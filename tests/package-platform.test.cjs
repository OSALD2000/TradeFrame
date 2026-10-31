const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

for (const platform of ['linux', 'win32', 'darwin']) test(`packaging preserves the application resource path after ${platform} branding`, async (t) => {
  const { brandApp } = await import('../scripts/package-platform.mjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-package with spaces-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const app = platform === 'darwin' ? path.join(root, 'Electron.app', 'Contents', 'Resources', 'app') : path.join(root, 'resources', 'app');
  await fs.mkdir(app, { recursive: true });
  await fs.writeFile(path.join(app, 'package.json'), JSON.stringify({ name: 'tradeframe', version: '0.2.0' }));
  if (platform === 'darwin') {
    await fs.writeFile(path.join(root, 'Electron.app', 'Contents', 'Info.plist'), 'Synthetic plist');
    for (const name of ['Electron Helper.app', 'Electron Helper (Renderer).app']) {
      const helper = path.join(root, 'Electron.app', 'Contents', 'Frameworks', name, 'Contents');
      await fs.mkdir(helper, { recursive: true });
      await fs.writeFile(path.join(helper, 'Info.plist'), 'Synthetic helper plist');
    }
  }
  else await fs.writeFile(path.join(root, platform === 'win32' ? 'electron.exe' : 'electron'), 'Synthetic executable');
  if (platform === 'win32') await fs.writeFile(path.join(root, 'electron_wer.dll'), 'Synthetic crash helper');
  const calls = [];
  const result = await brandApp(root, platform, '0.2.0', (command, args) => {
    calls.push([command, args]);
    assert.ok(require('node:fs').existsSync(args.at(-1)), 'Native tools must receive the existing renamed bundle/plist path');
    if (args[1]?.startsWith('Set :NSScreenCaptureUsageDescription')) throw new Error('Synthetic missing plist key');
  });
  assert.equal(JSON.parse(await fs.readFile(path.join(result, 'package.json'), 'utf8')).version, '0.2.0');
  if (platform === 'darwin') {
    assert.ok(result.includes('TradeFrame.app'));
    await assert.rejects(fs.stat(path.join(root, 'Electron.app')), { code: 'ENOENT' });
    assert.equal(calls.at(-1)[0], 'codesign');
    assert.ok(calls.some(([, args]) => args[1]?.startsWith('Add :NSScreenCaptureUsageDescription string')));
    assert.ok(calls.some(([, args]) => args[1] === 'Set :CFBundleIdentifier io.github.osald2000.tradeframe.helper.renderer'));
  } else {
    await fs.stat(path.join(root, platform === 'win32' ? 'TradeFrame.exe' : 'tradeframe'));
    if (platform === 'win32') await fs.stat(path.join(root, 'TradeFrame_wer.dll'));
  }
});
