import { mkdtemp, rm, readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import type { SetupInput, Screenshot } from './capture-types';
import { validateSchema, validateValues, emptyValues, serializeSetup, deserializeSetup, validateScreenshots, screenshotFile, screenshotAddition } from './form-schema';
import { appendDocument, createFile, recoverAppend } from './append-store';

export function validateSetup(input: unknown): SetupInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid setup');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some((key) => key !== 'schema' && key !== 'values')) throw new Error('Unknown setup property');
  const schema = validateSchema(data.schema);
  return { schema, values: validateValues(schema, data.values) };
}

export function pngBytes(image: string): Buffer {
  if (image.length > 45_000_000 || !image.startsWith('data:image/png;base64,')) throw new Error('Invalid screenshot');
  const png = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64');
  if (png.length > 32_000_000 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid screenshot');
  return png;
}

export async function writeSetup(folder: string, setup: SetupInput, screenshots: Screenshot[]): Promise<string> {
  const validated = validateSetup(setup);
  const references = validateScreenshots(screenshots.map((shot, index) => ({
    file: screenshotFile(index), caption: shot.caption, capturedAt: shot.capturedAt, timeframe: shot.timeframe,
  })), true);
  const images = screenshots.map((shot) => pngBytes(shot.image));
  if (images.reduce((sum, png) => sum + png.length, 0) > 128_000_000) throw new Error('Screenshots exceed 128 MB');
  const createdAt = new Date().toISOString();
  const markdown = serializeSetup({ ...validated, createdAt, screenshots: references });
  // Publish complete Markdown last: it is the completion marker for the new setup.
  const directory = await mkdtemp(path.join(folder, `setup-${createdAt.replace(/[:.]/g, '-')}-`));
  try {
    for (let index = 0; index < images.length; index++) {
      await createFile(path.join(directory, references[index].file), images[index]);
    }
    await createFile(path.join(directory, 'setup.md'), Buffer.from(markdown));
    return path.join(directory, 'setup.md');
  } catch (error) {
    // Remove only the new directory owned by this save, never existing setups.
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function readSetup(file: string): Promise<SetupInput & { screenshots: Screenshot[]; fingerprint: string; markdown: string; recoveredBackup: string | null }> {
  const recoveredBackup = await recoverAppend(file);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 5_000_000) throw new Error('Invalid setup file or image');
  const markdown = await readFile(file, 'utf8');
  const hash = createHash('sha256').update(markdown);
  const document = deserializeSetup(markdown);
  const references = document.screenshots ?? [{ file: 'chart.png', caption: '', capturedAt: document.createdAt, timeframe: undefined }];
  const screenshots: Screenshot[] = [];
  let totalBytes = 0;
  for (const [index, reference] of references.entries()) {
    const imageFile = path.join(path.dirname(file), reference.file);
    const imageInfo = await lstat(imageFile);
    totalBytes += imageInfo.size;
    if (!imageInfo.isFile() || imageInfo.isSymbolicLink() || imageInfo.size > 32_000_000 || totalBytes > 128_000_000) {
      throw new Error('Invalid setup file or image');
    }
    const bytes = await readFile(imageFile);
    hash.update(reference.file).update(bytes);
    const image = `data:image/png;base64,${bytes.toString('base64')}`;
    pngBytes(image);
    screenshots.push({ id: `opened-${index}`, image, caption: reference.caption, capturedAt: reference.capturedAt, timeframe: reference.timeframe ?? '' });
  }
  return { schema: document.schema, values: document.values, screenshots, fingerprint: hash.digest('hex'), markdown, recoveredBackup };
}

export async function appendScreenshots(file: string, fingerprint: string, setup: SetupInput, screenshots: Screenshot[]): Promise<string> {
  const original = await readSetup(file);
  if (original.screenshots.some((shot) => !shot.timeframe)) throw new Error('Choose each legacy screenshot timeframe and Save copy before appending');
  const validated = validateSetup(setup);
  if (original.fingerprint !== fingerprint && !original.recoveredBackup) throw new Error('The saved setup changed. Reopen it before adding screenshots.');
  const originalValues = validateValues(original.schema, { ...emptyValues(original.schema), ...original.values });
  if (JSON.stringify(original.schema) !== JSON.stringify(validated.schema) || JSON.stringify(originalValues) !== JSON.stringify(validated.values)) {
    throw new Error('Use Save copy to keep changes to the existing setup fields.');
  }
  const references = validateScreenshots(screenshots.map((shot, index) => ({ file: screenshotFile(index), caption: shot.caption, capturedAt: shot.capturedAt, timeframe: shot.timeframe })), true);
  if (screenshots.length < original.screenshots.length) throw new Error('The saved setup changed. Reopen it before adding screenshots.');
  for (const [index, shot] of original.screenshots.entries()) {
    const current = screenshots[index];
    if (current.image !== shot.image || current.caption !== shot.caption || current.capturedAt !== shot.capturedAt || current.timeframe !== shot.timeframe) {
      throw new Error('Existing screenshots must stay unchanged. Use Save copy instead.');
    }
  }
  if (screenshots.length === original.screenshots.length) {
    if (original.recoveredBackup) return original.recoveredBackup;
    throw new Error('Capture another screenshot before adding to this file.');
  }
  const bytes = screenshots.map((shot) => pngBytes(shot.image));
  if (bytes.reduce((sum, image) => sum + image.length, 0) > 128_000_000) throw new Error('Screenshots exceed 128 MB');
  const markdown = original.markdown;
  const addition = references.slice(original.screenshots.length).map((shot, index) => screenshotAddition(shot, original.screenshots.length + index)).join('');
  deserializeSetup(markdown + addition);
  return appendDocument(file, Buffer.from(markdown), Buffer.from(addition), bytes.map((bytes, index) => ({ name: references[index].file, bytes })));
}
