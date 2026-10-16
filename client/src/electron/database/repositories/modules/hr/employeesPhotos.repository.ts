import { transaction, get, run } from "../../../db.js";
import type Employee from "../../../../../common/types/hr/employees/Employee.js";

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
  return transaction(async () => {
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

  const result = await run(
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
      AND COALESCE(photo_needs_upload, 0) = 0
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
  if (!result.changes) {
    throw new Error(
      `Employee ${employeeId} photo changed during download; retry required`
    );
  }
  });
}

// ============================================================
// Mark employee photo synced
// ============================================================

export async function markEmployeePhotoSynced(
  companyId: string,
  employeeId: string,
  photoHash?: string
) {
  return transaction(async () => {
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
      AND (? IS NULL OR photo_hash = ?)
    `,
    [companyId, employeeId, photoHash ?? null, photoHash ?? null]
  );

  return true;
  });
}
