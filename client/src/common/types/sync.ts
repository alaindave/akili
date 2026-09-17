export const SYNC_ENTITIES = {
  COMPANY: "company",
  EMPLOYEE: "employee",
  ATTENDANCE: "attendance",
  LEAVE: "leave",
  PAYROLL_COMPONENT: "payroll_component",
  PAYROLL_PROFILE: "payroll_profile",
  PAYROLL_RUN: "payroll_run",
  PAYROLL_RESULT: "payroll_result",
  PAYROLL_ITEM: "payroll_item",
  PAYROLL_SETTINGS: "payroll_settings",
  TASK: "task",
} as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[keyof typeof SYNC_ENTITIES];

export interface SyncQueueItem {
  companyId: string;
  _id: string;
  entity:
    | "company"
    | "company_logo"
    | "employee"
    | "attendance"
    | "attendance_daily_check"
    | "leave"
    | "task"
    | "task_comment"
    | "user_notes"
    | "employee_photo"
    | "employee_document"
    | "payroll_settings"
    | "payroll_component"
    | "payroll_profile"
    | "payroll_run"
    | "payroll_result"
    | "payroll_item";
  entityId: string;
  operation: "create" | "update" | "delete";
  payload: string;
  synced?: number;
  createdAt?: string;
}

export interface SyncStatusEvent {
  status: "IDLE" | "SYNCING" | "OFFLINE" | "ERROR";
  timestamp: string;
  pendingChanges?: number;
  error?: string;
}
