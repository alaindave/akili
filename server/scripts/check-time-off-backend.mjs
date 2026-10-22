import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import console from 'node:console';
import process from 'node:process';
import { MongoClient, ObjectId, BSON } from 'mongodb';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import { migrateTimeOff } from '../migrations/time-off.mjs';
const fetch = globalThis.fetch;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'akili-timeoff-backend-'));
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const child = spawn(process.env.MONGOD_BINARY || 'mongod', ['--dbpath', directory, '--bind_ip', '127.0.0.1', '--port', String(port),
  '--replSet', 'timeoff_test', '--logpath', path.join(directory, 'mongo.log')], { stdio: 'ignore' });
let launchError;
child.on('error', error => { launchError = error; });
const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 500 });
let server;
try {
  let connected = false;
  for (let i = 0; i < 30; i++) {
    if (launchError) throw launchError;
    try { await client.connect(); connected = true; break; } catch { await delay(100); }
  }
  assert(connected, 'Temporary MongoDB failed to start');
  await client.db('admin').command({ replSetInitiate: { _id: 'timeoff_test', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
  for (let i = 0; i < 100; i++) {
    if ((await client.db('admin').command({ isMaster: 1 })).ismaster) break;
    await delay(100);
  }
  const db = client.db('timeoff_backend');
  const now = new Date('2026-10-20T10:00:00Z');
  const legacyId = new ObjectId();
  const legacy = { _id: legacyId, companyId: 'a', employeeId: 'e-a', motif: 'Historical reason', startDate: '2026-01-02', endDate: '2026-01-05',
    submittedAt: new Date('2025-12-01'), status: 'APPROUVÉ', notes: 'Original history', serverVersion: 50, isDeleted: 0, createdAt: now, updatedAt: now };
  await db.collection('leaves').insertMany([legacy, { ...legacy, _id: 'legacy-pending', submittedAt: '2025-12-01', status: 'ATTENTE_APPROBATION', serverVersion: 51 },
    { ...legacy, _id: 'legacy-b', companyId: 'b', employeeId: 'e-b', serverVersion: 52 }]);
  await db.collection('synccounters').insertMany([{ _id: 'leave', value: 60 }, { _id: 'employee', value: 10 }]);
  await db.collection('employees').insertMany([{ _id: 'e-a', companyId: 'a', remainingLeave: 20, serverVersion: 10, isDeleted: 0 },
    { _id: 'e-b', companyId: 'b', remainingLeave: 30, serverVersion: 9, isDeleted: 0 }]);
  await db.collection('adminusers').insertMany([
    { _id: 'manager-a', companyId: 'a', role: 'MANAGER', isDeleted: 0 },
    { _id: 'admin-a', companyId: 'a', role: 'ADMIN', isDeleted: 0 },
    { _id: 'viewer-a', companyId: 'a', role: 'VIEWER', isDeleted: 0 },
    { _id: 'manager-b', companyId: 'b', role: 'MANAGER', isDeleted: 0 },
  ]);
  await db.collection('employeesdocuments').insertMany([
    { _id: 'doc-a', companyId: 'a', employeeId: 'e-a', isDeleted: 0, storagePath: 'a/doc-a' },
    { _id: 'doc-b', companyId: 'b', employeeId: 'e-b', isDeleted: 0, storagePath: 'b/doc-b' },
    { _id: 'doc-deleted', companyId: 'a', employeeId: 'e-a', isDeleted: 1, storagePath: 'a/deleted' },
    { _id: 'doc-pending', companyId: 'a', employeeId: 'e-a', isDeleted: 0, storagePath: null },
  ]);
  await db.collection('payrollresults').insertOne({ _id: 'finalized', leaveId: legacyId, companyId: 'a', status: 'PAYÉ', netSalary: 12000 });
  const historical = BSON.EJSON.stringify(await db.collection('payrollresults').find({}).toArray());
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  await mongoose.connect(`mongodb://127.0.0.1:${port}/timeoff_backend?replicaSet=timeoff_test`);
  process.env.JWT_PRIVATE_KEY = 'isolated-timeoff-test-key';
  process.env.SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-test-key';
  const { default: router } = await import('../dist/server/routes/shared/sync.route.js');
  const app = express(); app.use(express.json()); app.use('/sync', router);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function http(route, body, actor = 'manager-a', expected = 200) {
    const companyId = actor.endsWith('-b') ? 'b' : 'a';
    const token = jwt.sign({ _id: actor, companyId, role: 'MANAGER' }, process.env.JWT_PRIVATE_KEY);
    const response = await fetch(`${base}${route}`, { method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', ...(actor === 'anonymous' ? {} : { 'x-auth-token': token }) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  }
  function item(entity, operation, data, companyId = 'a') {
    return { queueId: randomUUID(), companyId, entity, operation,
      data: { companyId, serverVersion: 0, syncMutationId: randomUUID(), ...data } };
  }
  async function push(entry, actor = 'manager-a', error) {
    const result = await http('/sync/push', { items: JSON.stringify([entry]) }, actor);
    if (error) {
      assert.equal(result.synced.length, 0);
      assert.equal(result.failed[0]?.code, error, JSON.stringify(result));
      return result.failed[0];
    }
    assert.deepEqual(result.synced, [entry.queueId], JSON.stringify(result));
    assert.equal(result.versions[entry.queueId], result.records[entry.queueId].serverVersion);
    return result.records[entry.queueId];
  }
  const pull = (entity, afterVersion = 0, limit = 500, actor = 'manager-a') =>
    http(`/sync/pull?entity=${entity}&afterVersion=${afterVersion}&limit=${limit}`, undefined, actor);
  const balance = async () => (await db.collection('employees').findOne({ _id: 'e-a' })).remainingLeave;
  await http('/sync/pull?entity=time_off', undefined, 'anonymous', 401);
  await http('/sync/pull?entity=time_off', undefined, 'manager-a', 503);
  await migrateTimeOff(db);
  const motifBase = { _id: 'm-a', code: 'ANNUAL', label: 'Annual leave', category: 'LEAVE', payrollTreatment: 'PAID',
    deductFromLeaveBalance: true, requiresApproval: true, requiresJustification: true, requiresSupportingDocument: false, isActive: true };
  const motifCreate = item('time_off_motif', 'create', motifBase);
  let motif = await push(motifCreate);
  assert.deepEqual(await push(motifCreate), motif, 'Lost creation response replays without another write');
  await push({ ...motifCreate, data: { ...motifCreate.data, label: 'Different payload' } }, 'manager-a', 'MUTATION_CONFLICT');
  await push(item('time_off_motif', 'create', { ...motifBase, _id: 'forbidden' }), 'admin-a', 'FORBIDDEN');
  await push(item('time_off_motif', 'create', { ...motifBase, _id: 'viewer' }), 'viewer-a', 'FORBIDDEN');
  await push(item('time_off_motif', 'create', { ...motifBase, _id: 'duplicate' }), 'manager-a', '11000');
  await db.collection('time_off_motifs').insertOne({ ...motifBase, _id: 'system', code: 'SYSTEM', companyId: 'a', isSystemDefault: true,
    serverVersion: 100, synced: 1, isDeleted: 0 });
  await push(item('time_off_motif', 'update', { _id: 'system', label: 'Changed', serverVersion: 100 }), 'manager-a', 'PROTECTED_MOTIF');
  const input = { _id: 'new-a', employeeId: 'e-a', motifId: motif._id, startDate: '2026-10-19', endDate: '2026-10-20',
    notes: 'Family time', isPartialDay: false };
  await push(item('time_off', 'create', { ...input, employeeId: 'e-b' }), 'manager-a', 'NOT_FOUND');
  await push(item('time_off', 'create', { ...input, notes: '' }), 'manager-a', 'JUSTIFICATION_REQUIRED');
  await push(item('time_off', 'create', input), 'viewer-a', 'FORBIDDEN');
  const create = item('time_off', 'create', input);
  let request = await push(create, 'admin-a');
  assert.equal(request.status, 'PENDING');
  assert.deepEqual(await push(create, 'admin-a'), request);
  assert.deepEqual(await push(create, 'manager-a'), request, 'Another authorized user can resume the same queue');
  await push(item('time_off', 'update', { _id: request._id, serverVersion: request.serverVersion, requestedAction: 'approve' }), 'admin-a', 'FORBIDDEN');
  const approve = item('time_off', 'update', { _id: request._id, serverVersion: request.serverVersion, requestedAction: 'approve' });
  request = await push(approve);
  assert.equal(request.status, 'APPROVED'); assert.equal(request.balanceDaysDeducted, 2); assert.equal(await balance(), 18);
  const employeeVersion = (await db.collection('employees').findOne({ _id: 'e-a' })).serverVersion;
  assert.deepEqual(await push(approve), request); assert.equal(await balance(), 18);
  assert.equal((await db.collection('employees').findOne({ _id: 'e-a' })).serverVersion, employeeVersion);
  await push(item('time_off', 'update', { ...approve.data, syncMutationId: randomUUID() }), 'manager-a', 'VERSION_CONFLICT');
  await push(item('time_off', 'delete', { _id: request._id, serverVersion: request.serverVersion }), 'manager-a', 'CANCELLATION_REQUIRED');
  await push(item('time_off', 'update', { _id: request._id, requestedAction: 'edit', serverVersion: request.serverVersion, notes: 'Rewrite' }), 'manager-a', 'HISTORY_IMMUTABLE');
  motif = await push(item('time_off_motif', 'update', { _id: motif._id, serverVersion: motif.serverVersion, label: 'Updated policy' }));
  const note = item('time_off', 'update', { _id: request._id, serverVersion: request.serverVersion, requestedAction: 'notes', additionalNotes: 'Manager note' });
  request = await push(note, 'admin-a');
  assert.deepEqual(await push(note, 'admin-a'), request);
  assert.equal(request.motifSnapshot.label, 'Annual leave');
  const cancel = item('time_off', 'update', { _id: request._id, serverVersion: request.serverVersion, requestedAction: 'cancel' });
  await push(cancel, 'admin-a', 'FORBIDDEN');
  request = await push(cancel); assert.equal(await balance(), 20);
  await push(cancel); assert.equal(await balance(), 20);
  const deletion = item('time_off', 'delete', { _id: request._id, serverVersion: request.serverVersion });
  request = await push(deletion); assert.equal(request.isDeleted, 1); await push(deletion);

  const concurrent = await push(item('time_off', 'create', { ...input, _id: 'concurrent' }));
  const approvals = [0, 1].map(() => item('time_off', 'update', { _id: concurrent._id, serverVersion: concurrent.serverVersion, requestedAction: 'approve' }));
  const races = await Promise.all(approvals.map(entry => http('/sync/push', { items: JSON.stringify([entry]) })));
  assert.equal(races.reduce((n, result) => n + result.synced.length, 0), 1); assert.equal(await balance(), 18);
  const partial = await push(item('time_off', 'create', { ...input, _id: 'partial', endDate: input.startDate, isPartialDay: true, startTime: '10:00', endTime: '11:00' }));
  await push(item('time_off', 'update', { _id: partial._id, serverVersion: partial.serverVersion, requestedAction: 'approve' }), 'manager-a', 'PARTIAL_BALANCE_RULE_UNDEFINED');
  let rejected = await push(item('time_off', 'update', { _id: partial._id, serverVersion: partial.serverVersion, requestedAction: 'reject', rejectionReason: 'Unavailable' }));
  assert.equal(rejected.status, 'REJECTED');
  const auto = await push(item('time_off_motif', 'create', { ...motifBase, _id: 'auto', code: 'AUTO', requiresApproval: false }));
  const automatic = item('time_off', 'create', { ...input, _id: 'automatic', motifId: auto._id });
  assert.equal((await push(automatic)).status, 'APPROVED'); assert.equal(await balance(), 16);
  await push(automatic); assert.equal(await balance(), 16);
  const counterBefore = await db.collection('synccounters').findOne({ _id: 'employee' });
  await push(item('time_off', 'create', { ...input, _id: 'insufficient', motifId: auto._id, endDate: '2026-12-30' }), 'manager-a', 'INSUFFICIENT_BALANCE');
  assert.equal(await db.collection('time_off').countDocuments({ _id: 'insufficient' }), 0);
  assert.deepEqual(await db.collection('synccounters').findOne({ _id: 'employee' }), counterBefore);

  const docs = await push(item('time_off_motif', 'create', { ...motifBase, _id: 'docs', code: 'DOCS', requiresSupportingDocument: true }));
  for (const documentId of ['doc-b', 'doc-deleted', 'doc-pending'])
    await push(item('time_off', 'create', { ...input, _id: 'documented', motifId: docs._id, supportingDocumentIds: [documentId] }), 'manager-a', 'INVALID_DOCUMENT');
  let documented = await push(item('time_off', 'create', { ...input, _id: 'documented', motifId: docs._id, supportingDocumentIds: ['doc-a'] }));
  await db.collection('employeesdocuments').updateOne({ _id: 'doc-a' }, { $set: { isDeleted: 1 } });
  await push(item('time_off', 'update', { _id: documented._id, serverVersion: documented.serverVersion, requestedAction: 'approve' }), 'manager-a', 'INVALID_DOCUMENT');
  motif = await push(item('time_off_motif', 'delete', { _id: motif._id, serverVersion: motif.serverVersion }));
  assert.equal(motif.isActive, false);
  await push(item('time_off', 'create', { ...input, _id: 'inactive' }), 'manager-a', 'MOTIF_UNAVAILABLE');
  motif = await push(item('time_off_motif', 'update', { _id: motif._id, serverVersion: motif.serverVersion, isActive: true }));
  const editedHistory = await push(item('time_off', 'update', { _id: 'legacy-pending', serverVersion: 51, requestedAction: 'edit', motifId: motif._id, notes: 'Updated normally' }));
  assert.equal(editedHistory.motifId, motif._id);
  assert.equal('legacyNeedsReview' in editedHistory, false);
  assert.equal('legacyData' in editedHistory, false);
  const legacyCancel = item('time_off', 'update', { _id: String(legacyId), serverVersion: 50, requestedAction: 'cancel' });
  await push(legacyCancel); assert.equal(await balance(), 18); await push(legacyCancel); assert.equal(await balance(), 18);
  assert.equal((await db.collection('time_off').findOne({ _id: legacyId }))._id._bsontype, 'ObjectId');
  assert.deepEqual(await db.collection('leaves').findOne({ _id: legacyId }), legacy);
  assert.equal(BSON.EJSON.stringify(await db.collection('payrollresults').find({}).toArray()), historical);

  let cursor = 0; const ids = [];
  for (;;) {
    const page = await pull('time_off', cursor, 1);
    assert(page.items.every(row => row.companyId === 'a'));
    ids.push(...page.items.map(row => row._id));
    if (!page.hasMore) break;
    assert(page.nextVersion > cursor); cursor = page.nextVersion;
  }
  assert.equal(ids.length, new Set(ids).size); assert(ids.includes('new-a'), 'Soft deletions are pulled');
  assert((await pull('time_off_motif')).items.some(row => row._id === 'm-a'));
  assert((await pull('time_off', 0, 500, 'manager-b')).items.every(row => row.companyId === 'b'));
  await push(item('time_off', 'update', { _id: 'new-a', companyId: 'b' }), 'manager-a', 'INVALID_COMPANY');
  assert.equal((await db.collection('employees').findOne({ _id: 'e-b' })).remainingLeave, 30);
  await db.collection('adminusers').updateOne({ _id: 'manager-a' }, { $set: { role: 'VIEWER' } });
  await push(item('time_off_motif', 'update', { _id: motif._id, serverVersion: motif.serverVersion, label: 'Stale role' }), 'manager-a', 'FORBIDDEN');
  console.log('PASS: shared sync HTTP/JWT, CRUD, receipts/retries, concurrency, atomic balances, policy/roles/documents, historical editing/ObjectIds, pagination, tenant isolation, tombstones and finalized payroll preservation.');

} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); await client.close();
  child.kill('SIGTERM');
  if (child.exitCode === null && !launchError) await new Promise(resolve => child.once('exit', resolve));
  fs.rmSync(directory, { recursive: true, force: true });
}
