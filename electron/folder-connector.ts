import { mkdir, lstat, readFile, rm, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { deserializeSetup, journalValues } from './form-schema';
import { readSetup, pngBytes } from './journal';
import { appendDocument, createFile, recoverAppend } from './append-store';
import {
  calendarPath,
  journalDirectory,
  safeNoteFilename,
  destinationNoteFilename,
} from './journal-layout';
import { filingPath } from './filing-rules';
import type { FilingDestination } from './filing-rules';
import type { ConnectorDelivery, SetupConnector } from './connector';

export async function copySnapshot(
  source: string,
  targetRoot: string,
  kind: FilingDestination = 'obsidian',
): Promise<string> {
  const loaded = await readSetup(source);
  const markdown = loaded.markdown;
  const document = deserializeSetup(markdown);
  const parent = path.basename(path.dirname(source));
  const name = /^setup-[A-Za-z0-9_.-]{1,120}$/.test(parent)
    ? parent
    : `setup-import-${createHash('sha256').update(source).digest('hex').slice(0, 20)}`;
  // Targets must already exist; a removed/unmounted destination must not be recreated elsewhere.
  const root = await realpath(path.dirname(targetRoot));
  if (root !== path.dirname(targetRoot)) throw new Error('Connection folder moved');
  const custom = document.filing
    ? filingPath(document.filing[kind], journalValues(document.schema, document.values)!)
    : null;
  if (!custom) {
    await mkdir(targetRoot, { recursive: true });
    if (!(await lstat(targetRoot)).isDirectory() || (await lstat(targetRoot)).isSymbolicLink())
      throw new Error('Invalid sync folder');
  }
  const calendar = calendarPath(document);
  const target = custom
    ? await journalDirectory(root, custom.segments)
    : calendar
      ? await journalDirectory(root, [path.basename(targetRoot), ...calendar])
      : path.join(targetRoot, name);
  const filename = custom
    ? await destinationNoteFilename(target, custom.filename, document.journalId!)
    : calendar
      ? path.basename(source)
      : 'setup.md';
  if (!safeNoteFilename(filename)) throw new Error('Invalid sync note filename');
  const files = loaded.screenshots.map((shot, index) => ({
    name: document.screenshots?.[index].file ?? 'chart.png',
    bytes: pngBytes(shot.image),
  }));
  files.push({ name: filename, bytes: Buffer.from(markdown) });
  let created = false;
  try {
    try {
      await mkdir(target);
      created = !calendar;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const info = await lstat(target);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid sync target');
    await recoverAppend(path.join(target, filename));
    const missing = [];
    let markdownAddition: Buffer | null = null;
    let previousMarkdown: Buffer | null = null;
    // Compare the entire snapshot before writing; never replace an externally edited file.
    for (const file of files) {
      const destination = path.join(target, file.name);
      try {
        const info = await lstat(destination);
        if (!info.isFile() || info.isSymbolicLink() || info.size > file.bytes.length)
          throw new Error('Sync conflict');
        const existing = await readFile(destination);
        if (existing.equals(file.bytes)) continue;
        if (file.name !== filename || !file.bytes.subarray(0, existing.length).equals(existing))
          throw new Error('Sync conflict');
        const earlier = deserializeSetup(existing.toString('utf8'));
        const suffix = file.bytes.subarray(existing.length);
        if (
          !suffix.toString('utf8').startsWith('\n<!-- tradeframe-screenshot: ') ||
          (earlier.screenshots?.length ?? 1) >= loaded.screenshots.length
        )
          throw new Error('Sync conflict');
        markdownAddition = suffix;
        previousMarkdown = existing;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        missing.push(file);
      }
    }
    if (markdownAddition) {
      const oldCount =
        deserializeSetup(previousMarkdown!.toString('utf8')).screenshots?.length ?? 1;
      for (const image of files.slice(0, oldCount)) {
        if (missing.includes(image)) await createFile(path.join(target, image.name), image.bytes);
      }
      await appendDocument(
        path.join(target, filename),
        previousMarkdown!,
        markdownAddition,
        files.slice(0, -1),
      );
    } else for (const file of missing) await createFile(path.join(target, file.name), file.bytes);
    return path.join(target, filename);
  } catch (error) {
    if (created) await rm(target, { recursive: true, force: true });
    throw error;
  }
}

export class FolderConnector implements SetupConnector {
  constructor(
    private folder: string,
    private kind: FilingDestination = 'obsidian',
  ) {}
  deliver(delivery: ConnectorDelivery): Promise<string> {
    return copySnapshot(delivery.source, path.join(this.folder, 'TradeFrame'), this.kind);
  }
  failureMessage(): string {
    return 'Could not sync. Check folder access, available space, and conflicting files, then retry.';
  }
}
