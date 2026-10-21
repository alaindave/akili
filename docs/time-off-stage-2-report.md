# TimeOff refactor — Stage 2 review

Stage 1 was explicitly approved in the conversation. Stage 2 backend implementation is complete and awaiting review. Stage 3 and Stage 4 have not been started. No application/production database was changed or deployed.

## Implemented backend

The canonical Mongoose models are `TimeOff` → `time_off` and `TimeOffMotif` → `time_off_motifs`, with explicit collection names and the same named indexes as Stage 1. Automatic collection/index creation is disabled for these models. Operations require the completed MongoDB migration marker `20261020_time_off_v1`, otherwise the API returns 503. Neither startup nor the API runs the migration.

Models and API input types import the existing shared TimeOff contracts directly. Storage-specific types extend these contracts for BSON dates, migrated ObjectId IDs, nullable unresolved legacy motifs, synchronization fields and supporting-document/balance metadata. No shared types were duplicated or changed.

The server TypeScript root now includes the shared source tree. The compiled backend lives under `server/dist/server` and its shared contracts under `server/dist/client`. The build creates compatibility entry files so existing `node dist/index.js`, `npm start`, and the create-company command continue to work. Build from the complete repository checkout; a server-only checkout lacking `client/src/common/types/hr/time-off/TimeOff.ts` is insufficient.

Request flow is Express authentication/current-account verification → request validation → service → company-scoped repository → Mongoose. Responses retain the explicit legacy envelope instead of claiming unresolved historical records are valid new-request TimeOff DTOs.

## HTTP contracts

All canonical endpoints are below `/time-off`. Requests require the existing `x-auth-token` header. Company identity comes from the verified JWT and current, non-deleted admin-user membership. The current database role overrides stale token privileges. Body-supplied `companyId`, approval metadata, snapshots, status, synchronization fields and other unknown properties are rejected.

| Operation | Endpoint | Required role |
| --- | --- | --- |
| List/get motifs | `GET /time-off/motifs`, `GET /time-off/motifs/:id` | VIEWER, ADMIN, MANAGER |
| Create/edit motif | `POST /time-off/motifs`, `PATCH /time-off/motifs/:id` | MANAGER |
| Deactivate motif | `DELETE /time-off/motifs/:id` | MANAGER |
| List/get requests | `GET /time-off`, `GET /time-off/:id` | VIEWER, ADMIN, MANAGER |
| Create/edit pending request | `POST /time-off`, `PATCH /time-off/:id` | ADMIN, MANAGER |
| Approve/reject | `POST /time-off/:id/approve`, `/reject` | MANAGER |
| Cancel pending request | `POST /time-off/:id/cancel` | ADMIN, MANAGER |
| Cancel approved request | `POST /time-off/:id/cancel` | MANAGER |
| Soft-delete request | `DELETE /time-off/:id` | MANAGER; approved requests must be cancelled first |
| Update additional notes | `PATCH /time-off/:id/notes` | ADMIN, MANAGER |
| Review pending legacy request | `POST /time-off/:id/review-legacy` | MANAGER |

List filters are `employeeId`, canonical `status`, submission `month=YYYY-MM`, and `includeDeleted=true|false`. Results are always company-scoped. The default list excludes tombstones; explicit historical reads preserve them. Date filtering supports the BSON dates and date strings retained by migration.

Motif creation requires all policy fields explicitly: `code`, `label`, `category`, `payrollTreatment`, `deductFromLeaveBalance`, `requiresApproval`, `requiresJustification`, `requiresSupportingDocument`, `isActive`. `_id` is optional; otherwise the server generates a UUID. Codes use uppercase letters, digits, `_` and `-`, with a 64-character maximum. `(companyId, code)` is unique. Users cannot create or edit protected system defaults. No default policies are seeded.

Request creation accepts `employeeId`, `motifId`, calendar `startDate`/`endDate`, optional `_id`, `isPartialDay`, `startTime`/`endTime`, `notes`, `additionalNotes` and `supportingDocumentIds`. Client status/snapshot/approval/version fields are forbidden. Creation returns 201; conflicts/duplicate IDs return 409 without creating another record.

Updates and actions require the current `serverVersion`. Edits include that version plus allowed changed fields. Approval/cancellation/deletion use `{ serverVersion }`; rejection also requires `rejectionReason`; notes require `additionalNotes`. A stale version returns 409. Legacy review accepts `{ serverVersion, motifId, notes?, supportingDocumentIds? }` and is only available for unresolved pending requests.

The retired `/leaves` HTTP route returns an authenticated 410 `TIME_OFF_API_REQUIRED` response instead of writing the archived collection. Old unscoped Leave CRUD helpers were removed from `server/db.ts`. Employee hard deletion now refuses employees with TimeOff history; no TimeOff history is cascade-deleted.

## Business behavior and history

- Each new or edited pending request resolves an active motif and non-deleted employee in the authenticated company.
- `requiresJustification` requires non-whitespace notes.
- `requiresSupportingDocument` requires at least one uploaded, non-deleted employee document belonging to that same company and employee. `supportingDocumentIds` reuses existing employee-upload storage; no new upload system is introduced. All supplied document IDs are validated even when documents are optional, and checked again at approval.
- `requiresApproval=true` creates a pending request; otherwise the service approves automatically and records the initiating actor. Explicit approval/rejection follows the existing manager-only UI convention.
- Approval creates the policy snapshot from the effective motif at that transition. Approved requests cannot have dates, motif or original justification rewritten. Additional notes can still be updated without changing the snapshot.
- Motif edits/deactivation do not mutate requests or finalized payroll. DELETE on a motif deactivates it and keeps its record/code/references. A private policy-use revision serializes concurrent motif use against policy edits within transactions; it is not a domain policy or a client version.
- Dates and times are validated without inventing scheduling rules. Partial-day requests require one date and ordered HH:mm times. Switching a pending request to a full day removes obsolete times.
- Server approvals honor `deductFromLeaveBalance` using the existing full-day inclusive calendar-day calculation. Request status, employee balance and both server-version allocations commit in one MongoDB transaction. Cancellation restores only the recorded applied delta; concurrent/repeated actions cannot apply it twice. This is the backend approval behavior; local/offline balance integration remains for the later stages.
- Partial-day requests that would deduct leave balance are blocked at approval with `PARTIAL_BALANCE_RULE_UNDEFINED`. No hours-to-days conversion is fabricated.
- Payroll treatment, including PARTIALLY_PAID, is captured in the snapshot. Stage 2 does not calculate payroll or invent a partial-pay percentage/formula. Payroll integration is still Stage 4.

Stage 1 legacy records remain readable with `motifId=null`, `legacyNeedsReview=true` and original `legacyData`. Already approved historical requests cannot be retroactively mapped, cancelled with an inferred refund, or assigned an invented snapshot. They may receive additional notes while their policy/history remains intact. Unresolved pending requests may be explicitly mapped by a manager, with current policy requirements checked; their original migration data is retained. Invalid legacy dates block processing rather than producing an invalid balance calculation.

Both string and migrated ObjectId request identifiers work without rewriting stored IDs. Ambiguous same-company string/ObjectId representations are rejected, and new explicit IDs cannot collide with a migrated ObjectId's textual representation.

## Stage boundary and deployment requirements

This intermediate stage is **not ready for deployment with the current desktop client**. The following remain intentionally deferred:

- Stage 3: Electron repositories/services, IPC/preload, renderer-facing contracts, motif/request sync registration, legacy queued payload adaptation, cursor/conflict/retry handling and dependency ordering.
- The old `leave.model.ts`, `syncLeave` and legacy `/sync` handlers remain only for the existing synchronization path, which belongs to Stage 3. They were not silently pointed at the canonical collection or allowed to bypass new policy validation. Do not deploy Stage 2 while that path still writes the legacy source collection.
- Stage 3 must call the authoritative policy workflow for synchronized request transitions, omit private motif-use metadata, and persist attachment IDs/applied balance metadata locally where needed. The new backend storage fields `supportingDocumentIds` and `balanceDaysDeducted` extend persistence/API metadata without changing the shared domain contract. The Stage 1 SQLite schema does not yet have dedicated columns for these service metadata fields; that compatibility work must be explicit in Stage 3.
- Offline approvals must not both upload an old employee balance snapshot and apply the server approval delta again. That reconciliation is part of the upcoming synchronization work.
- Stage 4: renderer/forms, payroll calculations, audit events, notifications, reports and end-to-end UI tests. No production salary or historical payroll data has been recalculated.

The new writes use the repository's existing MongoDB transaction convention. Deployment requires a replica set or transaction-capable MongoDB service; a standalone database is suitable for the Stage 1 migration but not the transactional approval API. Integration verification used a temporary local single-node replica set. Run Stage 1 explicitly during the eventual coordinated cutover; the API fails closed until its marker is present.

## Files changed in Stage 2

Added:

1. `server/types/timeOff.ts`
2. `server/models/modules/hr/timeOff.model.ts`
3. `server/models/modules/hr/timeOffMotif.model.ts`
4. `server/validation/timeOff.validation.ts`
5. `server/repositories/timeOff.repository.ts`
6. `server/services/timeOff.service.ts`
7. `server/routes/modules/hr/timeOff.route.ts`
8. `server/scripts/check-time-off-backend.mjs`
9. `server/scripts/write-build-entry.mjs`
10. `server/tsconfig.time-off.json`
11. `docs/time-off-stage-2-report.md`

Modified:

12. `server/index.ts` — mount canonical API; remove obsolete automatic subject-to-motif startup rewrite.
13. `server/db.ts` — remove retired Leave CRUD/cascade deletion; protect TimeOff employee history.
14. `server/routes/modules/hr/leave.route.ts` — explicit authenticated retirement response.
15. `server/utils/syncVersion.ts` — allocate canonical request/motif entity versions for backend writes; no push/pull registration in this stage.
16. `server/tsconfig.json` — include the authoritative shared source in compiled output.
17. `server/package.json` — build entry generation and `test:time-off` command.

Existing user changes and Stage 1 files were preserved. A Stage-2-only review patch is generated from the captured pre-Stage-2 file contents, not from an assumption that the initial working tree was clean.

## Executed checks

Node 22.23.2 was used for test commands.

| Check | Result |
| --- | --- |
| `tsc -p server/tsconfig.time-off.json` (strict, no unused locals/parameters) | PASS |
| `npm --prefix server run build` | PASS, including shared contracts and compatibility entry generation |
| `node server/scripts/check-time-off-backend.mjs` | PASS against real migrated MongoDB + replica-set transactions + HTTP/JWT |
| Focused ESLint on added/replaced Stage 2 backend code | PASS |
| `npm --prefix client run lint` | FAIL: existing 636 errors and 27 warnings; no new TimeOff migration diagnostics |
| `node server/scripts/check-payroll-profile-delete.mjs` | PASS |
| `node server/scripts/check-task-incident-modules.cjs` | PASS |
| `node server/scripts/check-incidents.cjs` | Existing failure: expected empty array, received undefined at line 102 |
| `node server/scripts/check-media-sync.cjs` | Existing failure: test model is not a constructor |
| `node server/scripts/check-inventory-models.cjs` | Existing failure: quantityReserved validation expectation |
| `node server/scripts/check-inventory-sync.cjs` | Existing failure: undefined reference-type list in test schema loading |
| `git diff --check` | PASS |

All four failing regression scripts were rerun with the captured pre-Stage-2 versions of changed files supplied in memory; each reproduced the same failure. No application files were reverted for this comparison and unrelated tests were not rewritten to hide failures.

The TimeOff integration test covers migration readiness, missing bodies/authentication, current membership and stale-token roles, cross-company reads/writes/references, protected defaults, unique motif codes, deactivation/reactivation, canonical enum/date validation, client-forged server fields, approval snapshots, atomic balance effects and rollback, simultaneous approvals, cancellation/deletion, partial-day transitions, supporting-document requirements, legacy ObjectId preservation, explicit pending-legacy review, non-decreasing versions and unchanged finalized payroll/source records. The test database and local MongoDB process are temporary and cleaned up.

Stage 2 is ready for review. Explicit conversational approval is required before Stage 3 begins.
