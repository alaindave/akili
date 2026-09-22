import type { Incident } from "../../../common/types/incident/Incident.js";
import { upsertIncident } from "../../database/repositories/shared/incidents.repository.js";
import axios from "axios";
import { app } from "electron";
import fs from "fs/promises";
import path from "path";

import { getEmployeeById } from "../../database/repositories/modules/hr/employees.repository.js";
import { setSetting } from "../../database/repositories/shared/settings.repository.js";
import { upsertAdminUser } from "../../database/repositories/shared/admin_users.repository.js";

import {
  markEmployeeSynced,
  upsertEmployee,
} from "../../database/repositories/modules/hr/employees.repository.js";

import {
  markLeaveSynced,
  upsertLeave,
} from "../../database/repositories/modules/hr/leaves.repository.js";

import Employee from "../../../common/types/Employee.js";
import { Attendance } from "../../../common/types/attendance/Attendance.js";
import Leave from "../../../common/types/leave/Leave.js";
import AdminUser from "../../../common/types/AdminUser.js";

import Task from "../../../common/types/task/Task.js";
import PayrollComponent from "../../../common/types/payroll/PayrollComponent.js";

import {
  markTaskSynced,
  upsertTask,
} from "../../database/repositories/shared/tasks.repository.js";

import { downloadEmployeePhoto } from "../../util/downloadEmployeePhoto.util.js";

import { updateEmployeePhotoMetadata } from "../../database/repositories/modules/hr/employees_photos.repository.js";

import { upsertTaskComment } from "../../database/repositories/shared/tasks_comments.repository.js";

import {
  getEmployeeDocument,
  upsertEmployeeDocument,
  markEmployeeDocumentSynced,
} from "../../database/repositories/modules/hr/employees_documents.repository.js";

import { downloadEmployeeDocument } from "../../util/downloadEmployeeDocument.util.js";

import { EmployeeDocument } from "../../../common/types/EmployeeDocuments.js";

import {
  upsertPayrollComponent,
  markPayrollComponentSynced,
} from "../../database/repositories/modules/hr/payroll_components.repository.js";

import PayrollEmployeeProfile from "../../../common/types/payroll/PayrollEmployeeProfile.js";

import {
  markPayrollEmployeeProfileSynced,
  upsertEmployeePayrollProfile,
} from "../../database/repositories/modules/hr/payroll_employee_profile.repository.js";

import {
  PayrollResult,
  PayrollRun,
  PayrollItem,
} from "../../../common/types/payroll/Payroll.js";

import {
  markPayrollItemSynced,
  markPayrollResultSynced,
  markPayrollRunSynced,
  upsertPayrollItem,
  upsertPayrollResult,
  upsertPayrollRun,
} from "../../database/repositories/modules/hr/payroll_run.repository.js";

import { PayrollSettings } from "../../../common/types/payroll/Payroll.js";

import {
  markPayrollSettingsSynced,
  upsertPayrollSettings,
} from "../../database/repositories/modules/hr/payroll_settings.repository.js";

import { AttendanceDailyCheck } from "../../../common/types/attendance/AttendanceDailyCheck.js";

import { get } from "../../database/db.js";

import {
  getSyncState,
  updateLastPulledVersion,
} from "../../database/repositories/shared/syncState.repository.js";

import Company from "../../../common/types/Company.js";

import {
  markCompanySynced,
  upsertCompany,
} from "../../database/repositories/shared/companies.repository.js";

import { getToken } from "../../auth.js";

import { getEmployeeDocumentsDir } from "../../storage/directories.js";
import { downloadCompanyLogo } from "../../util/downloadCompanyLogo.util.js";
import {
  markAttendanceSynced,
  upsertAttendance,
} from "../../database/repositories/modules/hr/attendances.repository.js";
import {
  markAttendanceDailyCheckSynced,
  upsertAttendanceDailyCheck,
} from "../../database/repositories/modules/hr/attendanceDailyCheck.repository.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
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

  try {
    if (!companyId) {
      throw new Error("CANNOT PULL CHANGES: NO LOCAL COMPANY ID FOUND.");
    }

    let latestServerTime: string | undefined;

    /* =====================================================
       COMPANIES
    ===================================================== */

    const companiesResult = await pullEntityByVersion<Company>(
      companyId,
      "company",
      syncCompanies
    );

    latestServerTime = companiesResult.serverTime ?? latestServerTime;

    const companies = companiesResult.items;

    /* =====================================================
       COMPANY LOGO
    ===================================================== */

    const companyLogosResult = await pullEntityByVersion<CompanyLogo>(
      companyId,
      "company_logo",
      syncCompanyLogos
    );

    latestServerTime = companyLogosResult.serverTime ?? latestServerTime;

    const companyLogos = companyLogosResult.items;

    /* =====================================================
       ADMIN USERS
    ===================================================== */

    const adminUsersResult = await pullEntityByVersion<AdminUser>(
      companyId,
      "admin_user",
      syncAdminUsers
    );

    latestServerTime = adminUsersResult.serverTime ?? latestServerTime;

    const adminUsers = adminUsersResult.items;

    /* =====================================================
       EMPLOYEES
    ===================================================== */

    const employeesResult = await pullEntityByVersion<Employee>(
      companyId,
      "employee",
      syncEmployees
    );

    latestServerTime = employeesResult.serverTime ?? latestServerTime;

    const employees = employeesResult.items;

    /* =====================================================
       EMPLOYEE PHOTOS
    ===================================================== */

    await syncEmployeePhotos(employees);

    /* =====================================================
       EMPLOYEE DOCUMENTS
    ===================================================== */

    const employeeDocumentsResult = await pullEntityByVersion<EmployeeDocument>(
      companyId,
      "employee_document",
      syncEmployeeDocuments
    );

    latestServerTime = employeeDocumentsResult.serverTime ?? latestServerTime;

    const employeesDocuments = employeeDocumentsResult.items;

    /* =====================================================
       ATTENDANCES
    ===================================================== */

    const attendancesResult = await pullEntityByVersion<Attendance>(
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
      await pullEntityByVersion<AttendanceDailyCheck>(
        companyId,
        "attendance_daily_check",
        syncAttendanceDailyChecks
      );

    latestServerTime =
      attendanceDailyChecksResult.serverTime ?? latestServerTime;

    const attendanceDailyCheck = attendanceDailyChecksResult.items;

    /* =====================================================
       LEAVES
    ===================================================== */

    const leavesResult = await pullEntityByVersion<Leave>(
      companyId,
      "leave",
      syncLeaves
    );

    latestServerTime = leavesResult.serverTime ?? latestServerTime;

    const leaves = leavesResult.items;

    /* =====================================================
       TASKS
    ===================================================== */

    const tasksResult = await pullEntityByVersion<Task>(
      companyId,
      "task",
      syncTasks
    );

    latestServerTime = tasksResult.serverTime ?? latestServerTime;

    const tasks = tasksResult.items;
    const incidentsResult = await pullEntityByVersion<Incident>(companyId, "incident", async (items) => {
      for (const incident of items) await upsertIncident(companyId, incident);
      return true;
    });
    latestServerTime = incidentsResult.serverTime ?? latestServerTime;

    /* =====================================================
       PAYROLL SETTINGS
    ===================================================== */

    const payrollSettingsResult = await pullEntityByVersion<PayrollSettings>(
      companyId,
      "payroll_settings",
      syncPayrollSettings
    );

    latestServerTime = payrollSettingsResult.serverTime ?? latestServerTime;

    const payrollSettings = payrollSettingsResult.items;

    /* =====================================================
       PAYROLL COMPONENTS
    ===================================================== */

    const payrollComponentsResult = await pullEntityByVersion<PayrollComponent>(
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
      await pullEntityByVersion<PayrollEmployeeProfile>(
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

    const payrollRunsResult = await pullEntityByVersion<PayrollRun>(
      companyId,
      "payroll_run",
      syncPayrollRuns
    );

    latestServerTime = payrollRunsResult.serverTime ?? latestServerTime;

    const payrollRuns = payrollRunsResult.items;

    /* =====================================================
       PAYROLL RESULTS
    ===================================================== */

    const payrollResultsResult = await pullEntityByVersion<PayrollResult>(
      companyId,
      "payroll_result",
      syncPayrollResults
    );

    latestServerTime = payrollResultsResult.serverTime ?? latestServerTime;

    const payrollResults = payrollResultsResult.items;

    /* =====================================================
       PAYROLL ITEMS
    ===================================================== */

    const payrollItemsResult = await pullEntityByVersion<PayrollItem>(
      companyId,
      "payroll_item",
      syncPayrollItems
    );

    latestServerTime = payrollItemsResult.serverTime ?? latestServerTime;

    const payrollItems = payrollItemsResult.items;

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

  let allSucceeded = true;

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
      allSucceeded = false;

      console.error("FAILED TO SYNC PULLED COMPANY:", {
        companyId: company.companyId,

        serverVersion: company.serverVersion,

        error,
      });
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

  let succeeded = true;

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
            app.getPath("userData"),
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
        .relative(app.getPath("userData"), absolutePath)
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
      succeeded = false;

      console.error("FAILED TO SYNC COMPANY LOGO:", {
        companyId: logo.companyId,
        serverVersion: logo.serverVersion,
        error,
      });
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

  let succeeded = true;

  for (const adminUser of adminUsers) {
    try {
      await upsertAdminUser(adminUser);
    } catch (error) {
      succeeded = false;

      console.error("FAILED TO SYNC PULLED ADMIN USER:", adminUser._id, error);
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

  let allSucceeded = true;

  for (const employee of sortedEmployees) {
    try {
      console.log(
        `SYNCING EMPLOYEE ${employee._id} ` +
          `(serverVersion=${employee.serverVersion})`
      );

      await upsertEmployee(employee);

      await markEmployeeSynced(employee.companyId, employee._id);

      console.log(
        `EMPLOYEE SYNCED ${employee._id} ` + `(v${employee.serverVersion})`
      );
    } catch (error) {
      allSucceeded = false;

      console.error("FAILED TO SYNC PULLED EMPLOYEE:", {
        employeeId: employee._id,

        serverVersion: employee.serverVersion,

        error,
      });
    }
  }

  return allSucceeded;
}

/* =========================================================
   EMPLOYEE PHOTOS
========================================================= */

async function syncEmployeePhotos(employees: Employee[]) {
  for (const employee of employees) {
    try {
      if (!employee.photo_filename || employee.photo_version == null) {
        continue;
      }

      const localEmployee = await getEmployeeById(
        employee.companyId,
        employee._id
      );

      const localPhotoVersion = localEmployee?.photo_version ?? 0;

      console.log("=====EMPLOYEE PHOTO SYNC=====");

      console.log("REMOTE PHOTO VERSION:", employee.photo_version);

      console.log("LOCAL PHOTO VERSION:", localPhotoVersion);

      if (localPhotoVersion >= employee.photo_version) {
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
        employee.photo_version
      );

      const extension = (() => {
        const mimeType = employee.photo_mime_type;

        switch (mimeType) {
          case "image/png":
            return ".png";

          case "image/webp":
            return ".webp";

          case "image/jpeg":
          case "image/jpg":
          default:
            return ".jpg";
        }
      })();

      const photo_path = `${employee.companyId}/${employee._id}/photo_v${employee.photo_version}${extension}`;

      await updateEmployeePhotoMetadata(employee.companyId, employee._id, {
        photo_path,

        photo_filename: employee.photo_filename,

        photo_version: employee.photo_version,

        photo_hash: employee.photo_hash,

        photo_mime_type: employee.photo_mime_type,

        photo_last_modified: employee.photo_last_modified,
      });

      console.log(
        `DOWNLOADED NEW PHOTO FOR ` +
          `${employee.firstName} ` +
          `${employee.lastName}. ` +
          `Version ${employee.photo_version}`
      );
    } catch (error) {
      console.error(`FAILED TO SYNC PHOTO FOR EMPLOYEE ${employee._id}`, error);
    }
  }
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

  let succeeded = true;

  for (const document of employeeDocuments) {
    try {
      const localDocument = await getEmployeeDocument(
        document.companyId,
        document.employeeId,
        document.documentType
      );

      const localVersion = localDocument?.serverVersion ?? 0;

      /* =====================================================
         DOCUMENT DELETED ON SERVER
      ===================================================== */

      if (document.isDeleted) {
        console.log(`DOCUMENT DELETED ON SERVER: ${document._id}`);

        if (localDocument?.localPath) {
          const employeeDocumentsDir = getEmployeeDocumentsDir();

          const absolutePath = path.join(
            employeeDocumentsDir,
            localDocument.localPath
          );

          try {
            await fs.unlink(absolutePath);

            console.log("PHYSICALLY DELETED EMPLOYEE DOCUMENT:", absolutePath);
          } catch (error: any) {
            if (error?.code === "ENOENT") {
              console.log("DOCUMENT FILE ALREADY DELETED:", absolutePath);
            } else {
              throw error;
            }
          }
        } else {
          console.log(
            "NO LOCAL PATH FOUND FOR DELETED DOCUMENT:",
            document._id
          );
        }

        await upsertEmployeeDocument(document);

        await markEmployeeDocumentSynced(document.companyId, document._id);

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

      /* =====================================================
         LOCAL STORED PATH
      ===================================================== */

      const localPath = [
        document.companyId,
        document.employeeId,
        document.documentType,
        document.fileName,
      ].join("/");

      await upsertEmployeeDocument({
        ...document,
        localPath,
      });

      await markEmployeeDocumentSynced(document.companyId, document._id);

      console.log(
        `DOWNLOADED ${document.documentType} ` +
          `FOR ${employee.firstName} ` +
          `${employee.lastName} ` +
          `(v${document.serverVersion})`
      );
    } catch (error) {
      succeeded = false;

      console.error(`FAILED TO SYNC DOCUMENT ${document._id}`, error);
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
      await upsertAttendance(attendance);

      await markAttendanceSynced(attendance.companyId, attendance._id);
    } catch (error) {
      succeeded = false;

      console.error("FAILED TO SYNC PULLED ATTENDANCE:", attendance._id, error);
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

  let succeeded = true;

  for (const attendanceDailyCheck of attendanceDailyChecks) {
    try {
      await upsertAttendanceDailyCheck(attendanceDailyCheck);

      await markAttendanceDailyCheckSynced(
        attendanceDailyCheck.companyId,
        attendanceDailyCheck._id
      );
    } catch (error) {
      succeeded = false;

      console.error(
        "FAILED TO SYNC PULLED ATTENDANCE DAILY CHECK:",
        attendanceDailyCheck._id,
        error
      );
    }
  }

  return succeeded;
}

/* =========================================================
   LEAVES
========================================================= */

async function syncLeaves(leaves: Leave[]): Promise<boolean> {
  if (!leaves || leaves.length === 0) {
    return true;
  }

  let succeeded = true;

  for (const leave of leaves) {
    try {
      await upsertLeave(leave);

      await markLeaveSynced(leave.companyId, leave._id);
    } catch (error) {
      succeeded = false;

      console.error("FAILED TO SYNC PULLED LEAVE:", leave._id, error);
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

  let succeeded = true;

  for (const task of tasks) {
    try {
      await upsertTask(task);

      if (task.comments?.length) {
        await Promise.all(
          task.comments.map((comment) => upsertTaskComment(comment))
        );
      }

      await markTaskSynced(task.companyId, task._id);
    } catch (error) {
      succeeded = false;

      console.error("FAILED TO SYNC PULLED TASK:", task._id, error);
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

  let succeeded = true;

  for (const settings of payrollSettings) {
    try {
      await upsertPayrollSettings(settings);

      await markPayrollSettingsSynced(settings.companyId, settings._id);
    } catch (error) {
      succeeded = false;

      console.error(
        "FAILED TO SYNC PULLED PAYROLL SETTINGS:",
        settings._id,
        error
      );
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

  let succeeded = true;

  for (const component of payrollComponents) {
    try {
      await upsertPayrollComponent(component);

      await markPayrollComponentSynced(component.companyId, component._id);
    } catch (error) {
      succeeded = false;

      console.error(
        "FAILED TO SYNC PULLED PAYROLL COMPONENT:",
        component._id,
        error
      );
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

  let succeeded = true;

  for (const profile of payrollEmployeeProfiles) {
    if (!profile._id) {
      continue;
    }

    try {
      await upsertEmployeePayrollProfile(profile);

      await markPayrollEmployeeProfileSynced(profile.companyId, profile._id);
    } catch (error) {
      succeeded = false;

      console.error(
        "FAILED TO SYNC PULLED PAYROLL EMPLOYEE PROFILE:",
        profile._id,
        error
      );
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
      await upsertPayrollRun(payrollRun.companyId, payrollRun);

      await markPayrollRunSynced(payrollRun.companyId, payrollRun._id);

      console.log("PAYROLL RUN SYNCED:", payrollRun._id);
    } catch (error) {
      succeeded = false;

      console.error(
        "FAILED TO SYNC PULLED PAYROLL RUN:",
        payrollRun._id,
        error
      );
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
            WHERE _id = ?
            LIMIT 1
          `,
        [result.payrollRunId]
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
            WHERE _id = ?
            LIMIT 1
          `,
        [result.employeeId]
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

      await upsertPayrollResult(result.companyId, result);

      await markPayrollResultSynced(result.companyId, result._id);

      console.log("PAYROLL RESULT SYNCED:", result._id);
    } catch (error) {
      succeeded = false;

      console.error("FAILED TO SYNC PULLED PAYROLL RESULT:", {
        resultId: result._id,

        payrollRunId: result.payrollRunId,

        employeeId: result.employeeId,

        error,
      });
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
      await upsertPayrollItem(item.companyId, item);

      await markPayrollItemSynced(item.companyId, item._id);
    } catch (error) {
      succeeded = false;

      console.error("FAILED TO SYNC PULLED PAYROLL ITEM:", item._id, error);
    }
  }

  return succeeded;
}

/* =========================================================
   PULL ENTITY BY VERSION
========================================================= */

async function pullEntityByVersion<T>(
  companyId: string,
  entity: string,
  syncBatch: (items: T[]) => Promise<boolean>,
  limit = 500
): Promise<VersionPullResult<T>> {
  const syncState = await getSyncState(companyId, entity);

  const token = await getToken();

  let afterVersion = syncState.lastPulledVersion ?? 0;

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

    const response = await axios.get(`${API_URL}/sync/pull`, {
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

    const succeeded = await syncBatch(batch);

    if (!succeeded) {
      throw new Error(
        `${entity.toUpperCase()} SYNC FAILED AFTER VERSION ` +
          `${afterVersion}. SYNC CURSOR WAS NOT ADVANCED.`
      );
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

    await updateLastPulledVersion(companyId, entity, newVersion);

    afterVersion = newVersion;

    allItems.push(...batch);

    hasMore = Boolean(serverHasMore);
  }

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
