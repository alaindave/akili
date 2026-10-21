// Maintenance/test loader: use the authoritative TypeScript contracts without
// requiring the unfinished application refactor to compile first.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const nodeRequire = createRequire(import.meta.url);
const cache = new Map();
export default function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInThisContext(`(function(module,exports,require){${code}\n})`, { filename: file })(
    module, module.exports, name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts'))) : nodeRequire(name));
  cache.set(file, module.exports);
  return module.exports;
}
