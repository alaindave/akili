import Employee from "./models/employee.model.js";
import Attendance from "./models/attendance.model.js";
import Leave from "./models/leave.model.js";
import Task from "./models/task.model.js";
import EmployeesDocuments from "./models/employeesDocuments.model.js";
import PayrollComponent from "./models/payrollComponent.model.js";
import AdminUser from "./models/adminUser.model.js";
import EmployeePayrollProfile from "./models/payrollEmployeeProfile.model.js";
import Company from "./models/company.model.js";
import supabase from "./services/supabase.service.js";
import PayrollRun from "./models/payrollRun.model.js";
import PayrollResult from "./models/payrollResult.model.js";
import PayrollItem from "./models/payrollItem.model.js";
import PayrollSettings from "./models/payrollSettings.model.js";
import AttendanceDailyCheck from "./models/attendanceDailyCheck.model.js";
import { Entity, getNextSyncVersion } from "./utils/syncVersion.js";

export type SyncOperation = "create" | "update" | "delete";

interface SyncData {
  _id: string;
  serverVersion: number;
  [key: string]: any;
}

export class SyncConflict extends Error {
  readonly retryable = false;
  constructor(public code: string, message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = "SyncConflict";
  }
}

function requireId(value: unknown, field = "_id"): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new SyncConflict("INVALID_ID", `SYNC FAILED: ${field} must be a non-empty string.`);
  }
}

// Payroll amounts and identity are snapshots of generation, not fields of a status update.
function preservePayrollSnapshot(existing: Record<string, any>, fields: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (existing[key] !== undefined) fields[key] = existing[key];
  }
}

async function syncRecord(model: any, entity: Entity, operation: SyncOperation, data: SyncData) {
  const companyId = requireCompanyId(data);
  const incomingDate = requireUpdatedAt(data);
  const { _id, fields } = cleanSyncFields(data, operation);
  fields.companyId = companyId;
  for (let attempt = 0; attempt < 10; attempt++) {
    const existing = await model.findOne({ _id, companyId }).lean();
    if (existing && new Date(existing.updatedAt).getTime() >= incomingDate.getTime()) {
      return { success: true, _id, serverVersion: existing.serverVersion, record: existing };
    }
    if (!existing && operation !== "create") {
      throw new SyncConflict("MISSING_RECORD", `${entity} ${_id} must be created before it can be ${operation}d.`);
    }
    if (!existing) {
      // Update validators do not check omitted required fields on an upsert.
      await new model({ ...fields, _id, serverVersion: 0 }).validate();
    }
    const serverVersion = await getServerVersion(entity);
    const filter = existing ? { _id, companyId, serverVersion: existing.serverVersion } : { _id, companyId };
    const saved = await model.updateOne(filter, {
      $set: { ...fields, serverVersion }, $setOnInsert: { _id },
    }, { upsert: !existing, runValidators: true, timestamps: false });
    if (!saved.matchedCount && !saved.upsertedCount) continue;
    const record = await model.findOne({ _id, companyId }).lean();
    return { success: true, _id, serverVersion, record };
  }
  throw new Error(`${entity} changed during sync; retry required.`);
}

function requireCompanyId(data: SyncData): string {
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.companyId !== "string" || !data.companyId.trim()) {
    throw new SyncConflict("INVALID_COMPANY",
      `SYNC FAILED: companyId is required for entity ${data?._id ?? "unknown"}`
    );
  }

  return data.companyId;
}

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

function cleanSyncFields(data: SyncData, operation?: SyncOperation) {
  requireId(data._id);
  if (operation && !["create", "update", "delete"].includes(operation)) {
    throw new SyncConflict("INVALID_OPERATION", "Unsupported sync operation.");
  }
  for (const key of ["employeeId", "payrollRunId", "payrollResultId", "taskId"]) {
    if (data[key] !== undefined) requireId(data[key], key);
  }
  const {
    _id,
    companyId,
    serverVersion: _clientServerVersion,
    lastSyncedAt: _clientLastSyncedAt,
    synced: _clientSynced,
    ...fields
  } = data;

  delete fields._id;
  delete fields.companyId;
  delete fields.serverVersion;
  delete fields.lastSyncedAt;
  delete fields.synced;
  for (const key of Object.keys(fields)) {
    if (key.startsWith("$") || key.includes(".")) throw new SyncConflict("INVALID_FIELD", "Invalid sync field name.");
    if (fields[key] === undefined) delete fields[key];
  }
  if (operation === "delete") fields.isDeleted = 1;

  return {
    _id,
    companyId,
    fields,
  };
}

function requireUpdatedAt(data: SyncData): Date {
  if (!data.updatedAt) {
    throw new SyncConflict("INVALID_DATE",
      `SYNC FAILED: updatedAt is required for entity ${data._id}`
    );
  }

  const updatedAt = new Date(data.updatedAt);

  if (Number.isNaN(updatedAt.getTime())) {
    throw new SyncConflict("INVALID_DATE", `SYNC FAILED: invalid updatedAt for entity ${data._id}`);
  }

  return updatedAt;
}

async function getServerVersion(entity: Entity): Promise<number> {
  return getNextSyncVersion(entity);
}

// ============================================================
// COMPANY
// ============================================================

export async function syncCompany(operation: SyncOperation, data: SyncData) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { fields } = cleanSyncFields(data, operation);

  const serverVersion = await getServerVersion("company");

  /*
   * ------------------------------------------------------------
   * DELETE
   * ------------------------------------------------------------
   */

  if (operation === "delete") {
    await Company.updateOne(
      {
        companyId,
      },
      {
        $set: {
          isDeleted: 1,
          updatedAt: new Date(data.updatedAt as string),
          serverVersion,
        },
      },
      {
        timestamps: false,
      }
    );

    const company = await Company.findOne({
      companyId,
    }).lean();

    console.log("SYNCED DELETE COMPANY:", {
      companyId,
      updatedAt: data.updatedAt,
      serverVersion,
    });

    return {
      success: true,
      companyId,
      serverVersion,
      company,
    };
  }

  if (
    fields.attendanceClockIn !== undefined &&
    (typeof fields.attendanceClockIn !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.attendanceClockIn))
  ) {
    throw new Error("COMPANY SYNC FAILED: invalid attendance clock-in time");
  }

  delete fields.companyId;

  delete fields._id;

  fields.serverVersion = serverVersion;

  fields.isDeleted = 0;

  await Company.updateOne(
    {
      companyId,
    },
    {
      $set: {
        ...fields,
        updatedAt: new Date(data.updatedAt as string),
      },

      $setOnInsert: {
        _id: data._id,
        companyId,
      },
    },
    {
      upsert: true,
      timestamps: false,
    }
  );

  /*
   * ------------------------------------------------------------
   * VERIFY
   * ------------------------------------------------------------
   */

  const company = await Company.findOne({
    companyId,
  }).lean();

  if (!company) {
    throw new Error(
      `COMPANY SYNC FAILED: COMPANY NOT FOUND AFTER UPSERT: ${companyId}`
    );
  }

  console.log(`SYNCED ${operation.toUpperCase()} COMPANY:`, {
    companyId,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    companyId,
    serverVersion,
    company,
  };
}

// ============================================================
// COMPANY LOGO
// ============================================================

export async function syncCompanyLogo(data: SyncData, file?: UploadedFile) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  console.log("COMPANY LOGO DATA:", data);

  const company = await Company.findOne({
    companyId,
  });

  if (!company) {
    throw new Error(`COMPANY ${companyId} NOT FOUND`);
  }

  if (!file) {
    throw new Error("COMPANY LOGO FILE MISSING");
  }

  const mimeType = data.mimeType || file.mimetype;

  const extension = (() => {
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

  const objectPath = `${companyId}/logo${extension}`;

  console.log("UPLOADING COMPANY LOGO:", {
    companyId,
    objectPath,
    mimeType,
    originalName: file.originalname,
    previousLocalPath: company.logoPath,
  });

  const { error: uploadError } = await supabase.storage
    .from("company_logos")
    .upload(objectPath, file.buffer, {
      contentType: mimeType,
      upsert: true,
      cacheControl: "0",
    });

  if (uploadError) {
    throw new Error(`FAILED TO UPLOAD COMPANY LOGO: ${uploadError.message}`);
  }

  console.log("NEW COMPANY LOGO UPLOADED:", {
    companyId,
    objectPath,
  });

  const possibleOldPaths = [
    `${companyId}/logo.png`,
    `${companyId}/logo.jpg`,
    `${companyId}/logo.jpeg`,
    `${companyId}/logo.webp`,
  ].filter((oldPath) => oldPath !== objectPath);

  if (possibleOldPaths.length > 0) {
    const { error: deleteError } = await supabase.storage
      .from("company_logos")
      .remove(possibleOldPaths);

    if (deleteError) {
      throw new Error(
        `NEW COMPANY LOGO UPLOADED BUT FAILED TO DELETE OLD LOGO: ${deleteError.message}`
      );
    }

    console.log("OLD COMPANY LOGO FILES CLEANED UP:", {
      companyId,
      removed: possibleOldPaths,
    });
  }

  const serverVersion = await getServerVersion("company_logo");

  await Company.updateOne(
    {
      companyId,
    },
    {
      $set: {
        logoPath: objectPath,

        updatedAt: new Date(data.updatedAt as string),

        serverVersion,
      },
    }
  );

  const { data: publicUrlData } = supabase.storage
    .from("company_logos")
    .getPublicUrl(objectPath);

  const logoUrl = publicUrlData.publicUrl;

  console.log("COMPANY LOGO SYNCED SUCCESSFULLY:", {
    companyId,
    objectPath,
    logoUrl,
    serverVersion,
  });

  return {
    success: true,
    companyId,
    serverVersion,
    logoPath: objectPath,
    logoUrl,
    updatedAt: company.updatedAt,
  };
}

// ============================================================
// EMPLOYEE
// ============================================================

export async function syncEmployee(operation: SyncOperation, data: SyncData) {
  const { record, ...result } = await syncRecord(Employee, "employee", operation, data);
  return { ...result, employee: record };
}

// ============================================================
// EMPLOYEE PHOTO
// ============================================================

export async function syncEmployeePhoto(data: SyncData, file?: UploadedFile) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const employee = await Employee.findOne({
    _id: data.employeeId,
    companyId,
  });

  console.log("PHOTO DATA", data);

  if (!employee) {
    throw new Error(`EMPLOYEE ${data.employeeId} NOT FOUND`);
  }

  if (!file) {
    throw new Error("PHOTO FILE MISSING");
  }

  const employeeId = employee._id.toString();

  /*
   * ---------------------------------------------------------
   * PHOTO VERSION
   * ---------------------------------------------------------
   */

  const photoVersion = Number(data.photo_version ?? 1);

  if (!Number.isFinite(photoVersion) || photoVersion < 1) {
    throw new Error(`INVALID PHOTO VERSION: ${data.photo_version}`);
  }

  /*
   * ---------------------------------------------------------
   * SUPABASE STORAGE PATH
   * ---------------------------------------------------------
   *
   * employee-photos/
   *   {companyId}/
   *     {employeeId}/
   *       photo_v{version}.jpg
   *
   * Example:
   *
   * employee-photos/
   *   64abc123/
   *     89xyz456/
   *       photo_v3.jpg
   *
   * Only the newest photo is kept.
   */

  const extension = (() => {
    const mimeType = data.photo_mime_type || file.mimetype;

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

  const objectPath = `${companyId}/${employeeId}/photo_v${photoVersion}${extension}`;

  const previousObjectPath = employee.photo_path;

  console.log("UPLOADING EMPLOYEE PHOTO:", {
    companyId,
    employeeId,
    previousObjectPath,
    newObjectPath: objectPath,
    photoVersion,
    mimeType: data.photo_mime_type || file.mimetype,
    hash: data.photo_hash,
  });

  /*
   * ---------------------------------------------------------
   * UPLOAD NEW PHOTO
   * ---------------------------------------------------------
   *
   */

  const { error: uploadError } = await supabase.storage
    .from("employees_photos")
    .upload(objectPath, file.buffer, {
      contentType: data.photo_mime_type || file.mimetype,
      upsert: true,
      cacheControl: "0",
    });

  if (uploadError) {
    throw new Error(`FAILED TO UPLOAD EMPLOYEE PHOTO: ${uploadError.message}`);
  }

  console.log("NEW EMPLOYEE PHOTO UPLOADED:", {
    companyId,
    employeeId,
    objectPath,
    photoVersion,
  });

  /*
   * ---------------------------------------------------------
   * DELETE PREVIOUS PHOTO
   * ---------------------------------------------------------
   *
   * Because filenames contain the version, upsert alone would
   * create multiple files:
   *
   * photo_v1.jpg
   * photo_v2.jpg
   * photo_v3.jpg
   *
   * Therefore we explicitly remove the previous photo.
   */

  if (previousObjectPath && previousObjectPath !== objectPath) {
    const { error: deleteError } = await supabase.storage
      .from("employees_photos")
      .remove([previousObjectPath]);

    if (deleteError) {
      /*
       * The new photo exists, but the old one could not be
       * removed. Throw so the sync is NOT considered successful.
       */
      throw new Error(
        `NEW PHOTO UPLOADED BUT FAILED TO DELETE OLD PHOTO: ${deleteError.message}`
      );
    }

    console.log("OLD EMPLOYEE PHOTO DELETED:", {
      companyId,
      employeeId,
      previousObjectPath,
    });
  }

  /*
   * ---------------------------------------------------------
   * UPDATE EMPLOYEE
   * ---------------------------------------------------------
   */

  const serverVersion = await getServerVersion("employee");

  Object.assign(employee, {
    companyId,

    photo_filename: data.photo_filename,
    photo_path: objectPath,
    photo_hash: data.photo_hash,
    photo_mime_type: data.photo_mime_type || file.mimetype,

    photo_last_modified: data.photo_last_modified
      ? new Date(data.photo_last_modified)
      : new Date(data.updatedAt as string),

    photo_version: photoVersion,

    updatedAt: new Date(data.updatedAt as string),
    serverVersion,
  });

  await employee.save();

  console.log("EMPLOYEE PHOTO SYNCED SUCCESSFULLY:", {
    companyId,
    employeeId,
    photoPath: objectPath,
    photoVersion,
    serverVersion,
  });

  return {
    success: true,
    companyId,
    employeeId,
    serverVersion,
    updatedAt: employee.updatedAt,
    photoVersion,
    photoPath: objectPath,
  };
}

// ============================================================
// EMPLOYEE DOCUMENTS
// ============================================================

// ============================================================
// EMPLOYEE DOCUMENTS
// ============================================================

export async function syncEmployeeDocument(
  operation: SyncOperation,
  data: SyncData,
  file?: UploadedFile
) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const employee = await Employee.findOne({
    _id: data.employeeId,
    companyId,
  });

  if (!employee) {
    throw new Error(
      `EMPLOYEE ${data.employeeId} NOT FOUND IN COMPANY ${companyId}`
    );
  }

  const serverVersion = await getServerVersion("employee_document");

  console.log(
    `STARTING SYNC FOR EMPLOYEE DOCUMENT. COMPANY ${companyId} EMPLOYEE:
   ${employee}.Server version:${serverVersion}.Operation:${operation}`
  );

  console.log("EMPLOYEE DOCUMENTS DATA:", data);

  switch (operation) {
    case "create":
    case "update": {
      if (!file) {
        throw new Error("DOCUMENT FILE MISSING");
      }

      const employeeId = employee._id.toString();

      const sanitizePathPart = (value: string) =>
        value
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
          .replace(/\s+/g, "_")
          .trim();

      const documentName = sanitizePathPart(
        String(data.documentType || file.originalname)
      );

      const objectPath = `${companyId}/${employeeId}/${documentName}`;

      console.log("UPLOADING EMPLOYEE DOCUMENT:", {
        companyId,
        employeeId,
        documentName,
        objectPath,
      });

      /*
       * --------------------------------------------------------
       * UPLOAD
       * --------------------------------------------------------
       */

      const { error } = await supabase.storage
        .from("employees_documents")
        .upload(objectPath, file.buffer, {
          contentType: data.mimeType || file.mimetype,
          upsert: true,
          cacheControl: "0",
        });

      if (error) {
        throw new Error(`FAILED TO UPLOAD EMPLOYEE DOCUMENT: ${error.message}`);
      }

      /*
       * --------------------------------------------------------
       * SAVE DOCUMENT METADATA
       * --------------------------------------------------------
       */

      const { _id, fields } = cleanSyncFields(data, operation);

      await EmployeesDocuments.updateOne(
        {
          _id,
          companyId,
        },
        {
          $set: {
            ...fields,
            storagePath: objectPath,
            updatedAt: new Date(data.updatedAt as string),
            serverVersion,
          },

          $setOnInsert: {
            _id,
            companyId,
          },
        },
        {
          upsert: true,
        }
      );

      console.log("EMPLOYEE DOCUMENT SYNCED:", {
        _id,
        companyId,
        employeeId,
        storagePath: objectPath,
        serverVersion,
      });

      return {
        success: true,
        _id,
        companyId,
        employeeId,
        serverVersion,
        updatedAt: data.updatedAt,
        storagePath: objectPath,
      };
    }

    case "delete": {
      /*
       * --------------------------------------------------------
       * DELETE DOCUMENT
       * --------------------------------------------------------
       */

      const document = await EmployeesDocuments.findOne({
        _id: data._id,
        companyId,
      });

      if (document?.storagePath) {
        const { error: deleteError } = await supabase.storage
          .from("employees_documents")
          .remove([document.storagePath]);

        if (deleteError) {
          throw new Error(
            `FAILED TO DELETE EMPLOYEE DOCUMENT: ${deleteError.message}`
          );
        }
      }

      await EmployeesDocuments.updateOne(
        {
          _id: data._id,
          companyId,
        },
        {
          $set: {
            isDeleted: 1,
            updatedAt: new Date(data.updatedAt as string),
            serverVersion,
          },
        }
      );

      console.log("EMPLOYEE DOCUMENT DELETED:", {
        _id: data._id,
        companyId,
        serverVersion,
      });

      return {
        success: true,
        _id: data._id,
        companyId,
        serverVersion,
        updatedAt: data.updatedAt,
      };
    }
  }
}

// ============================================================
// ATTENDANCE
// ============================================================

export async function syncAttendance(operation: SyncOperation, data: SyncData) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);
  const { _id, fields } = cleanSyncFields(data, operation);
  fields.companyId = companyId;

  if (!_id) {
    throw new Error("ATTENDANCE SYNC FAILED: MISSING _id");
  }

  if (!fields.employeeId) {
    throw new Error("ATTENDANCE SYNC FAILED: MISSING employeeId");
  }

  if (!fields.date) {
    throw new Error("ATTENDANCE SYNC FAILED: MISSING date");
  }

  const serverVersion = await getServerVersion("attendance");

  const existingAttendance = await Attendance.findOne({
    employeeId: fields.employeeId,
    date: fields.date,
    isDeleted: 0,
    companyId,
  });

  if (existingAttendance && existingAttendance._id.toString() !== _id) {
    await Attendance.updateOne(
      {
        _id: existingAttendance._id,
        companyId,
      },
      {
        $set: {
          ...fields,
          serverVersion,
        },
      }
    );

    const attendance = await Attendance.findOne({
      _id: existingAttendance._id,
      companyId,
    }).lean();

    console.log("ATTENDANCE MERGED BY EMPLOYEE + DATE:", {
      clientId: _id,
      serverId: existingAttendance._id,
      employeeId: fields.employeeId,
      date: fields.date,
      companyId,
      serverVersion,
    });

    return {
      success: true,
      _id: existingAttendance._id,
      clientId: _id,
      serverVersion,
      attendance,
      merged: true,
    };
  }

  await Attendance.updateOne(
    {
      _id,
      companyId,
    },
    {
      $set: {
        ...fields,
        serverVersion,
      },
      $setOnInsert: {
        _id,
      },
    },
    {
      upsert: true,
    }
  );

  const attendance = await Attendance.findOne({
    _id,
    companyId,
  }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} ATTENDANCE:`, {
    _id,
    companyId,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    attendance,
    merged: false,
  };
}

// ============================================================
// ATTENDANCE DAILY CHECK
// ============================================================

export async function syncAttendanceDailyCheck(
  operation: SyncOperation,
  data: SyncData
) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data, operation);

  fields.companyId = companyId;

  const serverVersion = await getServerVersion("attendance_daily_check");

  // ---------------------------------------------------------
  // 1. First check if the record exists with the given _id
  // ---------------------------------------------------------
  let attendanceDailyCheck = await AttendanceDailyCheck.findOne({
    _id,
    companyId,
  });

  // ---------------------------------------------------------
  // 2. If not found by _id, check if one already exists
  //    for the same date and company
  // ---------------------------------------------------------
  if (!attendanceDailyCheck && fields.date) {
    attendanceDailyCheck = await AttendanceDailyCheck.findOne({
      companyId,
      date: fields.date,
    });
  }

  // ---------------------------------------------------------
  // 3. Existing record found -> UPDATE it
  // ---------------------------------------------------------
  if (attendanceDailyCheck) {
    await AttendanceDailyCheck.updateOne(
      {
        _id: attendanceDailyCheck._id,
        companyId,
      },
      {
        $set: {
          ...fields,
          serverVersion,
        },
      }
    );

    attendanceDailyCheck = await AttendanceDailyCheck.findOne({
      _id: attendanceDailyCheck._id,
      companyId,
    }).lean();

    console.log(`SYNCED ${operation.toUpperCase()} ATTENDANCE DAILY CHECK:`, {
      incomingId: _id,
      actualId: attendanceDailyCheck?._id,
      updatedAt: data.updatedAt,
      serverVersion,
      action: "UPDATED_EXISTING",
    });

    return {
      success: true,
      _id: attendanceDailyCheck?._id,
      serverVersion,
      attendanceDailyCheck,
    };
  }

  // ---------------------------------------------------------
  // 4. Nothing found by _id or date -> INSERT new record
  // ---------------------------------------------------------
  await AttendanceDailyCheck.create({
    ...fields,
    _id,
    companyId,
    serverVersion,
  });

  attendanceDailyCheck = await AttendanceDailyCheck.findOne({
    _id,
    companyId,
  }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} ATTENDANCE DAILY CHECK:`, {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
    action: "CREATED_NEW",
  });

  return {
    success: true,
    _id,
    serverVersion,
    attendanceDailyCheck,
  };
}

// ============================================================
// LEAVE
// ============================================================

export async function syncLeave(operation: SyncOperation, data: SyncData) {
  const { record, ...result } = await syncRecord(Leave, "leave", operation, data);
  return { ...result, leave: record };
}

// ============================================================
// TASK
// ============================================================

export async function syncTask(operation: SyncOperation, data: SyncData) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data, operation);
  fields.companyId = companyId;

  console.log("FIELDS BEFORE", fields);

  delete fields.comments;

  console.log("FIELDS AFTER", fields);

  const serverVersion = await getServerVersion("task");

  await Task.updateOne(
    {
      _id,
      companyId,
    },
    {
      $set: {
        ...fields,
        serverVersion,
      },

      $setOnInsert: {
        _id,
      },
    },
    {
      upsert: true,
      timestamps: false,
    }
  );

  const task = await Task.findOne({ _id, companyId }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} TASK:`, {
    _id,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    updatedAt: task?.updatedAt,
    task,
  };
}

// ============================================================
// TASK COMMENTS
// ============================================================

export async function syncTaskComment(
  operation: SyncOperation,
  data: SyncData
) {
  const companyId = requireCompanyId(data);

  if (!data._id) {
    throw new Error("TASK COMMENT SYNC FAILED: MISSING _id");
  }

  if (!data.taskId) {
    throw new Error(`TASK COMMENT ${data._id} SYNC FAILED: MISSING taskId`);
  }

  requireUpdatedAt(data);

  const task = await Task.findOne({
    _id: data.taskId,
    companyId,
  });

  if (!task) {
    throw new Error(`TASK ${data.taskId} NOT FOUND`);
  }

  console.log("TASK COMMENT DATA:", data);

  const commentServerVersion = await getServerVersion("task_comment");

  switch (operation) {
    case "create": {
      const existingComment = task.comments.find(
        (comment) => comment._id === data._id
      );

      if (!existingComment) {
        task.comments.push({
          companyId,
          _id: data._id,
          taskId: data.taskId,
          author: data.author,
          comment: data.comment,
          createdAt: new Date(data.createdAt).toISOString(),
          updatedAt: new Date(data.updatedAt).toISOString(),
          serverVersion: commentServerVersion,
          isDeleted: data.isDeleted ?? 0,
        } as any);
      } else {
        const existingUpdatedAt = existingComment.updatedAt
          ? new Date(existingComment.updatedAt).getTime()
          : 0;

        const incomingUpdatedAt = new Date(data.updatedAt as string).getTime();

        if (incomingUpdatedAt >= existingUpdatedAt) {
          Object.assign(existingComment, {
            author: data.author,
            comment: data.comment,
            isDeleted: data.isDeleted ?? existingComment.isDeleted ?? 0,
            updatedAt: new Date(data.updatedAt).toISOString(),
            serverVersion: commentServerVersion,
          });
        }
      }

      break;
    }

    case "update": {
      const comment = task.comments.find((c) => c._id === data._id);

      if (!comment) {
        throw new Error(`COMMENT ${data._id} NOT FOUND`);
      }

      const existingUpdatedAt = comment.updatedAt
        ? new Date(comment.updatedAt).getTime()
        : 0;

      const incomingUpdatedAt = new Date(data.updatedAt as string).getTime();

      if (incomingUpdatedAt >= existingUpdatedAt) {
        Object.assign(comment, {
          comment: data.comment,
          author: data.author,
          isDeleted: data.isDeleted ?? comment.isDeleted ?? 0,
          updatedAt: new Date(data.updatedAt as string),
          serverVersion: commentServerVersion,
        });
      }

      break;
    }

    case "delete": {
      const deletedComment = task.comments.find((c) => c._id === data._id);

      if (!deletedComment) {
        throw new Error(`COMMENT ${data._id} NOT FOUND`);
      }

      const existingUpdatedAt = deletedComment.updatedAt
        ? new Date(deletedComment.updatedAt).getTime()
        : 0;

      const incomingUpdatedAt = new Date(data.updatedAt as string).getTime();

      if (incomingUpdatedAt >= existingUpdatedAt) {
        deletedComment.isDeleted = 1;
        deletedComment.updatedAt = new Date(data.updatedAt as string);
        (deletedComment as any).serverVersion = commentServerVersion;
      }

      break;
    }
  }

  const taskServerVersion = await getServerVersion("task");

  task.serverVersion = taskServerVersion;

  await task.save();

  const savedTask = await Task.findOne({
    _id: data.taskId,
    companyId,
  });

  const savedComment = savedTask?.comments.find(
    (comment) => comment._id === data._id
  );

  console.log("SYNCED TASK COMMENT:", {
    taskId: data.taskId,
    commentId: data._id,
    commentUpdatedAt: data.updatedAt,
    commentServerVersion,
    taskServerVersion,
  });

  return {
    success: true,
    taskId: data.taskId,
    commentId: data._id,
    commentServerVersion,
    serverVersion: taskServerVersion,
    comment: savedComment,
  };
}

// ============================================================
// USER NOTES / ADMIN USER
// ============================================================

export async function syncUserNotes(data: SyncData) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data);
  fields.companyId = companyId;

  for (const key of Object.keys(fields)) {
    if (!["companyId", "notes", "updatedAt"].includes(key)) delete fields[key];
  }
  const existing = await AdminUser.findOne({ _id, companyId }).lean();
  if (!existing) throw new SyncConflict("MISSING_RECORD", "User not found.");
  if (new Date(existing.updatedAt).getTime() >= new Date(data.updatedAt).getTime()) {
    return { success: true, _id, serverVersion: existing.serverVersion };
  }
  const serverVersion = await getServerVersion("admin_user");

  await AdminUser.updateOne(
    {
      _id,
      companyId,
    },
    {
      $set: {
        ...fields,
        serverVersion,
      },
      $setOnInsert: {
        _id,
      },
    },
    {
      upsert: false,
      runValidators: true,
    }
  );

  console.log("SYNCED USER NOTES:", {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
  };
}

// ============================================================
// PAYROLL SETTINGS
// ============================================================

export async function syncPayrollSettings(operation: SyncOperation, data: SyncData) {
  const { record, ...result } = await syncRecord(PayrollSettings, "payroll_settings", operation, data);
  return { ...result, settings: record };
}

// ============================================================
// PAYROLL COMPONENT
// ============================================================

export async function syncPayrollComponent(operation: SyncOperation, data: SyncData) {
  const { record, ...result } = await syncRecord(PayrollComponent, "payroll_component", operation, data);
  return { ...result, component: record };
}

// ============================================================
// PAYROLL PROFILE
// ============================================================

export async function syncPayrollProfile(
  operation: SyncOperation,
  data: SyncData
) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data, operation);
  fields.companyId = companyId;

  if (!_id) {
    throw new Error("PAYROLL PROFILE SYNC FAILED: MISSING _id");
  }

  // Older queued payloads may predate account numbers. Preserve the saved
  // profile value, or inherit the employee account when creating the profile.
  if (fields.accountNumber === undefined) {
    const existing = await EmployeePayrollProfile.findOne({
      _id,
      companyId,
    }).lean();
    const employee =
      existing?.accountNumber == null
        ? await Employee.findOne({ _id: fields.employeeId, companyId }).lean()
        : null;
    fields.accountNumber =
      existing?.accountNumber ?? employee?.accountNumber ?? "cash";
  }
  fields.accountNumber = String(fields.accountNumber ?? "").trim() || "cash";

  const serverVersion = await getServerVersion("payroll_profile");

  await EmployeePayrollProfile.updateOne(
    {
      _id,
      companyId,
    },
    {
      $set: {
        ...fields,
        serverVersion,
      },
      $setOnInsert: {
        _id,
      },
    },
    {
      upsert: true,
    }
  );

  const profile = await EmployeePayrollProfile.findOne({
    _id,
    companyId,
  });

  if (!profile) {
    throw new Error(`PAYROLL PROFILE WAS NOT FOUND AFTER UPSERT: ${_id}`);
  }

  console.log(`SYNCED ${operation.toUpperCase()} PAYROLL PROFILE:`, {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    profile,
  };
}

// ============================================================
// PAYROLL RUN
// ============================================================

// Derive the batch status on the server as well: different devices may approve
// different employees without ever seeing a locally complete batch.
export async function refreshPayrollRunStatus(
  companyId: string,
  payrollRunId: string
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const payrollRun = await PayrollRun.findOne({
      companyId,
      _id: payrollRunId,
    }).lean();
    if (!payrollRun || payrollRun.isDeleted || payrollRun.status === "ANNULÉ")
      return;
    const results = await PayrollResult.find({
      companyId,
      payrollRunId,
      isDeleted: 0,
    }).lean();
    const complete =
      results.length > 0 && results.length >= payrollRun.employeeCount;
    const allApproved =
      complete &&
      results.every((r) => r.status === "APPROUVÉ" || r.status === "PAYÉ");
    const allPaid = complete && results.every((r) => r.status === "PAYÉ");
    const status = allPaid
      ? "PAYÉ"
      : allApproved
      ? "APPROUVÉ"
      : (complete || payrollRun.status === "BROUILLON") &&
        results.every((r) => r.status === "BROUILLON")
      ? "BROUILLON"
      : "VERIFICATION";
    const lastApproved = [...results].sort(
      (a, b) =>
        new Date(b.approvedAt ?? 0).getTime() -
        new Date(a.approvedAt ?? 0).getTime()
    )[0];
    const lastPaid = [...results].sort(
      (a, b) =>
        new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime()
    )[0];
    const serverVersion = await getServerVersion("payroll_run");
    const saved = await PayrollRun.updateOne(
      { companyId, _id: payrollRunId, serverVersion: payrollRun.serverVersion },
      {
        $set: {
          status,
          serverVersion,
          updatedAt: new Date(),
          approvedAt: allApproved
            ? lastApproved?.approvedAt ?? payrollRun.approvedAt ?? null
            : null,
          approvedBy: allApproved
            ? lastApproved?.approvedBy ?? payrollRun.approvedBy ?? null
            : null,
          paidAt: allPaid
            ? lastPaid?.paidAt ?? payrollRun.paidAt ?? null
            : null,
          paidBy: allPaid
            ? lastPaid?.paidBy ?? payrollRun.paidBy ?? null
            : null,
        },
      }
    );
    if (saved.matchedCount) return;
  }
  throw new Error("Payroll status changed during sync; retry required.");
}

async function cancelSyncedPayrollResults(
  companyId: string,
  payrollRunId: string,
  cancelledAt: Date
) {
  const results = await PayrollResult.find({
    companyId,
    payrollRunId,
    isDeleted: 0,
  }).lean();
  for (const result of results) {
    if (result.status === "ANNULÉ") continue;
    // Give each result its own version so paginated pulls cannot skip a row.
    await syncPayrollResult("update", {
      _id: result._id,
      companyId,
      serverVersion: 0,
      status: "ANNULÉ",
      cancelledAt,
      updatedAt: cancelledAt,
    });
  }
}

export async function syncPayrollRun(operation: SyncOperation, data: SyncData) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);
  const { _id, fields } = cleanSyncFields(data, operation);
  fields.companyId = companyId;
  if (fields.status !== undefined && !["BROUILLON", "VERIFICATION", "APPROUVÉ", "PAYÉ", "ANNULÉ"].includes(fields.status)) {
    throw new SyncConflict("INVALID_STATUS", "Unknown payroll status.");
  }

  const fromSettings = fields.cancellationFromSettings === true;
  delete fields.cancellationFromSettings;
  for (let attempt = 0; attempt < 10; attempt++) {
    const existing = await PayrollRun.findOne({ companyId, _id }).lean();
    // Cancellation is terminal, including when another device replays an older run.
    if (existing?.status === "ANNULÉ") {
      if (operation === "delete" && fields.isDeleted === 1) {
        const serverVersion = await getServerVersion("payroll_run");
        const deleted = await PayrollRun.updateOne(
          { companyId, _id, serverVersion: existing.serverVersion },
          { $set: { isDeleted: 1, updatedAt: fields.updatedAt, serverVersion } }
        );
        if (!deleted.matchedCount) continue;
        const payrollRun = await PayrollRun.findOne({ companyId, _id }).lean();
        return { success: true, _id, serverVersion, payrollRun };
      }
      await cancelSyncedPayrollResults(
        companyId,
        _id,
        existing.cancelledAt ?? existing.updatedAt
      );
      return {
        success: true,
        _id,
        serverVersion: existing.serverVersion,
        payrollRun: existing,
      };
    }
    const update = { ...fields };
    if (existing) {
      preservePayrollSnapshot(existing, update, ["month", "year", "employeeCount", "totalBasicSalary", "totalEarnings", "totalDeductions", "totalNetSalary", "generatedBy", "createdAt"]);
    } else if (operation !== "create") {
      throw new SyncConflict("MISSING_RECORD", `Payroll ${_id} must be created before it can change.`);
    }
    const processed = await PayrollResult.exists({
      companyId,
      payrollRunId: _id,
      isDeleted: 0,
      status: { $in: ["APPROUVÉ", "PAYÉ"] },
    });
    const hasProcessed =
      processed ||
      existing?.status === "APPROUVÉ" ||
      existing?.status === "PAYÉ";
    if (
      hasProcessed &&
      (update.status === "BROUILLON" || update.isDeleted === 1)
    ) {
      throw new SyncConflict("INVALID_TRANSITION",
        "Cannot reset or delete payroll with approved or paid payslips."
      );
    }
    if (update.status === "ANNULÉ") {
      if (hasProcessed && !fromSettings)
        throw new SyncConflict("INVALID_TRANSITION",
          "Use payroll settings to cancel approved or paid payroll."
        );
      if (fromSettings) {
        const actor = await AdminUser.findOne({
          companyId,
          _id: update.cancelledBy,
          isDeleted: 0,
        }).lean();
        if (!actor || !["ADMIN", "MANAGER"].includes(actor.role)) {
          throw new SyncConflict("FORBIDDEN",
            "Only an administrator or manager can cancel approved or paid payroll."
          );
        }
      }
      if (!update.cancelledAt)
        throw new SyncConflict("INVALID_DATE", "Cancellation date is required.");
      // Retain the server's approval/payment history when cancellation was made offline.
      for (const field of [
        "approvedAt",
        "approvedBy",
        "paidAt",
        "paidBy",
      ] as const) {
        if (existing?.[field]) update[field] = existing[field];
      }
    } else if (
      update.status === "APPROUVÉ" ||
      update.status === "PAYÉ" ||
      processed
    ) {
      update.status = existing?.status ?? "VERIFICATION";
      delete update.approvedAt;
      delete update.approvedBy;
      delete update.paidAt;
      delete update.paidBy;
    }
    const serverVersion = await getServerVersion("payroll_run");
    const filter = existing
      ? { _id, companyId, serverVersion: existing.serverVersion }
      : { _id, companyId };
    const saved = await PayrollRun.updateOne(
      filter,
      {
        $set: { ...update, serverVersion },
        $setOnInsert: { _id },
      },
      { upsert: !existing, runValidators: true }
    );
    if (!saved.matchedCount && !saved.upsertedCount) continue;
    if (update.status === "ANNULÉ") {
      await cancelSyncedPayrollResults(
        companyId,
        _id,
        new Date(update.cancelledAt)
      );
    } else {
      await refreshPayrollRunStatus(companyId, _id);
    }
    const payrollRun = await PayrollRun.findOne({ _id, companyId }).lean();
    return {
      success: true,
      _id,
      serverVersion: payrollRun?.serverVersion ?? serverVersion,
      payrollRun,
    };
  }
  throw new Error("Payroll changed during sync; retry required.");
}

export async function syncPayrollResult(
  operation: SyncOperation,
  data: SyncData
) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);
  const { _id, fields } = cleanSyncFields(data, operation);
  fields.companyId = companyId;
  if (fields.status !== undefined && !["BROUILLON", "VERIFICATION", "APPROUVÉ", "PAYÉ", "ANNULÉ"].includes(fields.status)) {
    throw new SyncConflict("INVALID_STATUS", "Unknown payroll status.");
  }

  const rank: Record<string, number> = {
    BROUILLON: 0,
    VERIFICATION: 1,
    APPROUVÉ: 2,
    PAYÉ: 3,
  };
  for (let attempt = 0; attempt < 10; attempt++) {
    const existing = await PayrollResult.findOne({ companyId, _id }).lean();
    const update = { ...fields };
    if (
      existing &&
      update.payrollRunId &&
      update.payrollRunId !== existing.payrollRunId
    ) {
      throw new SyncConflict("PAYROLL_PARENT_CONFLICT", `Payslip ${_id} belongs to payroll ${existing.payrollRunId}, but this update references ${update.payrollRunId}. Reconciliation is required.`, {
        payslipId: _id, incomingPayrollRunId: update.payrollRunId, storedPayrollRunId: existing.payrollRunId,
      });
    }
    if (existing) {
      preservePayrollSnapshot(existing, update, ["employeeId", "month", "year", "baseSalary", "grossSalary", "taxableSalary", "totalEarnings", "totalDeductions", "netSalary", "createdAt"]);
    } else if (operation !== "create") {
      throw new SyncConflict("MISSING_RECORD", `Payslip ${_id} must be created before its status can change.`);
    }
    const payrollRunId = existing?.payrollRunId ?? update.payrollRunId;
    requireId(payrollRunId, "payrollRunId");
    const payrollRun = await PayrollRun.findOne({
      companyId,
      _id: payrollRunId,
    }).lean();
    if (!payrollRun || payrollRun.isDeleted)
      throw new Error("Payroll run not found.");
    if (payrollRun.status === "ANNULÉ") {
      update.status = "ANNULÉ";
      update.cancelledAt = payrollRun.cancelledAt;
      update.updatedAt = payrollRun.updatedAt;
      for (const field of [
        "approvedAt",
        "approvedBy",
        "paidAt",
        "paidBy",
      ] as const) {
        if (existing?.[field]) update[field] = existing[field];
      }
    } else if (existing && (rank[existing.status] ?? -1) >= 2) {
      if (
        update.isDeleted === 1 ||
        update.status === "ANNULÉ" ||
        update.status === "BROUILLON"
      ) {
        throw new SyncConflict("INVALID_TRANSITION", "Cannot reset or delete an approved or paid payslip.");
      }
      // Replayed verification/approval snapshots must never undo payment or audit dates.
      if ((rank[update.status] ?? -1) <= rank[existing.status]) {
        update.status = existing.status;
        update.approvedAt = existing.approvedAt;
        update.approvedBy = existing.approvedBy;
        update.paidAt = existing.paidAt;
        update.paidBy = existing.paidBy;
        update.updatedAt = existing.updatedAt;
      } else {
        update.approvedAt = existing.approvedAt;
        update.approvedBy = existing.approvedBy;
      }
    }
    const serverVersion = await getServerVersion("payroll_result");
    const filter = existing
      ? { _id, companyId, serverVersion: existing.serverVersion }
      : { _id, companyId };
    const saved = await PayrollResult.updateOne(
      filter,
      {
        $set: { ...update, serverVersion },
        $setOnInsert: { _id },
      },
      { upsert: !existing, runValidators: true }
    );
    if (!saved.matchedCount && !saved.upsertedCount) continue;
    const latestRun = await PayrollRun.findOne({
      companyId,
      _id: payrollRunId,
    }).lean();
    if (latestRun?.status === "ANNULÉ" && update.status !== "ANNULÉ") continue;
    await refreshPayrollRunStatus(companyId, payrollRunId);
    const result = await PayrollResult.findOne({ _id, companyId }).lean();
    return { success: true, _id, serverVersion, result };
  }
  throw new Error("Payslip changed during sync; retry required.");
}

// ============================================================
// PAYROLL ITEM
// ============================================================

export async function syncPayrollItem(operation: SyncOperation, data: SyncData) {
  const companyId = requireCompanyId(data);
  requireId(data._id);
  const existing = await PayrollItem.findOne({ _id: data._id, companyId }).lean();
  if (existing && data.payrollResultId !== undefined && data.payrollResultId !== existing.payrollResultId) {
    throw new SyncConflict("PAYROLL_PARENT_CONFLICT", `Payroll item ${data._id} cannot move to another payslip.`);
  }
  const payrollResultId = existing?.payrollResultId ?? data.payrollResultId;
  requireId(payrollResultId, "payrollResultId");
  const result = await PayrollResult.findOne({ _id: payrollResultId, companyId }).lean();
  if (!result) throw new Error("Parent payslip has not synced yet.");
  if (operation === "delete" && ["APPROUVÉ", "PAYÉ"].includes(result.status)) {
    throw new SyncConflict("INVALID_TRANSITION", "Cannot delete an item from an approved or paid payslip.");
  }
  const snapshot = { ...data };
  if (existing) {
    preservePayrollSnapshot(existing, snapshot, ["payrollResultId", "employeeId", "componentId", "name", "displayName", "type", "amount", "taxable", "createdAt"]);
    if (existing.isDeleted) snapshot.isDeleted = 1;
  } else if (data.employeeId !== result.employeeId) {
    throw new SyncConflict("PAYROLL_EMPLOYEE_CONFLICT", "Payroll item employee does not match its payslip.");
  }
  const { record, ...response } = await syncRecord(PayrollItem, "payroll_item", operation, snapshot);
  return { ...response, item: record };
}
