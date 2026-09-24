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

function requireCompanyId(data: SyncData): string {
  if (!data.companyId || typeof data.companyId !== "string") {
    throw new Error(
      `SYNC FAILED: companyId is required for entity ${data._id ?? "unknown"}`
    );
  }

  return data.companyId;
}

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

function cleanSyncFields(data: SyncData) {
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

  return {
    _id,
    companyId,
    fields,
  };
}

function requireUpdatedAt(data: SyncData): Date {
  if (!data.updatedAt) {
    throw new Error(
      `SYNC FAILED: updatedAt is required for entity ${data._id}`
    );
  }

  const updatedAt = new Date(data.updatedAt);

  if (Number.isNaN(updatedAt.getTime())) {
    throw new Error(`SYNC FAILED: invalid updatedAt for entity ${data._id}`);
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

  const { fields } = cleanSyncFields(data);

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
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data);
  fields.companyId = companyId;

  const serverVersion = await getServerVersion("employee");

  await Employee.updateOne(
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

  const employee = await Employee.findOne({ _id, companyId }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} EMPLOYEE:`, {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    employee,
  };
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

      const { _id, fields } = cleanSyncFields(data);

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
  const { _id, fields } = cleanSyncFields(data);
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

  const { _id, fields } = cleanSyncFields(data);

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
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data);
  fields.companyId = companyId;

  const serverVersion = await getServerVersion("leave");

  await Leave.updateOne(
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

  const leave = await Leave.findOne({ _id, companyId }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} LEAVE:`, {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    leave,
  };
}

// ============================================================
// TASK
// ============================================================

export async function syncTask(operation: SyncOperation, data: SyncData) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data);
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
      upsert: true,
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

export async function syncPayrollSettings(
  operation: SyncOperation,
  data: SyncData
) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data);
  fields.companyId = companyId;

  const serverVersion = await getServerVersion("payroll_settings");

  await PayrollSettings.updateOne(
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

  const settings = await PayrollSettings.findOne({
    _id,
    companyId,
  }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} PAYROLL SETTINGS:`, {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    settings,
  };
}

// ============================================================
// PAYROLL COMPONENT
// ============================================================

export async function syncPayrollComponent(
  operation: SyncOperation,
  data: SyncData
) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data);
  fields.companyId = companyId;

  const serverVersion = await getServerVersion("payroll_component");

  await PayrollComponent.updateOne(
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

  const component = await PayrollComponent.findOne({
    _id,
    companyId,
  }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} PAYROLL COMPONENT:`, {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    component,
  };
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

  const { _id, fields } = cleanSyncFields(data);
  fields.companyId = companyId;

  if (!_id) {
    throw new Error("PAYROLL PROFILE SYNC FAILED: MISSING _id");
  }

  // Older queued payloads may predate account numbers. Preserve the saved
  // profile value, or inherit the employee account when creating the profile.
  if (fields.accountNumber === undefined) {
    const existing = await EmployeePayrollProfile.findOne({ _id, companyId }).lean();
    const employee = existing?.accountNumber == null
      ? await Employee.findOne({ _id: fields.employeeId, companyId }).lean()
      : null;
    fields.accountNumber = existing?.accountNumber ?? employee?.accountNumber ?? "cash";
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

export async function syncPayrollRun(operation: SyncOperation, data: SyncData) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data);
  fields.companyId = companyId;

  const serverVersion = await getServerVersion("payroll_run");

  await PayrollRun.updateOne(
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

  const payrollRun = await PayrollRun.findOne({
    _id,
    companyId,
  }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} PAYROLL RUN:`, {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    payrollRun,
  };
}

// ============================================================
// PAYROLL RESULT
// ============================================================

export async function syncPayrollResult(
  operation: SyncOperation,
  data: SyncData
) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data);
  fields.companyId = companyId;

  const serverVersion = await getServerVersion("payroll_result");

  await PayrollResult.updateOne(
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

  const result = await PayrollResult.findOne({
    _id,
    companyId,
  }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} PAYROLL RESULT:`, {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    result,
  };
}

// ============================================================
// PAYROLL ITEM
// ============================================================

export async function syncPayrollItem(
  operation: SyncOperation,
  data: SyncData
) {
  const companyId = requireCompanyId(data);
  requireUpdatedAt(data);

  const { _id, fields } = cleanSyncFields(data);
  fields.companyId = companyId;

  const serverVersion = await getServerVersion("payroll_item");

  await PayrollItem.updateOne(
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

  const item = await PayrollItem.findOne({
    _id,
    companyId,
  }).lean();

  console.log(`SYNCED ${operation.toUpperCase()} PAYROLL ITEM:`, {
    _id,
    updatedAt: data.updatedAt,
    serverVersion,
  });

  return {
    success: true,
    _id,
    serverVersion,
    item,
  };
}
