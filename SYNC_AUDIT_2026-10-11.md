**HR and inventory synchronization audit — 11 October 2026**

The current implementation cannot be considered safe from data loss. This review traced local persistence and queue capture, push dispatch and acknowledgements, server models and writes, version allocation, pull pagination and application, attachments, and related regression tests. It reviewed the current working tree, including existing uncommitted work. No application behavior or production data was changed during this audit.

The audit used source inspection, existing local tests, and six isolated reproductions against actual synchronization functions with in-memory adapters. It did not connect to a deployed server, a live MongoDB replica set, Supabase, or a user's SQLite database. Passing tests below do not establish that deployed data is complete.

**Coverage**

| Records/workflows | Sync path found | Important limits |
| --- | --- | --- |
| Employees and account numbers | Employee push/pull; account propagation to payroll profiles | Nontransactional creation; snapshot conflicts; pull race |
| Employee photos | Separate push; employee-backed pull with its own cursor | Existing photo tests pass; shared version publication risk remains |
| Employee documents | Multipart push, cloud storage, versioned metadata pull and download | Attachment collisions, unsafe replacement, stale replays |
| Attendance and daily checks | Dedicated push/pull handlers | Attendance reconciliation tests pass; local write/queue atomicity is incomplete |
| Leave and remaining leave balances | Leave and employee snapshots | Related writes are separate; generic snapshot conflict policy |
| Payroll settings, components, employee profiles | Dedicated push/pull handlers | Several writes enqueue after committing; generic snapshot conflict policy |
| Payroll runs, results, items | Dedicated handlers and transition validation | Individual payroll tests pass; global version and pull-blocking risks remain |
| Attendance settings | Company record | Migration, authorization, queue and pull tests pass |
| Inventory categories, units, items | SQLite triggers, generic inventory server handler and pull applier | Fresh database failure; timestamp conflicts |
| Warehouses and locations | Same inventory path | No atomic parent/child publication across entities |
| Stock documents, lines, movements, balances | Transactional local posting, independent server snapshots | Lost balance updates and partial server posting |
| SKU settings | Inventory snapshot path | Shared snapshot conflict policy; not a distributed numbering reservation |
| Opening stock | Dedicated server transaction and company claim | Existing opening-stock tests pass; distinct from ordinary stock posting |
| Tasks/comments and incidents used by both modules | Shared sync paths, module discriminator | Task tests pass; incident sync test currently fails |
| Reports | Derived from the above local records | Their correctness depends on those records arriving consistently |

All ten currently registered inventory persistence entities appear in both client and server dispatch. Inventory count/reservation/settings types alone are not proof of an implemented persistence or sync workflow; no corresponding persisted tables were found in the searched implementation.

**Findings, ordered by risk**

1. **P1 — Concurrent offline stock operations overwrite each other's balances.**

   `server/sync.ts:63` handles balances with the same full-document replacement used for catalog data (`replaceOne` at line 109). `client/src/electron/database/repositories/modules/inventory/inventoryTransaction.repository.ts:69` saves absolute quantities. Two devices starting at 10 and receiving 2 and 3 independently produce snapshots of 12 and 13; the server ends at 13 rather than 15, although both movements can be accepted. This was reproduced against the actual server sync function. Compare-and-swap inside the server retry loop does not merge business operations: the later retry still replaces the entire total. Ordinary stock operations need idempotent server-side posting and transactional balance calculation, with a defined reconciliation policy for offline overselling. Existing balances must be reconciled against movements before trusting them.

2. **P1 — Pull cursors can permanently skip late-committing writes.**

   `server/utils/syncVersion.ts:25` increments a counter before ordinary writes commit; examples are `server/sync.ts:108` and `server/sync.ts:159`. `server/routes/shared/sync.route.ts:216` pulls only versions greater than the cursor and advances to the last visible version. Reproduced: writer A allocates a lower version and pauses before saving, writer B saves a higher version, a client pulls B, then A saves. All subsequent incremental pulls omit A until it receives another update or the cursor is reset. The same publication pattern is shared by HR. Version publication must be atomic with persistence or pulls must use a safely committed watermark/change log; merely sorting by version does not fix this race.

3. **P1 — Acknowledged success can mean an offline edit was discarded.**

   `server/sync.ts:89` and `server/sync.ts:137` return success whenever the stored timestamp is greater than or equal to the incoming timestamp, without verifying payload equality or checking the client's base revision. `server/routes/shared/sync.route.ts:755` then acknowledges the queue entry; `client/src/electron/services/shared/sync/push.service.ts:640` retires accepted entries. A different snapshot with the same timestamp was reproduced as acknowledged but not saved. Device clock skew also permits a stale snapshot with a future timestamp to overwrite newer work. This affects generic HR handlers and inventory. Use explicit base revisions and return a durable conflict for unequal payloads; reserve successful replay acknowledgement for the same operation/payload. Preserve both sides of a conflict for reconciliation.

4. **P1 — Several HR mutations can commit without a durable sync entry.**

   `client/src/electron/database/repositories/modules/hr/employees.repository.ts:42` inserts the employee, initializes payroll profiles at line 100, then enqueues the employee at line 118. Injecting a payroll-initialization failure reproduced an inserted employee with no create queue entry. Similar separate writes exist in payroll profiles/settings/components, attendance/daily checks, leaves and employee documents. Push reads `sync_queue`, not all records with `synced = 0` (`shared/sync.repository.ts:57`), and startup has no general HR recovery equivalent to inventory queue backfill. A crash, disk error or intermediate exception can strand records; later update-only snapshots may fail with MISSING_RECORD. Commit each business mutation and its queue entries in one SQLite transaction, including related records, and add a careful migration/recovery path for already stranded records.

5. **P1 — Employee pull can acknowledge a local edit it deliberately skipped.**

   `client/src/electron/database/repositories/modules/hr/employees.repository.ts:543` returns without applying a server record when local changes are unsynced. `client/src/electron/services/shared/sync/pull.service.ts:749` nevertheless calls `markEmployeeSynced` and reports success. The batch pending check at line 1505 occurs before application and is not atomic with concurrent UI writes. A controlled reproduction confirmed that a skipped upsert is marked synced and the batch succeeds. An edit arriving after the queue check can therefore be falsely marked synchronized, and the cursor can advance over unapplied remote data. There is also a read/update race inside the nontransactional employee upsert. Use a transaction with an internal pending/revision check, return an explicit applied/deferred result, and retain the cursor on deferral. Audit the analogous leave/settings/component wrappers as well.

6. **P1 — Employee documents can be assigned another employee's bytes.**

   `client/src/electron/database/repositories/modules/hr/employeesDocuments.repository.ts:123` builds filenames from first name, last name and document type. `server/routes/shared/sync.route.ts:613` selects the first uploaded file with that filename. The filenames are not unique across employees. Reproduced with two same-name attachments: both document records were acknowledged and both received the first attachment. `server/sync.ts:843` uploads bytes without verifying the supplied document hash, and `client/src/electron/util/downloadEmployeeDocument.util.ts:52` writes downloads without hash verification. Bind attachments to a unique queue/document identifier and verify hashes before acknowledging or replacing files.

7. **P1 — Document replacement and replay can destroy the only valid attachment.**

   Locally, `employeesDocuments.repository.ts:117` deletes the previous file before writing the replacement and committing metadata/queue entries. On the server, `server/sync.ts:828` uses a stable company/employee/document-type object path and overwrites it before the MongoDB metadata write; deletion removes the object before marking the record deleted. A failed write can leave metadata pointing at missing or different bytes. Unlike the photo path, `syncEmployeeDocument` also lacks a stale-version/timestamp guard: an older device can overwrite a newer document, and retries allocate fresh versions. Use immutable content-addressed/versioned objects, verify uploaded data, commit metadata conditionally, then retire obsolete files after success. Use temporary local files and atomic rename, retaining the previous file until the new state is durable.

8. **P1 — Ordinary stock posting is not atomic on the server.**

   Local posting correctly uses a SQLite transaction. The `/sync/push` loop (`server/routes/shared/sync.route.ts:383`) commits documents, lines, movements and balances individually and continues after failures. The generic inventory handler validates a single model, not the existence/ownership of its referenced parent records. A document number conflict can fail the parent while dependent lines/movements/balances succeed. Two devices creating a previously absent stock bucket also generate different UUIDs (`inventoryTransaction.service.ts:343`) for a server bucket with a unique natural key (`server/models/modules/inventory/inventoryBalance.model.ts:78`); one balance can remain permanently rejected after its movements succeeded. Treat a posted operation as one idempotent aggregate, validate all company-scoped references, and commit it atomically. Opening stock already uses a separate atomic workflow; that protection does not extend to ordinary receipts/issues/transfers.

9. **P1 — A fresh database cannot finish inventory initialization.**

   `client/src/electron/database/schemas/modules/inventory/inventory_items.schema.ts:122` defines `inventory_categories` without a `code` column, but line 138 declares `UNIQUE(companyId, code)`. The unmodified inventory sync test reproduces SQLite's `no such column: code`. `schemas/shared/initializeDatabase.ts:44` calls this before installing inventory sync triggers. Existing databases can hide the bug: the stock transaction test explicitly precreates a category table with `code`. Add the missing fresh-schema field and an idempotent compatibility migration for older databases, preserving existing category data and handling duplicate codes explicitly. Validate both fresh initialization and upgrades.

10. **P2 — Large offline backlogs are sent as one request and can fail forever.**

    `client/src/electron/services/shared/sync/push.service.ts:232` serializes every pending record into one multipart field and attaches every pending file. `server/middlewares/sync_upload.ts:5` limits uploads to 100 files and 10 MiB per file; the multipart items field is not given an explicit larger field-size limit. A backlog with more than 100 documents/photos is rejected before per-record processing, and retry sends the same oversized batch. Large JSON fields or a slow upload/processing period can also exceed transport limits. Batch by payload bytes and attachment count while preserving per-record and parent/child ordering; an invalid or oversized attachment should not block unrelated data.

11. **P2 — One permanent conflict can block unrelated pulls without useful diagnostics.**

    The server returns per-record `failed` details and `retryable` flags (`server/routes/shared/sync.route.ts:769`), but push only consumes `synced` IDs. The coordinator retries the same failures ten times. `pullEntityByVersion` blocks an entire entity when any entry for that entity remains pending, then throws; `pullLatestChanges` processes entities sequentially, so a failing employee/document entity can prevent later payroll and inventory pulls. The UI sees a generic pending-count error, not the stored conflict details. Persist structured conflicts and expose resolution information; continue independent pulls safely while deferring affected records/dependencies and retaining their cursors. Do not resolve this by dropping failed queue entries.

**Validation performed**

Node.js 22.23.2 was used explicitly because the shell's default Node.js is too old. The following unmodified scripts passed:

| Client scripts | Server scripts |
| --- | --- |
| `check-sync-reliability.cjs` | `check-inventory-models.cjs` |
| `check-attendance-sync.cjs` | `check-media-sync.cjs` |
| `check-media-sync.cjs` | `check-opening-stock.cjs` |
| `check-individual-payroll.cjs` | `check-task-incident-modules.cjs` |
| `check-inventory-transactions.cjs` | |
| `check-opening-stock-locations.cjs` | |
| `check-task-modules.cjs` | |
| `check-attendance-settings.cjs` | |

Three unmodified scripts failed:

- `server/scripts/check-inventory-sync.cjs`: fresh-schema failure, `no such column: code`.
- `client/scripts/check-payroll-account-sync.cjs`: stale test path, `src/electron/services/sync/push.service.ts` does not exist; the implementation lives under `services/shared/sync`.
- `client/scripts/check-incident-sync.cjs`: acknowledgement assertion fails at line 84. Its generic mock returns an async function for the newly imported synchronous `isInventorySyncEntity`; the resulting Promise is truthy and sends incident acknowledgements down the inventory branch. This test failure is not, by itself, proof of a production incident-routing bug.

Electron and server TypeScript checks passed (`tsc --noEmit -p src/electron/tsconfig.json` from client, and `tsc --noEmit` from server). Renderer checking failed (`tsc --noEmit -p tsconfig.app.json`), including type-only import errors, renderer project imports of Electron repository files, and unused declarations. These failures were present before any application edits in this audit; no application source was edited.

The isolated `/private/tmp/akili-sync-audit.cjs` harness reproduced findings 1, 2, 3, 4, 5 and 6. It loads the real sync functions, uses Mongoose validation and in-memory transport/persistence adapters, and makes no network requests. The employee pull reproduction explicitly simulates the actual repository's void return when an unsynced record is skipped; it is not a real two-process SQLite concurrency test.

A separate diagnostic inventory harness passed all ten entity push/pull checks after supplying an existing category table (with the normal unsynced default) and the missing InventoryDocument constant dependency in the test adapter. These fixture changes are isolated in `/private/tmp/akili-inventory-existing-db-check.cjs`; they do not repair or replace the failing unmodified suite. The test's concurrent-edit case covers edits during a push request, not the multi-device balance or out-of-order commit failures reproduced separately.

**Recommended repair sequence**

First restore fresh-database initialization and repair the stale test adapters. Then make HR writes plus queue capture atomic and fix pull deferral/acknowledgement handling. Address attachment identity and durable replacement before trusting employee documents. Finally define and implement server-side stock operation reconciliation and commit-safe version publication, with multi-device, crash and out-of-order commit regression tests. Those last changes affect sync protocol/business reconciliation and require an explicit design decision before implementation.

For existing installations, a repair must include reconciliation of balances against movements, detection of orphan records/queue entries, attachment hash verification, and a controlled pull rescan for records potentially skipped by cursors. A code fix alone cannot prove that historical data is complete.
