const fs = require('fs');
const path = require('path');
const vite = require('vite');
const esmodule = require('vite-plugin-esmodule');
const test = esmodule.__test__;

; (async () => {
  await vite.build({
    root: __dirname,
    build: {
      outDir: '',
      minify: false,
      emptyOutDir: false,
      lib: {
        entry: '-',
        formats: ['es'],
        fileName: () => '[name].mjs',
      },
      rollupOptions: {
        external: ['got'],
      },
    },
    plugins: [esmodule(['got'])],
  });
  runTest();
})();

function runTest() {
  const __snapshots__ = path.join(__dirname, '__snapshots__');
  const node_modules = path.join(__dirname, '../node_modules');
  const destdir = path.join(node_modules, test.CACHE_DIR);
  const modules = ['got'];
  fs.rmSync(__snapshots__, { recursive: true, force: true });

  /**
   * @type {(args: import('vite-plugin-optimizer').OptimizerArgs, ...args: Parameters<import('vite-plugin-esmodule')>) => Promise<void>}
   */
  const writeElectronRendererServeESM = test.writeElectronRendererServeESM;
  writeElectronRendererServeESM({ dir: destdir }, modules);

  for (const mod of modules) {
    const { cjsId, electronRendererId } = test.getModuleId(path.join(destdir, mod));
    const testCjsId = path.join(__snapshots__, cjsId.replace(destdir, ''));
    const testElectronRendererId = path.join(__snapshots__, electronRendererId.replace(destdir, ''));
    test.ensureDir(testCjsId);
    test.ensureDir(testElectronRendererId);
    fs.createReadStream(cjsId).pipe(fs.createWriteStream(testCjsId));
    fs.createReadStream(electronRendererId).pipe(fs.createWriteStream(testElectronRendererId));
  }
}
