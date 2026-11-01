import { mkdir, lstat, realpath, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { directionLabel, journalValues } from './form-schema';
import { filingPath, safeFilingSegment } from './filing-rules';
import type { SetupDocument } from './form-schema';

export function calendarPath(document: SetupDocument): string[] | null {
  if (!document.journalId) return null;
  const info = journalValues(document.schema, document.values)!;
  if (document.filing) return filingPath(document.filing.journal, info).segments;
  return [info.mode === 'backtest' ? 'backtesting' : 'live', ...info.date.split('-')];
}

export function journalFilename(document: SetupDocument): string {
  const info = journalValues(document.schema, document.values)!;
  if (document.filing) return filingPath(document.filing.journal, info).filename;
  const safe = (value: string) =>
    value
      .normalize('NFC')
      .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
      .replace(/[. ]+$/, '') || 'Setup';
  return `${info.date}${info.time ? ` ${info.time.replace(':', '')}` : ''} ${safe(info.instrument)} ${directionLabel(info.direction)} ${safe(info.model)}.md`;
}

export function safeNoteFilename(value: string): boolean {
  return (
    value.length <= 220 &&
    !/[<>:"/\\|?*\x00-\x1f\x7f]/.test(value) &&
    value.endsWith('.md') &&
    !/^[. ]/.test(value)
  );
}

export async function journalDirectory(root: string, segments: string[]): Promise<string> {
  if ((await realpath(root)) !== root) throw new Error('Connection folder moved');
  let folder = root;
  for (const segment of segments) {
    if (segment.length > 80 || safeFilingSegment(segment) !== segment)
      throw new Error('Invalid journal directory');
    folder = path.join(folder, segment);
    try {
      await mkdir(folder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const info = await lstat(folder);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error('Invalid sync or journal folder');
  }
  return folder;
}

export async function destinationNoteFilename(
  directory: string,
  filename: string,
  journalId: string,
): Promise<string> {
  if (!safeNoteFilename(filename)) throw new Error('Invalid sync note filename');
  const names = new Map<string, string[]>();
  const portableName = (value: string) => value.normalize('NFC').toLowerCase();
  for (const name of await readdir(directory)) {
    const key = portableName(name);
    names.set(key, [...(names.get(key) ?? []), name]);
  }
  let available: string | undefined;
  let matching: string | undefined;
  for (let index = 1; index <= 1000; index++) {
    const candidate = index === 1 ? filename : `${filename.slice(0, -3)} (${index}).md`;
    const aliases = names.get(portableName(candidate));
    if (!aliases) {
      available ??= candidate;
      continue;
    }
    for (const actual of aliases) {
      const file = path.join(directory, actual);
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('Invalid sync note');
      if (info.size > 5_000_000) throw new Error('Invalid sync note size');
      const markdown = await readFile(file, 'utf8');
      const header = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(markdown);
      const metadata = header?.[1].split(/\r?\n/).find((line) => line.startsWith('tradeframe: '));
      let identity: unknown;
      try {
        // Identity lookup precedes content checks so edited notes still fail as conflicts.
        identity = metadata
          ? JSON.parse(metadata.slice('tradeframe: '.length)).journalId
          : undefined;
      } catch {
        identity = undefined;
      }
      if (identity !== journalId && markdown.includes(`chart-${journalId}-`)) identity = journalId;
      if (identity === journalId) {
        if (matching) throw new Error('Multiple matching sync notes');
        matching = actual;
      }
    }
  }
  if (matching) return matching;
  if (available) return available;
  throw new Error('Too many matching journal names');
}
