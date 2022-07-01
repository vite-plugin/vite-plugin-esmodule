import type { Plugin, UserConfig } from 'vite';
import type { Configuration } from 'webpack';

export default esmodule;
declare const esmodule: Esmodule;

export interface Esmodule {
  (
    modules: (string | { [module: string]: string })[],
    options?: {
      webpack?:
      | Configuration
      | ((config: Configuration) => Configuration | void | Promise<Configuration | void>);
    },
  ): Plugin[];
}
