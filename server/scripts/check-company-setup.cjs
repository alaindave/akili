const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let handler, admin, lookup;
const company = { companyId: 'a', isDeleted: 0 };
const stubs = {
  express: { Router: () => ({ post: (_, callback) => { handler = callback; } }) },
  bcrypt: { compare: async password => password === 'correct' },
  '../../db.js': {
    getAdminUserByEmail: async (_, companyId) => { lookup = companyId; return admin; },
    getCompanyById: async () => company,
  },
  '../../models/shared/company.model.js': { findOne: async ({ signUpCode }) => signUpCode === 'ACME' ? company : null },
};
const code = ts.transpileModule(fs.readFileSync('routes/shared/authenticate.route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
vm.runInNewContext(code, { exports: {}, require: name => stubs[name] ?? require(name), console: { error() {} } });
async function request(body, path = '/setup') {
  const response = { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
    set() { return this; }, header(key, value) { this.headers[key] = value; return this; },
    send(value) { this.body = value; return this; } };
  await handler({ body, path }, response);
  return response;
}
(async () => {
  admin = { _id: 'admin-a', companyId: 'a', role: 'ADMIN', isDeleted: 0, passwordHash: 'hash', generateAuthToken: () => 'token' };
  const credentials = { email: 'admin@example.com', password: 'correct', signUpCode: 'ACME' };
  for (const path of ['/setup', '/setup/', '/SETUP']) {
    const result = await request(credentials, path);
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['x-auth-token'], 'token');
    assert.equal(lookup, 'a');
    assert.equal(result.body.admin.passwordHash, undefined);
  }
  for (const patch of [{ password: 'wrong' }, { signUpCode: 'OTHER' }, { companyId: 'b' }, { signUpCode: undefined }]) {
    const result = await request({ ...credentials, ...patch });
    assert.equal(result.statusCode, 400);
    assert.equal(result.headers['x-auth-token'], undefined);
  }
  for (const role of ['MANAGER', 'VIEWER']) {
    admin.role = role;
    assert.equal((await request(credentials)).statusCode, 400);
  }
  admin.role = 'ADMIN'; admin.isDeleted = 1;
  assert.equal((await request(credentials)).statusCode, 400);
  admin = null;
  assert.equal((await request(credentials)).statusCode, 400);
  console.log('Company setup authentication checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
