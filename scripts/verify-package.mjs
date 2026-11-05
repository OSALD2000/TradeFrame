import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const { version } = manifest;
const directory = path.join(
  root,
  'release',
  `TradeFrame-${version}-${process.platform}-${process.arch}`,
);
const application =
  process.platform === 'darwin'
    ? path.join(directory, 'TradeFrame.app', 'Contents', 'Resources', 'app')
    : path.join(directory, 'resources', 'app');
const executable =
  process.platform === 'darwin'
    ? path.join(directory, 'TradeFrame.app', 'Contents', 'MacOS', 'Electron')
    : path.join(directory, process.platform === 'win32' ? 'TradeFrame.exe' : 'tradeframe');
await access(executable);
await access(path.join(application, 'dist', 'index.html'));
const projectLicense = await readFile(path.join(root, 'LICENSE.md'), 'utf8');
for (const file of [path.join(directory, 'LICENSE.md'), path.join(application, 'LICENSE.md')])
  assert.equal(
    await readFile(file, 'utf8').catch(() => null),
    projectLicense,
    `TradeFrame license is missing or differs: ${file}`,
  );
assert.equal(
  JSON.parse(await readFile(path.join(application, 'package.json'), 'utf8')).license,
  manifest.license,
  'Packaged license metadata differs from package.json',
);
const script = [
  '(async () => {',
  "const assert = require('node:assert/strict'); const path = require('node:path');",
  `assert.equal(process.platform, ${JSON.stringify(process.platform)}); assert.equal(process.arch, ${JSON.stringify(process.arch)});`,
  `assert.equal(process.versions.electron, ${JSON.stringify(manifest.devDependencies.electron)}, 'Packaged Electron version does not match package.json');`,
  `const { SchemaStore } = require(path.join(${JSON.stringify(application)}, 'dist-electron', 'schema-store.js'));`,
  "const store = new SchemaStore(':memory:'); assert.ok(store.list().some(form => form.id === 'journal')); store.close();",
  `assert.equal(typeof require(path.join(${JSON.stringify(application)}, 'dist-electron', 'journal.js')).writeSetup, 'function');`,
  `const { findChartBounds, validateCrop } = require(path.join(${JSON.stringify(application)}, 'dist-electron', 'chart-crop.js'));`,
  "assert.equal(typeof findChartBounds, 'function'); assert.deepEqual(validateCrop({x: 0, y: 0, width: 1, height: 1}, 1, 1), {x: 0, y: 0, width: 1, height: 1});",
  `assert.equal(typeof require(path.join(${JSON.stringify(application)}, 'dist-electron', 'onenote.js')).OneNoteClient.prototype.openSetup, 'function');`,
  `const configuration = require(path.join(${JSON.stringify(application)}, 'dist-electron', 'integrations.json'));`,
  `assert.equal(configuration.microsoftClientId, ${JSON.stringify(process.env.TRADEFRAME_MICROSOFT_CLIENT_ID?.trim() || manifest.config?.microsoftClientId || '')});`,
  "const fs = require('node:fs'); const os = require('node:os');",
  "const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tradeframe-runtime-publisher-'));",
  'try {',
  `const { OneNoteClient } = require(path.join(${JSON.stringify(application)}, 'dist-electron', 'onenote.js'));`,
  "const client = new OneNoteClient(profile, {}, configuration.microsoftClientId, async () => { throw new Error('Startup must not authenticate'); });",
  'const state = await client.getState();',
  'assert.equal(state.configured, !!configuration.microsoftClientId); assert.equal(state.customApplicationId, false); assert.equal(state.connected, false);',
  'assert.deepEqual(fs.readdirSync(profile), []);',
  '} finally { fs.rmSync(profile, { recursive: true, force: true }); }',
  `const {validTimeframe} = require(path.join(${JSON.stringify(application)}, 'dist-electron', 'form-schema.js')); assert.ok(validTimeframe('2m'));`,
  "console.log('Packaged runtime and SQLite verified:', process.platform, process.arch, process.versions.electron);",
  "console.log('Packaged publisher configuration and clean-profile sign-in readiness verified');",
  '})().catch(error => { console.error(error); process.exitCode = 1; });',
].join('\n');
// Run only the embedded Node runtime, without opening a journal, window, or account.
execFileSync(executable, ['-e', script], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit',
});
