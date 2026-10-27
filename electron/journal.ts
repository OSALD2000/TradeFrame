import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

import type { SetupInput } from './capture-types';

export function validateSetup(input: unknown): SetupInput {
  if (!input || typeof input !== 'object') throw new Error('Invalid setup');
  const data = input as Record<string, unknown>;
  const text = (key: string, max: number, required = true) => {
    const value = data[key];
    if (typeof value !== 'string' || value.length > max || value.includes('\0')
      || (required && !value.trim())) throw new Error(`Invalid ${key}`);
    return value.trim();
  };
  if (data.mode !== 'live' && data.mode !== 'backtest') throw new Error('Invalid mode');
  if (data.direction !== 'long' && data.direction !== 'short') throw new Error('Invalid direction');
  const entryTimeNewYork = text('entryTimeNewYork', 16, false);
  if (entryTimeNewYork) {
    const date = new Date(`${entryTimeNewYork}:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(entryTimeNewYork)
      || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== entryTimeNewYork) {
      throw new Error('Invalid New York entry time');
    }
  }
  return { mode: data.mode, direction: data.direction, symbol: text('symbol', 80),
    model: text('model', 120), timeframe: text('timeframe', 40),
    entryTimeNewYork, note: text('note', 20000, false) };
}

export async function writeSetup(folder: string, setup: SetupInput, image: string): Promise<string> {
  if (!image.startsWith('data:image/png;base64,')) throw new Error('Invalid screenshot');
  const png = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64');
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('Invalid screenshot');
  }
  const createdAt = new Date().toISOString();
  // shortcut: saves are not crash-atomic; stage and rename before adding journal readers.
  const directory = await mkdtemp(path.join(folder, `setup-${createdAt.replace(/[:.]/g, '-')}-`));
  const fields = { schemaVersion: 1, createdAt, mode: setup.mode, symbol: setup.symbol,
    direction: setup.direction, model: setup.model, timeframe: setup.timeframe,
    entryTimeNewYork: setup.entryTimeNewYork || null, entryTimeZone: 'America/New_York' };
  const markdown = `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n# Setup\n\n![Chart](chart.png)\n\n## Notes\n\n${setup.note}\n`;
  try {
    await writeFile(path.join(directory, 'chart.png'), png, { flag: 'wx' });
    await writeFile(path.join(directory, 'setup.md'), markdown, { flag: 'wx' });
    return path.join(directory, 'setup.md');
  } catch (error) {
    // Remove only the new directory owned by this save, never existing setups.
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
