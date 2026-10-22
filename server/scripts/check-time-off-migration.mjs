import { setTimeout } from 'node:timers';
import console from 'node:console';
import process from 'node:process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { MongoClient, ObjectId, BSON } from 'mongodb';
import { migrateTimeOff, convert, TIME_OFF_MIGRATION } from '../migrations/time-off.mjs';
import mongoose from 'mongoose';
const canonical = rows => BSON.EJSON.stringify(rows, { relaxed: false });
(async () => {
  assert.equal(mongoose.pluralize()('Leaves'),'leaves');
  assert.equal(mongoose.pluralize()('SyncCounter'),'synccounters');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'akili-timeoff-mongo-'));
  const socket=net.createServer();
  await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
  const port=socket.address().port;
  await new Promise(resolve=>socket.close(resolve));
  const child=spawn(process.env.MONGOD_BINARY || 'mongod',['--dbpath',directory,'--bind_ip','127.0.0.1','--port',String(port),'--logpath',path.join(directory,'mongo.log')],{stdio:'ignore'});
  let launchError;
  child.on('error',error=>{launchError=error;});
  const client=new MongoClient(`mongodb://127.0.0.1:${port}`,{serverSelectionTimeoutMS:500});
  try {
    let connected=false;
    for(let i=0;i<30;i++) {if(launchError)throw launchError;try{await client.connect();connected=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
    assert(connected,'Temporary local MongoDB did not start');
    async function seed(name) {
      const db=client.db(name);
      const statuses=['ATTENTE_APPROBATION','APPROUVÉ','REFUSÉ','ANNULÉ'];
      const records=statuses.map((status,i)=>({_id:i===3?new ObjectId():`l${i}`,companyId:i%2?'b':'a',employeeId:`e${i}`,
        subject:'Historical custom reason',motif:i===1?'congé':undefined,startDate:'2026-10-01',endDate:'2026-10-02',
        submittedAt:new Date('2026-09-20'),submittedMonth:'2026-09',status,notes:'Notes',additionalNotes:'More',
        approvedBy:i===1?'manager':null,approvedAt:i===1?new Date('2026-09-21'):null,
        createdAt:new Date('2026-09-20'),updatedAt:new Date('2026-09-21'),lastSyncedAt:new Date('2026-09-22'),
        serverVersion:15+i,synced:i%2,isDeleted:i===3?1:0,unknownHistoricalField:{payrollRunId:'p'}}));
      await db.collection('leaves').insertMany(records);
      await db.collection('leaves').createIndex({serverVersion:1});
      await db.collection('synccounters').insertOne({_id:'leave',value:100});
      await db.collection('payrollresults').insertOne({_id:'p',leaveId:records[3]._id,status:'PAYÉ',netSalary:12000});
      return db;
    }
    const db=await seed('migration_success');
    await db.collection('synccounters').insertOne({_id:'time_off',value:200});
    const original=canonical(await db.collection('leaves').find({}).toArray());
    const payroll=canonical(await db.collection('payrollresults').find({}).toArray());
    assert.equal((await migrateTimeOff(db)).migrated,4);
    assert.equal(canonical(await db.collection('leaves').find({}).toArray()),original);
    assert.equal(canonical(await db.collection('payrollresults').find({}).toArray()),payroll);
    for(const old of await db.collection('leaves').find({}).toArray()) {
      assert.deepEqual(await db.collection('time_off').findOne({_id:old._id}),convert(old));
    }
    assert.equal(await db.collection('time_off_motifs').countDocuments({}),0);
    assert.equal((await db.collection('synccounters').findOne({_id:'time_off'})).value,200);
    assert.equal((await db.collection('synccounters').findOne({_id:'leave'})).value,100);
    assert.equal((await migrateTimeOff(db)).alreadyApplied,true);
    assert.equal(await db.collection('time_off').countDocuments({}),4);
    assert.equal(await db.collection('migrations').countDocuments({_id:TIME_OFF_MIGRATION}),1);
    const motif={_id:'m-a',companyId:'a',code:'CODE',label:'Policy',category:'ABSENCE',payrollTreatment:'UNPAID',
      deductFromLeaveBalance:false,requiresApproval:true,requiresJustification:true,requiresSupportingDocument:false,isSystemDefault:false,isActive:true};
    await db.collection('time_off_motifs').insertOne(motif);
    await db.collection('time_off_motifs').insertOne({...motif,_id:'m-b',companyId:'b'});
    await assert.rejects(()=>db.collection('time_off_motifs').insertOne({...motif,_id:'duplicate'}),{code:11000});
    await assert.rejects(()=>db.collection('time_off_motifs').insertOne({...motif,_id:'invalid',code:'OTHER',category:'INVALID'}),{code:121});
    await assert.rejects(()=>db.collection('time_off').insertOne({_id:'new',companyId:'a',employeeId:'e',startDate:'x',endDate:'x',submittedAt:new Date(),status:'PENDING'}),{code:121});
    // Simulate interruption after one verified copy by rejecting the second insert.
    const interrupted=await seed('migration_interrupted');
    const wrapper={listCollections:interrupted.listCollections.bind(interrupted),createCollection:interrupted.createCollection.bind(interrupted),
      collection(name){const collection=interrupted.collection(name);if(name!=='time_off')return collection;
        return new Proxy(collection,{get(target,key){if(key==='insertOne')return async record=>{if(record._id==='l1')throw new Error('Injected interruption');return target.insertOne(record);};
          const value=target[key];return typeof value==='function'?value.bind(target):value;}});}};
    await assert.rejects(()=>migrateTimeOff(wrapper),/Injected interruption/);
    assert.equal(await interrupted.collection('leaves').countDocuments({}),4);
    assert.equal(await interrupted.collection('migrations').countDocuments({}),0);
    assert.equal((await migrateTimeOff(interrupted)).migrated,4);
    // Never overwrite an incompatible record, even when company IDs differ.
    await interrupted.collection('migrations').deleteOne({_id:TIME_OFF_MIGRATION});
    await interrupted.collection('time_off').updateOne({_id:'l0'},{$set:{companyId:'other'}});
    await assert.rejects(()=>migrateTimeOff(interrupted),/Conflicting target/);
    assert.equal((await interrupted.collection('time_off').findOne({_id:'l0'})).companyId,'other');
    const invalid=await seed('migration_invalid');
    await invalid.collection('leaves').updateOne({_id:'l0'},{$set:{status:'UNKNOWN'}});
    await assert.rejects(()=>migrateTimeOff(invalid),/Unsupported legacy/);
    assert.equal((await invalid.listCollections({name:'time_off'}).toArray()).length,0);
    const empty=client.db('migration_empty');
    assert.equal((await migrateTimeOff(empty)).migrated,0);
    assert.equal((await migrateTimeOff(empty)).alreadyApplied,true);
    console.log('PASS real MongoDB: actual collection names, string/ObjectId IDs, BSON dates, companies, nullable historical policies, payroll references, tombstones, indexes/validators, counters, idempotency, interruption recovery, conflict protection and empty database.');
  } finally {
    await client.close();
    child.kill('SIGTERM');
    if(child.exitCode===null && !launchError) await new Promise(resolve=>child.once('exit',resolve));
    fs.rmSync(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
