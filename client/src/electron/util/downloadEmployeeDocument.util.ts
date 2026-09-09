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

  const url = `${API_URL}/documents/${document._id}`;

  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });

  // Get installation-specific documents directory
  const employeeDocumentsDir = getEmployeeDocumentsDir();

  const sanitizeFolderPart = (value: string) =>
    value
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "_")
      .trim();

  const employeeFolderName = [
    sanitizeFolderPart(employee.firstName),
    sanitizeFolderPart(employee.lastName),
    employee._id,
  ].join("_");

  const documentFolder = path.join(
    employeeDocumentsDir,
    employeeFolderName,
    sanitizeFolderPart(document.documentType)
  );

  await fs.mkdir(documentFolder, {
    recursive: true,
  });

  const localPath = path.join(documentFolder, document.fileName);

  await fs.writeFile(localPath, Buffer.from(response.data));

  return localPath;
}
