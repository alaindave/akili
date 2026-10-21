import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { isDeepStrictEqual } from 'node:util';
import load from '../../client/scripts/time-off-migration-loader.mjs';
const { TIME_OFF_MIGRATION, legacyTimeOffStatus, validateLegacyTimeOff } = load(
  path.resolve(__dirname, '../../client/src/common/migrations/timeOffLegacy.ts'));
const { TimeOffCategory, PayrollTreatment, TimeOffStatus } = load(
  path.resolve(__dirname, '../../client/src/common/types/hr/time-off/TimeOff.ts'));

const motifValidator = { $jsonSchema: {
  bsonType: 'object',
  required: ['_id', 'companyId', 'code', 'label', 'category', 'payrollTreatment',
    'deductFromLeaveBalance', 'requiresApproval', 'requiresJustification',
    'requiresSupportingDocument', 'isSystemDefault', 'isActive'],
  properties: {
    _id: { bsonType: 'string' }, companyId: { bsonType: 'string', minLength: 1 },
    code: { bsonType: 'string', minLength: 1 }, label: { bsonType: 'string', minLength: 1 },
    category: { enum: Object.values(TimeOffCategory) }, payrollTreatment: { enum: Object.values(PayrollTreatment) },
    ...Object.fromEntries(['deductFromLeaveBalance', 'requiresApproval', 'requiresJustification',
      'requiresSupportingDocument', 'isSystemDefault', 'isActive'].map(key => [key, { bsonType: 'bool' }])),
  },
} };
const requestValidator = { $and: [
  { $jsonSchema: {
    bsonType: 'object', required: ['_id', 'companyId', 'employeeId', 'startDate', 'endDate', 'submittedAt', 'status'],
    properties: { _id: { bsonType: ['string', 'objectId'] }, companyId: { bsonType: 'string', minLength: 1 },
      employeeId: { bsonType: 'string', minLength: 1 }, status: { enum: Object.values(TimeOffStatus) },
      motifId: { bsonType: ['string', 'null'] }, motifSnapshot: { bsonType: ['object', 'null'] } },
  } },
  { $or: [{ motifId: { $type: 'string', $ne: '' } },
    { motifId: null, legacyNeedsReview: true, legacyData: { $type: 'object' } }] },
] };

function convert(row) {
  validateLegacyTimeOff(row);
  if (!(typeof row._id === 'string' && row._id.length) && row._id?._bsontype !== 'ObjectId') {
    throw new Error('Unsupported legacy identifier: migration never converts identifier types');
  }
  return { ...row, status: legacyTimeOffStatus(row.status), motifId: null,
    legacyNeedsReview: true, legacyData: row, migrationVersion: TIME_OFF_MIGRATION };
}

/** Run only under an explicit maintenance window, with all writers stopped.
 * Copy/verify is retryable on standalone MongoDB as well as replica sets.
 * Never overwrite a conflicting target or drop/rename the source collection.
 */
async function migrateTimeOff(db) {
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
  const source = db.collection('leaves');
  const sourceIndexes = names.has('leaves') ? await source.listIndexes().toArray() : [];
  for (const index of sourceIndexes) {
    if (index.expireAfterSeconds !== undefined || index.partialFilterExpression) {
      throw new Error(`Legacy index ${index.name} requires manual review; cannot safely translate expiry/partial rules`);
    }
  }
  // Validate all rows before making changes; actual BSON IDs and dates remain intact.
  if (names.has('leaves')) for await (const row of source.find({})) convert(row);
  const marker = await db.collection('migrations').findOne({ _id: TIME_OFF_MIGRATION });
  if (marker && (!names.has('time_off') || !names.has('time_off_motifs'))) {
    throw new Error('Migration marker exists but canonical collections are missing');
  }
  for (const [name, validator] of [['time_off', requestValidator], ['time_off_motifs', motifValidator]]) {
    if (!names.has(name)) await db.createCollection(name, { validator });
    else {
      // Existing destinations are allowed only when their schema matches our
      // interrupted migration. Never silently replace an unrelated validator.
      const info = await db.listCollections({ name }).next();
      if (!isDeepStrictEqual(info.options?.validator, validator)) throw new Error(`Unexpected ${name} validator; manual review required`);
    }
  }
  const target = db.collection('time_off');
  for (const index of sourceIndexes) {
    if (index.name === '_id_') continue;
    const options = { ...index };
    for (const key of ['v', 'ns', 'key', 'background']) delete options[key];
    await target.createIndex(index.key, options);
  }
  await target.createIndex({ companyId: 1, serverVersion: 1 }, { name: 'time_off_company_version' });
  await target.createIndex({ companyId: 1, employeeId: 1, startDate: 1, endDate: 1 }, { name: 'time_off_employee_dates' });
  await target.createIndex({ companyId: 1, motifId: 1 }, { name: 'time_off_company_motif' });
  await db.collection('time_off_motifs').createIndex({ companyId: 1, code: 1 }, { unique: true, name: 'time_off_motif_company_code' });
  await db.collection('time_off_motifs').createIndex({ companyId: 1, serverVersion: 1 }, { name: 'time_off_motif_company_version' });
  let migrated = 0;
  let maximumVersion = 0;
  if (names.has('leaves')) for await (const row of source.find({})) {
    const expected = convert(row);
    const existing = await target.findOne({ _id: row._id });
    if (!existing) await target.insertOne(expected);
    const saved = existing ?? await target.findOne({ _id: row._id });
    if (!isDeepStrictEqual(saved, expected)) throw new Error(`Conflicting target for legacy time off ${String(row._id)}; nothing overwritten`);
    if (row.serverVersion != null && (!Number.isSafeInteger(row.serverVersion) || row.serverVersion < 0)) {
      throw new Error('Invalid legacy serverVersion');
    }
    maximumVersion = Math.max(maximumVersion, row.serverVersion ?? 0);
    migrated++;
  }
  if (await target.countDocuments({}) !== migrated) throw new Error('Unexpected additional TimeOff documents; destination requires review');
  const counter = await db.collection('synccounters').findOne({ _id: 'leave' });
  if (counter && (!Number.isSafeInteger(counter.value) || counter.value < 0)) throw new Error('Invalid leave version counter');
  await db.collection('synccounters').updateOne({ _id: 'time_off' },
    { $max: { value: Math.max(maximumVersion, counter?.value ?? 0) } }, { upsert: true });
  // Existing legacy counter is retained; no record version or timestamp changes.
  await db.collection('migrations').updateOne({ _id: TIME_OFF_MIGRATION },
    { $setOnInsert: { completedAt: new Date(), source: 'leaves', target: 'time_off', migrated } }, { upsert: true });
  return { alreadyApplied: !!marker, migrated, unresolvedMotifs: migrated };
}
export { migrateTimeOff, convert, requestValidator, motifValidator, TIME_OFF_MIGRATION };
