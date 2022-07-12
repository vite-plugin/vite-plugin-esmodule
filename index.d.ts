import type { Plugin } from 'vite';
import type { Configuration } from 'webpack';

export default esmodule;
declare const esmodule: Esmodule;

export interface Esmodule {
  (
    /**
     * If modules are not passed in, ESM packages will be automatically obtained from package.json in process.cwd path
     */
    modules?: (string | { [module: string]: string })[],
    webpack?: ((config: Configuration) => Configuration | void | Promise<Configuration | void>),
  ): Plugin;
}
