import axios from "axios";
import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import Employee from "../../common/types/Employee.js";
import { EmployeeDocument } from "../../common/types/EmployeeDocuments.js";
import { getEmployeeDocumentsDir } from "../storage/directories.js";

const API_URL = app.isPackaged
  ? "https://leather-works.onrender.com"
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

  const url = `${API_URL}/documents/${document._id}`;

  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });

  const employeeDocumentsDir = getEmployeeDocumentsDir();

  const sanitizePathPart = (value: string) =>
    value
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "_")
      .trim();

  const companyId = sanitizePathPart(employee.companyId);
  const employeeId = sanitizePathPart(employee._id);
  const documentType = sanitizePathPart(document.documentType);
  const fileName = sanitizePathPart(document.fileName);

  const documentFolder = path.join(employeeDocumentsDir, companyId, employeeId);

  await fs.mkdir(documentFolder, {
    recursive: true,
  });

  const localPath = path.join(documentFolder, fileName);

  await fs.writeFile(localPath, Buffer.from(response.data));

  console.log("EMPLOYEE DOCUMENT DOWNLOADED:");
  console.log("COMPANY ID:", companyId);
  console.log("EMPLOYEE ID:", employeeId);
  console.log("DOCUMENT TYPE:", documentType);
  console.log("FILE NAME:", fileName);
  console.log("LOCAL PATH:", localPath);

  return localPath;
}
