import SyncCounter from "../models/syncCounter.model.js";

export type Entity =
  | "company"
  | "admin_user"
  | "employee"
  | "employee_document"
  | "attendance"
  | "attendance_daily_check"
  | "leave"
  | "task"
  | "task_comment"
  | "payroll_settings"
  | "payroll_component"
  | "payroll_profile"
  | "payroll_run"
  | "payroll_result"
  | "payroll_item";

export async function getNextSyncVersion(entity: Entity): Promise<number> {
  const counter = await SyncCounter.findOneAndUpdate(
    { _id: entity },
    {
      $inc: {
        value: 1,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  if (!counter) {
    throw new Error(`FAILED TO GENERATE NEXT VERSION FOR${entity}`);
  }

  return counter.value;
}
