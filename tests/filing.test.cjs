const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { FilingStore } = require('../dist-electron/filing-store');
const {
  DEFAULT_FILING_RULES,
  FILING_EXAMPLE,
  filingPath,
  validateFilingRule,
  safeFilingSegment,
} = require('../dist-electron/filing-rules');
const { writeSetup, readSetup, appendScreenshots } = require('../dist-electron/journal');
const { copySnapshot } = require('../dist-electron/connections');
const {
  JOURNAL_SCHEMA,
  deserializeSetup,
  serializeSetup,
} = require('../dist-electron/form-schema');
const input = {
  schema: JOURNAL_SCHEMA,
  values: {
    mode: 'backtest',
    date: '2025-01-07',
    time_ny: '09:34',
    session: 'NY AM',
    symbol: 'TEST!',
    direction: 'short',
    model: 'Example',
    d_bias: '',
    result: 'win',
    r: 2,
    note: 'Synthetic summary',
  },
};
const shot = {
  id: 'synthetic',
  image:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  timeframe: '1m',
  caption: 'Synthetic explanation',
  capturedAt: '2026-01-02T12:00:00.000Z',
};
const rules = () => ({
  journal: {
    root: '',
    folders: ['instrument', 'year', 'month'],
    name: ['date', 'session', 'instrument', 'model'],
    separator: ' ',
  },
  obsidian: {
    root: 'Trading',
    folders: ['mode', 'year', 'month', 'day', 'instrument'],
    name: ['date', 'instrument', 'model'],
    separator: ' - ',
  },
  dropbox: { root: '', folders: ['year', 'month'], name: ['instrument', 'date'], separator: '_' },
});
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-filing-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('filing blocks are ordered, portable and bounded before any path is used', () => {
  assert.deepEqual(filingPath(validateFilingRule(rules().obsidian), FILING_EXAMPLE), {
    segments: ['Trading', 'backtesting', '2026', '11', '01', 'EURUSD'],
    filename: '2026-11-01 - EURUSD - FVG.md',
  });
  for (const root of [
    '..',
    '../outside',
    '/absolute',
    'a\\b',
    'CON',
    'LPT1.txt',
    '.obsidian',
    'trailing.',
    'x'.repeat(81),
  ])
    assert.throws(() => validateFilingRule({ ...rules().journal, root }));
  for (const patch of [
    { folders: ['unknown'] },
    { name: [] },
    { name: ['date', 'date'] },
    { separator: '/' },
    { unknown: true },
  ])
    assert.throws(() => validateFilingRule({ ...rules().journal, ...patch }));
  assert.equal(safeFilingSegment('a/b:c'), 'a-b-c');
  assert.equal(safeFilingSegment('CON.txt'), '_CON.txt');
  assert.equal(safeFilingSegment('..'), 'Untitled');
  for (const value of ['界'.repeat(200), '🕯'.repeat(100)]) {
    const name = safeFilingSegment(value, 196);
    assert.ok(Buffer.byteLength(name) <= 240);
    assert.doesNotMatch(name, /[\uD800-\uDBFF]$/);
  }
});

test('filing preferences are independent snapshots and invalid updates preserve the saved file', async (t) => {
  const root = await fixture(t);
  const file = path.join(root, 'preferences.json');
  const store = new FilingStore(file);
  assert.equal(store.snapshot(), null);
  assert.deepEqual(store.get(), DEFAULT_FILING_RULES);
  await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  store.set('obsidian', rules().obsidian);
  const saved = await fs.readFile(file, 'utf8');
  const snapshot = store.snapshot();
  snapshot.obsidian.root = 'Changed in memory';
  assert.equal(store.get().obsidian.root, 'Trading');
  assert.deepEqual(store.get().journal, DEFAULT_FILING_RULES.journal);
  assert.deepEqual(new FilingStore(file).get(), store.get());
  assert.throws(() => store.set('obsidian', { ...rules().obsidian, root: '../escape' }));
  assert.equal(await fs.readFile(file, 'utf8'), saved);
  await fs.writeFile(file, '{malformed');
  assert.throws(() => new FilingStore(file));
  assert.equal(await fs.readFile(file, 'utf8'), '{malformed');
});

test('format 6 pins each destination rule and appends retain the original paths and image bytes', async (t) => {
  const root = await fixture(t);
  const journal = path.join(root, 'journal');
  const vault = path.join(root, 'vault');
  const dropbox = path.join(root, 'dropbox');
  await Promise.all([journal, vault, dropbox].map((folder) => fs.mkdir(folder)));
  const originalRules = rules();
  const file = await writeSetup(journal, input, [shot], originalRules);
  assert.equal(
    path.relative(journal, file),
    path.join('TEST!', '2025', '01', '2025-01-07 NY AM TEST! Example.md'),
  );
  const loaded = await readSetup(file);
  const document = deserializeSetup(loaded.markdown);
  assert.equal(document.schemaVersion, 6);
  assert.deepEqual(document.filing, originalRules);
  assert.equal(serializeSetup(document), loaded.markdown);
  const target = await copySnapshot(file, path.join(vault, 'TradeFrame'), 'obsidian');
  assert.equal(
    path.relative(vault, target),
    path.join(
      'Trading',
      'backtesting',
      '2025',
      '01',
      '07',
      'TEST!',
      '2025-01-07 - TEST! - Example.md',
    ),
  );
  await assert.rejects(fs.stat(path.join(vault, 'TradeFrame')), { code: 'ENOENT' });
  const cloud = await copySnapshot(file, path.join(dropbox, 'TradeFrame'), 'dropbox');
  assert.equal(path.relative(dropbox, cloud), path.join('2025', '01', 'TEST!_2025-01-07.md'));
  const store = new FilingStore(path.join(root, 'filing.json'));
  store.set('obsidian', { ...originalRules.obsidian, root: 'Later rules' });
  await appendScreenshots(file, loaded.fingerprint, input, [
    shot,
    { ...shot, id: 'follow-up', timeframe: '2m', caption: 'Follow-up' },
  ]);
  assert.equal(await copySnapshot(file, path.join(vault, 'TradeFrame'), 'obsidian'), target);
  assert.equal(await fs.readFile(target, 'utf8'), await fs.readFile(file, 'utf8'));
  const updated = await readSetup(target);
  assert.equal(updated.screenshots.length, 2);
  assert.equal(updated.screenshots[1].image, shot.image);
  assert.deepEqual(deserializeSetup(updated.markdown).filing, originalRules);
});

test('destination name collisions remain independent and a missing earlier number cannot relocate a follow-up', async (t) => {
  const root = await fixture(t);
  const journal = path.join(root, 'journal');
  const vault = path.join(root, 'vault');
  await fs.mkdir(journal);
  await fs.mkdir(vault);
  const first = await writeSetup(journal, input, [shot], rules());
  const second = await writeSetup(journal, input, [shot], rules());
  const one = await copySnapshot(first, path.join(vault, 'TradeFrame'));
  const two = await copySnapshot(second, path.join(vault, 'TradeFrame'));
  assert.notEqual(one, two);
  assert.match(two, / \(2\)\.md$/);
  await fs.unlink(one);
  const loaded = await readSetup(second);
  await appendScreenshots(second, loaded.fingerprint, input, [shot, { ...shot, timeframe: '2m' }]);
  assert.equal(await copySnapshot(second, path.join(vault, 'TradeFrame')), two);
  const external = (await fs.readFile(two, 'utf8')) + '\nExternal note edit\n';
  await fs.writeFile(two, external);
  await assert.rejects(copySnapshot(second, path.join(vault, 'TradeFrame')), /Sync conflict/);
  assert.equal(await fs.readFile(two, 'utf8'), external);
  const editedHeader = external.replace(/^tradeframe:.*$/m, 'tradeframe: {}');
  await fs.writeFile(two, editedHeader);
  await assert.rejects(copySnapshot(second, path.join(vault, 'TradeFrame')), /Sync conflict/);
  assert.equal(await fs.readFile(two, 'utf8'), editedHeader);
  const changedIdentity = external.replace(
    /"journalId":"[^"]+"/,
    '"journalId":"11111111-1111-4111-8111-111111111111"',
  );
  assert.notEqual(changedIdentity, external);
  await fs.writeFile(two, changedIdentity);
  await assert.rejects(copySnapshot(second, path.join(vault, 'TradeFrame')), /Sync conflict/);
  assert.equal(await fs.readFile(two, 'utf8'), changedIdentity);
  await fs.writeFile(two, 'x'.repeat(5_000_001));
  await assert.rejects(
    copySnapshot(second, path.join(vault, 'TradeFrame')),
    /Invalid sync note size/,
  );
  assert.equal((await fs.stat(two)).size, 5_000_001);
  await assert.rejects(fs.stat(one), { code: 'ENOENT' });
});

test('custom filing rejects malformed snapshots and symlink directory segments', async (t) => {
  const root = await fixture(t);
  const source = await writeSetup(root, input, [shot], rules());
  const text = await fs.readFile(source, 'utf8');
  assert.throws(() => deserializeSetup(text.replace('"root":"Trading"', '"root":"../outside"')));
  assert.throws(() => deserializeSetup(text.replace('schemaVersion: 6', 'schemaVersion: 5')));
  const vault = path.join(root, 'vault');
  const external = path.join(root, 'external');
  await fs.mkdir(vault);
  await fs.mkdir(external);
  await fs.symlink(
    external,
    path.join(vault, 'Trading'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(
    copySnapshot(source, path.join(vault, 'TradeFrame')),
    /Invalid sync or journal folder/,
  );
  assert.deepEqual(await fs.readdir(external), []);
});

test('configured destination names avoid collisions that differ only by letter case', async (t) => {
  const root = await fixture(t);
  const vault = path.join(root, 'vault');
  await fs.mkdir(vault);
  const custom = rules();
  custom.obsidian.folders = [];
  custom.obsidian.name = ['instrument'];
  const one = await writeSetup(root, input, [shot], custom);
  const two = await writeSetup(
    root,
    { ...input, values: { ...input.values, symbol: 'test!' } },
    [shot],
    custom,
  );
  const first = await copySnapshot(one, path.join(vault, 'TradeFrame'));
  const second = await copySnapshot(two, path.join(vault, 'TradeFrame'));
  assert.equal(path.basename(first), 'TEST!.md');
  assert.equal(path.basename(second), 'test! (2).md');
  assert.notEqual(
    deserializeSetup(await fs.readFile(first, 'utf8')).journalId,
    deserializeSetup(await fs.readFile(second, 'utf8')).journalId,
  );
});
