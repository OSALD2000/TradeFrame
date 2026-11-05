const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

for (const platform of ['linux', 'win32', 'darwin'])
  test(`packaging preserves the application resource path after ${platform} branding`, async (t) => {
    const { brandApp } = await import('../scripts/package-platform.mjs');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-package with spaces-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const app =
      platform === 'darwin'
        ? path.join(root, 'Electron.app', 'Contents', 'Resources', 'app')
        : path.join(root, 'resources', 'app');
    await fs.mkdir(app, { recursive: true });
    await fs.writeFile(
      path.join(app, 'package.json'),
      JSON.stringify({ name: 'tradeframe', version: '0.3.1' }),
    );
    if (platform === 'darwin') {
      await fs.writeFile(
        path.join(root, 'Electron.app', 'Contents', 'Info.plist'),
        'Synthetic plist',
      );
      for (const name of ['Electron Helper.app', 'Electron Helper (Renderer).app']) {
        const helper = path.join(root, 'Electron.app', 'Contents', 'Frameworks', name, 'Contents');
        await fs.mkdir(helper, { recursive: true });
        await fs.writeFile(path.join(helper, 'Info.plist'), 'Synthetic helper plist');
      }
    } else
      await fs.writeFile(
        path.join(root, platform === 'win32' ? 'electron.exe' : 'electron'),
        'Synthetic executable',
      );
    if (platform === 'win32')
      await fs.writeFile(path.join(root, 'electron_wer.dll'), 'Synthetic crash helper');
    const calls = [];
    const result = await brandApp(root, platform, '0.3.1', (command, args) => {
      calls.push([command, args]);
      assert.ok(
        require('node:fs').existsSync(args.at(-1)),
        'Native tools must receive the existing renamed bundle/plist path',
      );
      if (args[1]?.startsWith('Set :NSScreenCaptureUsageDescription'))
        throw new Error('Synthetic missing plist key');
    });
    assert.equal(
      JSON.parse(await fs.readFile(path.join(result, 'package.json'), 'utf8')).version,
      '0.3.1',
    );
    if (platform === 'darwin') {
      assert.ok(result.includes('TradeFrame.app'));
      await assert.rejects(fs.stat(path.join(root, 'Electron.app')), { code: 'ENOENT' });
      assert.equal(calls.at(-1)[0], 'codesign');
      assert.ok(
        calls.some(([, args]) =>
          args[1]?.startsWith('Add :NSScreenCaptureUsageDescription string'),
        ),
      );
      assert.ok(
        calls.some(
          ([, args]) =>
            args[1] === 'Set :CFBundleIdentifier io.github.osald2000.tradeframe.helper.renderer',
        ),
      );
    } else {
      await fs.stat(path.join(root, platform === 'win32' ? 'TradeFrame.exe' : 'tradeframe'));
      if (platform === 'win32') await fs.stat(path.join(root, 'TradeFrame_wer.dll'));
    }
  });

test('package verification rejects a Node executable masquerading as the pinned Electron runtime', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-wrong-runtime-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(
    root,
    'release',
    `TradeFrame-0.0.0-${process.platform}-${process.arch}`,
  );
  const application =
    process.platform === 'darwin'
      ? path.join(directory, 'TradeFrame.app', 'Contents', 'Resources', 'app')
      : path.join(directory, 'resources', 'app');
  const executable =
    process.platform === 'darwin'
      ? path.join(directory, 'TradeFrame.app', 'Contents', 'MacOS', 'Electron')
      : path.join(directory, process.platform === 'win32' ? 'TradeFrame.exe' : 'tradeframe');
  await fs.mkdir(path.dirname(executable), { recursive: true });
  await fs.copyFile(process.execPath, executable);
  await fs.chmod(executable, 0o755);
  await fs.mkdir(path.join(application, 'dist'), { recursive: true });
  await fs.writeFile(path.join(application, 'dist', 'index.html'), 'Synthetic renderer');
  await fs.cp(
    path.resolve(__dirname, '../dist-electron'),
    path.join(application, 'dist-electron'),
    {
      recursive: true,
    },
  );
  await fs.writeFile(
    path.join(application, 'dist-electron', 'integrations.json'),
    JSON.stringify({ microsoftClientId: '' }),
  );
  await fs.writeFile(path.join(root, 'LICENSE.md'), 'Synthetic project license');
  await fs.writeFile(path.join(directory, 'LICENSE.md'), 'Synthetic project license');
  await fs.writeFile(path.join(application, 'LICENSE.md'), 'Synthetic project license');
  await fs.writeFile(
    path.join(application, 'package.json'),
    JSON.stringify({ license: 'SEE LICENSE IN LICENSE.md' }),
  );
  await fs.mkdir(path.join(root, 'scripts'));
  const verifier = path.join(root, 'scripts', 'verify-package.mjs');
  await fs.copyFile(path.resolve(__dirname, '../scripts/verify-package.mjs'), verifier);
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      version: '0.0.0',
      license: 'SEE LICENSE IN LICENSE.md',
      devDependencies: { electron: '99.0.0' },
    }),
  );
  const result = await new Promise((resolve, reject) => {
    const child = require('node:child_process').spawn(process.execPath, [verifier], {
      env: { ...process.env, TRADEFRAME_MICROSOFT_CLIENT_ID: '' },
    });
    let stderr = '';
    child.stdout.resume();
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stderr }));
  });
  assert.notEqual(result.status, 0, 'A plain Node runtime must not pass Electron verification');
  assert.match(result.stderr, /Packaged Electron version does not match package.json/);
});

test('package verification rejects a missing or changed TradeFrame license before launching a runtime', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-license-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(
    root,
    'release',
    `TradeFrame-0.0.0-${process.platform}-${process.arch}`,
  );
  const application =
    process.platform === 'darwin'
      ? path.join(directory, 'TradeFrame.app', 'Contents', 'Resources', 'app')
      : path.join(directory, 'resources', 'app');
  const executable =
    process.platform === 'darwin'
      ? path.join(directory, 'TradeFrame.app', 'Contents', 'MacOS', 'Electron')
      : path.join(directory, process.platform === 'win32' ? 'TradeFrame.exe' : 'tradeframe');
  await fs.mkdir(path.dirname(executable), { recursive: true });
  await fs.copyFile(process.execPath, executable);
  await fs.chmod(executable, 0o755);
  await fs.mkdir(path.join(application, 'dist'), { recursive: true });
  await fs.writeFile(path.join(application, 'dist', 'index.html'), 'Synthetic renderer');
  await fs.mkdir(path.join(root, 'scripts'));
  const verifier = path.join(root, 'scripts', 'verify-package.mjs');
  await fs.copyFile(path.resolve(__dirname, '../scripts/verify-package.mjs'), verifier);
  const manifest = {
    version: '0.0.0',
    license: 'SEE LICENSE IN LICENSE.md',
    devDependencies: { electron: '99.0.0' },
  };
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(manifest));
  await fs.writeFile(path.join(application, 'package.json'), JSON.stringify(manifest));
  const license = 'Synthetic project license for package boundary checks\n';
  await fs.writeFile(path.join(root, 'LICENSE.md'), license);
  await fs.writeFile(path.join(application, 'LICENSE.md'), license);
  for (const file of [path.join(directory, 'LICENSE.md'), path.join(application, 'LICENSE.md')]) {
    for (const content of [null, 'Changed license']) {
      await fs.writeFile(path.join(directory, 'LICENSE.md'), license);
      await fs.writeFile(path.join(application, 'LICENSE.md'), license);
      if (content === null) await fs.rm(file);
      else await fs.writeFile(file, content);
      const result = require('node:child_process').spawnSync(process.execPath, [verifier], {
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /TradeFrame license is missing or differs/);
      assert.doesNotMatch(result.stderr, /Packaged Electron version does not match/);
    }
  }
});
