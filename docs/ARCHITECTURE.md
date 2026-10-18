# Akili ERP — Architecture

> **Purpose:** This document records the architecture and engineering principles established during Akili ERP design. It is intended to guide implementation and code review.

## 1. Product overview

Akili ERP is an offline-first desktop ERP designed for small and medium-sized businesses, initially targeting Burundi and nearby markets. Planned and existing business areas include:

- Human resources, attendance, and leave
- Payroll
- Inventory and stock movements
- Procurement and supplier management
- Sales
- Accounting and finance
- Production and manufacturing
- Audit logs, reports, dashboards, and optional AI-assisted analysis

The product should prioritize practical workflows, French-language user interfaces, local business needs, and usability for companies that may have unreliable internet access. It should avoid unnecessary enterprise complexity while preserving important controls, traceability, data integrity, and authorization.

### Core principles

1. **Offline-first:** routine local operations should continue when the internet is unavailable.
2. **Local persistence:** business changes are saved to SQLite before depending on remote synchronization.
3. **Clear layer boundaries:** UI, privileged Electron capabilities, database access, business logic, and remote API responsibilities stay separated.
4. **Company isolation:** company-owned data and actions must be scoped to the authorized company.
5. **Deterministic business logic:** payroll, inventory, accounting, and other critical calculations must be implemented in testable application code, not delegated to an AI model.
6. **Auditable operations:** important changes, approvals, exceptions, and financial or stock movements should be traceable.
7. **Incremental evolution:** extend existing patterns rather than introducing new frameworks or architectural patterns without a concrete reason.

## 2. Technology stack

### Desktop client

- Electron
- React
- TypeScript
- Chakra UI 2.10
- React Router using `HashRouter`
- Zustand for appropriate client-side state
- TanStack React Query for query state, caching, loading/error handling, and invalidation where used
- SQLite accessed through the `sqlite3` package
- Socket.IO for supported real-time features
- `keytar` for supported operating-system credential storage
- Vite
- `electron-builder` for application packaging

**Constraint:** continue using the existing `sqlite3` approach. Do not introduce Prisma or `better-sqlite3` without an explicit architecture decision.

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- Socket.IO for supported real-time communication
- Hosted backend currently associated with `https://leather-works.onrender.com`

The backend is responsible for centrally authenticated and authorized API operations, remote persistence, and coordination of synchronization. The exact route structure, hosting configuration, and degree of TypeScript migration must be verified in the current repository.

### Build and TypeScript conventions

Configuration preferences include:

- ES modules (`"type": "module"`)
- Strict TypeScript
- `noUnusedLocals`
- `noImplicitReturns`
- ES2022 target and Node16 module resolution in the relevant TypeScript configuration
- Vite base path `./` for packaged desktop assets
- Electron packaging with `electron-builder`

**Verify in codebase:** current `package.json`, TypeScript configuration, Vite configuration, and build scripts before changing these settings.

## 3. High-level architecture

The desktop client uses a layered architecture:

React Renderer
|
| typed, limited API exposed by preload
v
Preload
|
| Electron IPC
v
Electron Main Process
|
+--> IPC handlers
|
+--> Services (business rules / use cases)
| |
| v
| Repositories (SQLite persistence)
| |
| v
| Local SQLite database
|
+--> Synchronization services
|
| HTTPS API / authenticated requests
v
Express backend
|
+--> Authentication and authorization
+--> Backend services and validation
+--> Mongoose models
v
MongoDB

This diagram describes responsibilities, not necessarily the exact directory layout or every call path. Some existing features may use different paths; inspect them before refactoring.

### Layer responsibilities

#### 3.1 React renderer

Responsible for:

- Rendering screens and forms
- User interaction and client-side validation
- Navigation and presentation state
- Calling the approved preload API instead of directly accessing privileged Electron capabilities
- Displaying loading, success, error, offline, and synchronization states
- Refreshing or invalidating UI queries after successful local writes

The renderer should not open SQLite connections or implement persistence directly. It should not contain authoritative business rules that must also be enforced by other entry points.

#### 3.2 Preload

Responsible for:

- Exposing a small, explicit API through Electron's context bridge
- Providing typed wrappers around approved IPC operations
- Keeping the renderer isolated from unrestricted Node.js or Electron APIs

Do not expose unrestricted `ipcRenderer`, filesystem access, arbitrary SQL execution, or general-purpose privileged functions to the renderer. Add narrow methods for specific capabilities.

#### 3.3 Electron main process and IPC handlers

Responsible for:

- Managing the desktop application lifecycle and privileged capabilities
- Registering IPC handlers
- Validating IPC inputs and invoking the appropriate services
- Managing local database initialization and access
- Handling desktop-specific tasks such as resource paths, secure credential integration, and native notifications where appropriate

IPC handlers should remain thin. Business rules belong in services, and database queries belong in repositories.

#### 3.4 Services

Responsible for application use cases and business rules, such as:

- Creating and approving a purchase order
- Posting a stock movement
- Calculating payroll
- Recording attendance
- Receiving goods against a purchase order
- Applying transaction boundaries and invariants
- Coordinating repositories and other services
- Initiating or scheduling synchronization where appropriate

Services should not depend on React components. Keep business logic testable without rendering the UI.

#### 3.5 Repositories

Responsible for persistence and retrieval:

- Encapsulate SQLite SQL queries
- Map database rows to application types
- Handle filtering and company scoping
- Persist synchronization metadata where applicable
- Use parameterized SQL
- Participate in transactions through the project's established database utilities

Repositories should not contain UI behavior. Avoid duplicating business rules across repositories and renderer components.

#### 3.6 Shared contracts and types

Use shared or clearly coordinated TypeScript types for data crossing boundaries, where appropriate:

- Renderer ↔ preload ↔ IPC
- Desktop client ↔ backend API
- Services ↔ repositories

Keep API contracts explicit. Validate untrusted inputs at process and server boundaries; TypeScript types alone do not validate runtime data.

## 4. Local SQLite database

### Role of SQLite

SQLite is the local persistence layer that enables Akili to continue working offline. Local business operations should not require a successful round trip to the backend before they can be saved.

Known database context:

- Database filename has been referenced as `hr.sqlite`.
- Database location has been referenced as `app.getPath('userData')`.
- SQLite configuration has included foreign-key enforcement, WAL mode, `synchronous = NORMAL`, and a `busy_timeout` of 5000 ms.
- The project uses `sqlite3`, not Prisma or `better-sqlite3`.
- A retry utility exists for `SQLITE_BUSY` errors.

**Verify in codebase:** current database filename, initialization sequence, PRAGMA configuration, transaction helper, migration mechanism, and retry implementation.

### Database rules

1. Use parameterized queries rather than string-concatenated user input.
2. Enforce database constraints that reflect real invariants.
3. Enable and verify foreign-key enforcement for each relevant connection.
4. Use transactions for operations that must succeed or fail as a unit.
5. Add schema changes through repeatable, versioned migrations or the migration pattern already used by the repository.
6. Do not remove a foreign-key constraint merely to bypass an error. First determine whether the relationship is required, optional, or incorrectly modeled.
7. Avoid silent data loss during migrations or synchronization.
8. Store dates and times consistently and make timezone assumptions explicit, especially for attendance, payroll, and scheduled jobs.

### Local data integrity

Examples of invariants that should be enforced in the relevant service and, where feasible, the database include:

- Reserved stock quantity must not be negative.
- Reserved quantity must not exceed quantity on hand unless the business model explicitly supports a different representation.
- Posted stock movements must be internally consistent.
- Payroll calculations and payment statuses must follow explicit state transitions.
- A company-owned record must not be accessible through an unrelated company's context.

A UI check alone is not sufficient to protect an invariant.

## 5. Multi-company isolation

Akili is intended to support company-scoped data. Company identity must be treated as a security boundary, not just a UI selection.

Company metadata include fields such as:

- `companyId`
- `name` and `legalName`
- `signupCode`
- `logoPath`
- `address`, `city`, and `country`
- `phone`, `email`, and `website`
- timestamps and synchronization metadata

The actual current schema should be checked before relying on this list.

### Rules

- Every company-owned operation must resolve and validate the active company context.
- Backend authorization must derive or verify the company from the authenticated user and server-side membership/permissions.
- Never trust a renderer-supplied `companyId`, role, or `isAdmin` flag as proof of authorization.
- Scope repository queries and updates to the correct company where records are company-owned.
- Avoid exposing one company's records, files, reports, logos, or synchronization state to another company.
- Company switching must change the effective data context safely, not merely update a label in the UI.
- Tests should verify that a user from Company A cannot read or mutate Company B's records.

A separate local database or data directory per company has been considered as a strong isolation option. This is a design choice that must be reconciled with the current implementation before changing database provisioning. If databases are shared, company scoping and constraints must be applied consistently.

## 6. Offline-first synchronization

### General model

Local SQLite supports operations while offline. Synchronization transfers eligible local changes to the backend and retrieves remote changes when connectivity is available.

Known conventions used or discussed in the project include fields such as:

- `serverVersion`
- `lastSyncedAt`
- `synced`
- `isDeleted`

The background synchronization interval is approximately two minutes. Treat the actual interval and field presence as implementation details to verify.

### Synchronization responsibilities

- Detect and report connectivity/synchronization state without treating `navigator.onLine` as definitive proof that the backend is reachable.
- Keep local operations usable during network failures.
- Retry transient failures using bounded, deliberate retry policies.
- Make pushes idempotent or otherwise protect against duplicate writes.
- Apply server changes without accidentally re-uploading them as new local edits.
- Track version/cursor progress consistently.
- Do not advance a pull cursor past unresolved conflicts or deferred records if doing so could permanently skip them.
- Make synchronization failures visible and actionable to users.
- Preserve local unsynced work when the backend is unavailable.
- Ensure deleted records and conflict-resolution rules are handled consistently.
- Log enough information to diagnose failures without leaking credentials or sensitive business data.

### Transactions and dependent records

When records depend on other records, synchronization must account for dependency ordering and missing references. A child record must not be silently discarded because its parent has not arrived yet.

For any sync change, consider:

1. What happens when the device is offline?
2. What happens when a request succeeds on the server but the response is lost?
3. What happens if the same batch is retried?
4. What happens if a dependent record arrives before its parent?
5. What happens when the client and server edit the same record?
6. When can a cursor safely advance?
7. How is the user informed of unresolved conflicts?

Do not assume every table uses identical synchronization rules. Inspect the current sync implementation and preserve entity-specific behavior where required.

## 7. Backend architecture and trust boundaries

The backend is the central boundary for authenticated remote operations and shared persistence.

Expected responsibilities include:

- Authentication and session/token validation
- Server-side authorization and company membership checks
- Input validation and normalization
- Enforcing business rules that must be authoritative centrally
- Mongoose models and MongoDB persistence
- Synchronization endpoints and conflict handling
- Coordinating supported real-time events
- Protecting secrets and third-party credentials

Do not rely on client-side validation for authorization. The backend must independently verify permissions for sensitive operations.

### API URL and environment configuration

Development and packaged builds may need different API URLs. Resolve environment-specific URLs through the established application configuration. Do not assume Vite environment variables alone provide the right runtime behavior in every packaged Electron context.

Never package server secrets or privileged third-party API credentials in the renderer. Tokens and credentials must be handled using the existing secure storage and backend authorization design.

### Hosting considerations

The backend has been associated with a Render deployment. A free hosted service may have cold starts or storage limitations. Do not assume local filesystem persistence on a hosted ephemeral service is durable; use the configured persistent database for authoritative records.

## 8. State management and data fetching

Client tools include Zustand and TanStack React Query.

Use each for a clear purpose:

- **SQLite:** durable local business data.
- **React Query:** query lifecycle, caching, loading/error state, deduplication, and invalidation where the project uses it.
- **Zustand:** appropriate shared client/UI state, not a replacement for durable business persistence.
- **React component state:** temporary form and presentation state.

If local SQLite is the source of truth, invalidate or update affected queries after a successful write. Do not expect an infinite `staleTime` or disabled automatic refetching to refresh data after a mutation.

A `networkMode: "always"` setting may be appropriate for queries that read local data through IPC, but it must not be used as evidence that the remote API is reachable.

Avoid maintaining multiple independent authoritative copies of the same business record in component state, Zustand, React Query, SQLite, and MongoDB without explicit synchronization semantics.

## 9. Realtime events and notifications

Socket.IO is part of the known technology context for supported realtime functionality. Use it for features that genuinely benefit from live updates, not as a substitute for durable persistence or synchronization.

Important events should remain recoverable when the app is offline or closed. A notification flow discussed for Akili uses durable local storage for important notifications, a client state store to display them, and native Electron notifications as a supplementary alert where appropriate.

OS-controlled native notifications cannot guarantee persistent visibility. The application should retain important notifications in its own notification center when the feature requires it.

For any realtime feature:

- Authenticate connections.
- Authorize each company-scoped subscription.
- Validate event payloads.
- Avoid treating an event as the only durable record of a business transaction.
- Handle reconnects and stale data.

## 10. Module boundaries

Each ERP module should own its business rules and documents while reusing shared entities and infrastructure.

### HR and Payroll

Own employee-related workflows, attendance, leave, payroll configuration, payroll runs, results, and payslips. Payroll calculations must be deterministic, auditable, and based on explicit rules. Avoid changing finalized or paid payroll results without a controlled correction process.

### Inventory

Own item definitions, units, warehouses, locations, stock balances, and stock movements. Stock changes should flow through validated inventory operations rather than arbitrary edits to quantity fields.

Examples of movement intent:

- Receipt from a supplier: stock entry tied to the receiving process.
- Material issued to production: stock exit/consumption.
- Moving goods between warehouses or locations: transfer.
- Opening stock: a controlled initialization operation with appropriate auditability.

### Procurement

Own purchase requests, supplier quotation records, purchase orders, receiving workflow, and supplier invoice workflow as implemented. Accepted goods should update Inventory through a defined service boundary. Procurement should not independently maintain a second stock balance.

### Accounting and Finance

Own accounting entries, account balances, financial periods, and accounting reports. Procurement and Payroll should provide validated business events or integration points rather than each implementing their own independent general ledger.

### Sales and Production

Sales should coordinate customer orders and fulfillment; Production should coordinate production orders, material requirements, and consumption. Define ownership and integration contracts before introducing cross-module side effects.

### Shared capabilities

Company data, users/permissions, attachments, audit logs, notifications, reporting, and synchronization should be reused rather than reimplemented separately by every module.

This section describes intended boundaries; it does not claim all listed modules are currently implemented.

## 11. Security, auditability, and files

- Keep privileged APIs narrow.
- Validate input at IPC and backend boundaries.
- Apply authorization in services/backend routes, not only by hiding UI controls.
- Use least-privilege permissions.
- Store credentials using the existing secure-storage approach where applicable.
- Avoid logging passwords, authentication tokens, private employee documents, or sensitive payroll details.
- Use company-scoped access for employee photos, documents, logos, and attachments.
- Validate file type and size; use safe file paths and prevent path traversal.
- Record meaningful audit events for approvals, cancellations, stock postings, payroll finalization, and other sensitive operations.
- Do not allow editing or deletion of posted transactions without a defined reversal/correction workflow.

## 12. Electron packaging and desktop behavior

Known packaging context includes Electron, Vite, and `electron-builder`; the product has been packaged for Windows using NSIS. The current app identifiers and output paths must be verified in `package.json` and builder configuration.

Guidelines:

- Keep development and packaged resource paths distinct and deliberate.
- Ensure required icons and runtime assets are included in packaged builds.
- Test the packaged application, not only the development server.
- Test different Windows display scaling settings and small laptop screens.
- Avoid hard-coding renderer zoom or device-scale behavior without checking layout responsiveness and accessibility.
- Verify app updates, shortcuts, installer/uninstaller icons, database paths, and startup behavior on a clean installation.
- Do not assume files inside the source tree are automatically available outside or inside `app.asar`; configure packaging explicitly.

## 13. TypeScript and code-change workflow

The preferred workflow discussed for using ChatGPT and Codex is:

1. Use ChatGPT to clarify requirements, design, edge cases, and affected layers.
2. Use Codex to inspect and implement changes in the repository.
3. Review the Git diff and run relevant checks.
4. Use ChatGPT or another reviewer to inspect the diff and reason about risks.
5. Ask Codex to refine issues identified in review.
6. Commit only after the change is tested and understood.

For non-trivial features, identify all affected parts of the vertical slice:

SQLite migration/schema
-> Repository
-> Service/business rules
-> IPC handler
-> Preload API and types
-> React hook/query/state
-> UI
-> Synchronization/API/backend
-> Tests and documentation

Not every feature touches every layer. Do not add layers or files mechanically when a layer is not needed.

### Code-change expectations

- Inspect existing code and follow established naming, types, error handling, and transaction patterns.
- Prefer focused changes over broad unrelated refactors.
- Do not invent schema fields, API routes, functions, or file paths.
- Keep TypeScript strict and resolve errors rather than hiding them with broad casts or `any`.
- Explain migrations, synchronization consequences, and backward compatibility.
- Add or update tests for business invariants and important failure cases.
- Run available lint, type-check, and test scripts; report what was actually run.
- When complete files are requested, provide copy-ready complete files and clearly list any companion changes required.

## 14. Testing expectations

Test more than the happy path. Depending on the feature, include:

- Valid operation while online
- Valid operation while offline
- Network failure or timeout
- Retry after an uncertain server response
- Duplicate request or repeated sync batch
- Missing or deferred parent/dependency
- Invalid state transition
- Foreign-key or uniqueness conflict
- Company isolation and permission denial
- Partial receipt, partial payment, or other partial workflow
- Transaction rollback after an intermediate failure
- Migration from an existing user database
- Packaged Electron behavior on a target Windows machine

Critical financial and inventory operations should have service-level tests for invariants independent of the UI.

## 15. Decisions to verify before changing architecture

This document records known direction, not a substitute for inspecting the repository. Verify these areas before implementing changes:

- Actual folder structure and current layer boundaries
- Current SQLite database filename/path and migration strategy
- Whether company data uses one database per company or a shared database
- Which tables contain each synchronization field and what each field means
- Push/pull ordering, cursor behavior, and entity-specific conflict handling
- Current IPC/preload API and validation patterns
- Which modules are implemented versus planned
- Backend route, service, and Mongoose model organization
- Current authentication and company-membership checks
- Current packaging scripts, builder settings, and app identifiers
- Existing test, lint, and type-check commands

## 16. Architecture decision log

Record durable decisions in `docs/DECISIONS.md`, using a consistent format:

## ADR-XXX: Short decision title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded

### Context

What problem or constraint prompted this decision?

### Decision

What was chosen?

### Alternatives considered

What other approaches were evaluated?

### Consequences

What becomes easier or harder? What migrations, tests, or documentation are required?

When a decision is superseded, preserve the old entry and link to the replacement instead of silently erasing the history.

---

## Summary

Akili should remain a layered, offline-first desktop ERP: React handles presentation; preload exposes a narrow API; IPC connects the renderer to Electron's main process; services enforce use-case rules; repositories persist to SQLite; synchronization communicates with the authenticated Express/MongoDB backend. Company isolation, transaction integrity, explicit synchronization behavior, and auditability are foundational. Build new modules by following these boundaries, keeping workflows practical for SMEs and documenting material architecture decisions.
