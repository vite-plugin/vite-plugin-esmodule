process.env.NODE_ENV = 'test-mjs';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const assert = require('assert').strict;
const vite = require('vite');
const esmodule = require('vite-plugin-esmodule');
const test = esmodule.__test__;
const moduleName = 'file-type';
const node_modules = path.join(__dirname, '../node_modules');
const __snapshots__ = path.join(__dirname, '__snapshots__');

fs.rmSync(__snapshots__, { recursive: true, force: true });
fs.mkdirSync(__snapshots__, { recursive: true });

; (async () => {
  await vite.build({
    root: __dirname,
    build: {
      outDir: '',
      minify: false,
      emptyOutDir: false,
      lib: {
        entry: '-.js',
        formats: ['es', /* 'cjs' */],
        fileName: format => format === 'es' ? '[name].mjs' : '[name].cjs',
      },
      rollupOptions: {
        external: /__snapshots__/,
      },
    },
    plugins: [
      esmodule([moduleName]),
    ],
    resolve: {
      alias: { 'file-type': './__snapshots__/index.electron-renderer.mjs' },
    },
  });
  preTest();
  runTest();
})();

function preTest() {
  const destdir = path.join(node_modules, test.CACHE_DIR);
  /**
   * @type {(options: import('vite-plugin-optimizer').OptimizerArgs, ...args: Parameters<import('vite-plugin-esmodule')>) => void}
   */
  const writeElectronRendererServeESM = test.writeElectronRendererServeESM;
  writeElectronRendererServeESM({ dir: destdir }, [moduleName]);

  const { electronRendererId } = test.getModuleId('');
  fs.writeFileSync(
    path.join(__snapshots__, electronRendererId.replace('.js', '.mjs')),
    `import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\n`
    +
    fs.readFileSync(path.join(node_modules, test.CACHE_DIR, moduleName, electronRendererId), 'utf8'),
  );
}

function runTest() {
  const child = cp.spawn('node', ['./-.mjs'], { cwd: __dirname });
  child.stdout.on('data', chunk => {
    const str = chunk.toString().trim();
    assert.equal(str, '[AsyncFunction: fileTypeFromFile]');
    console.log('test success');
  });
}
