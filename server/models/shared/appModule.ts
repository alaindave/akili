export const APP_MODULES = [
  "HR",
  "INVENTORY",
  "PROCUREMENT",
  "PRODUCTION",
  "SALES",
  "ACCOUNTING",
] as const;

export type AppModule = (typeof APP_MODULES)[number];
