export type EmployeeDocumentType = "EMPLOYMENT_CONTRACT" | "NATIONAL_ID";

export interface EmployeeDocument {
  companyId: string;
  _id: string;
  employeeId: string;
  uploadedBy: string;
  documentType: EmployeeDocumentType;
  originalName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  localPath: string;
  hash: string;
  serverVersion: number;
  needsUpload: number;
  isDeleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedEmployeeDocument {
  companyId: string;
  employeeId: string;
  uploadedBy: string;
  documentType: EmployeeDocumentType;
  name: string;
  mimeType: string;
  buffer: Uint8Array;
  serverVersion?: number;
}
