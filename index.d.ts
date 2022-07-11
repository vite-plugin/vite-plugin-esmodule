import type { Plugin } from 'vite';
import type { Configuration } from 'webpack';

export default esmodule;
declare const esmodule: Esmodule;

export type RecordModule = string | { [module: string]: string }

export interface Options {
  modules?:
  | RecordModule[]
  | ((esmPkgs: string[]) => RecordModule[]);
  webpack?:
  | Configuration
  | ((config: Configuration) => Configuration | void | Promise<Configuration | void>);
}

export interface Esmodule {
  (options?: Options): Plugin;
}
