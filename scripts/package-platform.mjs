import { readdir, rename, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export async function brandApp(staging, platform, version, run = execFileSync) {
  if (platform === 'linux') {
    await rename(path.join(staging, 'electron'), path.join(staging, 'tradeframe'));
    await writeFile(path.join(staging, 'tradeframe.desktop'), '[Desktop Entry]\nType=Application\nName=TradeFrame\nComment=Local-first trading journal\nExec=tradeframe\nIcon=tradeframe\nCategories=Office;Finance;\nTerminal=false\n');
    return path.join(staging, 'resources', 'app');
  }
  if (platform === 'win32') {
    await rename(path.join(staging, 'electron.exe'), path.join(staging, 'TradeFrame.exe'));
    try { await rename(path.join(staging, 'electron_wer.dll'), path.join(staging, 'TradeFrame_wer.dll')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return path.join(staging, 'resources', 'app');
  }
  if (platform !== 'darwin') throw new Error('Unsupported package platform');
  const bundle = path.join(staging, 'Electron.app');
  function setPlist(plist, values) {
    for (const [key, value] of Object.entries(values)) {
      try { run('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist], { stdio: 'pipe' }); }
      catch { run('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist]); }
    }
  }
  setPlist(path.join(bundle, 'Contents', 'Info.plist'), { CFBundleName: 'TradeFrame', CFBundleDisplayName: 'TradeFrame',
    CFBundleIdentifier: 'io.github.osald2000.tradeframe', CFBundleShortVersionString: version, CFBundleVersion: version,
    NSScreenCaptureUsageDescription: 'TradeFrame captures charts only when you request a screenshot.' });
  const frameworks = path.join(bundle, 'Contents', 'Frameworks');
  for (const name of await readdir(frameworks)) {
    const helper = /^Electron Helper(?: \(([^)]+)\))?\.app$/.exec(name);
    if (!helper) continue;
    const label = `TradeFrame Helper${helper[1] ? ` (${helper[1]})` : ''}`;
    setPlist(path.join(frameworks, name, 'Contents', 'Info.plist'), { CFBundleName: label, CFBundleDisplayName: label,
      CFBundleIdentifier: `io.github.osald2000.tradeframe.helper${helper[1] ? `.${helper[1].toLowerCase()}` : ''}` });
  }
  const renamed = path.join(staging, 'TradeFrame.app');
  await rename(bundle, renamed);
  // Ad-hoc signing permits local testing; public notarization needs the owner's Apple identity.
  run('codesign', ['--force', '--deep', '--sign', '-', renamed]);
  return path.join(renamed, 'Contents', 'Resources', 'app');
}
