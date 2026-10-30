const fs = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const [scenario, fixtureFile, action] = process.argv.slice(2);
const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
const filename = path.resolve(__dirname, '../../dist-electron/append-store.js');
const injected = new Module(filename, module);
injected.filename = filename;
injected.paths = module.paths;
injected.require = function (name) {
  if (name !== 'node:fs/promises') return Module.prototype.require.call(this, name);
  return { ...fs,
    link: async (source, target) => {
      await fs.link(source, target);
      if (!target.endsWith('.tradeframe-write.lock')) return;
      if (scenario === 'prepared') process.exit(71);
      if (scenario === 'active') {
        setInterval(() => {}, 1000);
        process.stdin.resume();
        await new Promise(() => {});
      }
    },
    appendFile: async (file, addition, options) => {
      if (scenario === 'partial') {
        await fs.appendFile(file, addition.subarray(0, Math.max(1, Math.floor(addition.length / 2))), options);
        process.exit(71);
      }
      await fs.appendFile(file, addition, options);
      if (scenario === 'committed') process.exit(71);
    },
  };
};
injected._compile(readFileSync(filename, 'utf8'), filename);
injected.loaded = true;
require.cache[filename] = injected;

(async () => {
  if (action === 'copy') await require('../../dist-electron/connections.js').copySnapshot(fixture.source, fixture.target);
  else {
    const { readSetup, appendScreenshots } = require('../../dist-electron/journal.js');
    const loaded = await readSetup(fixture.file);
    await appendScreenshots(fixture.file, loaded.fingerprint, fixture.input, [...loaded.screenshots, fixture.screenshot]);
  }
})().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
