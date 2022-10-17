declare module 'vite-plugin-esmodule' {
  import type { Configuration } from 'webpack'

  type ModuleRecord = string | { [module: string]: string }

  function esmodule(
    modules: ModuleRecord[] | ((esmPkgs: string[]) => ModuleRecord[]),
    webpack?: ((config: Configuration) => Configuration | void | Promise<Configuration | void>),
  ): import('vite').Plugin

  // https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-d-ts.html#default-exports
  export = esmodule
}
