import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { get, run } from "../db.js";

import { getEmployeePhotoDir } from "../../storage/directories.js";

import Employee from "../../../common/types/Employee.js";
import { addToSyncQueue } from "./sync.repository.js";

type UploadFile = {
  name: string;
  buffer: Buffer;
};

// ============================================================
// Helpers
// ============================================================

/**
 * Relative path stored in SQLite.
 *
 * Example:
 * companyId/employeeId/employeeId_photo.jpg
 */
function buildRelativePhotoPath(
  companyId: string,
  employeeId: string,
  fileName: string
): string {
  return path.posix.join(companyId, employeeId, fileName);
}

/**
 * Convert stored relative path into the actual
 * installation-specific filesystem path.
 *
 * Prevents paths from escaping the employee photo directory.
 */
function resolveLocalPhotoPath(relativePath: string): string {
  const photosRoot = path.resolve(getEmployeePhotoDir());

  const normalizedRelativePath = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  const absolutePath = path.resolve(photosRoot, normalizedRelativePath);

  const relativeToRoot = path.relative(photosRoot, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("EMPLOYEE PHOTO PATH ESCAPES EMPLOYEE PHOTO STORAGE");
  }

  return absolutePath;
}

// ============================================================
// Upload employee photo
// ============================================================

export async function uploadEmployeePhoto(
  companyId: string,
  employeeId: string,
  file: UploadFile
) {
  if (!companyId) {
    throw new Error("Cannot upload employee photo without companyId");
  }

  if (!employeeId) {
    throw new Error("Cannot upload employee photo without employeeId");
  }

  // ----------------------------------------------------------
  // Verify employee belongs to this company
  // ----------------------------------------------------------

  const employee = await get<Employee>(
    `
    SELECT *
    FROM employees
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, employeeId]
  );

  if (!employee) {
    throw new Error("Employee not found");
  }

  // ----------------------------------------------------------
  // Installation-specific photo root directory
  // ----------------------------------------------------------

  const photosRoot = getEmployeePhotoDir();

  // ----------------------------------------------------------
  // Company -> Employee directory
  // ----------------------------------------------------------

  const employeePhotoDir = path.join(photosRoot, companyId, employeeId);

  await fs.mkdir(employeePhotoDir, {
    recursive: true,
  });

  // ----------------------------------------------------------
  // Get extension
  // ----------------------------------------------------------

  const ext = path.extname(file.name).toLowerCase();

  // ----------------------------------------------------------
  // MIME type
  // ----------------------------------------------------------

  const mimeType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
      ? "image/webp"
      : ext === ".gif"
      ? "image/gif"
      : "image/jpeg";

  // ----------------------------------------------------------
  // Increment photo version
  // ----------------------------------------------------------

  const photoVersion = (employee.photo_version ?? 0) + 1;

  // ----------------------------------------------------------
  // Filename
  // ----------------------------------------------------------

  const fileName = `${employeeId}_photo${ext}`;

  // ----------------------------------------------------------
  // Actual filesystem path
  // ----------------------------------------------------------

  const absolutePath = path.join(employeePhotoDir, fileName);

  // ----------------------------------------------------------
  // Relative path stored in SQLite
  // ----------------------------------------------------------

  const relativePath = buildRelativePhotoPath(companyId, employeeId, fileName);

  // ----------------------------------------------------------
  // Hash
  // ----------------------------------------------------------

  const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

  const CURRENT_TIMESTAMP = new Date().toISOString();

  // ----------------------------------------------------------
  // Delete previous photo if path changed
  // ----------------------------------------------------------

  if (employee.photo_path && employee.photo_path !== relativePath) {
    try {
      const previousAbsolutePath = resolveLocalPhotoPath(employee.photo_path);

      await fs.unlink(previousAbsolutePath);
    } catch {
      // Previous file does not exist.
      // Continue with new photo.
    }
  }

  // ----------------------------------------------------------
  // Save photo locally
  // ----------------------------------------------------------

  await fs.writeFile(absolutePath, file.buffer);

  // ----------------------------------------------------------
  // Update employee metadata
  // ----------------------------------------------------------

  await run(
    `
    UPDATE employees
    SET
      photo_filename = ?,
      photo_path = ?,
      photo_version = ?,
      photo_hash = ?,
      photo_last_modified = ?,
      photo_mime_type = ?,
      photo_needs_upload = 1,
      updatedAt = ?
    WHERE companyId = ?
      AND _id = ?
    `,
    [
      fileName,
      relativePath,
      photoVersion,
      hash,
      CURRENT_TIMESTAMP,
      mimeType,
      CURRENT_TIMESTAMP,
      companyId,
      employeeId,
    ]
  );

  // ----------------------------------------------------------
  // Sync payload
  // ----------------------------------------------------------

  const syncPayload = {
    companyId,
    employeeId,
    photo_filename: fileName,
    photo_path: relativePath,
    photo_version: photoVersion,
    photo_hash: hash,
    photo_last_modified: CURRENT_TIMESTAMP,
    photo_mime_type: mimeType,
    updatedAt: CURRENT_TIMESTAMP,
  };

  console.log(
    "PHOTO TO ADD TO SYNC QUEUE:",
    JSON.stringify(syncPayload, null, 2)
  );

  // ----------------------------------------------------------
  // Add to sync queue
  // ----------------------------------------------------------

  await addToSyncQueue({
    companyId,
    entity: "employee_photo",
    entityId: employeeId,
    operation: "update",
    payload: JSON.stringify(syncPayload),
  });

  // ----------------------------------------------------------
  // Return updated employee
  // ----------------------------------------------------------

  return get<Employee>(
    `
    SELECT *
    FROM employees
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, employeeId]
  );
}

// ============================================================
// Update employee photo metadata
// ============================================================

export async function updateEmployeePhotoMetadata(
  companyId: string,
  employeeId: string,
  data: {
    photo_path: string;
    photo_filename: string;
    photo_version: number;
    photo_hash?: string | null;
    photo_mime_type?: string | null;
    photo_last_modified?: string | null;
  }
) {
  if (!companyId) {
    throw new Error("Cannot update employee photo without companyId");
  }

  // ----------------------------------------------------------
  // Validate that employee belongs to company
  // ----------------------------------------------------------

  const employee = await get<Employee>(
    `
    SELECT _id
    FROM employees
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, employeeId]
  );

  if (!employee) {
    throw new Error("Employee not found");
  }

  // ----------------------------------------------------------
  // Update metadata
  // ----------------------------------------------------------

  await run(
    `
    UPDATE employees
    SET
      photo_path = ?,
      photo_filename = ?,
      photo_version = ?,
      photo_hash = ?,
      photo_mime_type = ?,
      photo_last_modified = ?,
      photo_needs_upload = 0
    WHERE companyId = ?
      AND _id = ?
    `,
    [
      data.photo_path,
      data.photo_filename,
      data.photo_version,
      data.photo_hash ?? null,
      data.photo_mime_type ?? null,
      data.photo_last_modified ?? null,
      companyId,
      employeeId,
    ]
  );
}

// ============================================================
// Mark employee photo synced
// ============================================================

export async function markEmployeePhotoSynced(
  companyId: string,
  employeeId: string
) {
  if (!companyId) {
    throw new Error("Cannot mark employee photo synced without companyId");
  }

  await run(
    `
    UPDATE employees
    SET
      photo_needs_upload = 0
    WHERE companyId = ?
      AND _id = ?
    `,
    [companyId, employeeId]
  );

  return true;
}
