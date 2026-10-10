import SyncCounter from "../models/shared/syncCounter.model.js";
import type { ClientSession } from "mongoose";
import type { InventorySyncEntity } from "../models/modules/inventory/inventorySync.js";

export type Entity =
  | InventorySyncEntity
  | "company"
  | "company_logo"
  | "admin_user"
  | "employee"
  | "employee_document"
  | "attendance"
  | "attendance_daily_check"
  | "leave"
  | "incident"
  | "task"
  | "task_comment"
  | "payroll_settings"
  | "payroll_component"
  | "payroll_profile"
  | "payroll_run"
  | "payroll_result"
  | "payroll_item";

export async function getNextSyncVersion(entity: Entity, session?: ClientSession): Promise<number> {
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
      session,
    }
  ).lean();

  if (!counter) {
    throw new Error(`FAILED TO GENERATE NEXT VERSION FOR${entity}`);
  }

  return counter.value;
}
