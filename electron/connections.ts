import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { mkdir, lstat, readFile, rm, realpath } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { deserializeSetup } from './form-schema';
import { readSetup, pngBytes } from './journal';
import { appendDocument, createFile, recoverAppend } from './append-store';
import type { FolderKind, SyncJob, Connections } from './capture-types';

export function folderKind(value: unknown): asserts value is FolderKind {
  if (!['journal', 'obsidian', 'dropbox'].includes(String(value))) throw new Error('Invalid connection');
}

function validPath(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 4096 && !value.includes('\0') && path.isAbsolute(value);
}

function validateConnections(input: unknown): Connections {
  const data = input as Connections;
  if (!data || data.version !== 1 || !data.folders || !Array.isArray(data.jobs)
    || !['journal', 'obsidian', 'dropbox'].every((kind) => {
      const folder = data.folders[kind as FolderKind];
      return folder === null || validPath(folder);
    }) || data.jobs.length > 1000) throw new Error('Invalid connections file');
  for (const job of data.jobs) {
    if (!job || typeof job.id !== 'string' || !['obsidian', 'dropbox', 'onenote'].includes(job.kind)
      || !validPath(job.source) || (job.kind === 'onenote' ? job.section !== 'TradeFrame' : !validPath(job.folder)) || !['pending', 'synced', 'failed'].includes(job.status)
      || (job.error !== null && typeof job.error !== 'string')) throw new Error('Invalid sync job');
  }
  return data;
}

export class ConnectionStore {
  private data: Connections;
  constructor(private file: string) {
    try { this.data = validateConnections(JSON.parse(readFileSync(file, 'utf8'))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.data = { version: 1, folders: { journal: null, obsidian: null, dropbox: null }, jobs: [] };
    }
  }
  get(): Connections { return structuredClone(this.data); }
  private commit(next: Connections) {
    validateConnections(next);
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(next, null, 2), { flag: 'wx', mode: 0o600 });
      renameSync(temporary, this.file);
      this.data = next;
    } finally { rmSync(temporary, { force: true }); }
  }
  setFolder(kind: FolderKind, folder: string | null) {
    folderKind(kind);
    if (folder !== null && !validPath(folder)) throw new Error('Invalid connection folder');
    const next = this.get();
    next.folders[kind] = folder;
    // Disconnecting or replacing a target also cancels its outstanding deliveries.
    next.jobs = next.jobs.filter((job) => job.kind !== kind || job.status === 'synced');
    this.commit(next);
    return this.get();
  }
  enqueue(source: string, oneNoteSection?: string): SyncJob[] {
    if (!validPath(source)) throw new Error('Invalid saved setup');
    const next = this.get();
    const jobs: SyncJob[] = (['obsidian', 'dropbox'] as const).flatMap((kind) => next.folders[kind]
      ? [{ id: randomUUID(), kind, source, folder: next.folders[kind]!, status: 'pending' as const, error: null }] : []);
    if (oneNoteSection) jobs.push({ id: randomUUID(), kind: 'onenote', section: oneNoteSection, source, status: 'pending', error: null });
    next.jobs = [...next.jobs.filter((job) => job.status !== 'synced'), ...next.jobs.filter((job) => job.status === 'synced').slice(-50), ...jobs];
    this.commit(next);
    return jobs;
  }
  cancelOneNote() {
    const next = this.get();
    next.jobs = next.jobs.filter((job) => job.kind !== 'onenote' || job.status === 'synced');
    this.commit(next);
  }
  async retry(ids?: string[], deliverOneNote?: (source: string, section: string, id: string) => Promise<void>): Promise<SyncJob[]> {
    const jobs = this.data.jobs.filter((job) => job.status !== 'synced' && (!ids || ids.includes(job.id)));
    const results: SyncJob[] = [];
    for (const job of jobs) {
      let status: SyncJob['status'] = 'synced';
      let error: string | null = null;
      try {
        if (job.kind === 'onenote') {
          if (!deliverOneNote) throw new Error('OneNote is not connected');
          await deliverOneNote(job.source, job.section, job.id);
        } else await copySnapshot(job.source, path.join(job.folder, 'TradeFrame'));
      } catch {
        status = 'failed'; error = job.kind === 'onenote' ? 'Could not sync OneNote. Check your sign-in, connection and setup size, then retry.'
          : 'Could not sync. Check folder access, available space, and conflicting files, then retry.';
      }
      const next = this.get();
      const updated = { ...job, status, error };
      next.jobs = next.jobs.map((item) => item.id === job.id ? updated : item);
      this.commit(next);
      results.push(updated);
    }
    return results;
  }
}

export async function copySnapshot(source: string, targetRoot: string): Promise<string> {
  const loaded = await readSetup(source);
  const markdown = loaded.markdown;
  const document = deserializeSetup(markdown);
  const parent = path.basename(path.dirname(source));
  const name = /^setup-[A-Za-z0-9_.-]{1,120}$/.test(parent) ? parent : `setup-import-${createHash('sha256').update(source).digest('hex').slice(0, 20)}`;
  // Targets must already exist; a removed/unmounted destination must not be recreated elsewhere.
  const root = await realpath(path.dirname(targetRoot));
  if (root !== path.dirname(targetRoot)) throw new Error('Connection folder moved');
  await mkdir(targetRoot, { recursive: true });
  if (!(await lstat(targetRoot)).isDirectory() || (await lstat(targetRoot)).isSymbolicLink()) throw new Error('Invalid sync folder');
  const target = path.join(targetRoot, name);
  const files = loaded.screenshots.map((shot, index) => ({
    name: document.screenshots?.[index].file ?? 'chart.png', bytes: pngBytes(shot.image),
  }));
  files.push({ name: 'setup.md', bytes: Buffer.from(markdown) });
  let created = false;
  try {
    try { await mkdir(target); created = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const info = await lstat(target);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid sync target');
    await recoverAppend(path.join(target, 'setup.md'));
    const missing = [];
    let markdownAddition: Buffer | null = null;
    let previousMarkdown: Buffer | null = null;
    // Compare the entire snapshot before writing; never replace an externally edited file.
    for (const file of files) {
      const destination = path.join(target, file.name);
      try {
        const info = await lstat(destination);
        if (!info.isFile() || info.isSymbolicLink() || info.size > file.bytes.length) throw new Error('Sync conflict');
        const existing = await readFile(destination);
        if (existing.equals(file.bytes)) continue;
        if (file.name !== 'setup.md' || !file.bytes.subarray(0, existing.length).equals(existing)) throw new Error('Sync conflict');
        const earlier = deserializeSetup(existing.toString('utf8'));
        const suffix = file.bytes.subarray(existing.length);
        if (!suffix.toString('utf8').startsWith('\n<!-- tradeframe-screenshot: ') || (earlier.screenshots?.length ?? 1) >= loaded.screenshots.length) throw new Error('Sync conflict');
        markdownAddition = suffix;
        previousMarkdown = existing;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        missing.push(file);
      }
    }
    if (markdownAddition) {
      const oldCount = deserializeSetup(previousMarkdown!.toString('utf8')).screenshots?.length ?? 1;
      for (const image of files.slice(0, oldCount)) {
        if (missing.includes(image)) await createFile(path.join(target, image.name), image.bytes);
      }
      await appendDocument(path.join(target, 'setup.md'), previousMarkdown!, markdownAddition, files.slice(0, -1));
    } else for (const file of missing) await createFile(path.join(target, file.name), file.bytes);
    return path.join(target, 'setup.md');
  } catch (error) {
    if (created) await rm(target, { recursive: true, force: true });
    throw error;
  }
}
