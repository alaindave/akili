// Run with Node 20+: node scripts/check-electron-ipc.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

const root = path.resolve(__dirname, '../src/electron');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
);
const handlers = new Map();
const calls = [];
const registrations = new Set();
const registry = fs.readFileSync(path.join(root, 'registerIPCHandlers.ts'), 'utf8');

for (const file of walk(path.join(root, 'ipc')).concat(walk(path.join(root, 'preload')))) {
  if (!/\.(cts|tsx?)$/.test(file)) continue;
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text.startsWith('register')) {
      registrations.add(node.name.text);
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(source);
      const [channel, callback] = node.arguments;
      if (channel && ts.isStringLiteral(channel)) {
        if (expression === 'ipcMain.handle') {
          assert(!handlers.has(channel.text), `Duplicate IPC handler: ${channel.text}`);
          handlers.set(channel.text, Math.max(0, callback.parameters.length - 1));
        }
        if (file.includes(`${path.sep}preload${path.sep}`) && ['invoke', 'ipcRenderer.invoke'].includes(expression)) {
          calls.push({ channel: channel.text, count: node.arguments.length - 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
for (const { channel, count } of calls) {
  assert(handlers.has(channel), `Missing IPC handler: ${channel}`);
  assert.equal(count, handlers.get(channel), `IPC argument count mismatch: ${channel}`);
}
for (const name of registrations) {
  assert(new RegExp(`\\b${name}\\(\\)`).test(registry), `Unregistered IPC module: ${name}`);
}

// Execute the actual preload modules with an Electron stub. No app or database is opened.
const ipcRenderer = new EventEmitter();
const invocations = [];
ipcRenderer.invoke = (channel, ...args) => {
  invocations.push({ channel, args });
  return Promise.resolve();
};
let api;
const electron = {
  ipcRenderer,
  contextBridge: { exposeInMainWorld: (name, value) => {
    assert.equal(name, 'electron');
    api = value;
  } },
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier === 'electron') return electron;
    assert(specifier.startsWith('.'), `Unexpected preload dependency: ${specifier}`);
    return load(path.resolve(path.dirname(file), specifier.replace(/\.cjs$/, '.cts')));
  };
  vm.runInNewContext(code, { require: localRequire, module, exports: module.exports, Buffer, console }, { filename: file });
  return module.exports;
}
load(path.join(root, 'preload/index.cts'));
assert(api.hr.employees && api.auth.auth && api.tasks.tasks && api.sync);
let pending;
const unsubscribe = api.sync.onPendingChanges((event) => { pending = event.pendingChanges; });
ipcRenderer.emit('sync:status', {}, { status: 'SYNCING' });
assert.equal(pending, undefined);
ipcRenderer.emit('sync:pending-changes', {}, { pendingChanges: 7 });
assert.equal(pending, 7);
unsubscribe();
assert.equal(ipcRenderer.listenerCount('sync:pending-changes'), 0);
const document = { companyId: 'company', employeeId: 'employee' };
api.hr.employees_documents.upload(document);
assert.equal(invocations.at(-1).channel, 'employees-documents:upload');
assert.deepEqual(invocations.at(-1).args, [document]);
const check = { companyId: 'company', date: '2026-09-22' };
api.hr.attendanceDailyCheck.lock(check);
assert.deepEqual(invocations.at(-1).args, [check]);
console.log(`Passed: ${handlers.size} handlers, ${calls.length} preload calls, ${registrations.size} registrations, preload loading and event cleanup.`);
