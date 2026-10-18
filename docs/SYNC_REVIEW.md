# Sync and release review — 2026-09-30

## Result

The missing employee pictures have reproducible causes in the client and server code. Those paths are fixed and covered by regression checks. Both the backend and Electron application need the changes.

This review is not a release clearance. The broader checks found the remaining issues listed below. No production database, storage bucket, or second computer was inspected, and nothing was deployed.

## Why pictures disappear on another computer

1. **Failed downloads were permanently skipped.** The employee pull cursor advanced before photos downloaded, and photo errors were swallowed. Subsequent syncs did not receive those employee records again.
2. **PNG/WebP files could be saved under the wrong filename.** The downloader used the local employee's MIME type, which is initially absent. It saved a `.jpg`, while the caller recorded a `.png` or `.webp` path from the remote metadata.
3. **Ordinary employee updates could replace cloud storage metadata.** Employee forms include local photo fields. The server previously accepted those fields as part of a normal employee update, including installation-local paths.
4. **Version equality was treated as proof that a file existed.** Missing local files were skipped when the photo version already matched.
5. **Queued uploads could read replaced files.** Successive photo selections reused the same filename and removed previous files before their queued uploads completed.

## Changes made

- Photos use a separate persistent cursor, initially starting at zero on existing installations. Failed photo pages remain retryable.
- Sync checks cached files and replays photo metadata when a file is missing. A failed photo pass reports an error while allowing unrelated records to pull.
- Downloads use remote MIME metadata, save the actual returned path, validate hashes, use a timeout, and replace files through a temporary file.
- Photo display uses the stored MIME type and refreshes after sync, including partial pull failures.
- Local upload filenames include the version and hash. Only the newest queued photo per employee is uploaded; older queue entries are retired after its replacement succeeds.
- Upload acknowledgements preserve newer pending edits. Photo metadata writes also refuse to replace an upload created during a download.
- Normal employee and company updates cannot replace cloud photo/logo paths.
- The server verifies uploaded photo hashes, ignores older photo updates, and recognizes repeated uploads. It saves the new database pointer before removing the previous cloud file.
- Photo downloads can recover a legacy local path by trying the established versioned cloud path. GIFs are supported consistently by photo download, upload, and model validation.
- Pull pagination includes deleted records when determining whether another page exists.
- Pending queued edits prevent pull pages from overwriting local changes or advancing their cursor. This deliberately defers an affected entity's page until its queued changes can be pushed.
- Document filenames are normalized consistently, and the pull service uses the downloader's actual path.
- The payroll profile insert now has 20 bound values plus `CURRENT_TIMESTAMP` for 21 columns.

## Verification

- All 15 client/server `check-*.cjs` scripts passed using Node 22.23.2.
- Electron and server TypeScript checks passed.
- Renderer production build passed, with a large-bundle warning.
- Static SQL scan: 275 literal parameter arrays and 42 simple insert column/value mappings; no mismatches.
- New media checks use real SQLite and temporary files with mocked HTTP/storage. They cover fresh-install PNGs, download failures and retries, missing cached files, hash mismatches, pending photo edits, uploads changed during HTTP, cloud metadata preservation, save/delete ordering, legacy path recovery, and deletion pagination.
- The payroll insert and update are executed against SQLite with the repository schema.

Run the focused regression checks with Node 22 or newer:

```sh
cd client
npm run test:sync
cd ../server
npm run test:sync
```

## Remaining issues found

### High: legacy REST mutations bypass versioned sync

[server/db.ts](server/db.ts) still has employee/attendance/leave mutations that do not allocate new sync versions, and employee deletion removes records physically. These routes are mounted in [server/index.ts](server/index.ts). Changes made through them can be invisible to another installation's version-based pull, especially deletions.

The employee routes also validate Mongo ObjectIds despite the application using string UUIDs. They should be migrated to the same tenant-aware, versioned mutation flow, or retired if no clients need them.

### High: legacy employee/media routes lack access checks

[server/routes/employee.route.ts](server/routes/employee.route.ts) exposes employee operations without authentication middleware or company scoping. The photo download endpoint also looks up employees by ID without authenticating the requesting company. These are observed code paths, not a production penetration test. Securing media downloads requires corresponding authenticated client requests and compatibility planning for older installations.

### High: version allocation and record writes are separate operations

[server/utils/syncVersion.ts](server/utils/syncVersion.ts) allocates a version before the corresponding record write commits. Concurrent writers can commit a higher version first. A client that advances past it can miss the lower version when that write finishes. The new tests do not prove correctness for concurrent MongoDB writers; a durable commit-order design and integration test are still needed.

### Payroll: custom component creation conflicts with the schema

The custom profile form omits `componentId`. `createEmployeePayrollProfile` substitutes the new profile ID, but the SQLite schema requires non-null component IDs to reference an existing payroll component. That path does not create the referenced component. The DTO also allows omitted `taxable` and `displayOrder`, while the insert binds them directly into non-null columns. The earlier placeholder fix does not resolve this separate design issue.

### Renderer: strict type checking fails

The full renderer type check reported 144 diagnostics: type-only import requirements, CommonJS preload files pulled into the renderer project, missing Vite asset/environment declarations, and unused declarations. The production Vite build passes because it transpiles without running that full type check. These errors remain; compiler checks were not disabled to hide them.

## Testing the next release

1. Deploy the server changes and rebuild the Electron application.
2. On the source computer, sync a JPEG and a PNG/WebP photo. Change one photo twice while offline, then reconnect and sync.
3. Sync an existing second installation without deleting its database. Previously skipped cloud photos should download through the new photo cursor.
4. Test a fresh installation and verify employee, attendance, and leave screens display the pictures.
5. Interrupt a photo download, reconnect, and confirm the next sync retries it while preserving unrelated pulled records.
6. Edit an employee's ordinary details and verify that the picture still downloads on the other computer.

If the cloud file itself is missing, retrying cannot recreate it. Re-upload that picture from the original computer. Older local photo files are retained to protect in-flight uploads; cleanup of those retained files is not implemented here.
