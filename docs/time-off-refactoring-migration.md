# Akili ERP — Complete TimeOff Refactoring and Database Migration

## Objective

Refactor the existing Leave management implementation into the new configurable **TimeOff** domain across the entire Akili ERP codebase.

The application is an offline-first Electron + React + TypeScript ERP. It uses SQLite for local persistence, Express + Mongoose + MongoDB on the backend, Electron IPC and preload APIs, and background synchronization between local SQLite and the server.

The shared TimeOff types have already been created. Treat these types as the authoritative domain contracts. Do not recreate, duplicate, or unnecessarily modify them.

The task includes:

- Renaming the existing Leave domain to TimeOff.
- Introducing company-configurable TimeOffMotif records.
- Migrating SQLite tables and existing data safely.
- Updating MongoDB models, collections, indexes, and existing data safely.
- Auditing and updating the entire offline synchronization flow.
- Updating payroll integrations, approval workflows, repositories, services, IPC handlers, preload APIs, and renderer references as necessary.

**Do not stop after producing an architectural plan. Inspect the repository, develop an implementation plan, and implement the complete change.**

## 1. Inspect the existing architecture first

Before modifying files, trace the complete existing Leave implementation across:

- Shared TypeScript contracts and enums.
- Electron main process, preload, IPC handlers, and exposed renderer APIs.
- SQLite initialization, schema definitions, migrations, repositories, and services.
- Backend routes, controllers, services, Mongoose models, and synchronization endpoints.
- Background synchronization scheduler, sync orchestration, push/pull logic, conflict handling, version tracking, soft deletion, and retry logic.
- React pages, components, forms, validation schemas, stores, queries, and API calls.
- Payroll calculations, time-off adjustments, leave balances, payslips, and payroll audit records.
- Audit logging, notifications, and any reports or exports that reference Leave.
- Company-specific database context and company isolation.

Search the entire repository for references to Leave, including table names, collection names, filenames, types, enum values, IPC channel names, API routes, SQL queries, and serialized synchronization model identifiers.

Identify every affected component before editing. Follow the existing project conventions and architectural boundaries.

## 2. Use the existing shared types as the source of truth

Use the existing shared contracts:

- `TimeOffCategory`
- `PayrollTreatment`
- `TimeOffStatus`
- `TimeOffMotif`
- `TimeOffMotifSnapshot`
- `TimeOff`
- `TimeOffWithEmployee`

The new domain must support:

### TimeOffCategory

- `LEAVE`
- `ABSENCE`
- `EXIT_PERMISSION`

### PayrollTreatment

- `PAID`
- `UNPAID`
- `PARTIALLY_PAID`

### TimeOffStatus

- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`

Do not retain obsolete Leave-specific types or status enums where they conflict with the new contracts.

Update imports to use the authoritative shared types rather than defining separate, potentially inconsistent types in the renderer, Electron main process, or backend.

Respect the existing TypeScript strictness settings.

## 3. Rename the Leave domain to TimeOff

Refactor all domain-specific code that should now belong to TimeOff, including:

- Interfaces, type aliases, enums, function names, variables, and imports.
- Repository and service names.
- IPC channels and preload API methods.
- Backend routes, controllers, services, and request/response contracts.
- React hooks, components, pages, form schemas, state stores, and query keys.
- Sync model identifiers, registry entries, and handlers.
- Audit event names, notification payloads, and report references where appropriate.

Use `TimeOff` consistently for individual employee time-off requests or recorded events.

Use `TimeOffMotif` for company-configurable policy/reason records.

Avoid broad, blind text replacements. Review each reference in context because some concepts such as leave balances, historical payroll records, and legacy migration code may still need their original terminology.

Update filenames and exported symbols when appropriate. Ensure all imports and references remain valid after any file renaming.

## 4. Add full TimeOffMotif persistence and management

Implement the complete persistence and service flow for company-configurable motifs, including the relevant SQLite and MongoDB models, repositories, services, API endpoints, IPC handlers, and preload methods.

Support the following fields:

- `_id`
- `companyId`
- `code`
- `label`
- `category`
- `payrollTreatment`
- `deductFromLeaveBalance`
- `requiresApproval`
- `requiresJustification`
- `requiresSupportingDocument`
- `isSystemDefault`
- `isActive`
- `createdAt`
- `updatedAt`

Apply validation consistently on the client and server, with authoritative server-side validation.

Enforce company isolation in all reads, writes, updates, deletions, and synchronization operations. A company must not be able to access another company's motifs or requests.

Define appropriate indexes and uniqueness constraints after inspecting existing conventions. In particular, evaluate a unique constraint on `(companyId, code)`.

Prevent unsafe deletion of motifs referenced by existing requests. Prefer deactivation where historical records depend on a motif.

If system-default motifs are needed, implement them in a way that preserves company isolation and does not allow users to modify protected defaults inappropriately. Do not invent business policies without examining existing requirements; document any necessary assumptions.

Ensure newly created and updated motifs can synchronize in both directions.

## 5. Implement TimeOff request and event behavior

Refactor the existing Leave request flow to use the new TimeOff contract.

Persist the following fields correctly:

- `companyId`
- `_id`
- `employeeId`
- `motifId`
- `motifSnapshot`
- `startDate`
- `endDate`
- `isPartialDay`
- `startTime`
- `endTime`
- `notes`
- `additionalNotes`
- `submittedAt`
- `status`
- `approvedBy`
- `approvedAt`
- `rejectionReason`
- `serverVersion`
- `createdAt`
- `updatedAt`
- `lastSyncedAt`
- `synced`
- `isDeleted`

Respect optional fields and the shared TypeScript types.

Resolve the selected motif when creating or processing a request. Validate that the motif belongs to the authenticated company and is active when a new request is created.

Apply motif-specific requirements:

- `requiresApproval`
- `requiresJustification`
- `requiresSupportingDocument`
- `payrollTreatment`
- `deductFromLeaveBalance`

Do not treat these flags as merely decorative configuration. Trace the existing request workflow and implement their effects wherever the current architecture supports them.

For `motifSnapshot`, preserve the applicable policy values at the appropriate business transition, especially approval. Ensure later motif edits do not silently change historical approved requests or payroll calculations.

Handle changes to requests, approval, rejection, cancellation, partial-day requests, and recorded events consistently with the existing application's capabilities.

Do not introduce a separate approval workflow or new document storage system unless the existing architecture requires it.

## 6. SQLite schema and data migration

Inspect the actual SQLite schema, database versioning mechanism, and initialization sequence before writing migrations.

Rename the existing Leave request table to the chosen canonical TimeOff table name, and update all related SQL statements, indexes, foreign keys, joins, and repository queries.

Use `time_off_motifs` as the canonical SQLite table name and `time_off` as the canonical SQLite request/event table name unless existing naming conventions or SQLite constraints justify another documented choice.

The migration must:

1. Preserve existing Leave records and their identifiers.
2. Preserve company and employee associations.
3. Preserve request dates, status, approval metadata, notes, synchronization metadata, and soft-deletion state.
4. Preserve historical leave balance and payroll relationships.
5. Introduce the new motif reference and snapshot fields safely.
6. Create the new motif table, indexes, constraints, and any necessary supporting schema.
7. Update relevant foreign keys and relationship queries.
8. Be transactional wherever SQLite permits.
9. Be safe to run only once and compatible with the application's actual migration/versioning mechanism.
10. Preserve unrelated company databases and shared configuration data.

Do not drop the old table or destroy historical records before they have been migrated and validated.

If a SQLite table rename is insufficient because the new schema changes column definitions, constraints, or relationships, use a safe table-rebuild migration.

Account for SQLite foreign-key enforcement, indexes, triggers, and existing transactions. Respect the current SQLite library and raw SQL conventions; do not introduce Prisma or `better-sqlite3`.

### Legacy record handling

Existing Leave records will not necessarily have a `motifId` or `motifSnapshot`.

Design a deterministic migration strategy that maps historical records to appropriate legacy or migration-specific motifs, or safely preserves legacy records without a valid motif reference if the schema and application architecture permit it.

Do not assign arbitrary motifs or retroactively change the payroll treatment of historical requests.

If legacy data cannot be mapped unambiguously, preserve it and document how the application handles it. Do not fabricate historical policy information.

Test the migration against a representative legacy schema and data set.

## 7. MongoDB model and collection migration

Update the backend Mongoose models and all related queries, validation, indexes, controllers, and services.

Use `TimeOff` and `TimeOffMotif` as the canonical model names, with the corresponding canonical collection names:

- `time_off`
- `time_off_motifs`

Verify the actual Mongoose collection naming behavior. Set explicit collection names when necessary instead of relying on pluralization defaults.

Implement a safe migration from the old Leave collection to the new TimeOff collection.

The migration must:

- Preserve existing document identifiers and company associations.
- Preserve approval history, timestamps, synchronization fields, and payroll references.
- Handle legacy documents that lack motif fields.
- Preserve soft-deleted records.
- Avoid duplicate records if migration is retried.
- Rebuild or verify indexes and unique constraints.
- Keep historical payroll references valid.
- Avoid dropping the old collection until migrated records have been verified.

Do not assume that renaming a TypeScript interface or Mongoose model automatically renames an existing MongoDB collection.

Inspect whether existing documents use string or ObjectId identifiers. Maintain the established identifier convention unless a deliberate, compatible migration is required.

Use the existing backend migration conventions or implement an explicit, repeatable migration script if no suitable mechanism exists. Do not run a destructive production migration automatically during normal application startup.

Document the execution and rollback strategy.

## 8. Audit and update the complete synchronization flow

Trace the complete synchronization path for both TimeOff and TimeOffMotif.

Check every layer, including:

- Sync model registration and identifiers.
- SQLite queries used to identify unsynced records.
- Push payload construction.
- Server request validation and company authorization.
- MongoDB upserts and duplicate handling.
- Server version generation and incrementing.
- Pull queries and version filtering.
- Local SQLite upserts.
- Conflict resolution.
- Soft deletion propagation.
- `synced`, `isDeleted`, `serverVersion`, and `lastSyncedAt` handling.
- Retry and recovery behavior.
- Sync ordering and dependencies.
- Offline creation, modification, approval, rejection, and cancellation.
- Initial synchronization and incremental synchronization.
- Company-specific synchronization contexts.

Make sure motif records are available locally before requests that reference them are processed. Evaluate dependency-aware ordering, such as syncing motifs before dependent requests, without unnecessarily blocking unrelated models.

Ensure server-generated updates, including approvals and motif changes, can reach offline clients.

Verify that server versions cannot accidentally be reset or decrease during an upsert. Follow the existing conflict-resolution contract and document any required changes.

Preserve idempotency: retrying a push or pull must not create duplicate motifs or requests.

Ensure local writes continue working without an internet connection and synchronize when connectivity returns.

Do not assume that renaming a sync model is safe for existing installations. Check for persisted sync cursors, version keys, registries, or metadata that require migration or compatibility handling.

## 9. Payroll, balances, and historical adjustments

Audit all existing Leave integrations with payroll.

Update domain references to TimeOff where appropriate while preserving the semantics of historical payroll records and adjustments.

Use the new motif policy to determine the behavior of future requests:

- `PAID`
- `UNPAID`
- `PARTIALLY_PAID`
- `deductFromLeaveBalance`

Do not assume that `PARTIALLY_PAID` implies a specific deduction percentage or formula. Find the existing payroll calculation and configuration conventions. If the required partial-pay rule is not defined, preserve existing supported behavior and clearly identify the missing business rule rather than inventing one.

Check whether payroll adjustments reference a Leave record by ID, table name, or collection name. Preserve those references during migration.

Ensure that editing or deactivating a motif does not recalculate previously finalized payroll runs or alter historical payslips.

Review leave balance calculations, employee reports, payroll validation, and any absence-related processing for regressions.

## 10. API, IPC, validation, and renderer compatibility

Update the complete communication chain:

Renderer → preload → IPC → services → repositories → SQLite.

For server operations, update the corresponding chain:

Renderer/client services → HTTP API → Express routes/controllers/services → Mongoose.

Follow existing naming, error-handling, validation, and authorization patterns.

Ensure that:

- IPC handlers use the new types and identifiers.
- Preload methods expose the updated operations.
- Request and response payloads remain consistent across layers.
- Company context is validated in both local and server operations.
- Renderer query keys and cache invalidation are correct.
- Existing offline behavior remains intact.
- Errors are actionable and consistent with Akili's existing French UI conventions.
- TypeScript strict mode passes without introducing `any`, unnecessary type assertions, or disabled compiler checks.

Update API routes and IPC channel names when appropriate. If backward compatibility is needed for existing clients, use explicit compatibility adapters rather than retaining two competing domain implementations.

Do not redesign unrelated screens or modules.

## 11. Audit, notifications, and reporting

Update relevant audit events, notification payloads, reports, and exports to recognize TimeOff and TimeOffMotif.

Preserve the existing audit history. Do not erase or silently rewrite historical audit events merely to rename their labels.

Ensure notification and audit metadata continue to identify the correct company, employee, request, actor, and event.

Review any absence-related scheduled jobs or background processing. Adapt them only when their existing behavior is relevant to the new domain.

## 12. Testing and verification

Add or update tests using the repository's existing testing framework.

At minimum, verify:

1. Legacy SQLite migration preserves records and relationships.
2. Legacy MongoDB migration preserves records and identifiers.
3. Re-running migrations does not duplicate records or corrupt data.
4. Motifs can be created, retrieved, updated, deactivated, and synchronized.
5. Company isolation prevents cross-company access.
6. A request cannot reference another company's motif.
7. Motif snapshots preserve historical policy.
8. Approval requirements and justification/document requirements are enforced.
9. Leave balance and payroll calculations preserve their intended semantics.
10. Partial-day requests retain valid dates and times.
11. Offline request creation works and later synchronizes successfully.
12. Motifs synchronize before dependent requests when required.
13. Pull and push operations are idempotent.
14. Server updates propagate to local SQLite.
15. Soft deletion and conflict resolution work correctly.
16. Historical payroll references remain valid.
17. Existing unrelated modules continue compiling and functioning.

Run the available type checks, lint checks, unit tests, integration tests, and production builds relevant to the affected projects.

Do not claim a test passed unless it was actually executed.

## 13. Implementation rules

- Follow the existing repository architecture and conventions.
- Reuse existing abstractions instead of creating redundant infrastructure.
- Keep shared types independent of Electron, React, SQLite, Express, and Mongoose.
- Preserve offline-first operation.
- Do not introduce new ORM dependencies.
- Do not delete legacy data to simplify migrations.
- Do not silently alter finalized payroll records.
- Do not create duplicate Leave and TimeOff implementations.
- Do not perform destructive database migrations automatically during ordinary application startup.
- Keep changes focused on this refactor.
- If a business rule is genuinely undefined, document it and implement the safest compatible behavior rather than inventing policy.
- If the repository contains multiple applications or packages, identify the correct client and server paths and update all affected packages.

Implement the migration in the following four stages, one stage at a time:
Stage 1 — SQLite and MongoDB migrations
- Inspect the existing schemas, database versioning, and migration mechanisms.
- Implement safe SQLite table migrations and MongoDB collection migrations.
- Preserve existing records, identifiers, company associations, synchronization metadata, and historical payroll references.
- Verify migration idempotency and data integrity.
- Report the files changed, migration details, tests executed, and results.
Stop after Stage 1 and ask me to review and approve the changes before proceeding.
Stage 2 — Backend models, services, and APIs
After I explicitly approve Stage 1:
- Update Mongoose models, collection mappings, indexes, repositories or data-access layers, services, routes, controllers, validation, and API contracts.
- Implement TimeOffMotif persistence and management.
- Update TimeOff request handling and enforce company isolation.
- Verify compatibility with the migrated database schema.
- Report the files changed, tests executed, and results.
Stop after Stage 2 and ask me to review and approve the changes before proceeding.
Stage 3 — Electron, IPC, preload, and synchronization
After I explicitly approve Stage 2:
- Update SQLite repositories and services, IPC handlers, preload APIs, and renderer-facing contracts.
- Update synchronization registration, push/pull operations, version handling, conflict resolution, soft deletion, retry behavior, and dependency ordering.
- Ensure TimeOffMotif records are available before dependent TimeOff requests are synchronized when required.
- Verify offline operation, pending legacy changes, and synchronization idempotency.
- Report the files changed, tests executed, and results.
Stop after Stage 3 and ask me to review and approve the changes before proceeding.
Stage 4 — Payroll, UI, audit, and tests
After I explicitly approve Stage 3:
- Update renderer pages, components, forms, validation, state management, and API integrations.
- Update payroll calculations, leave balances, historical adjustments, reports, audit events, and notifications where affected.
- Verify that motif changes do not silently alter historical requests or finalized payroll records.
- Add or update relevant tests and run the available type checks, lint checks, tests, and production builds.
- Provide a final implementation report listing completed work, test results, migration status, and any unresolved issues or manual deployment steps.
Stop after Stage 4 and provide the final report.
Mandatory stage-gating requirement
Do not implement multiple stages in a single uninterrupted run. Complete only the current stage, summarize the changes and verification results, and ask for my explicit approval before beginning the next stage.
My approval to continue must be obtained in the conversation. Do not interpret silence, completion of a task, or approval of an earlier stage as authorization to proceed with a later stage.

## 14. Final deliverables

After implementing the changes, provide:

1. A summary of the architecture changes.
2. A list of modified, created, renamed, and removed files.
3. The exact SQLite table names and migration versions introduced.
4. The exact MongoDB model and collection names, plus the migration procedure.
5. A synchronization-flow summary describing push, pull, versioning, conflict handling, deletion, and dependency ordering.
6. An explanation of how legacy Leave records are mapped to TimeOff and how historical payroll references are preserved.
7. A list of tests and build commands actually executed, with their results.
8. Any unresolved business rules, migration risks, or manual deployment steps.
9. A clear distinction between completed implementation and anything that still requires action.

First inspect the repository and produce a concise impact plan. Then implement the changes in coherent stages, verifying each stage before proceeding. Do not stop after the impact plan.
