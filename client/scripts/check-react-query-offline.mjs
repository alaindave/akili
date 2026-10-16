import assert from "node:assert/strict";
import console from "node:console";
import fs from "node:fs";
import { createRequire } from "node:module";
import { URL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
// Use the same module instance as the transpiled application configuration.
const { MutationObserver, QueryObserver, onlineManager } = require("@tanstack/react-query");
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(new URL("../src/renderer/lib/queryClient.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText, { module, exports: module.exports, require });
const { queryClient } = module.exports;
const previousOnline = onlineManager.isOnline();
const unsubscribers = [];
try {
  onlineManager.setOnline(false);
  queryClient.mount();
  let localReads = 0;
  let rows = [{ _id: "employee-a", companyId: "a", name: "Before" }];
  const key = ["employees", "list", { companyId: "a" }];
  const observer = new QueryObserver(queryClient, {
    queryKey: key,
    queryFn: async () => { localReads++; return rows.map((row) => ({ ...row })); },
  });
  unsubscribers.push(observer.subscribe(() => {}));
  assert.notEqual(observer.getCurrentResult().fetchStatus, "paused", "Local reads must start while offline");
  await observer.refetch();
  assert.equal(observer.getCurrentResult().status, "success");
  assert.equal(observer.getCurrentResult().data[0].name, "Before");

  let writes = 0;
  const mutation = new MutationObserver(queryClient, {
    mutationFn: async (name) => { writes++; rows = [{ ...rows[0], name }]; return rows[0]; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  unsubscribers.push(mutation.subscribe(() => {}));
  const pendingWrite = mutation.mutate("After");
  assert.equal(mutation.getCurrentResult().isPaused, false, "Local writes must not wait for connectivity");
  await pendingWrite;
  assert.equal(writes, 1);
  assert.equal(observer.getCurrentResult().data[0].name, "After", "Invalidation must reload SQLite data offline");
  assert.ok(localReads >= 2);

  const otherCompany = await queryClient.fetchQuery({
    queryKey: ["employees", "list", { companyId: "b" }], queryFn: async () => [],
  });
  assert.equal(otherCompany.length, 0);
  assert.equal(queryClient.getQueryData(key)[0].companyId, "a");
  await assert.rejects(queryClient.fetchQuery({
    queryKey: ["local-error"], queryFn: async () => { throw new Error("SQLite read failed"); },
  }), /SQLite read failed/);

  onlineManager.setOnline(true);
  await Promise.resolve();
  assert.equal(writes, 1, "Reconnecting must not replay a completed local write");
  console.log("Passed: offline cold reads, local writes, invalidation/refetch, company cache isolation, errors, and reconnect without duplicate writes.");
} finally {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  queryClient.unmount();
  queryClient.clear();
  onlineManager.setOnline(previousOnline);
}
