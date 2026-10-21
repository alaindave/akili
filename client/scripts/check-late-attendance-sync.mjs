import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
function load(file, resolve) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: resolve, Date, Error, setTimeout,
    console: { log() {}, warn() {}, error() {} }, process: { env: {} } });
  return module.exports;
}
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE attendances (_id TEXT,companyId TEXT,employeeId TEXT,date TEXT,clockIn TEXT,
clockOut TEXT,status TEXT,source TEXT,lateMinutes INTEGER,serverVersion INTEGER,synced INTEGER,
isDeleted INTEGER DEFAULT 0,createdAt TEXT,updatedAt TEXT,notes TEXT);
CREATE TABLE sync_queue (_id INTEGER PRIMARY KEY,companyId TEXT,entity TEXT,entityId TEXT,operation TEXT,payload TEXT,synced INTEGER DEFAULT 0);`);
let callbacks = [], failQueue = false;
const requested = [];
const db = {
  get: async (q, p=[]) => sql.prepare(q).get(...p),
  run: async (q, p=[]) => sql.prepare(q).run(...p),
  afterCommit: cb => callbacks.push(cb),
  transaction: async cb => {
    sql.exec('BEGIN'); callbacks = [];
    try { const result = await cb(); sql.exec('COMMIT'); for (const fn of callbacks) fn(); return result; }
    catch (e) { sql.exec('ROLLBACK'); callbacks = []; throw e; }
  },
};
const repo = load('../src/electron/database/repositories/modules/hr/attendances.repository.ts', name => {
  if (name.endsWith('/db.js')) return db;
  if (name === 'crypto') return { randomUUID: () => `id-${sql.prepare('SELECT count(*) n FROM attendances').get().n}` };
  if (name.endsWith('/attendanceSettings.repository.js')) return { getAttendanceClockIn: async () => '08:00' };
  if (name.endsWith('/attendanceDailyCheck.repository.js')) return { isAttendanceDateLocked: async () => false };
  if (name.endsWith('/employees.repository.js')) return { getEmployeeById: async () => ({}) };
  if (name.endsWith('/sync.repository.js')) return { addToSyncQueue: async item => {
    if (failQueue) throw new Error('queue failure');
    sql.prepare('INSERT INTO sync_queue(companyId,entity,entityId,operation,payload) VALUES (?,?,?,?,?)')
      .run(item.companyId,item.entity,item.entityId,item.operation,item.payload);
  } };
  if (name.endsWith('/sync.service.js')) return { requestLateAttendanceSync: (company,id) => {
    assert.equal(sql.isTransaction, false);
    assert(sql.prepare('SELECT * FROM sync_queue WHERE entityId=?').get(id));
    requested.push(id);
  } };
  return {};
});
const input = { employeeId:'employee',date:'2026-10-19' };
const late = await repo.createAttendance('company',{...input,clockIn:new Date(2026,9,19,9).toISOString()});
assert.deepEqual(requested,[late._id]);
const punctual = await repo.createAttendance('company',{...input,date:'2026-10-20',clockIn:new Date(2026,9,20,8).toISOString()});
assert.equal(requested.length,1);
await repo.updateAttendance('company',punctual._id,'2026-10-20',{clockIn:new Date(2026,9,20,9).toISOString()});
assert.equal(requested.length,2);
await repo.updateAttendance('company',punctual._id,'2026-10-20',{notes:'Note'});
assert.equal(requested.length,2);
failQueue=true;
await assert.rejects(repo.createAttendance('company',{...input,date:'2026-10-21',status:'RETARD'}));
assert.equal(requested.length,2);

let release, online=true, fail=false;
const calls=[];
const service = load('../src/electron/services/shared/sync/sync.service.ts', name => {
  if (name==='electron') return {app:{isPackaged:false},BrowserWindow:{getAllWindows:()=>[]}};
  if (name.endsWith('/companyStorage.js')) return {findCompanyStorage:id=>({companyId:id}),withCompanyStorage:(_s,fn)=>fn()};
  if (name.endsWith('/network.service.js')) return {NetworkService:{canReachBackend:async()=>online}};
  if (name.endsWith('/sync.repository.js')) return {getUnsyncedItems:async()=>[],notifyPendingChanges:async()=>{}};
  if (name.endsWith('/push.service.js')) return {pushPendingChanges:async(company,ids)=>{
    calls.push([company,[...ids]]);
    if(calls.length===1) await new Promise(resolve=>{release=resolve;});
    return {failures:fail?['rejected']:[],syncedCount:0,pendingChanges:0};
  }};
  return {};
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
service.requestLateAttendanceSync('a','one'); await tick();
service.requestLateAttendanceSync('a','two');
service.requestLateAttendanceSync('a','two');
assert.equal(calls.length,1);
release(); await tick(); await tick();
assert.deepEqual(calls,[['a',['one']],['a',['two']]]);
online=false; service.requestLateAttendanceSync('a','offline'); await tick();
assert.equal(calls.length,2);
online=true;fail=true;service.requestLateAttendanceSync('b','failed');await tick();await tick();
assert.equal(calls.length,3,'Failures must not cause an immediate retry loop');
// The real push pipeline must exclude unrelated queue entries and retain rejects.
const queue = [
  { _id:'1',companyId:'a',entity:'attendance',entityId:'late',operation:'create',payload:JSON.stringify({_id:'late',companyId:'a',status:'RETARD'}) },
  { _id:'2',companyId:'a',entity:'attendance',entityId:'on-time',operation:'create',payload:JSON.stringify({_id:'on-time',companyId:'a',status:'PONCTUEL'}) },
  { _id:'3',companyId:'a',entity:'employee',entityId:'employee',operation:'update',payload:JSON.stringify({_id:'employee',companyId:'a'}) },
];
let sent;
class Form { append(key,value){this[key]=value;} getHeaders(){return {};} }
const push = load('../src/electron/services/shared/sync/push.service.ts',name=>{
  if(name==='electron') return {app:{isPackaged:false}};
  if(name==='form-data') return Form;
  if(name.endsWith('/auth.js')) return {getToken:async()=> 'token'};
  if(name.endsWith('/InventorySync.js')) return {isInventorySyncEntity:()=>false};
  if(name.endsWith('/sync.repository.js')) return {getUnsyncedItems:async()=>queue,markManySynced:async(_company,ids)=>assert.equal(ids.length,0)};
  if(name==='axios') return {post:async(_url,form)=>{
    sent=JSON.parse(form.items);
    return {data:{synced:[],failed:[{queueId:'1',code:'REVISION_CONFLICT',message:'conflict'}]}};
  }};
  return {};
});
const result=await push.pushPendingChanges('a',new Set(['late']));
assert.equal(sent.length,1);
assert.equal(sent[0].queueId,'1');
assert.equal(result.failures.length,1);
assert.equal(queue.length,3);
sql.close();
console.log('Passed: post-commit late-only triggers, rollback, update transitions, serialized/coalesced requests, offline and failed attempts.');
