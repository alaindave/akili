import { UploadedEmployeeDocument } from "../../../../common/types/hr/employees/EmployeeDocuments.js";
import { uploadEmployeeDocument } from "../../shared/employeeDocumentStorage.service.js";

export async function uploadValidatedEmployeeDocument(document: UploadedEmployeeDocument) {
  if (!document || typeof document.documentType !== "string" || !document.documentType.trim()) {
    throw new Error("DOCUMENT TYPE IS REQUIRED");
  }
  for (const id of [document.companyId, document.employeeId]) {
    if (typeof id !== "string" || !id.trim() || id === "." || id === ".." || /[/\\]/.test(id) || id.includes(String.fromCharCode(0))) {
      throw new Error("INVALID COMPANY OR EMPLOYEE ID");
    }
  }
  if (typeof document.name !== "string" || !document.name.trim()) {
    throw new Error("DOCUMENT NAME IS REQUIRED");
  }
  if (!(document.buffer instanceof Uint8Array) || document.buffer.byteLength > 10 * 1024 * 1024) {
    throw new Error("INVALID DOCUMENT OR FILE EXCEEDS 10 MB");
  }
  return uploadEmployeeDocument({ ...document, documentType: document.documentType.trim() });
}
