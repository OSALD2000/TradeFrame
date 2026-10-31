import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const directory = path.join(root, 'release', `TradeFrame-${version}-${process.platform}-${process.arch}`);
const application = process.platform === 'darwin' ? path.join(directory, 'TradeFrame.app', 'Contents', 'Resources', 'app') : path.join(directory, 'resources', 'app');
const executable = process.platform === 'darwin' ? path.join(directory, 'TradeFrame.app', 'Contents', 'MacOS', 'Electron')
  : path.join(directory, process.platform === 'win32' ? 'TradeFrame.exe' : 'tradeframe');
await access(executable);
await access(path.join(application, 'dist', 'index.html'));
const script = [
  "const assert = require('node:assert/strict'); const path = require('node:path');",
  `assert.equal(process.platform, ${JSON.stringify(process.platform)}); assert.equal(process.arch, ${JSON.stringify(process.arch)});`,
  `const { SchemaStore } = require(path.join(${JSON.stringify(application)}, 'dist-electron', 'schema-store.js'));`,
  'const store = new SchemaStore(\':memory:\'); assert.ok(store.list().length); store.close();',
  `const {validTimeframe} = require(path.join(${JSON.stringify(application)}, 'dist-electron', 'form-schema.js')); assert.ok(validTimeframe('2m'));`,
  "console.log('Packaged runtime and SQLite verified:', process.platform, process.arch, process.versions.electron);",
].join('\n');
// Run only the embedded Node runtime, without opening a journal, window, or account.
execFileSync(executable, ['-e', script], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'inherit' });
