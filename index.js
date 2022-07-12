const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const optimizer = require('vite-plugin-optimizer');

const PLUGIN_NAME = 'vite-plugin-esmodule';
const CACHE_DIR = `.${PLUGIN_NAME}`;

/**
 * @type {import('.').Esmodule}
 */
module.exports = function esmodule(modules, options = {}) {
  /**
   * @type {import('vite').ConfigEnv}
   */
  let env;

  const plugin = optimizer(
    (modules || []).reduce((memo, mod, idx) => {
      if (typeof mod === 'object') {
        // e.g. { 'file-type': 'file-type/index.js' }
        mod = Object.keys(mod)[0];
      }
      return Object.assign(memo, {
        [mod]: async args => {
          const isDev = env.command === 'serve';
          const moduleCjsId = path.join(args.dir, mod, 'index.js');
          const moduleEsmId = path.join(args.dir, mod, 'index.electron-renderer.js');
          if (idx === modules.length - 1) { // One time build
            await buildESModules(args, modules, options);
            isDev && writeEsmModules(args, modules);
          }
          // return { alias: { find: mod } }; // Keep alias registration
          return {
            alias: {
              find: mod,
              replacement: isDev ? moduleEsmId : moduleCjsId,
            }
          };
        },
      })
    }, {}),
    { dir: CACHE_DIR },
  );

  plugin.name = PLUGIN_NAME;
  return [
    {
      name: `${PLUGIN_NAME}:init`,
      config(_, _env) {
        env = _env;
      },
    },
    plugin
  ];

  // return [
  //   {
  //     name: `${name}:resolve`,
  //     apply: 'build',
  //     enforce: 'pre',
  //     resolveId(source) {
  //       // Bypass Vite's `vite:resolve` plugin
  //       return modules.includes(source) ? source : null;
  //     },
  //   },
  //   plugin,
  // ];
};

/**
 * @type {(args: import('vite-plugin-optimizer').OptimizerArgs, ...args: Parameters<import('.').Esmodule>) => Promise<void>}
 */
async function buildESModules(args, modules, options) {
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
  if (typeof options.webpack === 'function') {
    config = options.webpack(config) || config;
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
function writeEsmModules(args, modules) {
  for (const mod of modules) {
    const moduleName = typeof mod === 'object' ? Object.keys(mod)[0] : mod
    const moduleCjsId = path.join(args.dir, moduleName, 'index.js');
    const moduleEsmId = path.join(args.dir, moduleName, 'index.electron-renderer.js');

    // 🚧 For Electron-Renderer
    const cjsModule = require(moduleCjsId);
    const requireModule = `const _M_ = require("${CACHE_DIR}/${moduleName}");`;
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
    fs.writeFileSync(moduleEsmId, esmModuleCodeSnippet);
  }
}
