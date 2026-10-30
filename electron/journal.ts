import { mkdtemp, writeFile, appendFile, rm, readFile, lstat, open } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

import type { SetupInput, Screenshot } from './capture-types';
import { validateSchema, validateValues, emptyValues, serializeSetup, deserializeSetup, validateScreenshots, screenshotFile, screenshotAddition } from './form-schema';

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
    file: screenshotFile(index), caption: shot.caption, capturedAt: shot.capturedAt,
  })));
  const images = screenshots.map((shot) => pngBytes(shot.image));
  if (images.reduce((sum, png) => sum + png.length, 0) > 128_000_000) throw new Error('Screenshots exceed 128 MB');
  const createdAt = new Date().toISOString();
  const markdown = serializeSetup({ ...validated, createdAt, screenshots: references });
  // Write Markdown last: it is the completion marker for this immutable snapshot.
  const directory = await mkdtemp(path.join(folder, `setup-${createdAt.replace(/[:.]/g, '-')}-`));
  try {
    for (let index = 0; index < images.length; index++) {
      await writeFile(path.join(directory, references[index].file), images[index], { flag: 'wx' });
    }
    await writeFile(path.join(directory, 'setup.md'), markdown, { flag: 'wx' });
    return path.join(directory, 'setup.md');
  } catch (error) {
    // Remove only the new directory owned by this save, never existing setups.
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function readSetup(file: string): Promise<SetupInput & { screenshots: Screenshot[]; fingerprint: string }> {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 5_000_000) throw new Error('Invalid setup file or image');
  const markdown = await readFile(file, 'utf8');
  const hash = createHash('sha256').update(markdown);
  const document = deserializeSetup(markdown);
  const references = document.screenshots ?? [{ file: 'chart.png', caption: '', capturedAt: document.createdAt }];
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
    screenshots.push({ id: `opened-${index}`, image, caption: reference.caption, capturedAt: reference.capturedAt });
  }
  return { schema: document.schema, values: document.values, screenshots, fingerprint: hash.digest('hex') };
}

export async function appendScreenshots(file: string, fingerprint: string, setup: SetupInput, screenshots: Screenshot[]): Promise<string> {
  const lockFile = path.join(path.dirname(file), '.tradeframe-write.lock');
  const lock = await open(lockFile, 'wx', 0o600);
  const addedFiles: string[] = [];
  let appending = false;
  try {
    const original = await readSetup(file);
    const validated = validateSetup(setup);
    if (original.fingerprint !== fingerprint) throw new Error('The saved setup changed. Reopen it before adding screenshots.');
    const originalValues = validateValues(original.schema, { ...emptyValues(original.schema), ...original.values });
    if (JSON.stringify(original.schema) !== JSON.stringify(validated.schema) || JSON.stringify(originalValues) !== JSON.stringify(validated.values)) {
      throw new Error('Use Save copy to keep changes to the existing setup fields.');
    }
    const references = validateScreenshots(screenshots.map((shot, index) => ({ file: screenshotFile(index), caption: shot.caption, capturedAt: shot.capturedAt })));
    if (screenshots.length <= original.screenshots.length) throw new Error('Capture another screenshot before adding to this file.');
    for (const [index, shot] of original.screenshots.entries()) {
      const current = screenshots[index];
      if (current.image !== shot.image || current.caption !== shot.caption || current.capturedAt !== shot.capturedAt) {
        throw new Error('Existing screenshots must stay unchanged. Use Save copy instead.');
      }
    }
    const bytes = screenshots.map((shot) => pngBytes(shot.image));
    if (bytes.reduce((sum, image) => sum + image.length, 0) > 128_000_000) throw new Error('Screenshots exceed 128 MB');
    const markdown = await readFile(file, 'utf8');
    const addition = references.slice(original.screenshots.length).map((shot, index) => screenshotAddition(shot, original.screenshots.length + index)).join('');
    deserializeSetup(markdown + addition);
    const backup = `${file}.${randomUUID()}.bak`;
    await writeFile(backup, markdown, { flag: 'wx', flush: true });
    for (let index = original.screenshots.length; index < screenshots.length; index++) {
      const target = path.join(path.dirname(file), references[index].file);
      try { await writeFile(target, bytes[index], { flag: 'wx', flush: true }); addedFiles.push(target); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const info = await lstat(target);
        if (!info.isFile() || info.isSymbolicLink() || info.size !== bytes[index].length || !(await readFile(target)).equals(bytes[index])) throw error;
      }
    }
    if ((await readSetup(file)).fingerprint !== fingerprint) throw new Error('The setup changed while saving. Reopen it and retry.');
    // Append instead of rewriting so existing text survives even an interrupted write.
    appending = true;
    await appendFile(file, addition, { flush: true });
    return backup;
  } catch (error) {
    if (!appending) for (const target of addedFiles) await rm(target, { force: true });
    throw error;
  } finally { await lock.close(); await rm(lockFile, { force: true }); }
}
