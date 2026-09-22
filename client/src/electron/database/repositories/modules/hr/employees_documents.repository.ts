import { all, get, run } from "../../../db.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { randomUUID } from "crypto";

import { getEmployeeDocumentsDir } from "../../../../storage/directories.js";

import {
  EmployeeDocument,
  EmployeeDocumentType,
  UploadedEmployeeDocument,
} from "../../../../../common/types/EmployeeDocuments.js";

import { addToSyncQueue } from "../../shared/sync.repository.js";
import { getEmployeeById } from "./employees.repository.js";

// ============================================================
// Helpers
// ============================================================

function sanitizeFilePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

/**
 * Relative path stored in SQLite.
 *
 * Example:
 * companyId/employeeId/John_Doe_NATIONAL_ID.png
 */
function buildRelativeDocumentPath(
  companyId: string,
  employeeId: string,
  fileName: string
): string {
  return path.posix.join(companyId, employeeId, fileName);
}

/**
 * Convert stored relative path into the actual
 * installation-specific filesystem path.
 */
function resolveLocalDocumentPath(relativePath: string): string {
  const documentsRoot = path.resolve(getEmployeeDocumentsDir());

  const normalizedRelativePath = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  const absolutePath = path.resolve(documentsRoot, normalizedRelativePath);

  const relativeToRoot = path.relative(documentsRoot, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("EMPLOYEE DOCUMENT PATH ESCAPES EMPLOYEE DOCUMENT STORAGE");
  }

  return absolutePath;
}

// ============================================================
// Upload employee document
// ============================================================

export async function uploadEmployeeDocument(
  file: UploadedEmployeeDocument
): Promise<EmployeeDocument> {
  const companyId = file.companyId;

  if (!companyId) {
    throw new Error("Cannot upload employee document without companyId");
  }

  const existing = await getEmployeeDocument(
    companyId,
    file.employeeId,
    file.documentType
  );

  const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

  const employee = await getEmployeeById(companyId, file.employeeId);

  // Installation-specific root directory.
  // This is NEVER stored in the database.
  const employeeDocumentsDir = getEmployeeDocumentsDir();

  // Company folder -> Employee folder -> Document type
  const employeeFolder = path.join(
    employeeDocumentsDir,
    companyId,
    file.employeeId
  );

  await fs.mkdir(employeeFolder, {
    recursive: true,
  });

  const extension = path.extname(file.name);

  let _id: string = randomUUID();
  let createdAt = new Date().toISOString();

  if (existing) {
    _id = existing._id;
    createdAt = existing.createdAt;

    // Resolve the stored relative path to the actual
    // installation-specific file location.
    try {
      const existingAbsolutePath = resolveLocalDocumentPath(existing.localPath);

      await fs.unlink(existingAbsolutePath);
    } catch {
      // Old file doesn't exist. Ignore.
    }
  }

  const fileName = `${sanitizeFilePart(
    employee?.firstName ?? "employee"
  )}_${sanitizeFilePart(employee?.lastName ?? "")}_${sanitizeFilePart(
    file.documentType
  )}${extension}`;

  // Actual filesystem path.
  const absolutePath = path.join(employeeFolder, fileName);

  // Relative path stored in SQLite.
  const localPath = buildRelativeDocumentPath(
    companyId,
    file.employeeId,
    fileName
  );

  await fs.writeFile(absolutePath, file.buffer);

  const now = new Date().toISOString();

  const document: EmployeeDocument = {
    companyId,
    _id,
    employeeId: file.employeeId,
    uploadedBy: file.uploadedBy,
    documentType: file.documentType,
    originalName: file.name,
    fileName,
    localPath,
    mimeType: file.mimeType,
    fileSize: file.buffer.length,
    hash,
    serverVersion: file.serverVersion ?? 0,
    needsUpload: 1,
    isDeleted: 0,
    createdAt,
    updatedAt: now,
  };

  await upsertEmployeeDocument(document);

  return document;
}

// ============================================================
// Upsert employee document
// ============================================================
export async function upsertEmployeeDocument(
  document: EmployeeDocument
): Promise<void> {
  const companyId = document.companyId;

  if (!companyId) {
    throw new Error("Cannot upsert employee document without companyId");
  }

  if (!document.employeeId) {
    throw new Error("Cannot upsert employee document without employeeId");
  }

  if (!document.fileName) {
    throw new Error("Cannot upsert employee document without fileName");
  }

  const incomingServerVersion = document.serverVersion ?? 0;

  const existing = await get<{
    serverVersion: number;
    needsUpload: number;
  }>(
    `
      SELECT
        serverVersion,
        needsUpload
      FROM employees_documents
      WHERE companyId = ?
        AND _id = ?
    `,
    [companyId, document._id]
  );

  // ----------------------------------------------------------
  // Do not overwrite a newer local/server version
  // ----------------------------------------------------------

  if (existing && existing.serverVersion > incomingServerVersion) {
    return;
  }

  // ----------------------------------------------------------
  // Do not overwrite local changes that haven't been synced
  // ----------------------------------------------------------

  if (existing && existing.needsUpload === 1) {
    return;
  }

  // ----------------------------------------------------------
  // ALWAYS store a normalized relative path in SQLite
  //
  // Format:
  //
  // companyId/employeeId/fileName
  //
  // Example:
  //
  // abc123/employee456/Alain_Bedetse_ID_CARD.pdf
  // ----------------------------------------------------------

  const normalizedLocalPath = buildRelativeDocumentPath(
    companyId,
    document.employeeId,
    path.basename(document.fileName)
  );

  await run(
    `
      INSERT INTO employees_documents (
        companyId,
        _id,
        employeeId,
        uploadedBy,
        documentType,
        originalName,
        fileName,
        localPath,
        mimeType,
        fileSize,
        hash,
        serverVersion,
        needsUpload,
        isDeleted,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

      ON CONFLICT(_id)
      DO UPDATE SET
        companyId = excluded.companyId,
        employeeId = excluded.employeeId,
        uploadedBy = excluded.uploadedBy,
        documentType = excluded.documentType,
        originalName = excluded.originalName,
        fileName = excluded.fileName,
        localPath = excluded.localPath,
        mimeType = excluded.mimeType,
        fileSize = excluded.fileSize,
        hash = excluded.hash,
        serverVersion = excluded.serverVersion,
        needsUpload = excluded.needsUpload,
        isDeleted = excluded.isDeleted,
        createdAt = excluded.createdAt,
        updatedAt = excluded.updatedAt
    `,
    [
      companyId,
      document._id,
      document.employeeId,
      document.uploadedBy,
      document.documentType,
      document.originalName,
      document.fileName,
      normalizedLocalPath,
      document.mimeType,
      document.fileSize,
      document.hash,
      incomingServerVersion,
      document.needsUpload ? 1 : 0,
      document.isDeleted ? 1 : 0,
      document.createdAt,
      document.updatedAt,
    ]
  );

  // ----------------------------------------------------------
  // Add local modifications to sync queue
  // ----------------------------------------------------------

  if (document.needsUpload === 1) {
    await addToSyncQueue({
      companyId,
      entity: "employee_document",
      entityId: document._id,
      operation: document.isDeleted ? "delete" : "update",
      payload: JSON.stringify({
        ...document,
        localPath: normalizedLocalPath,
      }),
    });
  }
}

// ============================================================
// Get employee document
// ============================================================

export async function getEmployeeDocument(
  companyId: string,
  employeeId: string,
  documentType: EmployeeDocumentType
) {
  return get<EmployeeDocument>(
    `
      SELECT *
      FROM employees_documents
      WHERE companyId = ?
        AND employeeId = ?
        AND documentType = ?
        AND isDeleted = 0
      LIMIT 1
    `,
    [companyId, employeeId, documentType]
  );
}

// ============================================================
// Get employee document by ID
// ============================================================

export async function getEmployeeDocumentById(companyId: string, id: string) {
  return get<EmployeeDocument>(
    `
      SELECT *
      FROM employees_documents
      WHERE companyId = ?
        AND _id = ?
    `,
    [companyId, id]
  );
}

// ============================================================
// Get all employee documents for employee
// ============================================================

export async function getEmployeeDocumentsByEmployee(
  companyId: string,
  employeeId: string
) {
  return all<EmployeeDocument>(
    `
      SELECT *
      FROM employees_documents
      WHERE companyId = ?
        AND employeeId = ?
        AND isDeleted = 0
      ORDER BY createdAt DESC
    `,
    [companyId, employeeId]
  );
}

// ============================================================
// Get employee documents by type
// ============================================================

export async function getEmployeeDocumentsByType(
  companyId: string,
  employeeId: string,
  documentType: EmployeeDocumentType
) {
  return all<EmployeeDocument>(
    `
      SELECT *
      FROM employees_documents
      WHERE companyId = ?
        AND employeeId = ?
        AND documentType = ?
        AND isDeleted = 0
    `,
    [companyId, employeeId, documentType]
  );
}

// ============================================================
// Get all employee documents
// ============================================================

export async function getAllEmployeeDocuments(companyId: string) {
  return all<EmployeeDocument>(
    `
      SELECT *
      FROM employees_documents
      WHERE companyId = ?
      ORDER BY updatedAt DESC
    `,
    [companyId]
  );
}

// ============================================================
// Update employee document
// ============================================================

export async function updateEmployeeDocument(
  companyId: string,
  document: EmployeeDocument
) {
  if (!companyId) {
    throw new Error("Cannot update employee document without companyId");
  }

  const now = new Date().toISOString();

  await run(
    `
      UPDATE employees_documents
      SET
        uploadedBy = ?,
        documentType = ?,
        originalName = ?,
        fileName = ?,
        localPath = ?,
        mimeType = ?,
        fileSize = ?,
        hash = ?,
        serverVersion = ?,
        needsUpload = ?,
        updatedAt = ?
      WHERE companyId = ?
        AND _id = ?
        AND isDeleted = 0
    `,
    [
      document.uploadedBy,
      document.documentType,
      document.originalName,
      document.fileName,
      document.localPath,
      document.mimeType,
      document.fileSize,
      document.hash,
      document.serverVersion,
      document.needsUpload ? 1 : 0,
      now,
      companyId,
      document._id,
    ]
  );

  await addToSyncQueue({
    companyId,
    entity: "employee_document",
    entityId: document._id,
    operation: "update",
    payload: JSON.stringify({
      ...document,
      companyId,
      updatedAt: now,
    }),
  });
}

// ============================================================
// Delete employee document
// ============================================================

export async function deleteEmployeeDocument(companyId: string, _id: string) {
  const now = new Date().toISOString();

  const document = await getEmployeeDocumentById(companyId, _id);

  if (!document) {
    return false;
  }

  // Delete the physical file using the relative path.
  try {
    const absolutePath = resolveLocalDocumentPath(document.localPath);

    await fs.unlink(absolutePath);
  } catch {
    // File doesn't exist. Continue with soft delete.
  }

  await run(
    `
      UPDATE employees_documents
      SET
        isDeleted = 1,
        needsUpload = 1,
        updatedAt = ?
      WHERE companyId = ?
        AND _id = ?
    `,
    [now, companyId, _id]
  );

  await addToSyncQueue({
    companyId,
    entity: "employee_document",
    entityId: _id,
    operation: "delete",
    payload: JSON.stringify({
      ...document,
      companyId,
      isDeleted: 1,
      updatedAt: now,
    }),
  });

  return true;
}

// ============================================================
// Get unsynced employee documents
// ============================================================

export async function getUnsyncedEmployeeDocuments(companyId: string) {
  return all<EmployeeDocument>(
    `
      SELECT *
      FROM employees_documents
      WHERE companyId = ?
        AND needsUpload = 1
      ORDER BY updatedAt ASC
    `,
    [companyId]
  );
}

// ============================================================
// Mark employee document uploaded
// ============================================================

export async function markEmployeeDocumentUploaded(
  companyId: string,
  id: string
) {
  await run(
    `
      UPDATE employees_documents
      SET
        needsUpload = 0,
        lastSyncedAt = CURRENT_TIMESTAMP
      WHERE companyId = ?
        AND _id = ?
    `,
    [companyId, id]
  );

  return true;
}

// ============================================================
// Mark employee document needs upload
// ============================================================

export async function markEmployeeDocumentNeedsUpload(
  companyId: string,
  id: string
) {
  await run(
    `
      UPDATE employees_documents
      SET
        needsUpload = 1
      WHERE companyId = ?
        AND _id = ?
    `,
    [companyId, id]
  );

  return true;
}

// ============================================================
// Mark employee document synced
// ============================================================

export async function markEmployeeDocumentSynced(
  companyId: string,
  _id: string
) {
  await run(
    `
      UPDATE employees_documents
      SET
        needsUpload = 0,
        lastSyncedAt = CURRENT_TIMESTAMP
      WHERE companyId = ?
        AND _id = ?
    `,
    [companyId, _id]
  );

  return true;
}
