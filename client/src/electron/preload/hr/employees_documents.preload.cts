type EmployeeDocument = import("../../../common/types/EmployeeDocuments", {
  with: { "resolution-mode": "require" },
}).EmployeeDocument;

type UploadedEmployeeDocument = import("../../../common/types/EmployeeDocuments", {
  with: { "resolution-mode": "require" },
}).UploadedEmployeeDocument;

import { invoke } from "../../ipc/ipc.cjs";

export const employeesDocumentsApi = {
  view: (companyId: string, localPath: string) =>
    invoke("employee_documents:view", companyId, localPath),

  download: (companyId: string, document: EmployeeDocument) =>
    invoke("employee_documents:download", companyId, document),

  delete: (companyId: string, _id: string) =>
    invoke("employee_documents:delete", companyId, _id),

  upload: (document: UploadedEmployeeDocument) =>
    invoke("employees-documents:upload", document),

  getAll: (companyId: string) =>
    invoke("employees-documents:get-all", companyId),

  getById: (companyId: string, _id: string) =>
    invoke("employees-documents:get-by-id", companyId, _id),

  getByEmployee: (companyId: string, employeeId: string) =>
    invoke("employees-documents:get-by-employee", companyId, employeeId),

  getByType: (companyId: string, employeeId: string, documentType: string) =>
    invoke(
      "employees-documents:get-by-type",
      companyId,
      employeeId,
      documentType
    ),

  update: (companyId: string, document: EmployeeDocument) =>
    invoke("employees-documents:update", companyId, document),

  getUnsynced: (companyId: string) =>
    invoke("employees-documents:get-unsynced", companyId),

  markSynced: (companyId: string, id: string) =>
    invoke("employees-documents:mark-synced", companyId, id),
};
