# TimeOff refactor — Stage 3 review

**Status: Stage 3 implementation is ready for review. Stage 4 has not started.** Stage 1 and Stage 2 implementation reports remain as previously recorded. No production or active company database was migrated.

## Changes

- Added a company-scoped SQLite repository for canonical motifs and requests, with offline request creation, local persistence, durable sync queue entries, company/employee/motif checks, and preservation of legacy review envelopes.
- Added `time-off:*` IPC and preload methods and the corresponding renderer-facing `window.electron.hr.timeOff` contract. The existing Leave UI has not yet been switched to this contract; that work belongs to Stage 4.
- Added a TimeOff sync adapter. It sends motifs before dependent requests through the Stage 2 policy API, pulls motifs before requests, stores version/cursor metadata, and does not overwrite a record with local pending edits.
- Added safe retry behavior for a create whose response was lost: the adapter reads the existing ID and acknowledges it only when the submitted fields match. Other version or data conflicts remain queued for review.
- Legacy `leave` queue entries are retained and excluded from the retired `/sync` Leave handler. They are not mapped to a motif automatically. Sync reports that they need explicit review and does not spend the retry loop resubmitting them.
- Startup no longer recreates a `leaves` table alongside a database carrying the canonical TimeOff migration marker. The old Leave IPC remains registered for the pre-migration path, so Stage 4 must switch the renderer before migrated databases are used. The explicit SQLite migration now adds `supportingDocumentIds` and `balanceDaysDeducted` metadata columns idempotently.

## Verification

- `node scripts/check-time-off-migration.mjs` — PASS. SQLite migration, preservation, retry/idempotency, and rollback checks passed after the metadata-column change.
- Electron TypeScript check — FAILS on the existing Attendance and legacy Leave runtime diagnostics recorded in the Stage 2 report (French status values and obsolete Leave fields/types). The check reports no diagnostics in the new Stage 3 repository, IPC/preload contract, or sync adapter.
- `git diff --check` — PASS.
- No production database, online server, or full offline-to-online Electron sync session was exercised in this stage.

## Review notes and rollout requirements

- Legacy Leave requests without an explicitly reviewed motif remain visible in the local/server migration envelope and are not sent as new policy-backed requests. Their queued legacy operations stay pending until a review/mapping workflow resolves them.
- The existing renderer still calls the legacy Leave IPC. Stage 4 must move those screens and their approval flows to the new `timeOff` API before deploying against migrated company databases.
- The current pull adapter reads the company-scoped TimeOff API listing and applies local version cursors. It does not yet use paginated incremental TimeOff sync endpoints; large company histories may make these full listing reads costly.
- Rehearse the SQLite migration on restorable backups only after the remaining stages are complete. No application/production database has been migrated.

Stage 3 is stopped here for review. Stage 4 requires your explicit approval.
