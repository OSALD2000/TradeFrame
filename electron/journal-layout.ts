import { mkdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { directionLabel, journalValues } from './form-schema';
import type { SetupDocument } from './form-schema';

export function calendarPath(document: SetupDocument): string[] | null {
  if (!document.journalId) return null;
  const info = journalValues(document.schema, document.values)!;
  return [info.mode === 'backtest' ? 'backtesting' : 'live', ...info.date.split('-')];
}

export function journalFilename(document: SetupDocument): string {
  const info = journalValues(document.schema, document.values)!;
  const safe = (value: string) => value.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[. ]+$/, '') || 'Setup';
  return `${info.date}${info.time ? ` ${info.time.replace(':', '')}` : ''} ${safe(info.instrument)} ${directionLabel(info.direction)} ${safe(info.model)}.md`;
}

export function safeNoteFilename(value: string): boolean {
  return value.length <= 220 && !/[<>:"/\\|?*\x00-\x1f\x7f]/.test(value) && value.endsWith('.md') && !/^[. ]/.test(value);
}

export async function journalDirectory(root: string, segments: string[]): Promise<string> {
  if (await realpath(root) !== root) throw new Error('Connection folder moved');
  let folder = root;
  for (const segment of segments) {
    if (!/^(?:TradeFrame|backtesting|live|[0-9]{4}|[0-9]{2})$/.test(segment)) throw new Error('Invalid journal directory');
    folder = path.join(folder, segment);
    try { await mkdir(folder); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const info = await lstat(folder);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid sync or journal folder');
  }
  return folder;
}
