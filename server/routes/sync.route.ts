import express, { Request, Response } from "express";

import authorize from "../middlewares/authorize.js";
import upload from "../middlewares/sync_upload.js";

import {
  syncEmployee,
  syncAttendance,
  syncAttendanceDailyCheck,
  syncLeave,
  syncTask,
  syncTaskComment,
  syncUserNotes,
  syncEmployeePhoto,
  syncEmployeeDocument,
  syncPayrollComponent,
  syncPayrollProfile,
  syncPayrollRun,
  syncPayrollResult,
  syncPayrollItem,
  syncPayrollSettings,
  syncCompany,
} from "../sync.js";

import type { SyncOperation } from "../sync.js";

import Company from "../models/company.model.js";
import Employee from "../models/employee.model.js";
import Attendance from "../models/attendance.model.js";
import Leave from "../models/leave.model.js";
import Task from "../models/task.model.js";
import AdminUser from "../models/adminUser.model.js";
import EmployeeDocuments from "../models/employeesDocuments.model.js";
import PayrollComponent from "../models/payrollComponent.model.js";
import PayrollEmployeeProfile from "../models/payrollEmployeeProfile.model.js";
import PayrollResult from "../models/payrollResult.model.js";
import PayrollItem from "../models/payrollItem.model.js";
import PayrollRun from "../models/payrollRun.model.js";
import PayrollSettings from "../models/payrollSettings.model.js";
import AttendanceDailyCheck from "../models/attendanceDailyCheck.model.js";

const router = express.Router();

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

interface AuthenticatedUser {
  _id?: string;
  id?: string;
  email?: string;
  role?: string;
  companyId?: string;
}

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

interface PushSyncRequest {
  items: string;
}

interface SyncItem {
  queueId: string;
  companyId: string;
  entity: string;
  operation: SyncOperation;
  data: any;
}

interface PullQuery {
  entity?: string;
  afterVersion?: string;
  limit?: string;
}

/*
 * ============================================================
 * COMPANY ID HELPERS
 * ============================================================
 */

function requireAuthenticatedCompanyId(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;

  if (!companyId || typeof companyId !== "string") {
    throw new Error("SYNC: authenticated user has no companyId");
  }

  return companyId;
}

/**
 * Validate the optional x-company-id header.
 *
 * The JWT remains the authoritative company identity.
 */
function validateCompanyHeader(
  req: AuthenticatedRequest,
  companyId: string
): void {
  const headerCompanyId = req.headers["x-company-id"];

  if (headerCompanyId === undefined) {
    return;
  }

  const receivedCompanyId = Array.isArray(headerCompanyId)
    ? headerCompanyId[0]
    : headerCompanyId;

  if (receivedCompanyId !== companyId) {
    throw new Error("SYNC: x-company-id does not match authenticated company");
  }
}

/**
 * Validate that a pushed item belongs to the authenticated company.
 */
function validateSyncItemCompany(
  item: SyncItem,
  authenticatedCompanyId: string
): void {
  if (!item.companyId) {
    throw new Error(`SYNC: companyId is required for entity ${item.entity}`);
  }

  if (item.companyId !== authenticatedCompanyId) {
    throw new Error(`SYNC: companyId mismatch for entity ${item.entity}`);
  }

  if (!item.data?.companyId) {
    throw new Error(
      `SYNC: data.companyId is required for entity ${item.entity}`
    );
  }

  if (item.data.companyId !== authenticatedCompanyId) {
    throw new Error(`SYNC: data.companyId mismatch for entity ${item.entity}`);
  }
}

/*
 * ============================================================
 * VERSIONED PULL HELPER
 * ============================================================
 */

async function pullVersionedCollection<
  T extends {
    serverVersion?: number;
    companyId?: string;
  }
>(
  model: any,
  companyId: string,
  afterVersion: number,
  limit: number,
  select?: string
) {
  if (!companyId) {
    throw new Error("SYNC PULL: companyId is required");
  }

  let query = model
    .find({
      companyId,
      serverVersion: {
        $gt: afterVersion,
      },
    })
    .sort({
      serverVersion: 1,
    })
    .limit(limit);

  if (select) {
    query = query.select(select);
  }

  const items = await query.lean();

  const nextVersion =
    items.length > 0
      ? Number(items[items.length - 1].serverVersion ?? afterVersion)
      : afterVersion;

  const moreChanges = await model.exists({
    companyId,
    serverVersion: {
      $gt: nextVersion,
    },
    isDeleted: 0,
  });

  return {
    items: items as T[],
    nextVersion,
    hasMore: Boolean(moreChanges),
  };
}

/*
 * ============================================================
 * PUSH SYNC
 * ============================================================
 */

router.post(
  "/push",
  authorize,
  upload.fields([
    {
      name: "employees_photos",
    },
    {
      name: "employees_documents",
    },
  ]),
  async (
    req: AuthenticatedRequest & {
      body: PushSyncRequest;
    },
    res: Response
  ) => {
    try {
      /*
       * --------------------------------------------------------
       * AUTHENTICATED COMPANY
       * --------------------------------------------------------
       */

      const companyId = requireAuthenticatedCompanyId(req);

      validateCompanyHeader(req, companyId);

      /*
       * --------------------------------------------------------
       * PARSE ITEMS
       * --------------------------------------------------------
       */

      if (!req.body?.items) {
        return res.status(400).json({
          success: false,
          message: "Missing sync items",
        });
      }

      let items: SyncItem[];

      try {
        items = JSON.parse(req.body.items);
      } catch (error) {
        console.error("INVALID SYNC ITEMS JSON:", error);

        return res.status(400).json({
          success: false,
          message: "Invalid sync items JSON",
        });
      }

      if (!Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          message: "Sync items must be an array",
        });
      }

      console.log("SYNC PUSH COMPANY:", companyId);
      console.log("SYNC PUSH ITEM COUNT:", items.length);

      /*
       * --------------------------------------------------------
       * FILES
       * --------------------------------------------------------
       */

      console.log("REQ FILES:", req.files);

      const files = req.files as
        | {
            [fieldname: string]: Express.Multer.File[];
          }
        | undefined;

      const photoFiles = files?.employees_photos || [];
      const documentFiles = files?.employees_documents || [];

      /*
       * --------------------------------------------------------
       * SYNC RESULTS
       * --------------------------------------------------------
       */

      const synced: string[] = [];

      /*
       * --------------------------------------------------------
       * PROCESS ITEMS
       * --------------------------------------------------------
       */

      for (const item of items) {
        const { queueId, entity, operation, data } = item;

        try {
          /*
           * ------------------------------------------------------
           * TENANT VALIDATION
           * ------------------------------------------------------
           */

          validateSyncItemCompany(item, companyId);

          switch (entity) {
            /*
             * ====================================================
             * COMPANY
             * ====================================================
             */

            case "company": {
              /*
               * Company is the tenant root.
               *
               * The companyId has already been verified against
               * the authenticated JWT above.
               */
              const result = await syncCompany(operation, data);

              console.log(
                `COMPANY ${data.companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * EMPLOYEE
             * ====================================================
             */

            case "employee": {
              const result = await syncEmployee(operation, data);

              console.log(
                `EMPLOYEE ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * ATTENDANCE
             * ====================================================
             */

            case "attendance": {
              const result = await syncAttendance(operation, data);

              console.log(
                `ATTENDANCE ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * ATTENDANCE DAILY CHECK
             * ====================================================
             */

            case "attendance_daily_check": {
              const result = await syncAttendanceDailyCheck(operation, data);

              console.log(
                `ATTENDANCE DAILY CHECK ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * LEAVE
             * ====================================================
             */

            case "leave": {
              const result = await syncLeave(operation, data);

              console.log(
                `LEAVE ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * TASK
             * ====================================================
             */

            case "task": {
              const result = await syncTask(operation, data);

              console.log(
                `TASK ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * TASK COMMENT
             * ====================================================
             */

            case "task_comment": {
              const result = await syncTaskComment(operation, data);

              console.log(
                `TASK COMMENT ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * USER NOTES
             * ====================================================
             */

            case "user_notes": {
              const result = await syncUserNotes(data);

              console.log(
                `USER NOTES ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * EMPLOYEE PHOTO
             * ====================================================
             */

            case "employee_photo": {
              const file = photoFiles.find(
                (f) => f.originalname === data.photo_filename
              );

              console.log("EMPLOYEE PHOTO TO UPDATE:", file);

              const result = await syncEmployeePhoto(data, file);

              console.log(
                `EMPLOYEE PHOTO ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * EMPLOYEE DOCUMENT
             * ====================================================
             */

            case "employee_document": {
              const file = documentFiles.find(
                (f) => f.originalname === data.fileName
              );

              console.log("file name", data.fileName);

              const result = await syncEmployeeDocument(operation, data, file);

              console.log(
                `EMPLOYEE DOCUMENT ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );
              break;
            }

            /*
             * ====================================================
             * PAYROLL SETTINGS
             * ====================================================
             */

            case "payroll_settings": {
              const result = await syncPayrollSettings(operation, data);

              console.log(
                `PAYROLL SETTINGS ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * PAYROLL COMPONENT
             * ====================================================
             */

            case "payroll_component": {
              const result = await syncPayrollComponent(operation, data);

              console.log(
                `PAYROLL COMPONENT ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * PAYROLL PROFILE
             * ====================================================
             */

            case "payroll_profile": {
              const result = await syncPayrollProfile(operation, data);

              console.log(
                `PAYROLL PROFILE ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * PAYROLL RUN
             * ====================================================
             */

            case "payroll_run": {
              const result = await syncPayrollRun(operation, data);

              console.log(
                `PAYROLL RUN ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * PAYROLL RESULT
             * ====================================================
             */

            case "payroll_result": {
              const result = await syncPayrollResult(operation, data);

              console.log(
                `PAYROLL RESULT ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * PAYROLL ITEM
             * ====================================================
             */

            case "payroll_item": {
              const result = await syncPayrollItem(operation, data);

              console.log(
                `PAYROLL ITEM ${data._id} COMPANY ${companyId} SERVER VERSION:`,
                result?.serverVersion
              );

              break;
            }

            /*
             * ====================================================
             * UNKNOWN ENTITY
             * ====================================================
             */

            default: {
              console.warn(`UNKNOWN SYNC ENTITY: ${entity}`);

              continue;
            }
          }

          /*
           * ------------------------------------------------------
           * ONLY MARK QUEUE ITEM AS SYNCED AFTER SUCCESS
           * ------------------------------------------------------
           */

          synced.push(queueId);
        } catch (error) {
          console.error(`PUSH FAILED FOR ${entity}`, {
            companyId,
            queueId,
            entityId: data?._id,
            error,
          });

          /*
           * Continue processing the other queue items.
           */
        }
      }

      /*
       * --------------------------------------------------------
       * RESPONSE
       * --------------------------------------------------------
       */

      return res.json({
        success: true,
        companyId,
        synced,
      });
    } catch (error) {
      console.error("PUSH SYNC FAILED:", error);

      return res.status(500).json({
        success: false,
        message: "Push sync failed",
      });
    }
  }
);

/*
 * ============================================================
 * PULL SYNC
 * ============================================================
 */

router.get(
  "/pull",
  authorize,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      /*
       * --------------------------------------------------------
       * AUTHENTICATED COMPANY
       * --------------------------------------------------------
       */

      const companyId = requireAuthenticatedCompanyId(req);

      validateCompanyHeader(req, companyId);

      const {
        entity,
        afterVersion = "0",
        limit = "500",
      } = req.query as PullQuery;

      /*
       * --------------------------------------------------------
       * VALIDATE VERSION
       * --------------------------------------------------------
       */

      const version = Number(afterVersion);
      const max = Number(limit);

      if (!Number.isInteger(version) || version < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid afterVersion parameter",
        });
      }

      if (!Number.isInteger(max) || max <= 0 || max > 1000) {
        return res.status(400).json({
          success: false,
          message: "Invalid limit. Must be between 1 and 1000.",
        });
      }

      /*
       * --------------------------------------------------------
       * ENTITY REQUIRED
       * --------------------------------------------------------
       */

      if (!entity) {
        return res.status(400).json({
          success: false,
          message: "Missing entity parameter",
        });
      }

      /*
       * ========================================================
       * COMPANY
       * ========================================================
       */

      if (entity === "company") {
        const result = await pullVersionedCollection(
          Company,
          companyId,
          version,
          max
        );

        console.log("COMPANY VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        return res.json({
          success: true,
          companyId,
          entity: "company",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * EMPLOYEES
       * ========================================================
       */

      if (entity === "employee") {
        const result = await pullVersionedCollection(
          Employee,
          companyId,
          version,
          max
        );

        console.log("EMPLOYEE VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "EMPLOYEE PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "employee",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * ADMIN USERS
       * ========================================================
       */

      if (entity === "admin_user") {
        const result = await pullVersionedCollection(
          AdminUser,
          companyId,
          version,
          max,
          "-password -notes"
        );

        console.log("ADMIN USER VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "ADMIN USER PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "admin_user",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * EMPLOYEE DOCUMENTS
       * ========================================================
       */

      if (entity === "employee_document") {
        const result = await pullVersionedCollection(
          EmployeeDocuments,
          companyId,
          version,
          max
        );

        console.log("EMPLOYEE DOCUMENTS VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "EMPLOYEE DOCUMENTS PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "employee_document",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * ATTENDANCE
       * ========================================================
       */

      if (entity === "attendance") {
        const result = await pullVersionedCollection(
          Attendance,
          companyId,
          version,
          max
        );

        console.log("ATTENDANCE VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "ATTENDANCE PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "attendance",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * ATTENDANCE DAILY CHECK
       * ========================================================
       */

      if (entity === "attendance_daily_check") {
        const result = await pullVersionedCollection(
          AttendanceDailyCheck,
          companyId,
          version,
          max
        );

        console.log("ATTENDANCE DAILY CHECK VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "ATTENDANCE DAILY CHECK PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "attendance_daily_check",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * LEAVE
       * ========================================================
       */

      if (entity === "leave") {
        const result = await pullVersionedCollection(
          Leave,
          companyId,
          version,
          max
        );

        console.log("LEAVE VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "LEAVE PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "leave",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * TASK
       * ========================================================
       */

      if (entity === "task") {
        const result = await pullVersionedCollection(
          Task,
          companyId,
          version,
          max
        );

        console.log("TASK VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "TASK PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "task",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * PAYROLL SETTINGS
       * ========================================================
       */

      if (entity === "payroll_settings") {
        const result = await pullVersionedCollection(
          PayrollSettings,
          companyId,
          version,
          max
        );

        console.log("PAYROLL SETTINGS VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "PAYROLL SETTINGS PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "payroll_settings",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * PAYROLL COMPONENT
       * ========================================================
       */

      if (entity === "payroll_component") {
        const result = await pullVersionedCollection(
          PayrollComponent,
          companyId,
          version,
          max
        );

        console.log("PAYROLL COMPONENT VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "PAYROLL COMPONENT PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "payroll_component",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * PAYROLL PROFILE
       * ========================================================
       */

      if (entity === "payroll_profile") {
        const result = await pullVersionedCollection(
          PayrollEmployeeProfile,
          companyId,
          version,
          max
        );

        console.log("PAYROLL PROFILE VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "PAYROLL PROFILE PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "payroll_profile",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * PAYROLL RUN
       * ========================================================
       */

      if (entity === "payroll_run") {
        const result = await pullVersionedCollection(
          PayrollRun,
          companyId,
          version,
          max
        );

        console.log("PAYROLL RUN VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "PAYROLL RUN PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "payroll_run",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * PAYROLL RESULT
       * ========================================================
       */

      if (entity === "payroll_result") {
        const result = await pullVersionedCollection(
          PayrollResult,
          companyId,
          version,
          max
        );

        console.log("PAYROLL RESULT VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "PAYROLL RESULT PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "payroll_result",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * PAYROLL ITEM
       * ========================================================
       */

      if (entity === "payroll_item") {
        const result = await pullVersionedCollection(
          PayrollItem,
          companyId,
          version,
          max
        );

        console.log("PAYROLL ITEM VERSION PULL:", {
          companyId,
          afterVersion: version,
          nextVersion: result.nextVersion,
          count: result.items.length,
          hasMore: result.hasMore,
        });

        if (result.items.length > 0) {
          console.log(
            "PAYROLL ITEM PULL FROM MONGO:",
            JSON.stringify(result.items[0], null, 2)
          );
        }

        return res.json({
          success: true,
          companyId,
          entity: "payroll_item",
          items: result.items,
          nextVersion: result.nextVersion,
          hasMore: result.hasMore,
          serverTime: new Date().toISOString(),
        });
      }

      /*
       * ========================================================
       * UNKNOWN ENTITY
       * ========================================================
       */

      return res.status(400).json({
        success: false,
        message: `Unknown sync entity: ${entity}`,
      });
    } catch (error) {
      console.error("PULL SYNC FAILED:", error);

      return res.status(500).json({
        success: false,
        message: "Pull sync failed",
      });
    }
  }
);

export default router;
