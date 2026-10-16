import { transaction } from "../../../db.js";
import { all, get, run } from "../../../db.js";


import {
  EmployeeDocument,
  EmployeeDocumentType,
} from "../../../../../common/types/hr/employees/EmployeeDocuments.js";

import { addToSyncQueue } from "../../shared/sync.repository.js";

// ============================================================
// Helpers
// ============================================================

export async function upsertEmployeeDocument(
  document: EmployeeDocument
): Promise<void> {
  return transaction(async () => {
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

    const normalizedLocalPath = document.localPath;
    if (!normalizedLocalPath || normalizedLocalPath.startsWith("/") || normalizedLocalPath.includes("\\") || normalizedLocalPath.split("/").some(part => part === ".." || part === ".")) {
      throw new Error("Invalid employee document local path");
    }

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
        operation: document.isDeleted
          ? "delete"
          : incomingServerVersion === 0 ? "create" : "update",
        payload: JSON.stringify({
          ...document,
          localPath: normalizedLocalPath,
        }),
      });
    }
  });
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
  return transaction(async () => {
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
      operation: (document.serverVersion ?? 0) === 0 ? "create" : "update",
      payload: JSON.stringify({
        ...document,
        companyId,
        updatedAt: now,
      }),
    });
  });
}

// ============================================================
// Delete employee document
// ============================================================

export async function deleteEmployeeDocument(companyId: string, _id: string) {
  return transaction(async () => {
    const now = new Date().toISOString();

    const document = await getEmployeeDocumentById(companyId, _id);

    if (!document) {
      return false;
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
  });
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
  return transaction(async () => {
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
  });
}

// ============================================================
// Mark employee document needs upload
// ============================================================

export async function markEmployeeDocumentNeedsUpload(
  companyId: string,
  id: string
) {
  return transaction(async () => {
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
  });
}

// ============================================================
// Mark employee document synced
// ============================================================

export async function markEmployeeDocumentSynced(
  companyId: string,
  _id: string,
  hash?: string,
  updatedAt?: string
) {
  return transaction(async () => {
    await run(
      `
      UPDATE employees_documents
      SET
        needsUpload = 0,
        lastSyncedAt = CURRENT_TIMESTAMP
      WHERE companyId = ?
        AND _id = ?
        AND (? IS NULL OR hash = ?)
        AND (? IS NULL OR updatedAt = ?)
    `,
      [companyId, _id, hash ?? null, hash ?? null, updatedAt ?? null, updatedAt ?? null]
    );

    return true;
  });
}
