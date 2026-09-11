import { ipcMain, shell, dialog, app } from "electron";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

import {
  updateEmployeeDocument,
  deleteEmployeeDocument,
  getEmployeeDocumentById,
  getEmployeeDocumentsByEmployee,
  getEmployeeDocumentsByType,
  getAllEmployeeDocuments,
  getUnsyncedEmployeeDocuments,
  markEmployeeDocumentUploaded,
  uploadEmployeeDocument,
} from "../../electron/database/repositories/employees_documents.repository.js";

import {
  EmployeeDocument,
  EmployeeDocumentType,
  UploadedEmployeeDocument,
} from "../../common/types/EmployeeDocuments.js";

function resolveEmployeeDocumentPath(
  companyId: string,
  localPath: string
): string {
  if (!companyId) {
    throw new Error("Company ID is required");
  }

  if (!localPath) {
    throw new Error("Employee document path is empty");
  }

  /*
   * Normalize separators.
   */
  let normalizedPath = localPath.replace(/\\/g, "/").replace(/^\/+/, "");

  console.log("NORMALIZED PATH", normalizedPath);

  /*
   * Remove employees_documents prefix if it exists.
   */
  if (normalizedPath.startsWith("employees_documents/")) {
    normalizedPath = normalizedPath.substring("employees_documents/".length);
  }

  /*
   * The stored path MUST start with the requested companyId.
   */
  const expectedPrefix = `${companyId}/`;

  if (!normalizedPath.startsWith(expectedPrefix)) {
    throw new Error(
      `EMPLOYEE DOCUMENT DOES NOT BELONG TO COMPANY ${companyId}`
    );
  }

  /*
   * Base directory:
   *
   * userData/
   *   employees_documents/
   */
  const documentsRoot = path.resolve(
    app.getPath("userData"),
    "employees_documents"
  );

  /*
   * Final path:
   *
   * userData/
   *   employees_documents/
   *     companyId/
   *       employeeId/
   *         file.pdf
   */
  const absolutePath = path.resolve(documentsRoot, normalizedPath);

  /*
   * Security check.
   *
   * Make sure the resolved path is still inside:
   *
   * userData/employees_documents/{companyId}
   */
  const companyRoot = path.resolve(documentsRoot, companyId);

  const relativeToCompany = path.relative(companyRoot, absolutePath);

  if (
    relativeToCompany.startsWith("..") ||
    path.isAbsolute(relativeToCompany)
  ) {
    throw new Error(
      "EMPLOYEE DOCUMENT PATH IS OUTSIDE THE COMPANY STORAGE FOLDER"
    );
  }

  return absolutePath;
}

export function registerEmployeeDocumentIPC() {
  console.log("REGISTERING EMPLOYEES DOCUMENTS IPC");

  // ==========================================================
  // VIEW DOCUMENT
  // ==========================================================

  ipcMain.handle(
    "employee_documents:view",
    async (_, companyId: string, localPath: string) => {
      const absolutePath = resolveEmployeeDocumentPath(companyId, localPath);

      console.log("VIEWING EMPLOYEE DOCUMENT:");
      console.log("COMPANY ID:", companyId);
      console.log("STORED PATH:", localPath);
      console.log("ABSOLUTE PATH:", absolutePath);

      console.log("FILE EXISTS:", fs.existsSync(absolutePath));

      if (!fs.existsSync(absolutePath)) {
        console.error("DOCUMENT FILE DOES NOT EXIST");
        console.error("Expected path:", absolutePath);

        throw new Error(`Document file not found: ${absolutePath}`);
      }

      const error = await shell.openPath(absolutePath);

      if (error) {
        console.error("Failed to open employee document:", error);

        throw new Error(error);
      }

      return true;
    }
  );

  // ==========================================================
  // DOWNLOAD DOCUMENT
  // ==========================================================

  ipcMain.handle(
    "employee_documents:download",
    async (_, companyId: string, document: EmployeeDocument) => {
      if (document.companyId !== companyId) {
        throw new Error("EMPLOYEE DOCUMENT DOES NOT BELONG TO THIS COMPANY");
      }

      const absolutePath = resolveEmployeeDocumentPath(
        companyId,
        document.localPath
      );

      console.log("DOWNLOADING EMPLOYEE DOCUMENT:");
      console.log("COMPANY ID:", companyId);
      console.log("STORED PATH:", document.localPath);
      console.log("ABSOLUTE PATH:", absolutePath);

      // Verify the local file exists first
      try {
        await fsPromises.access(absolutePath);
      } catch {
        throw new Error(`EMPLOYEE DOCUMENT DOES NOT EXIST: ${absolutePath}`);
      }

      const result = await dialog.showSaveDialog({
        defaultPath: document.originalName,
      });

      if (result.canceled || !result.filePath) {
        return false;
      }

      await fsPromises.copyFile(absolutePath, result.filePath);

      return true;
    }
  );

  // ==========================================================
  // UPLOAD DOCUMENT
  // ==========================================================

  ipcMain.handle(
    "employees-documents:upload",
    async (_, document: UploadedEmployeeDocument) => {
      if (!document.companyId) {
        throw new Error("COMPANY ID IS REQUIRED FOR EMPLOYEE DOCUMENT UPLOAD");
      }

      return await uploadEmployeeDocument(document);
    }
  );

  // ==========================================================
  // UPDATE DOCUMENT
  // ==========================================================

  ipcMain.handle(
    "employees-documents:update",
    async (_, companyId: string, document: EmployeeDocument) => {
      if (document.companyId !== companyId) {
        throw new Error("EMPLOYEE DOCUMENT DOES NOT BELONG TO THIS COMPANY");
      }

      return await updateEmployeeDocument(companyId, document);
    }
  );

  // ==========================================================
  // DELETE DOCUMENT
  // ==========================================================

  ipcMain.handle(
    "employee_documents:delete",
    async (_, companyId: string, _id: string) => {
      const document = await getEmployeeDocumentById(companyId, _id);

      if (!document) {
        return false;
      }

      /*
       * Extra tenant protection.
       */
      if (document.companyId !== companyId) {
        throw new Error("EMPLOYEE DOCUMENT DOES NOT BELONG TO THIS COMPANY");
      }

      try {
        const absolutePath = resolveEmployeeDocumentPath(
          companyId,
          document.localPath
        );

        await fsPromises.unlink(absolutePath);
      } catch {
        // Ignore if the file has already been removed
      }

      await deleteEmployeeDocument(companyId, _id);

      return true;
    }
  );

  // ==========================================================
  // GET BY ID
  // ==========================================================

  ipcMain.handle(
    "employees-documents:get-by-id",
    async (_, companyId: string, _id: string) => {
      return await getEmployeeDocumentById(companyId, _id);
    }
  );

  // ==========================================================
  // GET BY EMPLOYEE
  // ==========================================================

  ipcMain.handle(
    "employees-documents:get-by-employee",
    async (_, companyId: string, employeeId: string) => {
      return await getEmployeeDocumentsByEmployee(companyId, employeeId);
    }
  );

  // ==========================================================
  // GET BY TYPE
  // ==========================================================

  ipcMain.handle(
    "employees-documents:get-by-type",
    async (
      _,
      companyId: string,
      employeeId: string,
      documentType: EmployeeDocumentType
    ) => {
      return await getEmployeeDocumentsByType(
        companyId,
        employeeId,
        documentType
      );
    }
  );

  // ==========================================================
  // GET ALL
  // ==========================================================

  ipcMain.handle(
    "employees-documents:get-all",
    async (_, companyId: string) => {
      return await getAllEmployeeDocuments(companyId);
    }
  );

  // ==========================================================
  // GET UNSYNCED
  // ==========================================================

  ipcMain.handle(
    "employees-documents:get-unsynced",
    async (_, companyId: string) => {
      return await getUnsyncedEmployeeDocuments(companyId);
    }
  );

  // ==========================================================
  // MARK SYNCED
  // ==========================================================

  ipcMain.handle(
    "employees-documents:mark-synced",
    async (_, companyId: string, _id: string) => {
      return await markEmployeeDocumentUploaded(companyId, _id);
    }
  );
}
