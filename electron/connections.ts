import { createConnector } from './connector-factory';
import type { OneNoteDelivery } from './connector';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { FolderKind, SyncJob, Connections } from './capture-types';
import { validOneNoteId } from './capture-types';

export function folderKind(value: unknown): asserts value is FolderKind {
  if (!['journal', 'obsidian', 'dropbox'].includes(String(value)))
    throw new Error('Invalid connection');
}

function validPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 4096 &&
    !value.includes('\0') &&
    path.isAbsolute(value)
  );
}

function validateConnections(input: unknown): Connections {
  const data = input as Connections;
  if (
    !data ||
    ![1, 2].includes(data.version) ||
    !data.folders ||
    !Array.isArray(data.jobs) ||
    !['journal', 'obsidian', 'dropbox'].every((kind) => {
      const folder = data.folders[kind as FolderKind];
      return folder === null || validPath(folder);
    }) ||
    data.jobs.length > 1000
  )
    throw new Error('Invalid connections file');
  for (const job of data.jobs) {
    if (
      !job ||
      typeof job.id !== 'string' ||
      !['obsidian', 'dropbox', 'onenote'].includes(job.kind) ||
      !validPath(job.source) ||
      (job.kind === 'onenote' ? job.section !== 'TradeFrame' : !validPath(job.folder)) ||
      !['pending', 'synced', 'failed'].includes(job.status) ||
      (job.error !== null && typeof job.error !== 'string')
    )
      throw new Error('Invalid sync job');
    if (
      job.kind === 'onenote' &&
      job.notebookId !== undefined &&
      (data.version !== 2 || !validOneNoteId(job.notebookId))
    )
      throw new Error('Invalid OneNote notebook');
  }
  return data;
}

export class ConnectionStore {
  private data: Connections;
  constructor(private file: string) {
    try {
      this.data = validateConnections(JSON.parse(readFileSync(file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.data = {
        version: 2,
        folders: { journal: null, obsidian: null, dropbox: null },
        jobs: [],
      };
    }
  }
  get(): Connections {
    return structuredClone(this.data);
  }
  private commit(next: Connections) {
    next.version = 2;
    validateConnections(next);
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    if (this.data.version === 1) {
      try {
        writeFileSync(`${this.file}.v1.bak`, readFileSync(this.file), { flag: 'wx', mode: 0o600 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(next, null, 2), { flag: 'wx', mode: 0o600 });
      renameSync(temporary, this.file);
      this.data = next;
    } finally {
      rmSync(temporary, { force: true });
    }
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
  enqueue(
    source: string,
    oneNoteSection?: string,
    notebookId?: string,
    includeFolders = true,
  ): SyncJob[] {
    if (!validPath(source)) throw new Error('Invalid saved setup');
    if (notebookId !== undefined && (!oneNoteSection || !validOneNoteId(notebookId)))
      throw new Error('Invalid OneNote notebook');
    const next = this.get();
    const jobs: SyncJob[] = (['obsidian', 'dropbox'] as const).flatMap((kind) =>
      includeFolders && next.folders[kind]
        ? [
            {
              id: randomUUID(),
              kind,
              source,
              folder: next.folders[kind]!,
              status: 'pending' as const,
              error: null,
            },
          ]
        : [],
    );
    if (oneNoteSection)
      jobs.push({
        id: randomUUID(),
        kind: 'onenote',
        section: oneNoteSection,
        ...(notebookId ? { notebookId } : {}),
        source,
        status: 'pending',
        error: null,
      });
    next.jobs = [
      ...next.jobs.filter((job) => job.status !== 'synced'),
      ...next.jobs.filter((job) => job.status === 'synced').slice(-50),
      ...jobs,
    ];
    this.commit(next);
    return jobs;
  }
  cancelOneNote() {
    const next = this.get();
    next.jobs = next.jobs.filter((job) => job.kind !== 'onenote' || job.status === 'synced');
    this.commit(next);
  }
  async retry(ids?: string[], deliverOneNote?: OneNoteDelivery): Promise<SyncJob[]> {
    const jobs = this.data.jobs.filter(
      (job) => job.status !== 'synced' && (!ids || ids.includes(job.id)),
    );
    const results: SyncJob[] = [];
    for (const job of jobs) {
      const connector = createConnector(job, deliverOneNote);
      let status: SyncJob['status'] = 'synced';
      let error: string | null = null;
      try {
        await connector.deliver(job);
      } catch (cause) {
        status = 'failed';
        error = connector.failureMessage(cause);
      }
      const next = this.get();
      const updated = { ...job, status, error };
      next.jobs = next.jobs.map((item) => (item.id === job.id ? updated : item));
      this.commit(next);
      results.push(updated);
    }
    return results;
  }
}

export { copySnapshot } from './folder-connector';
