# vite-plugin-esmodule

Build ES module to CommonJs module for Node.js/Electron

[![NPM version](https://img.shields.io/npm/v/vite-plugin-esmodule.svg?style=flat)](https://npmjs.org/package/vite-plugin-esmodule)
[![NPM Downloads](https://img.shields.io/npm/dm/vite-plugin-esmodule.svg?style=flat)](https://npmjs.org/package/vite-plugin-esmodule)

## Why 🤔

When using ES modules(e.g.`node-fetch`) in Node.js/Electron projects, we may need to compile them into CommonJs modules to ensure they work correctly.

*在 Node.js/Electron 项目中使用 ES 模块时(e.g. `node-fetch`)，我们可能需要将其编译成 CommonJs 模块，以确保它们能够正常工作*

## Install

```sh
npm i vite-plugin-esmodule -D
```

## Usage

vite.config.js

```js
import esmodule from 'vite-plugin-esmodule'

export default {
  plugins: [
    // Take `execa`, `node-fetch` and `file-type` as examples
    esmodule([
      'execa',
      'node-fetch',

      // 🌱 this means that you have explicit specified the entry file
      { 'file-type': 'file-type/index.js' },
    ]),
  ],
}
```

execa.js

```js
import {execa} from 'execa';

const {stdout} = await execa('echo', ['unicorns']);
console.log(stdout);
//=> 'unicorns'
```

[👉 See test](https://github.com/vite-plugin/vite-plugin-esmodule/test)

## API

```ts
export interface Esmodule {
  (
    /**
     * If modules are not passed in, ESM packages will be automatically obtained from package.json in process.cwd path
     */
    modules?: (string | { [module: string]: string })[],
    webpack?: ((config: Configuration) => Configuration | void | Promise<Configuration | void>),
  ): Plugin;
}
```

## How to work

This plugin just wraps [vite-plugin-optimizer](https://github.com/vite-plugin/vite-plugin-optimizer)
