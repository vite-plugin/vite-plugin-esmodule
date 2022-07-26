import type { Plugin } from 'vite'
import type { Configuration } from 'webpack'

export type ModuleRecord = string | { [module: string]: string }

declare function exports(
  modules: ModuleRecord[] | ((esmPkgs: string[]) => ModuleRecord[]),
  webpack?: ((config: Configuration) => Configuration | void | Promise<Configuration | void>),
): Plugin

export = exports
