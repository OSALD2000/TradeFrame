const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

test(
  'a project import cannot authorize reading an outside file with the same root-relative path',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { createServer, isFileServingAllowed, normalizePath } = await import('vite');
    const temporary = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-dev-server-')),
    );
    t.after(() => fs.rm(temporary, { recursive: true, force: true }));
    const project = path.join(temporary, 'project');
    const outside = path.join(temporary, 'private.js');
    const publicFile = path.join(project, outside.slice(1));
    await fs.mkdir(path.dirname(publicFile), { recursive: true });
    await fs.writeFile(outside, 'export default "synthetic private content";');
    await fs.writeFile(publicFile, 'export default "synthetic public content";');
    await fs.writeFile(
      path.join(project, 'main.js'),
      `import value from ${JSON.stringify('./' + normalizePath(path.relative(project, publicFile)))}; console.log(value);`,
    );
    const server = await createServer({
      root: project,
      configFile: false,
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true, include: [] },
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
        fs: { strict: true, allow: [project] },
      },
    });
    t.after(() => server.close());
    assert.equal(isFileServingAllowed(server.config, outside), false);
    assert.ok((await server.transformRequest('/main.js')).code.includes('console.log'));
    assert.equal(isFileServingAllowed(server.config, publicFile), true);
    assert.equal(isFileServingAllowed(server.config, outside), false);
    assert.equal(await fs.readFile(outside, 'utf8'), 'export default "synthetic private content";');
  },
);
