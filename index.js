const fs = require('fs');
const path = require('path');
const optimizer = require('vite-plugin-optimizer');
const libEsm = require('lib-esm').default;

const PLUGIN_NAME = 'vite-plugin-esmodule';
const TAG = `[${PLUGIN_NAME}]`;
const CACHE_DIR = `.${PLUGIN_NAME}`;

/**
 * @type {import('vite-plugin-esmodule')}
 */
function esmodule(modules, webpackFn) {
  try {
    require.resolve('webpack');
  } catch (error) {
    console.log(TAG, '"webpack" is a required dependency, make sure you have it installed?');
    return;
  }

  /**
   * @type {import('vite').ConfigEnv}
   */
  let env;
  const cwd = process.cwd();

  if (typeof modules === 'function') {
    // deps(ESM) of package.json
    const esmPkgs = [];

    // Resolve package.json dependencies and devDependencies
    const pkgId = lookupFile('package.json', [cwd]);
    if (pkgId) {
      const pkg = require(pkgId);
      const deps_devDeps = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}));
      for (const npmPkg of deps_devDeps) {
        const _pkgId = lookupFile(
          'package.json',
          [cwd].map(r => `${r}/node_modules/${npmPkg}`),
        );
        if (_pkgId) {
          const _pkg = require(_pkgId);
          if (_pkg.type === 'module') {
            esmPkgs.push(npmPkg);
          }
        }
      }
    }

    modules = modules(esmPkgs);
  }

  if (!Array.isArray(modules)) {
    throw new Error(`[vite-plugin-esmodule] esmodule(modules) expects an array, but got: ${modules}`);
  }

  /**
   * @type {import('vite').Plugin}
   */
  const plugin = optimizer(
    modules.reduce((memo, mod, idx) => {
      if (typeof mod === 'object') {
        // e.g. { 'file-type': 'file-type/index.js' }
        mod = Object.keys(mod)[0];
      }
      return Object.assign(memo, {
        [mod]: async args => {
          // At present, the use of ESM in the `vite serve` phase is considered Electron-Renderer
          // 目前，在 vite-serve 阶段使用 ESM 的场景，被认为是 Electron-Renderer
          const isElectronRendererServe = env.command === 'serve';
          const { cjsId, electronRendererId } = getModuleId(path.join(args.dir, mod));
          if (idx === modules.length - 1) { // One time build
            await buildESModules(args, modules, webpackFn);
            isElectronRendererServe && writeElectronRendererServeESM(args, modules);
          }
          // return { alias: { find: mod } }; // Keep alias registration
          return {
            alias: {
              find: mod,
              replacement: isElectronRendererServe ? electronRendererId : cjsId,
            }
          };
        },
      })
    }, {}),
    { dir: CACHE_DIR },
  );

  plugin.name = PLUGIN_NAME;
  const original = plugin.config;

  plugin.config = function conf(_config, _env) {
    env = _env;
    if (original) {
      return original(_config, _env);
    }
  };

  return plugin;
};

/**
 * @type {(args: import('vite-plugin-optimizer').OptimizerArgs, ...args: Parameters<import('vite-plugin-esmodule')>) => Promise<void>}
 */
async function buildESModules(
  args,
  modules,
  webpackFn,
) {
  await new Promise(async resolve => {
    const webpack = require('webpack');
    const config = await resolveWebpackConfig(
      modules,
      args.dir,
      webpackFn,
    );

    fs.rmSync(args.dir, { recursive: true, force: true });

    // Whey use Webpack?
    // Some ESM packages depend on CJS packages, which is rellay confusing.
    // In thes case, using Webpack is more reliable.
    webpack.webpack(config).run((error, stats) => {
      if (error) {
        logError(error);
      }
      if (stats.hasErrors()) {
        const errorMsg = stats.toJson().errors.map(msg => `
${msg.message}
${msg.stack}
`).join('\n');
        logError(errorMsg);
      }

      resolve(null);
      console.log(`\n[${PLUGIN_NAME}]`, modules, `build succeeded.\n`);
    });
  });
}

function logError(error, exit = true) {
  console.log(error);

  console.log(`\n[${PLUGIN_NAME}] build failed.\n`);
  exit && process.exit(1);
}

/**
 * @type {(options: import('vite-plugin-optimizer').OptimizerArgs, ...args: Parameters<import('vite-plugin-esmodule')>) => void}
 */
function writeElectronRendererServeESM(options, modules) {
  for (const mod of modules) {
    const moduleName = typeof mod === 'object' ? Object.keys(mod)[0] : mod
    const { cjsId, electronRendererId } = getModuleId(path.join(options.dir, moduleName));
    const result = libEsm({
      require: `${CACHE_DIR}/${moduleName}`,
      exports: Object.keys(require(cjsId)),
    });

    fs.writeFileSync(
      ensureDir(electronRendererId),
      `const _M_ = require("${CACHE_DIR}/${moduleName}");\n${result.exports}`,
      // 🐞 BUG in Electron-Renderer
      // `const _M_ = require("./index.js");\n${result.exports}`,
    );
  }
}

/**
 * @type {(dir: string) => { cjsId: string; electronRendererId: string; }}
 */
function getModuleId(dir) {
  return {
    cjsId: path.join(dir, 'index.js'),
    electronRendererId: path.join(dir, 'index.electron-renderer.js'),
  };
}

/**
 * @type {(filename: string, paths: string[]) => string | undefined}
 */
function lookupFile(filename, paths) {
  for (const p of paths) {
    const filepath = path.join(p, filename);
    if (fs.existsSync(filepath)) {
      return filepath;
    }
  }
}

function ensureDir(filename) {
  const dirname = path.dirname(filename);
  !fs.existsSync(dirname) && fs.mkdirSync(dirname, { recursive: true });
  return filename;
}

function modules2entries(modules) {
  return modules.reduce((memo, mod) => {
    const [key, val] = typeof mod === 'object' ? Object.entries(mod)[0] : [mod, mod];
    return Object.assign(memo, {
      // This is essentially an alias
      // e.g. { esm-pkg: 'node_modules/.vite-plugin-esmodule/esm-pkg.js' }
      [key]: require.resolve(val),
    });
  }, {});
}

/**
 * @type {(
 *   modules: Record<string, string>,
 *   outputPath: string,
 *   webpackFn: Parameters<import('vite-plugin-esmodule')>[1]
 * ) => Promise<import('webpack').Configuration>}
 */
function resolveWebpackConfig(
  modules,
  outputPath,
  webpackFn,
) {
  /**
   * @type {import('webpack').Configuration}
   */
  const config = {
    mode: 'none',
    target: 'node14',
    entry: modules2entries(modules),
    output: {
      library: {
        type: 'commonjs2',
      },
      path: outputPath,
      filename: '[name]/index.js',
    },
  };

  return typeof webpackFn === 'function' ? webpackFn(config) : config;
}

esmodule.__test__ = {
  CACHE_DIR,
  ensureDir,
  getModuleId,
  writeElectronRendererServeESM,
};

module.exports = esmodule;
