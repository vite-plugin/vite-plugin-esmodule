const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const optimizer = require('vite-plugin-optimizer');

const PLUGIN_NAME = 'vite-plugin-esmodule';
const CACHE_DIR = `.${PLUGIN_NAME}`;

/**
 * @type {import('.').Esmodule}
 */
module.exports = function esmodule(...args) {
  /**
   * @type {Parameters<import('.').Esmodule>[0] | undefined}
   */
  let modules;
  /**
   * @type {Parameters<import('.').Esmodule>[1] | undefined}
   */
  let webpackFn;
  /**
   * @type {import('vite').ConfigEnv}
   */
  let env;
  const cwd = process.cwd();

  if (args.length === 1) {
    if (Array.isArray(args[0])) {
      modules = args[0];
    } else if (typeof args[0] === 'function') {
      webpackFn = args[0];
    }
  } else if (args.length === 2) {
    modules = args[0];
    webpackFn = args[1];
  }

  // Set defalut value
  if (!modules) {
    // deps(ESM) of package.json
    modules = [];

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
            modules.push(npmPkg);
          }
        }
      }
    }
  }

  /**
   * @type {import('vite').Plugin}
   */
  const plugin = optimizer(
    (modules || []).reduce((memo, mod, idx) => {
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
 * @type {(args: import('vite-plugin-optimizer').OptimizerArgs, ...args: Parameters<import('.').Esmodule>) => Promise<void>}
 */
async function buildESModules(args, modules, webpackFn) {
  const entries = modules.reduce((memo, mod) => {
    const [key, val] = typeof mod === 'object' ? Object.entries(mod)[0] : [mod, mod];
    return Object.assign(memo, {
      // This is essentially an alias
      // e.g. { esm-pkg: 'node_modules/.vite-plugin-esmodule/esm-pkg.js' }
      [key]: require.resolve(val),
    });
  }, {});

  /**
   * @type {import('webpack').Configuration}
   */
  let config = {
    mode: 'none',
    target: 'node14',
    entry: entries,
    output: {
      library: {
        type: 'commonjs2',
      },
      path: args.dir,
      filename: '[name]/index.js',
    },
  };
  if (typeof webpackFn === 'function') {
    config = webpackFn(config) || config;
  }

  await new Promise(resolve => {
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
 * @type {(args: import('vite-plugin-optimizer').OptimizerArgs, ...args: Parameters<import('.').Esmodule>) => Promise<void>}
 */
function writeElectronRendererServeESM(args, modules) {
  for (const mod of modules) {
    const moduleName = typeof mod === 'object' ? Object.keys(mod)[0] : mod
    const { cjsId, electronRendererId } = getModuleId(path.join(args.dir, moduleName));

    // 🚧 For Electron-Renderer
    const cjsModule = require(cjsId);
    const requireModule = `const _M_ = require("${CACHE_DIR}/${mod}");`;
    const exportDefault = `const _D_ = _M_.default || _M_;\nexport { _D_ as default };`;
    const exportMembers = Object
      .keys(cjsModule)
      .filter(n => n !== 'default')
      .map(attr => `export const ${attr} = _M_.${attr};`).join('\n')
    const esmModuleCodeSnippet = `
${requireModule}
${exportDefault}
${exportMembers}
`.trim();
    fs.writeFileSync(electronRendererId, esmModuleCodeSnippet);
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
