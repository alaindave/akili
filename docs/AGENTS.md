# Akili ERP — Codex Development Rules

## 1. Project principles

- Akili is an offline-first desktop ERP built with Electron, React, TypeScript, Chakra UI, and SQLite. It connects to a Node.js/Express backend with access to a MongoDB cloud database.
- Local SQLite data is the primary source for normal offline workflows.
- Preserve existing functionality unless the task explicitly requires changing it.
- Follow existing project conventions and patterns before introducing new abstractions.
- Do not introduce a new library, ORM, database, or architectural pattern without explaining why and requesting approval.

## 2. Required architecture

Before making changes, read `docs/ARCHITECTURE.md` for the documented system design. Use it alongside the actual code, not as a substitute for inspecting the implementation. If the document is missing, outdated, or conflicts with the code, flag the discrepancy and ask for clarification when it affects the proposed solution.

Follow these layers:

1. **Renderer:** React pages, components, forms, and UI state.
2. **Preload:** Exposes a minimal, typed API through `contextBridge`.
3. **IPC:** Validates and routes renderer requests to Electron handlers.
4. **Service:** Implements business rules, validation, orchestration, and workflows.
5. **Repository:** Executes SQLite queries and maps database records.

Expected flow:

`Renderer → Preload API → IPC handler → Service → Repository → SQLite`

Rules:

- Renderer components must not query SQLite directly.
- Renderer components must not import Electron's `ipcRenderer`.
- Renderer components must not contain raw SQL.
- Preload APIs must expose only the operations the renderer needs.
- IPC handlers should delegate business logic to services.
- Repositories should focus on persistence, not UI behavior or business workflows.
- Services should use repositories rather than duplicating SQL across the application.
- Follow existing exceptions only when the project already has a deliberate, documented pattern.
- When proposing changes, identify which layers are affected and keep the data flow consistent with the documented architecture.

## 3. TypeScript and security

- Keep TypeScript strict and avoid `any` where practical.
- Reuse shared domain types rather than duplicating interfaces.
- Keep Electron context isolation enabled.
- Never expose unrestricted Node.js or Electron APIs to the renderer.
- Validate untrusted IPC input before performing database or filesystem operations.

## 4. SQLite and offline-first behavior

- Use the existing SQLite access helpers and transaction conventions.
- Do not introduce Prisma or `better-sqlite3`.
- Preserve transaction integrity, foreign-key constraints, and existing retry behavior.
- Make multi-step writes transactional when necessary.
- Preserve company isolation: company-scoped records must be queried and modified using the correct company ID.
- Preserve sync queue, conflict resolution, and soft-deletion conventions.
- Do not assume the network is available for normal local operations.
- Do not modify the database schema without explaining migration and backward-compatibility implications.
- Treat `docs/ARCHITECTURE.md` and any relevant database/synchronization documentation as design references; verify important details against the current schema and implementation before changing them.

## 5. Implementation workflow

**Before implementing any changes, explain the proposed design approach and ask for approval. Do not start implementation until approval is given.**

1. Inspect the relevant files and existing implementations.
2. Identify the layers and files that need to change.
3. Explain the proposed implementation and data flow.
4. Identify risks to offline behavior, synchronization, database integrity, security, and existing features.
5. Ask for clarification if a significant architectural decision is ambiguous.
6. Do not use external CSS files for styling. Use Chakra UI props, class names where already established, or inline styles directly on components/elements, consistent with existing project conventions.

During coding:

- Make the smallest complete change that solves the request.
- Reuse existing helpers and patterns.
- Avoid unrelated refactoring.
- Update types, preload APIs, IPC handlers, services, repositories, and tests as required by the change.
- Do not assume that mentioning a file or requesting a fix grants approval for a broader architectural change; keep the implementation within the approved scope.

After coding:

1. Run the relevant type checks and tests.
2. Run `npm run lint` after modifying code.
3. Review the diff for unrelated changes.
4. Confirm that all calls follow the intended architecture and `docs/ARCHITECTURE.md`.
5. Report changed files, checks performed, failures, and any remaining risks.
6. Never claim a test or build passed unless it was actually run and passed.

## 6. Architecture changes

- Do not bypass a layer just to make an implementation faster.
- If the existing architecture cannot support a requirement cleanly, explain the limitation and propose alternatives before making a structural change.
- When an approved architectural change makes `docs/ARCHITECTURE.md` inaccurate, propose and update the documentation as part of the approved work.
- Do not silently treat the architecture document as more authoritative than the actual code. Inspect the implementation and call out discrepancies instead of blindly following outdated documentation.

## 7. Scope control

- Implement only the requested task.
- Do not silently change business rules, database semantics, public APIs, or synchronization behavior.
- If the task reveals a necessary but out-of-scope fix, explain it and ask before including it.

## 8. ESLint and code quality

- Run `npm run lint` after modifying code.
- Fix new ESLint errors caused by your changes.
- Do not disable lint rules just to make checks pass.
- Do not modify unrelated files to eliminate pre-existing warnings.
- Run relevant tests and report their actual results.
- Review all automatic fixes before accepting them.
- Preserve Akili's existing renderer, preload, IPC, service, repository, and database architecture.
