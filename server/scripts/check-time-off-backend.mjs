import assert from 'node:assert/strict';
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
  const legacy = { _id: legacyId, companyId: 'a', employeeId: 'e-a', motif: 'Historical reason', startDate: '2026-01-01', endDate: '2026-01-02',
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
  const { default: router } = await import('../dist/server/routes/modules/hr/timeOff.route.js');
  const { default: retired } = await import('../dist/server/routes/modules/hr/leave.route.js');
  const app = express(); app.use(express.json()); app.use('/time-off', router); app.use('/leaves', retired);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, route, body, actor = 'manager-a', expected = 200) {
    const companyId = actor.endsWith('-b') ? 'b' : 'a';
    const token = jwt.sign({ _id: actor, companyId, role: 'MANAGER', email: 'test@example.invalid' }, process.env.JWT_PRIVATE_KEY);
    const response = await fetch(`${base}${route}`, { method, headers: { 'content-type': 'application/json', ...(actor === 'anonymous' ? {} : { 'x-auth-token': token }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
    assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(result)}`);
    return result;
  }
  const balance = async () => (await db.collection('employees').findOne({ _id: 'e-a' })).remainingLeave;
  await call('GET', '/time-off', undefined, 'anonymous', 401);
  await call('GET', '/time-off', undefined, 'manager-a', 503);
  await migrateTimeOff(db);
  await call('GET', '/leaves', undefined, 'manager-a', 410);
  await call('POST', '/time-off', undefined, 'admin-a', 400);
  await call('POST', '/time-off/motifs', undefined, 'manager-a', 400);
  const motifBase = { code: 'ANNUAL', label: 'Annual leave', category: 'LEAVE', payrollTreatment: 'PAID', deductFromLeaveBalance: true,
    requiresApproval: true, requiresJustification: true, requiresSupportingDocument: false, isActive: true };
  let motif = await call('POST', '/time-off/motifs', { ...motifBase, _id: 'm-a' }, 'manager-a', 201);
  const motifB = await call('POST', '/time-off/motifs', { ...motifBase, _id: 'm-b' }, 'manager-b', 201);
  await call('POST', '/time-off/motifs', { ...motifBase, _id: 'duplicate' }, 'manager-a', 409);
  await call('POST', '/time-off/motifs', { ...motifBase, code: 'BAD', companyId: 'b' }, 'manager-a', 400);
  await call('POST', '/time-off/motifs', { ...motifBase, code: 'BAD', isSystemDefault: true }, 'manager-a', 400);
  await call('POST', '/time-off/motifs', { ...motifBase, code: 'BAD', category: 'INVALID' }, 'manager-a', 400);
  await call('POST', '/time-off/motifs', { ...motifBase, code: 'BAD' }, 'viewer-a', 403);
  await call('POST', '/time-off/motifs', { ...motifBase, code: 'BAD' }, 'admin-a', 403);
  await call('GET', '/time-off/motifs/m-b', undefined, 'manager-a', 404);
  await call('PATCH', '/time-off/motifs/m-b', { serverVersion: motifB.serverVersion, label: 'Attack' }, 'manager-a', 404);
  await call('DELETE', '/time-off/motifs/m-b', { serverVersion: motifB.serverVersion }, 'manager-a', 404);
  assert((await call('GET', '/time-off/motifs', undefined, 'viewer-a')).every(row => row.companyId === 'a'));
  await db.collection('time_off_motifs').insertOne({ ...motifBase, _id: 'system', companyId: 'a', code: 'SYSTEM',
    isSystemDefault: true, isDeleted: 0, serverVersion: 999 });
  await call('PATCH', '/time-off/motifs/system', { serverVersion: 999, label: 'Overwrite system' }, 'manager-a', 403);
  await call('DELETE', '/time-off/motifs/system', { serverVersion: 999 }, 'manager-a', 403);
  const input = { employeeId: 'e-a', motifId: 'm-a', startDate: '2026-11-01', endDate: '2026-11-02', notes: 'Family event' };
  for (const patch of [{ companyId: 'b' }, { status: 'APPROVED' }, { motifSnapshot: {} }, { approvedBy: 'attacker' }, { serverVersion: 999 },
    { balanceDaysDeducted: 9 }, { startDate: '2026-02-30' }, { endDate: '2026-01-01' }, { notes: '  ' }]) {
    await call('POST', '/time-off', { ...input, ...patch }, 'admin-a', 400);
  }
  await call('POST', '/time-off', { ...input, employeeId: 'e-b' }, 'admin-a', 404);
  await call('POST', '/time-off', { ...input, motifId: 'm-b' }, 'admin-a', 404);
  await call('POST', '/time-off', input, 'viewer-a', 403);
  await call('POST', '/time-off', { ...input, _id: String(legacyId) }, 'admin-a', 409);
  let request = await call('POST', '/time-off', { ...input, _id: 'new-a' }, 'admin-a', 201);
  assert(request.serverVersion > 60);
  assert.equal(request.status, 'PENDING'); assert.equal(request.motifSnapshot, undefined); assert.equal(await balance(), 20);
  await call('GET', `/time-off/${request._id}`, undefined, 'manager-b', 404);
  await call('POST', `/time-off/${request._id}/approve`, { serverVersion: request.serverVersion }, 'manager-b', 404);
  await call('POST', `/time-off/${request._id}/approve`, { serverVersion: request.serverVersion }, 'admin-a', 403);
  const oldVersion = request.serverVersion;
  request = await call('POST', `/time-off/${request._id}/approve`, { serverVersion: oldVersion });
  assert(request.serverVersion > oldVersion);
  assert.equal(request.status, 'APPROVED'); assert.equal(request.approvedBy, 'manager-a');
  assert.equal(request.motifSnapshot.payrollTreatment, 'PAID'); assert.equal(await balance(), 18);
  await call('POST', `/time-off/${request._id}/approve`, { serverVersion: oldVersion }, 'manager-a', 409);
  await call('PATCH', `/time-off/${request._id}`, { serverVersion: request.serverVersion, notes: 'Rewrite' }, 'manager-a', 409);
  await call('DELETE', `/time-off/${request._id}`, { serverVersion: request.serverVersion }, 'manager-a', 409);
  const frozen = request.motifSnapshot;
  motif = await call('PATCH', '/time-off/motifs/m-a', { serverVersion: motif.serverVersion, label: 'Updated policy', payrollTreatment: 'UNPAID', deductFromLeaveBalance: false });
  request = await call('PATCH', `/time-off/${request._id}/notes`, { serverVersion: request.serverVersion, additionalNotes: 'Manager note' }, 'admin-a');
  assert.deepEqual(request.motifSnapshot, frozen);
  request = await call('POST', `/time-off/${request._id}/cancel`, { serverVersion: request.serverVersion });
  assert.equal(await balance(), 20); assert.deepEqual(request.motifSnapshot, frozen);
  await call('POST', `/time-off/${request._id}/cancel`, { serverVersion: request.serverVersion }, 'manager-a', 409);
  request = await call('DELETE', `/time-off/${request._id}`, { serverVersion: request.serverVersion });
  assert.equal(request.isDeleted, 1); assert.equal(await db.collection('time_off').countDocuments({ _id: 'new-a' }), 1);
  assert(!(await call('GET', '/time-off')).some(row => row._id === 'new-a'));
  assert((await call('GET', '/time-off?includeDeleted=true')).some(row => row._id === 'new-a'));
  await call('GET', '/time-off?companyId=b', undefined, 'manager-a', 400);
  assert.equal((await call('GET', '/time-off?month=2025-12')).length, 2);
  await call('GET', '/time-off?month=2026-99', undefined, 'manager-a', 400);
  // Concurrent approvals serialize and do not double-deduct.
  motif = await call('PATCH', '/time-off/motifs/m-a', { serverVersion: motif.serverVersion, deductFromLeaveBalance: true });
  const concurrent = await call('POST', '/time-off', input, 'admin-a', 201);
  const token = jwt.sign({ _id: 'manager-a', companyId: 'a' }, process.env.JWT_PRIVATE_KEY);
  const statuses = await Promise.all([1, 2].map(async () => {
    const response = await fetch(`${base}/time-off/${concurrent._id}/approve`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ serverVersion: concurrent.serverVersion }) });
    await response.json(); return response.status;
  }));
  assert.deepEqual(statuses.sort(), [200, 409]); assert.equal(await balance(), 18);
  // Explicit deactivation preserves references; inactive policies reject new use.
  motif = await call('DELETE', '/time-off/motifs/m-a', { serverVersion: motif.serverVersion });
  assert.equal(motif.isActive, false);
  await call('POST', '/time-off', input, 'admin-a', 404);
  assert.equal(await db.collection('time_off_motifs').countDocuments({ _id: 'm-a' }), 1);
  motif = await call('PATCH', '/time-off/motifs/m-a', { serverVersion: motif.serverVersion, isActive: true });
  const automatic = await call('POST', '/time-off/motifs', { ...motifBase, _id: 'automatic', code: 'EXIT', category: 'EXIT_PERMISSION',
    requiresApproval: false, deductFromLeaveBalance: false, requiresJustification: false }, 'manager-a', 201);
  const partial = await call('POST', '/time-off', { ...input, motifId: automatic._id, endDate: input.startDate,
    isPartialDay: true, startTime: '10:00', endTime: '11:00', notes: '' }, 'admin-a', 201);
  assert.equal(partial.status, 'APPROVED'); assert.equal(partial.balanceDaysDeducted, 0); assert.equal(await balance(), 18);
  await call('POST', '/time-off', { ...input, motifId: automatic._id, isPartialDay: true, startTime: '10:00', endTime: '11:00' }, 'admin-a', 400);
  let partialPending = await call('POST', '/time-off', { ...input, endDate: input.startDate, isPartialDay: true, startTime: '10:00', endTime: '11:00' }, 'admin-a', 201);
  await call('POST', `/time-off/${partialPending._id}/approve`, { serverVersion: partialPending.serverVersion }, 'manager-a', 409);
  partialPending = await call('PATCH', `/time-off/${partialPending._id}`, { serverVersion: partialPending.serverVersion, isPartialDay: false }, 'admin-a');
  assert.equal(partialPending.startTime, undefined); assert.equal(partialPending.endTime, undefined);
  const docs = await call('POST', '/time-off/motifs', { ...motifBase, _id: 'docs', code: 'MEDICAL', requiresSupportingDocument: true }, 'manager-a', 201);
  for (const supportingDocumentIds of [[], ['doc-b'], ['doc-deleted'], ['doc-pending']]) {
    await call('POST', '/time-off', { ...input, motifId: docs._id, supportingDocumentIds }, 'admin-a', 400);
  }
  let documented = await call('POST', '/time-off', { ...input, motifId: docs._id, supportingDocumentIds: ['doc-a'] }, 'admin-a', 201);
  await db.collection('employeesdocuments').updateOne({ _id: 'doc-a' }, { $set: { isDeleted: 1 } });
  await call('POST', `/time-off/${documented._id}/approve`, { serverVersion: documented.serverVersion }, 'manager-a', 400);
  documented = await call('POST', `/time-off/${documented._id}/reject`, { serverVersion: documented.serverVersion, rejectionReason: 'Document removed' });
  assert.equal(documented.status, 'REJECTED');
  // Legacy ObjectIds and immutable policy history survive API operations.
  let old = await call('GET', `/time-off/${legacyId}`);
  assert.equal(old.legacyNeedsReview, true); assert.equal(old.motifId, null);
  await call('POST', `/time-off/${legacyId}/review-legacy`, { serverVersion: old.serverVersion, motifId: 'm-a' }, 'manager-a', 409);
  await call('POST', `/time-off/${legacyId}/cancel`, { serverVersion: old.serverVersion }, 'manager-a', 409);
  old = await call('PATCH', `/time-off/${legacyId}/notes`, { serverVersion: old.serverVersion, additionalNotes: 'Historical note' });
  assert.equal((await db.collection('time_off').findOne({ _id: legacyId }))._id._bsontype, 'ObjectId');
  assert.equal(old.legacyData.notes, 'Original history');
  let pending = await call('GET', '/time-off/legacy-pending');
  await call('POST', '/time-off/legacy-pending/approve', { serverVersion: pending.serverVersion }, 'manager-a', 409);
  pending = await call('POST', '/time-off/legacy-pending/review-legacy', { serverVersion: pending.serverVersion, motifId: 'm-a', notes: 'Reviewed' });
  assert.equal(pending.legacyNeedsReview, false); assert.equal(pending.status, 'PENDING'); assert.equal(pending.motifSnapshot, undefined);
  assert.deepEqual(await db.collection('leaves').findOne({ _id: legacyId }), legacy);
  assert.equal(BSON.EJSON.stringify(await db.collection('payrollresults').find({}).toArray()), historical);
  // A rejected automatic approval rolls back request, counters and balance together.
  await call('POST', '/time-off/motifs', { ...motifBase, _id: 'auto-balance', code: 'AUTO_BALANCE', requiresApproval: false }, 'manager-a', 201);
  const beforeCounter = await db.collection('synccounters').findOne({ _id: 'employee' });
  await call('POST', '/time-off', { ...input, _id: 'insufficient', motifId: 'auto-balance', endDate: '2026-12-30' }, 'admin-a', 409);
  assert.equal(await db.collection('time_off').countDocuments({ _id: 'insufficient' }), 0);
  assert.deepEqual(await db.collection('synccounters').findOne({ _id: 'employee' }), beforeCounter);
  assert.equal(await balance(), 18);
  assert.equal((await db.collection('employees').findOne({ _id: 'e-b' })).remainingLeave, 30);
  // Current account role overrides a stale manager claim in the token.
  await db.collection('adminusers').updateOne({ _id: 'manager-a' }, { $set: { role: 'VIEWER' } });
  await call('POST', '/time-off/motifs', { ...motifBase, code: 'STALE_TOKEN' }, 'manager-a', 403);
  const collections = (await db.listCollections().toArray()).map(row => row.name);
  assert(!collections.includes('timeoffs')); assert(!collections.includes('timeoffmotifs'));
  console.log('PASS Stage 2: real migrated MongoDB replica set + HTTP/JWT, tenant isolation, current roles, motif lifecycle, validation, approval snapshots, atomic balances, concurrency, cancellation, documents, partial days, legacy ObjectIds/review, soft deletion and preserved finalized payroll.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); await client.close();
  child.kill('SIGTERM');
  if (child.exitCode === null && !launchError) await new Promise(resolve => child.once('exit', resolve));
  fs.rmSync(directory, { recursive: true, force: true });
}
