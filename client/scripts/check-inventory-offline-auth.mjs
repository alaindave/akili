import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const passwords = new Map();
const keytar = {
  getPassword: async (_, account) => passwords.get(account) ?? null,
  setPassword: async (_, account, value) => { passwords.set(account, value); },
  deletePassword: async (_, account) => passwords.delete(account),
};
function load(relative, stubs) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, Buffer, console,
    require: name => name in stubs ? stubs[name] : require(name),
  });
  return module.exports;
}
const auth = load('../src/electron/auth.ts', { keytar });
const identity = { _id: 'user-a', companyId: 'company-a', role: 'ADMIN' };
const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
await assert.rejects(auth.requireLocalIdentity('company-a'));
await auth.saveToken(token({ ...identity, exp: 1 }));
await assert.rejects(auth.requireLocalIdentity('company-a'));
const handlers = new Map();
const electron = { ipcMain: { handle: (name, handler) => handlers.set(name, handler) } };
load('../src/electron/ipc/shared/offline_users.ipc.ts', {
  electron, bcrypt: { compare: async password => password === 'correct' },
  '../../auth.js': auth,
  '../../database/repositories/shared/offline_users.repository.js': {
    getOfflineUserByEmail: async email => email === 'known' ? { ...identity, password: 'hash' } : null,
  },
}).registerOfflineUsersIPC();
const login = handlers.get('offline-users:login');
await assert.rejects(login(null, { email: 'known', password: 'wrong' }));
await assert.rejects(auth.requireLocalIdentity('company-a'));
await assert.rejects(login(null, { email: 'unknown', password: 'correct' }));
await login(null, { email: 'known', password: 'correct' });
assert.equal((await auth.requireLocalIdentity('company-a'))._id, 'user-a');
await assert.rejects(auth.requireLocalIdentity('company-b'));
await assert.rejects(auth.requireLocalIdentity(''));
await assert.rejects(auth.requireLocalIdentity(null));
passwords.delete('auth-token');
const restarted = load('../src/electron/auth.ts', { keytar });
assert.equal((await restarted.requireLocalIdentity('company-a')).companyId, 'company-a');
let posted;
load('../src/electron/ipc/modules/inventory/inventoryMovement.ipc.ts', {
  electron, '../../../auth.js': restarted,
  './inventoryItem.ipc.js': { requireAuthenticatedCompanyId: async company => (await restarted.requireLocalIdentity(company)).companyId },
  '../../../services/modules/inventory/inventoryTransaction.service.js': { inventoryTransactionService: { post: async (...args) => { posted = args; } } },
  '../../../database/repositories/modules/inventory/inventoryMovement.repository.js': { InventoryMovementRepository: class {} },
}).registerInventoryMovementIpc();
const post = handlers.get('inventory:movement:postTransaction');
await post(null, 'company-a', {});
assert.equal(posted[1], 'user-a');
await restarted.saveLocalSession({ ...identity, role: 'VIEWER' });
await assert.rejects(post(null, 'company-a', {}));
await restarted.saveLocalSession({ ...identity, companyId: 'company-b', role: 'MANAGER' });
await assert.rejects(restarted.requireLocalIdentity('company-a'));
await post(null, 'company-b', {});
await restarted.clearToken();
await assert.rejects(restarted.requireLocalIdentity('company-b'));
await restarted.saveToken(token({ ...identity, exp: Date.now() / 1000 + 3600 }));
assert.equal((await restarted.requireLocalIdentity('company-a'))._id, 'user-a');
await restarted.clearToken();
console.log('Passed: offline password login, expired/missing token, restart, company isolation, role enforcement, account switching, logout, and legacy valid token.');
