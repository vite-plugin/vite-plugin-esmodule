process.env.NODE_ENV = 'test-mjs';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const vite = require('vite');
const esmodule = require('vite-plugin-esmodule');
const test = esmodule.__test__;
const modules = ['file-type'];

function __snapshots__id(id) {
  return {
    id: `./__snapshots__/${id}/index.js`,
    electronId: `./__snapshots__/${id}/index.electron-renderer.mjs`,
  };
}

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
        external: source => source.includes('__snapshots__'),
      },
    },
    plugins: [
      esmodule(modules),
      {
        name: 'rewrite-resolveId',
        enforce: 'pre',
        resolveId(source) {
          if (source.includes(test.CACHE_DIR)) {
            // /Absolute-path/node_modules/.vite-plugin-esmodule/file-type/index.js
            const [, relative] = source.split(test.CACHE_DIR);
            // file-type
            const name = path.dirname(relative).slice(1);
            const { id, electronId } = __snapshots__id(name);
            return electronId;
          }
        },
      },
    ],
  });
  preTest();
  runTest();
})();

function preTest() {
  const __snapshots__ = path.join(__dirname, '__snapshots__');
  const node_modules = path.join(__dirname, '../node_modules');
  const destdir = path.join(node_modules, test.CACHE_DIR);
  fs.rmSync(__snapshots__, { recursive: true, force: true });

  /**
   * @type {(options: import('vite-plugin-optimizer').OptimizerArgs, ...args: Parameters<import('vite-plugin-esmodule')>) => void}
   */
  const writeElectronRendererServeESM = test.writeElectronRendererServeESM;
  writeElectronRendererServeESM({ dir: destdir }, modules);

  for (const mod of modules) {
    const { cjsId, electronRendererId } = test.getModuleId(path.join(destdir, mod));
    const testCjsId = path.join(__snapshots__, cjsId.replace(destdir, ''));
    const testElectronRendererId = path.join(__snapshots__, electronRendererId.replace(destdir, ''));
    test.ensureDir(testCjsId);
    test.ensureDir(testElectronRendererId);
    fs.writeFileSync(testCjsId, fs.readFileSync(cjsId, 'utf8'));
    fs.writeFileSync(
      testElectronRendererId.replace('.js', '.mjs'),
      'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\n' +
      fs.readFileSync(electronRendererId, 'utf8'),
    );
  }
}

function runTest() {
  const child = cp.spawn('node', ['./-.mjs'], { cwd: __dirname });
  child.stdout.on('data', chunk => {
    const str = chunk.toString().trim();
    console.log('[test]', str);
    if (str === '[AsyncFunction: fileTypeFromFile]') {
      console.log('[test] success.');
    } else {
      throw new Error('[test] field!');
    }
  });
}
