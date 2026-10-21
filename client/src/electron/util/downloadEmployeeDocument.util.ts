import axios from "axios";
import { app } from "electron";
import Employee from "../../common/types/hr/employees/Employee.js";
import { EmployeeDocument } from "../../common/types/hr/employees/EmployeeDocuments.js";
import { installDownloadedDocument } from "../services/shared/employeeDocumentStorage.service.js";
import { validateStorageCompany } from "../storage/companyStorage.js";

const API_URL = app.isPackaged
  ? process.env.PRODUCTION_API_URL
  : process.env.VITE_API_URL;

export async function downloadEmployeeDocument(
  employee: Employee,
  document: EmployeeDocument
): Promise<string> {
  if (!employee) {
    throw new Error(`Employee ${document.employeeId} not found`);
  }

  if (!employee.companyId) {
    throw new Error(`Employee ${employee._id} does not have a companyId`);
  }

  validateStorageCompany(employee.companyId);
  if (
    document.companyId !== employee.companyId ||
    document.employeeId !== employee._id
  ) {
    throw new Error(
      "Document does not belong to the selected employee/company"
    );
  }
  const url = `${API_URL}/documents/${document._id}`;

  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });

  return installDownloadedDocument(document, Buffer.from(response.data));
}
