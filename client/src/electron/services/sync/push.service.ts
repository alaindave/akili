import axios from "axios";
import { app } from "electron";
import FormData from "form-data";
import fs from "fs";
import path from "path";

import { getToken } from "../../auth.js";

import {
  getUnsyncedItems,
  markManySynced,
} from "../../database/repositories/sync.repository.js";

import { markCompanySynced } from "../../database/repositories/companies.repository.js";
import { markEmployeeSynced } from "../../database/repositories/employees.repository.js";
import { markAttendanceSynced } from "../../database/repositories/attendances.repository.js";
import { markLeaveSynced } from "../../database/repositories/leaves.repository.js";
import { markTaskSynced } from "../../database/repositories/tasks.repository.js";
import { markTaskCommentsSynced } from "../../database/repositories/tasks_comments.repository.js";
import { markEmployeePhotoSynced } from "../../database/repositories/employees_photos.repository.js";
import { markEmployeeDocumentSynced } from "../../database/repositories/employees_documents.repository.js";
import { markPayrollComponentSynced } from "../../database/repositories/payroll_components.repository.js";
import { markPayrollEmployeeProfileSynced } from "../../database/repositories/payroll_employee_profile.repository.js";

import {
  markPayrollItemSynced,
  markPayrollResultSynced,
  markPayrollRunSynced,
} from "../../database/repositories/payroll_run.repository.js";

import { markPayrollSettingsSynced } from "../../database/repositories/payroll_settings.repository.js";
import { markAttendanceDailyCheckSynced } from "../../database/repositories/attendanceDailyCheck.repository.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
  : process.env.VITE_API_URL;

interface PushPendingChangesResult {
  pendingChanges: number;
  syncedCount: number;
}

export async function pushPendingChanges(
  companyId: string
): Promise<PushPendingChangesResult> {
  if (!companyId) {
    throw new Error("PUSH SYNC: companyId is required");
  }

  console.log("PUSH SERVICE API URL:", API_URL);
  console.log("PUSH SERVICE COMPANY ID:", companyId);

  /*
   * ---------------------------------------------------------
   * GET AUTH TOKEN
   * ---------------------------------------------------------
   */

  const token = await getToken();

  if (!token) {
    throw new Error("PUSH SYNC: authentication token is missing");
  }

  /*
   * ---------------------------------------------------------
   * GET PENDING ITEMS FOR THIS COMPANY ONLY
   * ---------------------------------------------------------
   */

  const pending = await getUnsyncedItems(companyId);

  if (!pending.length) {
    console.log("NO PENDING CHANGES TO PUSH.", {
      companyId,
    });

    return {
      pendingChanges: 0,
      syncedCount: 0,
    };
  }

  console.log("ITEMS TO PUSH SYNC:", {
    companyId,
    count: pending.length,
    items: pending,
  });

  /*
   * ---------------------------------------------------------
   * VALIDATE COMPANY IDS
   * ---------------------------------------------------------
   */

  for (const item of pending) {
    if (item.companyId !== companyId) {
      throw new Error(
        `SYNC QUEUE COMPANY MISMATCH: ` +
          `item ${item._id} belongs to ${item.companyId}, ` +
          `but current company is ${companyId}`
      );
    }

    let data: any;

    try {
      data = JSON.parse(item.payload);
    } catch {
      throw new Error(`INVALID SYNC PAYLOAD FOR ITEM ${item._id}`);
    }

    if (!data.companyId) {
      throw new Error(`Cannot push sync item ${item._id}: missing companyId`);
    }

    if (data.companyId !== companyId) {
      throw new Error(
        `SYNC PAYLOAD COMPANY MISMATCH: ` +
          `item ${item._id} belongs to ${data.companyId}, ` +
          `but current company is ${companyId}`
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * CREATE FORM DATA
   * ---------------------------------------------------------
   */

  const form = new FormData();

  const items = pending.map((item) => {
    const data = JSON.parse(item.payload);

    return {
      queueId: item._id,
      companyId: item.companyId,
      entity: item.entity,
      operation: item.operation,
      data,
    };
  });

  /*
   * ---------------------------------------------------------
   * SYNC METADATA
   * ---------------------------------------------------------
   */

  form.append("items", JSON.stringify(items));

  /*
   * ---------------------------------------------------------
   * ATTACH FILES
   * ---------------------------------------------------------
   */

  for (const item of pending) {
    const data = JSON.parse(item.payload);

    switch (item.entity) {
      case "employee_photo": {
        const photoPath = path.join(app.getPath("userData"), data.photo_path);

        if (fs.existsSync(photoPath)) {
          form.append("employees_photos", fs.createReadStream(photoPath), {
            filename: data.photo_filename,
            contentType: data.photo_mime_type,
          });
        } else {
          console.error("PHOTO FILE MISSING:", {
            companyId,
            employeeId: data.employeeId,
            photoPath,
          });
        }

        break;
      }

      case "employee_document": {
        if (fs.existsSync(data.localPath)) {
          form.append(
            "employees_documents",
            fs.createReadStream(data.localPath),
            {
              filename: data.fileName,
              contentType: data.mimeType,
            }
          );
        } else {
          console.error("DOCUMENT FILE MISSING:", {
            companyId,
            employeeId: data.employeeId,
            localPath: data.localPath,
          });
        }

        break;
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * SEND TO BACKEND
   * ---------------------------------------------------------
   */

  console.log("FORM TO SEND TO BACKEND:", {
    companyId,
    itemCount: pending.length,
  });

  const response = await axios.post(`${API_URL}/sync/push`, form, {
    headers: {
      ...form.getHeaders(),
      "x-auth-token": token,
      "x-company-id": companyId,
    },
  });

  console.log("SYNC PUSH RESULT:", {
    companyId,
    status: response.status,
  });

  const syncedIds: string[] = response.data.synced ?? [];

  /*
   * ---------------------------------------------------------
   * MARK SYNC QUEUE ITEMS AS SYNCED
   * ---------------------------------------------------------
   */

  if (syncedIds.length > 0) {
    await markManySynced(companyId, syncedIds);
  }

  /*
   * ---------------------------------------------------------
   * MARK LOCAL ENTITIES AS SYNCED
   * ---------------------------------------------------------
   */

  for (const item of pending) {
    if (!syncedIds.includes(item._id)) {
      continue;
    }

    const data = JSON.parse(item.payload);

    switch (item.entity) {
      case "company":
        await markCompanySynced(companyId, data.serverVersion);
        break;

      case "employee":
        await markEmployeeSynced(companyId, data._id);
        break;

      case "employee_photo":
        await markEmployeePhotoSynced(companyId, data.employeeId);
        break;

      case "employee_document":
        await markEmployeeDocumentSynced(companyId, data._id);
        break;

      case "attendance":
        await markAttendanceSynced(companyId, data._id);
        break;

      case "attendance_daily_check":
        await markAttendanceDailyCheckSynced(companyId, data._id);
        break;

      case "leave":
        await markLeaveSynced(companyId, data._id);
        break;

      case "task":
        await markTaskSynced(companyId, data._id);
        break;

      case "task_comment":
        await markTaskCommentsSynced(companyId, data._id);
        break;

      case "payroll_settings":
        await markPayrollSettingsSynced(companyId, data._id);
        break;

      case "payroll_component":
        await markPayrollComponentSynced(companyId, data._id);
        break;

      case "payroll_profile":
        await markPayrollEmployeeProfileSynced(companyId, data._id);
        break;

      case "payroll_run":
        await markPayrollRunSynced(companyId, data._id);
        break;

      case "payroll_result":
        await markPayrollResultSynced(companyId, data._id);
        break;

      case "payroll_item":
        await markPayrollItemSynced(companyId, data._id);
        break;

      default:
        console.warn(`UNKNOWN SYNC ENTITY: ${item.entity}`);
        break;
    }
  }

  /*
   * ---------------------------------------------------------
   * CHECK WHAT IS STILL PENDING
   * ---------------------------------------------------------
   */

  const remainingPending = await getUnsyncedItems(companyId);

  const pendingChanges = remainingPending.length;

  console.log("PUSH COMPLETE:", {
    companyId,
    synced: syncedIds.length,
    stillPending: pendingChanges,
  });

  return {
    pendingChanges,
    syncedCount: syncedIds.length,
  };
}
