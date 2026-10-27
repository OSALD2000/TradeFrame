import { mkdtemp, writeFile, rm, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';

import type { SetupInput } from './capture-types';
import { validateSchema, validateValues, serializeSetup, deserializeSetup } from './form-schema';

export function validateSetup(input: unknown): SetupInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid setup');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some((key) => key !== 'schema' && key !== 'values')) throw new Error('Unknown setup property');
  const schema = validateSchema(data.schema);
  return { schema, values: validateValues(schema, data.values) };
}

function pngBytes(image: string): Buffer {
  if (image.length > 45_000_000 || !image.startsWith('data:image/png;base64,')) throw new Error('Invalid screenshot');
  const png = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64');
  if (png.length > 32_000_000 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid screenshot');
  return png;
}

export async function writeSetup(folder: string, setup: SetupInput, image: string): Promise<string> {
  const validated = validateSetup(setup);
  const png = pngBytes(image);
  const createdAt = new Date().toISOString();
  const markdown = serializeSetup({ ...validated, createdAt });
  // shortcut: saves are not crash-atomic; stage and rename before adding journal readers.
  const directory = await mkdtemp(path.join(folder, `setup-${createdAt.replace(/[:.]/g, '-')}-`));
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

export async function readSetup(file: string): Promise<SetupInput & { image: string }> {
  const imageFile = path.join(path.dirname(file), 'chart.png');
  for (const [target, limit] of [[file, 5_000_000], [imageFile, 32_000_000]] as const) {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink() || info.size > limit) throw new Error('Invalid setup file or image');
  }
  const markdown = await readFile(file, 'utf8');
  const document = deserializeSetup(markdown);
  const png = await readFile(imageFile);
  const image = `data:image/png;base64,${png.toString('base64')}`;
  pngBytes(image);
  return { schema: document.schema, values: document.values, image };
}
