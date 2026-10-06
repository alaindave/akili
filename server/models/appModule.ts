// Keep these persisted values aligned with client/common/types/task/Task.ts.
export const APP_MODULES = [
  "HR",
  "INVENTORY",
  "PROCUREMENT",
  "PRODUCTION",
  "SALES",
  "ACCOUNTING",
] as const;

export type AppModule = (typeof APP_MODULES)[number];
