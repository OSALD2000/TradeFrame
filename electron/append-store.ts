import { appendFile, link, lstat, mkdir, open, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { deserializeSetup, screenshotFile } from './form-schema';

type Image = { name: string; bytes: Buffer };
type PendingAppend = { version: 1; pid: number; file: string; operation: string; backup: string; originalHash: string;
  additionHash: string; previousCount: number; images: { name: string; hash: string }[] };
const lockName = '.tradeframe-write.lock';
const active = new Set<string>();
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export async function createFile(file: string, bytes: Buffer) {
  const temporary = path.join(path.dirname(file), `.tradeframe-file-${randomUUID()}`);
  const handle = await open(temporary, 'wx', 0o600);
  try {
    try { await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close(); }
    await link(temporary, file);
  } finally { await rm(temporary, { force: true }); }
}

async function removeStage(stage: string, images: string[]) {
  for (const name of ['original.md', 'addition.md', 'pending.json', ...images]) await rm(path.join(stage, name), { force: true });
  try { await rmdir(stage); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOTEMPTY') throw error; }
}

async function regularFile(file: string, limit: number): Promise<Buffer> {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > limit) throw new Error('Invalid append recovery file');
  const bytes = await readFile(file);
  if (bytes.length > limit) throw new Error('Append recovery file is too large');
  return bytes;
}

function validatePending(input: unknown, file: string): PendingAppend {
  const data = input as PendingAppend;
  const hash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  if (!data || data.version !== 1 || data.file !== path.basename(file)
    || !Number.isSafeInteger(data.pid) || data.pid <= 0
    || typeof data.operation !== 'string' || !/^\.tradeframe-append-[a-f0-9-]{36}$/.test(data.operation)
    || typeof data.backup !== 'string' || !data.backup.startsWith(`${data.file}.`)
    || !/^[a-f0-9-]{36}\.bak$/.test(data.backup.slice(data.file.length + 1))
    || !hash(data.originalHash) || !hash(data.additionHash)
    || !Number.isSafeInteger(data.previousCount) || data.previousCount < 1
    || !Array.isArray(data.images) || data.images.length <= data.previousCount || data.images.length > 20
    || data.images.some((image, index) => !image || image.name !== screenshotFile(index) || !hash(image.hash))) {
    throw new Error('Unrecognized append recovery record. Preserve the folder for inspection.');
  }
  return data;
}

function processAlive(pid: number) {
  // shortcut: local PID ownership; add host-aware leases before supporting journal writers across devices.
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}

async function finishAppend(file: string, pending: PendingAppend) {
  const directory = path.dirname(file);
  const operation = path.join(directory, pending.operation);
  const info = await lstat(operation);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid append recovery directory');
  const original = await regularFile(path.join(operation, 'original.md'), 5_000_000);
  const addition = await regularFile(path.join(operation, 'addition.md'), 5_000_000);
  if (digest(original) !== pending.originalHash || digest(addition) !== pending.additionHash) throw new Error('Append recovery data changed');
  const backup = path.join(directory, pending.backup);
  try {
    if (!(await regularFile(backup, 5_000_000)).equals(original)) throw new Error('Append backup changed');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await createFile(backup, original);
  }
  const previous = deserializeSetup(original.toString('utf8'));
  const complete = deserializeSetup(Buffer.concat([original, addition]).toString('utf8'));
  if ((previous.screenshots?.length ?? 1) !== pending.previousCount || complete.screenshots?.length !== pending.images.length) throw new Error('Invalid append recovery images');
  const suffix = async () => {
    const current = await regularFile(file, 5_000_000);
    if (current.length < original.length || current.length > original.length + addition.length
      || !current.subarray(0, original.length).equals(original)
      || !current.subarray(original.length).equals(addition.subarray(0, current.length - original.length))) {
      throw new Error('The setup changed outside TradeFrame. Recovery preserved all files.');
    }
    return addition.subarray(current.length - original.length);
  };
  await suffix();
  let total = 0;
  const missing: { staged: string; target: string }[] = [];
  for (const [index, image] of pending.images.entries()) {
    const target = path.join(directory, image.name);
    const source = index < pending.previousCount ? target : path.join(operation, image.name);
    const bytes = await regularFile(source, 32_000_000);
    total += bytes.length;
    if (total > 128_000_000 || digest(bytes) !== image.hash) throw new Error('Append image changed');
    if (index >= pending.previousCount) {
      try {
        if (!(await regularFile(target, 32_000_000)).equals(bytes)) throw new Error('Append image conflict');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        missing.push({ staged: source, target });
      }
    }
  }
  // Link complete staged PNGs exclusively; readers never see a half-written image.
  for (const image of missing) await link(image.staged, image.target);
  const remaining = await suffix();
  if (remaining.length) await appendFile(file, remaining, { flush: true });
  if ((await suffix()).length) throw new Error('Screenshot append did not finish');
  await rm(path.join(directory, lockName));
  await removeStage(operation, pending.images.slice(pending.previousCount).map((image) => image.name));
}

export async function recoverAppend(file: string): Promise<string | null> {
  const lock = path.join(path.dirname(file), lockName);
  let pending: PendingAppend;
  try { pending = validatePending(JSON.parse((await regularFile(lock, 20_000)).toString('utf8')), file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  if (active.has(path.resolve(file)) || (pending.pid !== process.pid && processAlive(pending.pid))) {
    throw new Error('This setup is being updated by another operation. Try again after it finishes.');
  }
  active.add(path.resolve(file));
  try { await finishAppend(file, pending); return path.join(path.dirname(file), pending.backup); }
  finally { active.delete(path.resolve(file)); }
}

export async function appendDocument(file: string, original: Buffer, addition: Buffer, images: Image[]): Promise<string> {
  await recoverAppend(file);
  const key = path.resolve(file);
  if (active.has(key)) throw new Error('This setup is already being updated');
  active.add(key);
  const directory = path.dirname(file);
  const operation = `.tradeframe-append-${randomUUID()}`;
  const stage = path.join(directory, operation);
  const backup = `${file}.${randomUUID()}.bak`;
  let published = false;
  let staged = false;
  try {
    const previous = deserializeSetup(original.toString('utf8'));
    const previousCount = previous.screenshots?.length ?? 1;
    const pending = validatePending({ version: 1, pid: process.pid, file: path.basename(file), operation, backup: path.basename(backup),
      originalHash: digest(original), additionHash: digest(addition), previousCount,
      images: images.map((image) => ({ name: image.name, hash: digest(image.bytes) })) }, file);
    const complete = deserializeSetup(Buffer.concat([original, addition]).toString('utf8'));
    if (complete.screenshots?.length !== images.length) throw new Error('Invalid append image count');
    if (!(await regularFile(file, 5_000_000)).equals(original)) throw new Error('The setup changed before appending');
    for (let index = 0; index < previousCount; index++) {
      if (!(await regularFile(path.join(directory, images[index].name), 32_000_000)).equals(images[index].bytes)) throw new Error('Existing screenshot changed');
    }
    await mkdir(stage, { mode: 0o700 });
    staged = true;
    await writeFile(path.join(stage, 'original.md'), original, { flag: 'wx', mode: 0o600, flush: true });
    await writeFile(path.join(stage, 'addition.md'), addition, { flag: 'wx', mode: 0o600, flush: true });
    for (const image of images.slice(previousCount)) {
      await writeFile(path.join(stage, image.name), image.bytes, { flag: 'wx', mode: 0o600, flush: true });
    }
    await writeFile(path.join(stage, 'pending.json'), JSON.stringify(pending), { flag: 'wx', mode: 0o600, flush: true });
    await writeFile(backup, original, { flag: 'wx', mode: 0o600, flush: true });
    // Publish only the complete intent; an interruption before this point changes no setup bytes.
    await link(path.join(stage, 'pending.json'), path.join(directory, lockName));
    published = true;
    await finishAppend(file, pending);
    return backup;
  } finally {
    active.delete(key);
    if (!published && staged) {
      const previousCount = deserializeSetup(original.toString('utf8')).screenshots?.length ?? 1;
      await removeStage(stage, images.slice(previousCount).map((image) => image.name));
    }
  }
}
