import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const _M_ = require("./index.js");
export const fileTypeFromBuffer = _M_.fileTypeFromBuffer;
export const fileTypeFromFile = _M_.fileTypeFromFile;
export const fileTypeFromStream = _M_.fileTypeFromStream;
export const fileTypeFromTokenizer = _M_.fileTypeFromTokenizer;
export const fileTypeStream = _M_.fileTypeStream;
export const supportedExtensions = _M_.supportedExtensions;
export const supportedMimeTypes = _M_.supportedMimeTypes;
export const keyword_default = _M_.default || _M_;
export {
  keyword_default as default,
};