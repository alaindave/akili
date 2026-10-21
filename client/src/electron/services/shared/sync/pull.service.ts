import { getCompanyFilesRoot } from "../../../storage/companyStorage.js";
import type { Incident } from "../../../../common/types/incident/Incident.js";
import { upsertIncident } from "../../../database/repositories/shared/incidents.repository.js";
import axios from "axios";
import {
  INVENTORY_SYNC_TABLES,
  type InventorySyncEntity,
} from "../../../../common/types/inventory/InventorySync.js";
import { applyInventoryBatch } from "../../../database/repositories/modules/inventory/inventorySync.repository.js";
import { app } from "electron";
import fs from "fs/promises";
import path from "path";

import { getEmployeeById } from "../../../database/repositories/modules/hr/employees.repository.js";
import { setSetting } from "../../../database/repositories/shared/settings.repository.js";
import { upsertAdminUser } from "../../../database/repositories/shared/admin_users.repository.js";

import { markEmployeeSynced } from "../../../database/repositories/modules/hr/employees.repository.js";

import Employee from "../../../../common/types/hr/employees/Employee.js";
import { Attendance } from "../../../../common/types/hr/attendance/Attendance.js";
import Leave from "../../../../common/types/hr/time-off/TimeOff.js";
import AdminUser from "../../../../common/types/shared/AdminUser.js";

import Task from "../../../../common/types/task/Task.js";
import PayrollComponent from "../../../../common/types/hr/payroll/PayrollComponent.js";

import {
  markTaskSynced,
  upsertTask,
} from "../../../database/repositories/shared/tasks.repository.js";

import { downloadEmployeePhoto } from "../../../util/downloadEmployeePhoto.util.js";

import { upsertEmployeeWithPhoto } from "../employeePhoto.service.js";

import { upsertTaskComment } from "../../../database/repositories/shared/tasks_comments.repository.js";

import {
  getEmployeeDocumentById,
  markEmployeeDocumentSynced,
} from "../../../database/repositories/modules/hr/employeesDocuments.repository.js";

import { downloadEmployeeDocument } from "../../../util/downloadEmployeeDocument.util.js";
import {
  importEmployeeDocumentDeletion,
  cleanupEmployeeDocuments,
} from "../employeeDocumentStorage.service.js";

import { EmployeeDocument } from "../../../../common/types/hr/employees/EmployeeDocuments.js";

import {
  upsertPayrollComponent,
  markPayrollComponentSynced,
} from "../../../database/repositories/modules/hr/payrollComponents.repository.js";

import PayrollEmployeeProfile from "../../../../common/types/hr/payroll/PayrollEmployeeProfile.js";

import { upsertEmployeePayrollProfile } from "../../../database/repositories/modules/hr/payrollProfile.repository.js";

import {
  PayrollResult,
  PayrollRun,
  PayrollItem,
} from "../../../../common/types/hr/payroll/Payroll.js";

import {
  upsertPayrollItem,
  upsertPayrollResult,
  upsertPayrollRun,
  refreshPayrollRunStatuses,
} from "../../../database/repositories/modules/hr/payrollRun.repository.js";

import { PayrollSettings } from "../../../../common/types/hr/payroll/Payroll.js";

import {
  markPayrollSettingsSynced,
  upsertPayrollSettings,
} from "../../../database/repositories/modules/hr/payrollSettings.repository.js";

import { AttendanceDailyCheck } from "../../../../common/types/hr/attendance/AttendanceDailyCheck.js";

import { all, get, transaction } from "../../../database/db.js";

import {
  getSyncState,
  updateLastPulledVersion,
} from "../../../database/repositories/shared/syncState.repository.js";

import Company from "../../../../common/types/shared/Company.js";

import {
  markCompanySynced,
  upsertCompany,
} from "../../../database/repositories/shared/companies.repository.js";

import { getToken } from "../../../auth.js";
import { getPendingSyncItems } from "../../../database/repositories/shared/sync.repository.js";

import { getEmployeePhotoDir } from "../../../storage/directories.js";
import { pullTimeOffChanges } from "./timeOffSync.service.js";
import { withEmployeeMedia } from "../../../storage/employeeMediaLock.js";
import { downloadCompanyLogo } from "../../../util/downloadCompanyLogo.util.js";
import { upsertAttendance } from "../../../database/repositories/modules/hr/attendances.repository.js";
import {
  markAttendanceDailyCheckSynced,
  upsertAttendanceDailyCheck,
} from "../../../database/repositories/modules/hr/attendanceDailyCheck.repository.js";

const API_URL = app.isPackaged
  ? process.env.PRODUCTION_API_URL
  : process.env.VITE_API_URL;

/* =========================================================
   TYPES
========================================================= */

interface VersionPullResult<T> {
  items: T[];
  serverTime?: string;
}

interface CompanyLogo {
  companyId: string;
  logoPath?: string | null;
  logoUrl?: string | null;
  mimeType?: string | null;
  serverVersion?: number;
  updatedAt: string;
  isDeleted?: number;
}

/* =========================================================
   MAIN PULL SERVICE
========================================================= */

export async function pullLatestChanges(companyId: string) {
  console.log("PULL SERVICE API URL:", API_URL);

  const errors: string[] = [];
  async function pullIndependently<T>(
    ...args: Parameters<typeof pullEntityByVersion<T>>
  ): Promise<VersionPullResult<T>> {
    try {
      return await pullEntityByVersion<T>(...args);
    } catch (error) {
      errors.push(String(error));
      return { items: [] };
    }
  }
  try {
    if (!companyId) {
      throw new Error("CANNOT PULL CHANGES: NO LOCAL COMPANY ID FOUND.");
    }

    let latestServerTime: string | undefined;

    /* =====================================================
       COMPANIES
    ===================================================== */

    const companiesResult = await pullIndependently<Company>(
      companyId,
      "company",
      syncCompanies
    );

    latestServerTime = companiesResult.serverTime ?? latestServerTime;

    const companies = companiesResult.items;

    /* =====================================================
       COMPANY LOGO
    ===================================================== */

    const companyLogosResult = await pullIndependently<CompanyLogo>(
      companyId,
      "company_logo",
      syncCompanyLogos
    );

    latestServerTime = companyLogosResult.serverTime ?? latestServerTime;

    const companyLogos = companyLogosResult.items;

    /* =====================================================
       ADMIN USERS
    ===================================================== */

    const adminUsersResult = await pullIndependently<AdminUser>(
      companyId,
      "admin_user",
      syncAdminUsers
    );

    latestServerTime = adminUsersResult.serverTime ?? latestServerTime;

    const adminUsers = adminUsersResult.items;

    /* =====================================================
       EMPLOYEES
    ===================================================== */

    const employeesResult = await pullIndependently<Employee>(
      companyId,
      "employee",
      syncEmployees
    );

    latestServerTime = employeesResult.serverTime ?? latestServerTime;

    const employees = employeesResult.items;

    // Media failure must be reported, while allowing unrelated records to pull.
    let photoSyncError: unknown;
    try {
      await syncEmployeePhotoFiles(companyId);
    } catch (error) {
      photoSyncError = error;
    }

    /* =====================================================
       EMPLOYEE DOCUMENTS
    ===================================================== */

    const employeeDocumentsResult = await pullIndependently<EmployeeDocument>(
      companyId,
      "employee_document",
      syncEmployeeDocuments
    );

    latestServerTime = employeeDocumentsResult.serverTime ?? latestServerTime;

    const employeesDocuments = employeeDocumentsResult.items;
    try {
      await withEmployeeMedia(companyId, cleanupEmployeeDocuments);
    } catch (error) {
      errors.push(`Employee document cleanup failed: ${String(error)}`);
    }

    /* =====================================================
       ATTENDANCES
    ===================================================== */

    const attendancesResult = await pullIndependently<Attendance>(
      companyId,
      "attendance",
      syncAttendances
    );

    latestServerTime = attendancesResult.serverTime ?? latestServerTime;

    const attendances = attendancesResult.items;

    /* =====================================================
       ATTENDANCE DAILY CHECKS
    ===================================================== */

    const attendanceDailyChecksResult =
      await pullIndependently<AttendanceDailyCheck>(
        companyId,
        "attendance_daily_check",
        syncAttendanceDailyChecks
      );

    latestServerTime =
      attendanceDailyChecksResult.serverTime ?? latestServerTime;

    const attendanceDailyCheck = attendanceDailyChecksResult.items;

    /* =====================================================
       TIME OFF MOTIFS, THEN REQUESTS
    ===================================================== */

    let timeOffMotifCount = 0;
    let timeOffRequestCount = 0;
    try {
      const token = await getToken(companyId);
      if (!token) throw new Error("PULL SYNC: authentication token is missing");
      const result = await pullTimeOffChanges(companyId, API_URL ?? "", token);
      timeOffMotifCount = result.motifs;
      timeOffRequestCount = result.requests;
    } catch (error) {
      errors.push(`TimeOff pull failed: ${String(error)}`);
    }
    // Do not query the retired /sync entity "leave". Historical rows remain
    // archived until explicitly mapped to a company policy.
    const leaves: Leave[] = [];

    /* =====================================================
       TASKS
    ===================================================== */

    const tasksResult = await pullIndependently<Task>(
      companyId,
      "task",
      syncTasks
    );

    latestServerTime = tasksResult.serverTime ?? latestServerTime;

    const tasks = tasksResult.items;
    const incidentsResult = await pullIndependently<Incident>(
      companyId,
      "incident",
      async (items) => {
        for (const incident of items) await upsertIncident(companyId, incident);
        return true;
      }
    );
    latestServerTime = incidentsResult.serverTime ?? latestServerTime;

    /* =====================================================
       PAYROLL SETTINGS
    ===================================================== */

    const payrollSettingsResult = await pullIndependently<PayrollSettings>(
      companyId,
      "payroll_settings",
      syncPayrollSettings
    );

    latestServerTime = payrollSettingsResult.serverTime ?? latestServerTime;

    const payrollSettings = payrollSettingsResult.items;

    /* =====================================================
       PAYROLL COMPONENTS
    ===================================================== */

    const payrollComponentsResult = await pullIndependently<PayrollComponent>(
      companyId,
      "payroll_component",
      syncPayrollComponents
    );

    latestServerTime = payrollComponentsResult.serverTime ?? latestServerTime;

    const payrollComponents = payrollComponentsResult.items;

    /* =====================================================
       PAYROLL EMPLOYEE PROFILES
    ===================================================== */

    const payrollEmployeeProfilesResult =
      await pullIndependently<PayrollEmployeeProfile>(
        companyId,
        "payroll_profile",
        syncPayrollEmployeeProfiles
      );

    latestServerTime =
      payrollEmployeeProfilesResult.serverTime ?? latestServerTime;

    const payrollEmployeeProfiles = payrollEmployeeProfilesResult.items;

    /* =====================================================
       PAYROLL RUNS
    ===================================================== */

    const payrollRunsResult = await pullIndependently<PayrollRun>(
      companyId,
      "payroll_run",
      syncPayrollRuns
    );

    latestServerTime = payrollRunsResult.serverTime ?? latestServerTime;

    const payrollRuns = payrollRunsResult.items;

    /* =====================================================
       PAYROLL RESULTS
    ===================================================== */

    const payrollResultsResult = await pullIndependently<PayrollResult>(
      companyId,
      "payroll_result",
      syncPayrollResults
    );

    latestServerTime = payrollResultsResult.serverTime ?? latestServerTime;

    const payrollResults = payrollResultsResult.items;
    await refreshPayrollRunStatuses(companyId);

    /* =====================================================
       PAYROLL ITEMS
    ===================================================== */

    const payrollItemsResult = await pullIndependently<PayrollItem>(
      companyId,
      "payroll_item",
      syncPayrollItems
    );

    latestServerTime = payrollItemsResult.serverTime ?? latestServerTime;

    const payrollItems = payrollItemsResult.items;

    /* =====================================================
       INVENTORY SYNC
    ===================================================== */
    for (const entity of Object.keys(
      INVENTORY_SYNC_TABLES
    ) as InventorySyncEntity[]) {
      const result = await pullIndependently<Record<string, any>>(
        companyId,
        entity,
        (items) => applyInventoryBatch(companyId, entity, items)
      );
      latestServerTime = result.serverTime ?? latestServerTime;
    }

    if (photoSyncError) errors.push(String(photoSyncError));
    if (errors.length) throw new Error(errors.join("\n"));

    /* =====================================================
       SYNC METADATA
    ===================================================== */

    const completedAt = new Date().toISOString();

    await setSetting("lastSync", completedAt);

    if (latestServerTime) {
      await setSetting("serverTime", latestServerTime);
    }

    /* =====================================================
       LOGGING
    ===================================================== */

    console.log("PULL SYNC COMPLETED SUCCESSFULLY.");

    console.log("SYNC SUMMARY:", {
      companyId,

      companies: companies.length,

      companyLogos: companyLogos.length,

      employees: employees.length,

      adminUsers: adminUsers.length,

      employeesDocuments: employeesDocuments.length,

      attendances: attendances.length,

      attendanceDailyCheck: attendanceDailyCheck.length,

      leaves: leaves.length,
      timeOffMotifs: timeOffMotifCount,
      timeOffRequests: timeOffRequestCount,

      tasks: tasks.length,

      payrollSettings: payrollSettings.length,

      payrollComponents: payrollComponents.length,

      payrollEmployeeProfiles: payrollEmployeeProfiles.length,

      payrollRuns: payrollRuns.length,

      payrollResults: payrollResults.length,

      payrollItems: payrollItems.length,

      lastSync: completedAt,

      serverTime: latestServerTime,
    });

    return {
      companyId,

      companies,

      companyLogos,

      employees,

      adminUsers,

      employeesDocuments,

      attendances,

      attendanceDailyCheck,

      leaves,

      tasks,

      payrollSettings,

      payrollComponents,

      payrollEmployeeProfiles,

      payrollRuns,

      payrollResults,

      payrollItems,

      lastSync: completedAt,

      serverTime: latestServerTime,
    };
  } catch (error) {
    console.error("PULL SYNC FAILED:", error);

    throw error;
  }
}

/* =========================================================
   COMPANIES
========================================================= */

async function syncCompanies(companies: Company[]): Promise<boolean> {
  if (!companies || companies.length === 0) {
    console.log("NO COMPANIES TO SYNC.");

    return true;
  }

  const sortedCompanies = [...companies].sort(
    (a, b) => (a.serverVersion ?? 0) - (b.serverVersion ?? 0)
  );

  const allSucceeded = true;

  for (const company of sortedCompanies) {
    try {
      console.log(
        `SYNCING COMPANY ${company.companyId} ` +
          `(serverVersion=${company.serverVersion})`
      );

      await upsertCompany(company);

      await markCompanySynced(company.companyId);

      console.log(
        `COMPANY SYNCED ${company.companyId} ` + `(v${company.serverVersion})`
      );
    } catch (error) {
      console.error("FAILED TO SYNC PULLED COMPANY:", {
        companyId: company.companyId,

        serverVersion: company.serverVersion,

        error,
      });
      throw error;
    }
  }

  return allSucceeded;
}

/* =========================================================
   COMPANY LOGOS
========================================================= */
/* =========================================================
   COMPANY LOGOS
========================================================= */

async function syncCompanyLogos(companyLogos: CompanyLogo[]): Promise<boolean> {
  if (!companyLogos || companyLogos.length === 0) {
    console.log("NO COMPANY LOGOS TO SYNC.");
    return true;
  }

  const succeeded = true;

  for (const logo of companyLogos) {
    try {
      console.log("===== COMPANY LOGO SYNC =====");

      console.log("COMPANY ID:", logo.companyId);
      console.log("SERVER VERSION:", logo.serverVersion);
      console.log("LOGO PATH:", logo.logoPath);
      console.log("LOGO URL:", logo.logoUrl);
      console.log("MIME TYPE:", logo.mimeType);

      /* =====================================================
         DELETED LOGO
      ===================================================== */

      if (logo.isDeleted) {
        console.log("COMPANY LOGO DELETED ON SERVER:", logo.companyId);

        const localCompany = await get<Company>(
          `
            SELECT *
            FROM companies
            WHERE companyId = ?
            LIMIT 1
          `,
          [logo.companyId]
        );

        if (localCompany?.logoPath) {
          const absolutePath = path.join(
            getCompanyFilesRoot(),
            localCompany.logoPath
          );

          try {
            await fs.unlink(absolutePath);

            console.log("PHYSICALLY DELETED COMPANY LOGO:", absolutePath);
          } catch (error: any) {
            if (error?.code === "ENOENT") {
              console.log("COMPANY LOGO FILE ALREADY DELETED:", absolutePath);
            } else {
              throw error;
            }
          }
        }

        await get(
          `
            UPDATE companies
            SET
              logoPath = NULL,
              synced = 1,
              serverVersion = ?
            WHERE companyId = ?
          `,
          [logo.serverVersion ?? 0, logo.companyId]
        );

        console.log("COMPANY LOGO DELETE SYNCED:", logo.companyId);

        continue;
      }

      /* =====================================================
         LOGO URL REQUIRED
      ===================================================== */

      if (!logo.logoUrl) {
        throw new Error(`COMPANY LOGO URL MISSING FOR ${logo.companyId}`);
      }

      console.log("DOWNLOADING COMPANY LOGO:", {
        companyId: logo.companyId,
        url: logo.logoUrl,
      });

      const absolutePath = await downloadCompanyLogo(
        logo.companyId,
        logo.mimeType
      );

      console.log("COMPANY LOGO DOWNLOADED:", absolutePath);

      /* =====================================================
         CONVERT ABSOLUTE PATH TO LOCAL RELATIVE PATH
      ===================================================== */

      const relativeLogoPath = path
        .relative(getCompanyFilesRoot(), absolutePath)
        .split(path.sep)
        .join("/");

      console.log("COMPANY LOGO RELATIVE PATH:", relativeLogoPath);

      /* =====================================================
         UPDATE LOCAL COMPANY METADATA
      ===================================================== */

      await get(
        `
          UPDATE companies
          SET
            logoPath = ?,
            updatedAt = ?,
            synced = 1,
            serverVersion = ?
          WHERE companyId = ?
        `,
        [
          relativeLogoPath,
          logo.updatedAt ?? new Date().toISOString(),
          logo.serverVersion ?? 0,
          logo.companyId,
        ]
      );

      console.log("COMPANY LOGO METADATA UPDATED:", {
        companyId: logo.companyId,
        logoPath: relativeLogoPath,
        serverVersion: logo.serverVersion,
      });

      console.log("COMPANY LOGO SYNCED:", logo.companyId);
    } catch (error) {
      console.error("FAILED TO SYNC COMPANY LOGO:", {
        companyId: logo.companyId,
        serverVersion: logo.serverVersion,
        error,
      });
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   ADMIN USERS
========================================================= */

async function syncAdminUsers(adminUsers: AdminUser[]): Promise<boolean> {
  if (!adminUsers || adminUsers.length === 0) {
    return true;
  }

  const succeeded = true;

  for (const adminUser of adminUsers) {
    try {
      await upsertAdminUser(adminUser);
    } catch (error) {
      console.error("FAILED TO SYNC PULLED ADMIN USER:", adminUser._id, error);
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   EMPLOYEES
========================================================= */

async function syncEmployees(employees: Employee[]): Promise<boolean> {
  if (!employees || employees.length === 0) {
    console.log("NO EMPLOYEES TO SYNC.");

    return true;
  }

  const sortedEmployees = [...employees].sort(
    (a, b) => (a.serverVersion ?? 0) - (b.serverVersion ?? 0)
  );

  const allSucceeded = true;

  for (const employee of sortedEmployees) {
    try {
      console.log(
        `SYNCING EMPLOYEE ${employee._id} ` +
          `(serverVersion=${employee.serverVersion})`
      );

      await upsertEmployeeWithPhoto(employee);

      await markEmployeeSynced(employee.companyId, employee._id);

      console.log(
        `EMPLOYEE SYNCED ${employee._id} ` + `(v${employee.serverVersion})`
      );
    } catch (error) {
      console.error("FAILED TO SYNC PULLED EMPLOYEE:", {
        employeeId: employee._id,

        serverVersion: employee.serverVersion,

        error,
      });
      throw error;
    }
  }

  return allSucceeded;
}

/* =========================================================
   EMPLOYEE PHOTOS
========================================================= */

async function syncEmployeePhotoFiles(companyId: string) {
  // Recheck downloaded files so a missing cache can recover without a remote edit.
  const cached = await all<Employee>(
    `SELECT * FROM employees WHERE companyId = ? AND isDeleted = 0
      AND photo_path IS NOT NULL AND COALESCE(photo_needs_upload, 0) = 0`,
    [companyId]
  );
  for (const employee of cached) {
    const exists = await fs
      .stat(
        path.join(
          getEmployeePhotoDir(),
          employee.photo_path!.replace(/\\/g, "/")
        )
      )
      .then((stat) => stat.isFile() && stat.size > 0)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return false;
        throw error;
      });
    if (!exists) {
      await updateLastPulledVersion(companyId, "employee_photo", 0);
      break;
    }
  }
  // A separate cursor also recovers photos skipped by older installations.
  return pullEntityByVersion<Employee>(
    companyId,
    "employee",
    syncEmployeePhotos,
    500,
    "employee_photo"
  );
}

async function syncEmployeePhotos(employees: Employee[]): Promise<boolean> {
  const succeeded = true;
  for (const employee of employees) {
    try {
      if (
        employee.isDeleted ||
        !employee.photo_filename ||
        employee.photo_version == null
      ) {
        continue;
      }

      const localEmployee = await getEmployeeById(
        employee.companyId,
        employee._id
      );

      const localPhotoVersion = localEmployee?.photo_version ?? 0;

      if (!localEmployee)
        throw new Error(`Employee ${employee._id} not found locally`);
      if (localEmployee.photo_needs_upload) {
        throw new Error(`Employee ${employee._id} has a pending photo upload`);
      }

      const localPhotoExists = localEmployee.photo_path
        ? await fs
            .stat(
              path.join(
                getEmployeePhotoDir(),
                localEmployee.photo_path.replace(/\\/g, "/")
              )
            )
            .then((stat) => stat.isFile() && stat.size > 0)
            .catch((error: NodeJS.ErrnoException) => {
              if (error.code === "ENOENT") return false;
              throw error;
            })
        : false;

      console.log("=====EMPLOYEE PHOTO SYNC=====");

      console.log("REMOTE PHOTO VERSION:", employee.photo_version);

      console.log("LOCAL PHOTO VERSION:", localPhotoVersion);

      if (
        localPhotoExists &&
        localPhotoVersion >= employee.photo_version &&
        (!employee.photo_hash ||
          localEmployee.photo_hash === employee.photo_hash)
      ) {
        console.log(
          `PHOTO ALREADY UP TO DATE FOR ` +
            `${employee.firstName} ` +
            `${employee.lastName}`
        );

        continue;
      }

      await downloadEmployeePhoto(
        employee.companyId,
        employee._id,
        employee.photo_version,
        employee.photo_mime_type,
        employee.photo_hash,
        employee.photo_last_modified
      );

      console.log(
        `DOWNLOADED NEW PHOTO FOR ` +
          `${employee.firstName} ` +
          `${employee.lastName}. ` +
          `Version ${employee.photo_version}`
      );
    } catch (error) {
      console.error(`FAILED TO SYNC PHOTO FOR EMPLOYEE ${employee._id}`, error);
      throw error;
    }
  }
  return succeeded;
}

/* =========================================================
   EMPLOYEE DOCUMENTS
========================================================= */

async function syncEmployeeDocuments(
  employeeDocuments: EmployeeDocument[]
): Promise<boolean> {
  if (!employeeDocuments || employeeDocuments.length === 0) {
    return true;
  }

  const succeeded = true;

  for (const document of employeeDocuments) {
    try {
      const localDocument = await getEmployeeDocumentById(
        document.companyId,
        document._id
      );

      if (localDocument?.needsUpload) {
        throw new Error("Employee document has pending local changes");
      }

      const localVersion = localDocument?.serverVersion ?? 0;

      /* =====================================================
         DOCUMENT DELETED ON SERVER
      ===================================================== */

      if (document.isDeleted) {
        console.log(`DOCUMENT DELETED ON SERVER: ${document._id}`);

        await importEmployeeDocumentDeletion(document);

        console.log(
          `DELETED DOCUMENT SYNCED: ${document._id} ` +
            `(v${document.serverVersion})`
        );

        continue;
      }

      /* =====================================================
         DOCUMENT ALREADY UP TO DATE
      ===================================================== */

      if (localVersion >= document.serverVersion) {
        console.log(
          `DOCUMENT ALREADY UP TO DATE: ` +
            `${document.employeeId} ` +
            `(${document.documentType})`
        );

        continue;
      }

      /* =====================================================
         GET EMPLOYEE
      ===================================================== */

      const employee = await getEmployeeById(
        document.companyId,
        document.employeeId
      );

      if (!employee) {
        throw new Error(
          `Employee ${document.employeeId} not found while syncing document`
        );
      }

      /* =====================================================
         DOWNLOAD DOCUMENT
      ===================================================== */

      await downloadEmployeeDocument(employee, document);

      await markEmployeeDocumentSynced(document.companyId, document._id);

      console.log(
        `DOWNLOADED ${document.documentType} ` +
          `FOR ${employee.firstName} ` +
          `${employee.lastName} ` +
          `(v${document.serverVersion})`
      );
    } catch (error) {
      console.error(`FAILED TO SYNC DOCUMENT ${document._id}`, error);
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   ATTENDANCES
========================================================= */

async function syncAttendances(attendances: Attendance[]): Promise<boolean> {
  if (!attendances || attendances.length === 0) {
    return true;
  }

  let succeeded = true;

  for (const attendance of attendances) {
    try {
      const applied = await upsertAttendance(attendance);
      if (!applied) succeeded = false;
    } catch (error) {
      console.error("FAILED TO SYNC PULLED ATTENDANCE:", attendance._id, error);
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   ATTENDANCE DAILY CHECKS
========================================================= */

async function syncAttendanceDailyChecks(
  attendanceDailyChecks: AttendanceDailyCheck[]
): Promise<boolean> {
  if (!attendanceDailyChecks || attendanceDailyChecks.length === 0) {
    return true;
  }

  const succeeded = true;

  for (const attendanceDailyCheck of attendanceDailyChecks) {
    try {
      await upsertAttendanceDailyCheck(attendanceDailyCheck);

      await markAttendanceDailyCheckSynced(
        attendanceDailyCheck.companyId,
        attendanceDailyCheck._id
      );
    } catch (error) {
      console.error(
        "FAILED TO SYNC PULLED ATTENDANCE DAILY CHECK:",
        attendanceDailyCheck._id,
        error
      );
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   TASKS
========================================================= */

async function syncTasks(tasks: Task[]): Promise<boolean> {
  if (!tasks || tasks.length === 0) {
    return true;
  }

  const succeeded = true;

  for (const task of tasks) {
    try {
      await upsertTask({ ...task, module: task.module ?? "HR" });

      if (task.comments?.length) {
        for (const comment of task.comments) await upsertTaskComment(comment);
      }

      await markTaskSynced(task.companyId, task._id, task.module ?? "HR");
    } catch (error) {
      console.error("FAILED TO SYNC PULLED TASK:", task._id, error);
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   PAYROLL SETTINGS
========================================================= */

async function syncPayrollSettings(
  payrollSettings: PayrollSettings[]
): Promise<boolean> {
  if (!payrollSettings || payrollSettings.length === 0) {
    return true;
  }

  const succeeded = true;

  for (const settings of payrollSettings) {
    try {
      await upsertPayrollSettings(settings);

      await markPayrollSettingsSynced(settings.companyId, settings._id);
    } catch (error) {
      console.error(
        "FAILED TO SYNC PULLED PAYROLL SETTINGS:",
        settings._id,
        error
      );
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   PAYROLL COMPONENTS
========================================================= */

async function syncPayrollComponents(
  payrollComponents: PayrollComponent[]
): Promise<boolean> {
  if (!payrollComponents || payrollComponents.length === 0) {
    return true;
  }

  const succeeded = true;

  for (const component of payrollComponents) {
    try {
      await upsertPayrollComponent(component);

      await markPayrollComponentSynced(component.companyId, component._id);
    } catch (error) {
      console.error(
        "FAILED TO SYNC PULLED PAYROLL COMPONENT:",
        component._id,
        error
      );
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   PAYROLL EMPLOYEE PROFILES
========================================================= */

async function syncPayrollEmployeeProfiles(
  payrollEmployeeProfiles: PayrollEmployeeProfile[]
): Promise<boolean> {
  if (!payrollEmployeeProfiles || payrollEmployeeProfiles.length === 0) {
    return true;
  }

  const succeeded = true;

  for (const profile of payrollEmployeeProfiles) {
    if (!profile._id) {
      continue;
    }

    try {
      await upsertEmployeePayrollProfile(profile);
    } catch (error) {
      console.error(
        "FAILED TO SYNC PULLED PAYROLL EMPLOYEE PROFILE:",
        profile._id,
        error
      );
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   PAYROLL RUNS
========================================================= */

async function syncPayrollRuns(payrollRuns: PayrollRun[]): Promise<boolean> {
  if (!payrollRuns || payrollRuns.length === 0) {
    return true;
  }

  let succeeded = true;

  for (const payrollRun of payrollRuns) {
    if (!payrollRun._id) {
      continue;
    }

    try {
      if (
        (await upsertPayrollRun(payrollRun.companyId, payrollRun)) === false
      ) {
        succeeded = false;
        continue;
      }

      console.log("PAYROLL RUN SYNCED:", payrollRun._id);
    } catch (error) {
      console.error(
        "FAILED TO SYNC PULLED PAYROLL RUN:",
        payrollRun._id,
        error
      );
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   PAYROLL RESULTS
========================================================= */

async function syncPayrollResults(
  payrollResults: PayrollResult[]
): Promise<boolean> {
  if (!payrollResults || payrollResults.length === 0) {
    return true;
  }

  let succeeded = true;

  for (const result of payrollResults) {
    if (!result._id) {
      continue;
    }

    try {
      const payrollRun = await get(
        `
            SELECT _id
            FROM payroll_runs
            WHERE _id = ? AND companyId = ?
            LIMIT 1
          `,
        [result.payrollRunId, result.companyId]
      );

      if (!payrollRun) {
        console.error(
          "SKIPPING PAYROLL RESULT: PAYROLL RUN DOES NOT EXIST LOCALLY",
          {
            resultId: result._id,

            payrollRunId: result.payrollRunId,
          }
        );

        succeeded = false;

        continue;
      }

      const employee = await get(
        `
            SELECT _id
            FROM employees
            WHERE _id = ? AND companyId = ?
            LIMIT 1
          `,
        [result.employeeId, result.companyId]
      );

      if (!employee) {
        console.error(
          "SKIPPING PAYROLL RESULT: EMPLOYEE DOES NOT EXIST LOCALLY",
          {
            resultId: result._id,

            employeeId: result.employeeId,
          }
        );

        succeeded = false;

        continue;
      }

      if ((await upsertPayrollResult(result.companyId, result)) === false) {
        succeeded = false;
        continue;
      }

      console.log("PAYROLL RESULT SYNCED:", result._id);
    } catch (error) {
      console.error("FAILED TO SYNC PULLED PAYROLL RESULT:", {
        resultId: result._id,

        payrollRunId: result.payrollRunId,

        employeeId: result.employeeId,

        error,
      });
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   PAYROLL ITEMS
========================================================= */

async function syncPayrollItems(payrollItems: PayrollItem[]): Promise<boolean> {
  if (!payrollItems || payrollItems.length === 0) {
    return true;
  }

  let succeeded = true;

  for (const item of payrollItems) {
    if (!item._id) {
      continue;
    }

    try {
      if ((await upsertPayrollItem(item.companyId, item)) === false) {
        succeeded = false;
        continue;
      }
    } catch (error) {
      console.error("FAILED TO SYNC PULLED PAYROLL ITEM:", item._id, error);
      throw error;
    }
  }

  return succeeded;
}

/* =========================================================
   PULL ENTITY BY VERSION
========================================================= */

export async function pullEntityByVersion<T>(
  companyId: string,
  entity: string,
  syncBatch: (items: T[]) => Promise<boolean>,
  limit = 500,
  cursorEntity = entity
): Promise<VersionPullResult<T>> {
  const state = await getSyncState(companyId, cursorEntity);

  const token = await getToken(companyId);

  let afterVersion = state.lastPulledVersion;
  let blockedCount = 0;
  let failedCount = 0;
  const issueDetails: string[] = [];
  const recordIssue = (message: string) => {
    console.error(message);
    if (issueDetails.length < 10) issueDetails.push(message);
  };

  const allItems: T[] = [];

  let hasMore = true;

  let latestServerTime: string | undefined;

  while (hasMore) {
    console.log(
      `PULLING ${entity.toUpperCase()} ` +
        `FOR COMPANY ${companyId} ` +
        `AFTER VERSION ${afterVersion}`
    );

    if (!token) {
      throw new Error("PULL SYNC: authentication token is missing");
    }

    const response = await axios
      .get(`${API_URL}/sync/pull`, {
        params: {
          entity,
          afterVersion,
          limit,
        },

        headers: {
          "x-auth-token": token,

          "x-company-id": companyId,
        },

        timeout: 90000,
      })
      .catch((error: unknown) => {
        if (!axios.isAxiosError(error)) throw error;

        const body: unknown = error.response?.data;
        const message =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : error.message;
        const unsupportedInventory =
          error.response?.status === 400 &&
          entity.startsWith("inventory_") &&
          message === `Unknown sync entity: ${entity}`;

        throw new Error(
          `PULL ${entity} FROM ${API_URL}/sync/pull FAILED ` +
            `(${error.response?.status ?? "network error"}): ${message}` +
            (unsupportedInventory
              ? ". This backend does not support inventory sync. Rebuild and restart " +
                "the backend with the current server code. If VITE_API_URL changed, " +
                "restart Electron to use the new backend."
              : "")
        );
      });

    const {
      items,
      nextVersion,
      hasMore: serverHasMore,
      serverTime,
    } = response.data;

    latestServerTime = serverTime ?? latestServerTime;

    const batch = items ?? [];

    console.log(`${entity.toUpperCase()} VERSION PULL RESULT:`, {
      companyId,

      afterVersion,

      received: batch.length,

      nextVersion,

      hasMore: serverHasMore,

      serverTime,
    });

    if (batch.length === 0) {
      break;
    }

    // A failed push must not let a pull overwrite the remaining local edits or
    // mark them synced. Retain this page until those edits are acknowledged.
    for (const row of batch as Array<
      T & { _id?: string; companyId?: string }
    >) {
      const recordId =
        entity === "company" || entity === "company_logo"
          ? row.companyId
          : row._id;
      try {
        if (!recordId) throw new Error("Pull record is missing its ID");
        const blockers = await transaction(async () => {
          const targets: Array<{ entity: string; entityId?: string }> = [
            { entity: cursorEntity, entityId: recordId },
          ];
          if (entity === "task") targets.push({ entity: "task_comment" });
          if (entity === "admin_user")
            targets.push({ entity: "user_notes", entityId: row._id });
          if (entity === "company") targets.push({ entity: "company_logo" });
          // Aggregate stock operations replace individual queue entries for
          // these four groups. Catalog rows are not part of the snapshot.
          if (
            [
              "inventory_document",
              "inventory_document_line",
              "inventory_movement",
              "inventory_balance",
            ].includes(entity)
          )
            targets.push({ entity: "inventory_transaction" });
          const pending = await getPendingSyncItems(companyId, targets);
          const blocked = pending.filter((item) => {
            if (item.entity !== "task_comment") return true;
            try {
              const payload: unknown = JSON.parse(item.payload);
              if (
                typeof payload !== "object" ||
                payload === null ||
                !("taskId" in payload)
              )
                throw new Error("Missing taskId");
              return payload.taskId === row._id;
            } catch {
              throw new Error(
                `Invalid task comment payload in queue ${item._id}`
              );
            }
          });
          if (blocked.length) return blocked;
          // A resolved false must roll back writes too, not commit a partial import.
          if (!(await syncBatch([row])))
            throw new Error(
              "Record import was refused; local data may require reconciliation"
            );
          return [];
        });
        if (blockers.length) {
          blockedCount++;
          recordIssue(
            `${cursorEntity} ${recordId}: waiting for local changes in queue ` +
              blockers.map((item) => `${item._id} (${item.entity})`).join(", ")
          );
        }
      } catch (error) {
        failedCount++;
        recordIssue(
          `${cursorEntity} ${recordId ?? "<missing ID>"}: import failed: ` +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }

    const newVersion = Number(nextVersion ?? afterVersion);

    if (!Number.isFinite(newVersion)) {
      throw new Error(
        `${entity.toUpperCase()} RETURNED INVALID NEXT VERSION: ` +
          `${nextVersion}`
      );
    }

    if (newVersion <= afterVersion) {
      throw new Error(
        `${entity.toUpperCase()} SYNC VERSION DID NOT ADVANCE. ` +
          `Current: ${afterVersion}, ` +
          `Next: ${newVersion}`
      );
    }

    if (blockedCount === 0 && failedCount === 0)
      await updateLastPulledVersion(companyId, cursorEntity, newVersion);

    afterVersion = newVersion;

    allItems.push(...batch);

    hasMore = Boolean(serverHasMore);
  }

  if (blockedCount || failedCount)
    throw new Error(
      `${cursorEntity.toUpperCase()}: ${blockedCount} record(s) waiting for local changes, ` +
        `${failedCount} import failure(s). SYNC CURSOR WAS NOT ADVANCED past unapplied records.\n` +
        issueDetails.join("\n") +
        (blockedCount + failedCount > issueDetails.length
          ? "\nAdditional details are in the sync log."
          : "")
    );

  console.log(`${entity.toUpperCase()} VERSION SYNC COMPLETE:`, {
    companyId,

    totalItems: allItems.length,

    lastVersion: afterVersion,

    serverTime: latestServerTime,
  });

  return {
    items: allItems,

    serverTime: latestServerTime,
  };
}
