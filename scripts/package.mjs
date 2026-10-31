import { cp, mkdir, readFile, writeFile, rename, rm, access, chmod, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { brandApp } from './package-platform.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (process.env.GITHUB_REF_TYPE === 'tag') assert.equal(process.env.GITHUB_REF_NAME, `v${manifest.version}`, 'Release tag must match the application version');
const platform = process.platform;
assert(['linux', 'win32', 'darwin'].includes(platform), 'Package on Linux, Windows or macOS');
const name = `TradeFrame-${manifest.version}-${platform}-${process.arch}`;
const output = path.join(root, 'release');
await mkdir(output, { recursive: true });
const directory = path.join(output, name);
const archive = `${directory}${platform === 'linux' ? '.tar.gz' : '.zip'}`;
const debianArch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
const debian = platform === 'linux' && debianArch ? path.join(output, `TradeFrame-${manifest.version}-${debianArch}.deb`) : null;
for (const file of [directory, archive, ...(debian ? [debian] : [])]) {
  try { await access(file); throw new Error(`Move the previous package before building again: ${file}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const staging = path.join(output, `.packaging-${randomUUID()}`);
const electronDist = path.join(path.dirname(require.resolve('electron/package.json')), 'dist');
assert.equal((await readFile(path.join(electronDist, 'version'), 'utf8')).trim(), manifest.devDependencies.electron, 'Installed Electron differs from the reviewed version');
try {
  await cp(electronDist, staging, { recursive: true, verbatimSymlinks: true });
  let resources = path.join(staging, 'resources');
  if (platform === 'darwin') resources = path.join(staging, 'Electron.app', 'Contents', 'Resources');
  await rm(path.join(resources, 'default_app.asar'), { force: true });
  let application = path.join(resources, 'app');
  await mkdir(application);
  // Only compiled code and public metadata enter the distribution, never workspace data.
  await cp(path.join(root, 'dist'), path.join(application, 'dist'), { recursive: true });
  await mkdir(path.join(application, 'dist-electron'));
  for (const module of ['main', 'preload', 'capture-types', 'journal', 'form-schema', 'schema-store', 'connections', 'onenote', 'append-store']) {
    await cp(path.join(root, 'dist-electron', `${module}.js`), path.join(application, 'dist-electron', `${module}.js`));
  }
  await writeFile(path.join(application, 'package.json'), JSON.stringify({
    name: manifest.name, productName: 'TradeFrame', version: manifest.version,
    description: manifest.description, main: manifest.main, author: manifest.author,
  }, null, 2));
  const clientId = process.env.TRADEFRAME_MICROSOFT_CLIENT_ID ?? '';
  assert(!clientId || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId), 'Invalid public Microsoft application ID');
  await writeFile(path.join(application, 'dist-electron', 'integrations.json'), JSON.stringify({ microsoftClientId: clientId }));
  for (const document of ['README.md', 'README.de.md', 'GLOSSARY.md', 'AGENTS.md',
    'docs/RELEASE.md', 'docs/RELEASE_NOTES.md', 'docs/JOURNAL.md', 'docs/CAPTURE.md', 'docs/SYNC.md', 'docs/CONTEXT.md',
    'docs/ROADMAP.md', 'docs/DESIGN.md', 'docs/adr/0001-local-first-journal.md',
    'docs/adr/0002-versioned-form-schemas.md', 'docs/adr/0003-deliver-local-setups-to-independent-destinations.md']) {
    await mkdir(path.dirname(path.join(staging, document)), { recursive: true });
    await cp(path.join(root, document), path.join(staging, document));
  }
  let notices = 'TradeFrame bundles Electron; its LICENSE and LICENSES.chromium.html are included.\n';
  for (const dependency of ['react', 'react-dom', 'scheduler']) {
    notices += `\n${dependency}\n${await readFile(path.join(path.dirname(require.resolve(`${dependency}/package.json`)), 'LICENSE'), 'utf8')}\n`;
  }
  await writeFile(path.join(staging, 'THIRD_PARTY_NOTICES.txt'), notices);
  application = await brandApp(staging, platform, manifest.version);
  const packagedManifest = JSON.parse(await readFile(path.join(application, 'package.json'), 'utf8'));
  assert.equal(packagedManifest.main, 'dist-electron/main.js');
  await access(path.join(application, packagedManifest.main));
  await access(path.join(application, 'dist', 'index.html'));
  await rename(staging, directory);
  if (platform === 'linux') execFileSync('tar', ['--owner=0', '--group=0', '--numeric-owner', '-czf', archive, '-C', output, name], { stdio: 'inherit' });
  else if (platform === 'darwin') execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', directory, archive], { stdio: 'inherit' });
  else execFileSync('tar', ['-a', '-cf', archive, '-C', output, name], { stdio: 'inherit' });
  if (debian) {
    const debRoot = path.join(staging, 'deb');
    await mkdir(path.join(debRoot, 'DEBIAN'), { recursive: true });
    await mkdir(path.join(debRoot, 'opt'), { recursive: true });
    await cp(directory, path.join(debRoot, 'opt', 'tradeframe'), { recursive: true });
    await chmod(path.join(debRoot, 'opt', 'tradeframe', 'chrome-sandbox'), 0o4755);
    await mkdir(path.join(debRoot, 'usr', 'bin'), { recursive: true });
    await symlink('/opt/tradeframe/tradeframe', path.join(debRoot, 'usr', 'bin', 'tradeframe'));
    await mkdir(path.join(debRoot, 'usr', 'share', 'applications'), { recursive: true });
    await mkdir(path.join(debRoot, 'usr', 'share', 'pixmaps'), { recursive: true });
    await writeFile(path.join(debRoot, 'usr', 'share', 'applications', 'tradeframe.desktop'),
      '[Desktop Entry]\nType=Application\nName=TradeFrame\nComment=Local-first trading journal\nExec=/opt/tradeframe/tradeframe\nIcon=tradeframe\nCategories=Office;Finance;\nTerminal=false\n');
    await cp(path.join(root, 'dist', 'tradeframe-icon.png'), path.join(debRoot, 'usr', 'share', 'pixmaps', 'tradeframe.png'));
    await writeFile(path.join(debRoot, 'DEBIAN', 'control'), `Package: tradeframe\nVersion: ${manifest.version}\nArchitecture: ${debianArch}\nMaintainer: OSALD2000 <os14052020@gmail.com>\nSection: office\nPriority: optional\nDepends: libgtk-3-0 | libgtk-3-0t64, libnss3, libasound2 | libasound2t64, libgbm1, libxss1, libxtst6, libatk-bridge2.0-0 | libatk-bridge2.0-0t64, libdrm2, libxkbcommon0, xdg-utils\nDescription: Local-first desktop trading journal\n Capture charts and save setups as Markdown with optional connected destinations.\n`);
    execFileSync('dpkg-deb', ['--root-owner-group', '--build', debRoot, debian], { stdio: 'inherit' });
  }
  for (const artifact of [archive, ...(debian ? [debian] : [])]) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(artifact)) hash.update(chunk);
    await writeFile(`${artifact}.sha256`, `${hash.digest('hex')}  ${path.basename(artifact)}\n`);
  }
  console.log(`Download package: ${archive}\nChecksum: ${archive}.sha256`);
} finally { await rm(staging, { recursive: true, force: true }); }
