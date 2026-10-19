const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '../..');
function load(file, resolve, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: resolve, console,
    process, Date, ...globals });
  return module.exports;
}
(async () => {
  const claims = new Set(), events = [];
  const service = load('server/services/lateAttendanceNotification.service.ts', name => {
    if (name === 'mongoose') return { Schema: class {}, model: () => ({ create: async ({ _id }) => {
      if (claims.has(_id)) throw { code: 11000 };
      claims.add(_id);
    } }) };
    if (name.includes('employee.model')) return { default: { findOne: () => ({ lean: async () => ({ firstName: 'Jean', lastName: 'Test' }) }) }, __esModule: true };
    if (name.includes('socket.service')) return { broadcastLateAttendance: event => events.push(event) };
    throw new Error(name);
  });
  const late = { _id: 'a', companyId: 'c', employeeId: 'e', date: '2026-10-19', status: 'RETARD', isDeleted: 0, lateMinutes: 17, clockIn: new Date('2026-10-19T06:17:00Z') };
  await Promise.all([service.notifyLateAttendance(null, late), service.notifyLateAttendance(null, late)]);
  assert.equal(events.length, 1, 'Concurrent retry emits once');
  await service.notifyLateAttendance(late, { ...late, notes: 'edited' });
  await service.notifyLateAttendance(null, { ...late, isDeleted: 1 });
  await service.notifyLateAttendance(null, { ...late, status: 'PONCTUEL' });
  await service.notifyLateAttendance(null, { ...late, _id: 'replacement' });
  assert.equal(events.length, 1, 'Edits, deletion, punctual records and replacement IDs do not repeat alerts');
  await service.notifyLateAttendance({ status: 'PONCTUEL', isDeleted: 0 }, { ...late, date: '2026-10-20' });
  await service.notifyLateAttendance(null, { ...late, companyId: 'other' });
  assert.equal(events.length, 3, 'New dates and companies have independent alerts');

  let middleware, connected;
  const sent = [];
  const sockets = new Map();
  const io = { use: fn => middleware = fn, on: (_event, fn) => connected = fn,
    sockets: { sockets }, to: room => ({ emit: (event, payload) => sent.push({ room, event, payload }) }) };
  const server = load('server/services/socket.service.ts', name => {
    if (name === 'jsonwebtoken') return { verify: token => {
      if (token === 'bad') throw new Error('invalid');
      return { _id: 'u', companyId: 'c', exp: Math.floor(Date.now() / 1000) + 60 };
    } };
    return {};
  });
  server.initializeSocketService(io);
  for (const token of [undefined, 'bad']) {
    let failure;
    middleware({ handshake: { auth: { token } }, data: {} }, err => failure = err);
    assert.ok(failure, 'Unauthenticated connections rejected');
  }
  let room;
  const socket = { handshake: { auth: { token: 'valid' } }, data: {}, join: value => room = value };
  middleware(socket, err => assert.equal(err, undefined));
  connected(socket);
  assert.equal(room, 'company:c');
  let disconnected = false;
  sockets.set('expired', { data: { expiresAt: 1 }, disconnect: () => disconnected = true });
  server.broadcastLateAttendance(events[0]);
  assert.equal(sent[0].room, 'company:c');
  assert.equal(sent[0].event, 'attendance.late');
  assert.equal(disconnected, true);

  const native = [], inApp = [], timers = new Map();
  class Notification extends EventEmitter {
    static isSupported() { return true; }
    constructor(options) { super(); this.options = options; native.push(this); }
    show() { this.shown = true; }
    close() { this.closed = true; this.emit('close'); }
  }
  const app = load('client/src/electron/services/shared/notification/appNotification.service.ts', name => {
    if (name === 'electron') return { Notification };
    return { emitNotification: item => inApp.push(item) };
  });
  const item = { _id: 'late', title: 'Retard', message: 'Jean', type: 'WARNING', createdAt: new Date().toISOString() };
  app.showAppNotification(item);
  app.showAppNotification(item);
  assert.equal(native.length, 1);
  assert.equal(inApp.length, 1);
  let nextId = 0;
  const reminders = load('client/src/electron/services/shared/notification/reminder.service.ts', name => name === 'crypto'
    ? { randomUUID: () => `reminder-${++nextId}` } : app,
    { setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
  const reminder = reminders.scheduleReminder('Remember', new Date(Date.now() + 60000));
  timers.get(1)();
  assert.equal(native[1].options.urgency, 'critical');
  assert.equal(inApp[1].type, 'REMINDER');
  assert.equal(reminders.cancelReminder(reminder._id), true);
  assert.equal(native[1].closed, true);
  reminders.cancelAllReminders();
  assert.equal(native[0].closed, undefined, 'Cancelling reminders preserves attendance alerts');
  app.closeAppNotifications('WARNING');
  assert.equal(native[0].closed, true, 'Session cleanup closes attendance alerts');

  let activeCompany = 'c';
  const connections = [], received = [];
  const clientSocket = load('client/src/electron/socket.ts', name => {
    if (name === 'socket.io-client') return { io: () => {
      const connection = { connected: true, handlers: {},
        on(event, fn) { this.handlers[event] = fn; },
        disconnect() { this.connected = false; } };
      connections.push(connection);
      return connection;
    } };
    if (name === './auth.js') return { getToken: async () => 'token', getActiveCompanyId: async () => activeCompany };
    if (name === 'zod') return require('zod');
    if (name.includes('appNotification')) return { showAppNotification: item => received.push(item) };
    return {};
  });
  await clientSocket.createSocket({});
  const first = connections[0];
  await first.handlers['attendance.late'](events[0]);
  assert.equal(received.length, 1);
  await first.handlers['attendance.late']({ ...events[0], companyId: 'other' });
  await first.handlers['attendance.late']({ invalid: true });
  assert.equal(received.length, 1, 'Wrong company and malformed payloads are ignored');
  const pending = first.handlers['attendance.late'](events[0]);
  first.disconnect();
  activeCompany = null;
  await pending;
  assert.equal(received.length, 1, 'Logout during asynchronous validation suppresses alert');
  activeCompany = 'other';
  await clientSocket.createSocket({});
  await first.handlers['attendance.late'](events[0]);
  await connections[1].handlers['attendance.late'](events[0]);
  assert.equal(received.length, 1, 'Old connection and previous company cannot deliver after switching');
  console.log('Late notification checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
