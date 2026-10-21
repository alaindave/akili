// Keep existing deployment entry points while TypeScript emits the shared
// contracts alongside the backend under dist/server and dist/client.
import { URL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir(new URL('../dist/scripts/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/index.js', import.meta.url), 'import "./server/index.js";\n');
await writeFile(new URL('../dist/scripts/createCompany.js', import.meta.url), 'import "../server/scripts/createCompany.js";\n');
