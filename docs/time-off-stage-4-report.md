# TimeOff refactor — Stage 4 implementation report

**Status: Stage 4 implementation completed; existing Electron compilation errors remain in the older Attendance and Leave compatibility code.** The TimeOff renderer now uses the canonical API. No company database was migrated and no payroll run was changed.

## Changes

- Added the TimeOff renderer page with employee/motif selection, date and partial-day fields, existing employee-document selection, motif policy controls, status/month filtering, manager approval/rejection/cancellation, explicit legacy review, and offline sync state.
- Switched the HR Leave route and Employee Quick Actions to the canonical TimeOff page. Employee history reports now read canonical requests and show the approved motif snapshot and recorded balance days.
- Added React Query hooks and expanded the preload/IPC API for edits, transitions, legacy review, and motif deactivation.
- Added a main-process TimeOff service that derives actor identity from the secure local session, enforces manager-only policy actions and motif requirements, records transactional audit events, and queues an idempotent request email to the existing company contact.
- Updated daily attendance marking to derive leave attendance from approved canonical `LEAVE` motifs only. Attendance edits do not rewrite canonical TimeOff requests.
- Added the explicit legacy-review push operation. It uses the server review endpoint and retires old queued Leave entries for that request only after the server accepts the review.
- Payroll was inspected: payroll calculation consumes generic attendance `absentDays`; it does not read Leave or TimeOff policy. The Stage 2 server applies approved balance deductions and stores `motifSnapshot`/`balanceDaysDeducted`. Finalized payroll snapshots are not recalculated. The percentage/formula for `PARTIALLY_PAID` is undefined, and the server refuses partial-day balance deductions until that rule is defined.

## Verification

- Client renderer production build with Node 22 — PASS (Vite built 2,142 modules; existing large-chunk advisory remains).
- `client/scripts/check-time-off-migration.mjs` — PASS (legacy preservation, idempotency, isolation, payroll links, and rollback).
- `server/tsconfig.time-off.json` TypeScript check — PASS.
- `server/scripts/check-time-off-backend.mjs` — PASS (policy API, isolation, approval snapshots, balances, documents, concurrency, legacy review, and finalized payroll preservation).
- `git diff --check` — PASS.
- Full Electron TypeScript check — FAILS on existing `attendances.repository.ts`, `leaves.repository.ts`, `leaves.ipc.ts`, `leaves.preload.cts`, and `markEmployeesAbsentLocal.service.ts` diagnostics: obsolete French Leave status/field contracts and Attendance enum values. No diagnostics were emitted for the new TimeOff IPC/preload/service/sync modules.
- `npm run build:renderer` and `npm run test:time-off` first ran under an old system Node and failed before compilation. Equivalent renderer and backend verification was then run explicitly under Node 22; see results above.

## Migration and deployment

- Canonical SQLite tables and migration version remain as reported in Stage 1: `time_off`, `time_off_motifs`, migration `time_off_legacy_v1`. MongoDB remains `time_off` and `time_off_motifs`; use the explicit maintenance migration procedures described in earlier stage reports.
- Existing ambiguous requests remain in the legacy review envelope until a manager explicitly associates a motif. Their original Leave data and payroll references remain preserved.
- No production/active company database was migrated. Rehearse the explicit migration against restorable backups after the outstanding legacy Electron type errors are resolved.

## Remaining issues

- Resolve the listed Electron TypeScript errors in legacy Attendance/Leave compatibility code before shipping the desktop application.
- Define the business rule for `PARTIALLY_PAID`, plus partial-day leave-balance deduction, before enabling those policies for affected requests.
- The manager email notification uses the company email already used by attendance notifications; confirm that remains the desired recipient for TimeOff requests.

Stage 4 implementation stops here. This completes the four-stage implementation sequence; no later stage is pending.
