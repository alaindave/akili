# TimeOff migration — Stage 1

Status: implementation and isolated database verification complete; awaiting Stage 1 review. Stages 2–4 are not implemented by this change. No application/production database was migrated.

## Scope and architecture findings

The complete `time-off-refactoring-migration.md` and `ARCHITECTURE.md` were read before implementation. The shared source of truth is `client/src/common/types/hr/time-off/TimeOff.ts`; it exports TimeOff, TimeOffCategory, PayrollTreatment, TimeOffStatus, TimeOffMotif and TimeOffMotifSnapshot. `TimeOffWithEmployee` was not found. Shared types were not changed.

The impact search found Leave references in 78 source files, including schema/repositories, attendance operations, preload/IPC, sync push/pull and counters, backend routes, approval flows, notifications and renderer screens. The inspected payroll schemas do not declare a foreign key to `leaves`; employee balances and historical payroll payloads must nevertheless remain unchanged. Runtime changes belong to subsequent stages.

SQLite opens a separate `Akili_db` per company using `sqlite3`, WAL, foreign keys and a serialized transaction queue. Most schema upgrades happen inside table initialization. `db.ts` also defines a `migrations(name, runAt)` ledger, but the initializer does not register named migrations. The new migration uses this existing ledger shape and records completion inside the same transaction as the changes. Its database adapter is compatible with existing all/get/run/transaction helpers; the explicit maintenance command uses `sqlite3` and `BEGIN IMMEDIATE`.

Mongoose's current `Leaves` model maps to `leaves`; `SyncCounter` maps to `synccounters`. Both mappings were verified with the installed Mongoose version. Existing backend upgrades are startup functions. This migration is instead an explicit source-checkout maintenance command, as required by the specification. It requires the existing TypeScript development dependency to load the shared authoritative enums; it is not a packaged/dist-only command.

## Migration identity and storage

Migration name, both databases: `20261020_time_off_v1`.

Canonical request table/collection: `time_off`. Canonical motif table/collection: `time_off_motifs`. Stage 2 must introduce explicit Mongoose model mappings `TimeOff` → `time_off` and `TimeOffMotif` → `time_off_motifs`; those model changes are deliberately not part of Stage 1.

SQLite transaction:

- Preflight foreign-key enforcement/integrity, company ownership, employee association, legacy status, ID and version validity, and conflicting destination tables.
- Refuse unknown leaves triggers/views instead of silently rewriting their behavior.
- Rename `leaves` to `leaves_legacy_time_off_v1`, retaining every original row, column and index. SQLite automatically retargets any historical inbound foreign keys to this archive; their records remain resolvable. The test fixture exercises this with a historical adjustment. Current application schemas have no such inbound Leave FK.
- Create the canonical tables and indexes. Motifs have unique `(companyId, code)` and `(companyId, _id)` keys. Requests enforce same-company employee and motif references and restrict referenced motif deletion. A unique `(companyId, _id)` employee index supports the employee FK.
- Copy original IDs, company/employee associations, dates, notes, approval fields when present, version/timestamp/sync metadata and tombstones. Keep a complete `legacyData` JSON copy of every original row, including unknown columns and `submittedMonth`.
- Map `ATTENTE_APPROBATION` → `PENDING`, `APPROUVÉ` → `APPROVED`, `REFUSÉ` → `REJECTED`, `ANNULÉ` → `CANCELLED`. Unknown statuses stop the migration. Already canonical statuses are also recognized.
- Preserve `sync_queue` byte for byte, including acknowledged history and pending changes. Retain the `leave` cursor and copy its value/timestamp to the company-scoped `time_off` cursor. Conflicting pre-existing canonical cursors abort the transaction. Stage 3 must adapt legacy queued operations; this migration does not change their serialized entity names or payloads.
- Verify copied fields, foreign keys and SQLite integrity before writing the completion marker. Any failure rolls back table rename, schema, copied records, cursor alias and marker together. Repeating a completed migration does not duplicate data.

MongoDB procedure:

- Preflight all source records. Preserve BSON ID types, including string and ObjectId request IDs, and original BSON dates. Invalid/unexpected records stop migration instead of being coerced.
- Create explicit canonical collections with validators and indexes. Preserve ordinary source indexes; TTL/partial indexes require manual review because blindly copying them could delete or hide migrated history.
- Copy each document while retaining all original fields and a full `legacyData` document. Never modify or drop `leaves`. Reuse existing matching copies on retry; reject conflicting target documents, including company mismatches, without overwriting them.
- Verify every copied document and the destination count before marking completion.
- Preserve all document versions/timestamps and the legacy counter. Set the canonical `time_off` counter to at least the maximum source record version and legacy counter, using `$max` so an existing higher canonical counter cannot decrease.
- Retain the source collection indefinitely during this staged refactor. Copy/verify is retryable on standalone MongoDB without requiring replica-set transactions. An interruption can leave partially copied target data, but no completion marker; retry under maintenance completes matching copies. Unexpected destinations/validators stop for review.

## Unknown historical policies

Old motif text cannot establish category, payroll treatment, deduction policy or approval rules. No default motifs, categories, pay rates or historical snapshots are invented.

Migrated requests have `motifId = null`, no fabricated snapshot, and `legacyNeedsReview = 1` (SQLite) / `true` (MongoDB). The original reason/status and all other source fields remain in `legacyData` and the archive/source. Fresh requests require a motif reference; the nullable migration exception is guarded by explicit legacy metadata.

This is a deliberate **migration persistence envelope**, not a valid new-request `TimeOff` DTO: the shared contract requires a string motifId. Stages 2–4 must recognize the unresolved legacy envelope, keep it out of new-policy recalculation, and expose an explicit review/mapping process. They must not cast it blindly to TimeOff or infer payroll treatment from old labels. Existing employee balances, finalized payroll records, audit data and notification history are untouched.

`TimeOffMotif` does not yet declare synchronization metadata. The SQLite motif table reserves the project's normal version/sync/deletion fields as persistence metadata; Stage 3 must settle the sync DTO without unnecessarily modifying the domain contract. No system-default policy is seeded. PARTIALLY_PAID still has no defined percentage/formula and is not inferred by this migration.

## Files added in Stage 1

- `client/src/common/migrations/timeOffLegacy.ts` — authoritative status mapping and fail-safe legacy validation.
- `client/src/electron/database/migrations/timeOff.migration.ts` — transactional canonical schema/data migration.
- `client/scripts/time-off-migration-loader.mjs` — shared TypeScript source loader for explicit maintenance/tests.
- `client/scripts/migrate-time-off.mjs` — actual sqlite3 maintenance command, explicit file/company/manifest checks.
- `client/scripts/check-time-off-migration.mjs` — SQLite migration and CLI integration tests.
- `server/migrations/time-off.mjs` — retryable MongoDB migration, validators and index/counter verification.
- `server/scripts/migrate-time-off.mjs` — explicit MongoDB maintenance command.
- `server/scripts/check-time-off-migration.mjs` — real temporary local MongoDB integration tests.
- `docs/time-off-stage-1-report.md` — this report and operational procedure.

Existing user edits and earlier motif changes were retained. No Stage 2 model/service/API changes, Stage 3 runtime/IPC/sync cutover, or Stage 4 renderer/payroll changes were implemented in this stage.

## Execution and rollback

**Do not execute against active application databases while only Stage 1 is installed.** Existing startup code and repositories still use `leaves`; opening the old application after SQLite migration could recreate that table. These explicit commands are for backup copies/rehearsal now and for the coordinated release after the runtime stages are approved and complete.

Before real deployment:

1. Complete and approve later runtime stages, including unresolved legacy handling and queue adapters.
2. Stop desktop writers, backend writers, sync workers, scheduled jobs and integrations for the maintenance window. The confirmation flag is an operator acknowledgement, not an automatic distributed lock.
3. Create and verify restorable SQLite backups, including any live WAL content using a consistent backup/checkpoint procedure; back up MongoDB source collections, counters and migration metadata. Do not copy only an active SQLite main file while writes/WAL are pending.
4. Rehearse on backups and resolve validation failures; do not bypass them.
5. Run the explicit commands from the source checkout with installed client/server dependencies. Node 22.23.2 was used for verification.

From the repository root:

```sh
node client/scripts/migrate-time-off.mjs /absolute/company-directory/Akili_db COMPANY_ID --maintenance-confirmed
```

The SQLite command requires an existing database and adjacent `company.json` with the same companyId. It never creates or scans unrelated company databases. Repeat separately for each intended company. Fresh company schema provisioning will be connected during Stage 3; the migration can initialize an empty legacy domain when the employee table exists.

```sh
# Set TIME_OFF_MIGRATION_URI securely in the environment first.
node server/scripts/migrate-time-off.mjs DATABASE_NAME --maintenance-confirmed
```

The MongoDB command takes an explicit database name and migrates all companies within that selected database while retaining each association. It does not use the application's default connection implicitly and was not run against a configured application database.

If migration validation fails, SQLite rolls back automatically; MongoDB source data remains intact and matching partial target copies may be retried. For rollback before resumed writes, restore the verified pre-migration SQLite backup and MongoDB backup, or retain the legacy backend mapping while reviewing the untouched `leaves` source. Do not delete canonical data or simply rerun old software after post-cutover writes; a rollback after new writes requires a reconciled export/restore plan. Never reset version counters to lower values.

## Verification

Executed with Node 22.23.2 unless noted:

- `node client/scripts/check-time-off-migration.mjs` — PASS. In-memory SQLite plus the real sqlite3 CLI on a disposable database file. Tests both historical `subject` and `motif` schemas, all statuses, unknown columns, approval/timestamp/sync preservation, tombstones, payroll references, archive relationships, same-company foreign keys, unchanged pending queue, cursor isolation, retry/idempotency, empty domain and late-failure rollback. Also checks rejection of invalid company/status/employee, conflicting destinations and custom triggers.
- `node server/scripts/check-time-off-migration.mjs` — PASS against a temporary local `mongod`, not a mock or production server. Covers collection naming, string/ObjectId IDs, BSON dates, multiple companies, historical fields/payroll links, tombstones, validators/unique indexes, non-decreasing counters, repeated runs, injected interruption/recovery, conflicting targets, invalid statuses and empty database. Temporary server and data are cleaned up.
- Strict focused TypeScript check of the shared legacy helper and SQLite migration — PASS.
- `tsc -p server/tsconfig.json --noEmit` — PASS.
- `tsc -p client/src/electron/tsconfig.json --noEmit` — FAIL in existing/in-progress Attendance and Leave runtime code (legacy French enum values and obsolete fields against new contracts). These are deferred to the authorized runtime stages; the new migration modules have no reported errors.
- `npm --prefix client run lint` — FAIL on existing project-wide issues; the first run also exposed CommonJS lint issues in the new scripts, which were converted to ES modules. Focused lint on all added client and server migration code — PASS. Final full client ESLint run using Node 22 — FAIL with 636 errors and 27 warnings, with no diagnostics in the new migration files.
- `git diff --check` — PASS for tracked changes.

Production builds and UI/runtime integration tests are deferred to the later stages. No claim is made that the partially refactored application currently builds or can safely run against the migrated schema.
