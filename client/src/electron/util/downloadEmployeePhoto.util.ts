import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { app } from "electron";

import { getEmployeePhotoDir } from "../storage/directories.js";
import { getEmployeeById } from "../database/repositories/employees.repository.js";

export async function downloadEmployeePhoto(
  companyId: string,
  employeeId: string,
  photoFilename: string
) {
  const API_URL = app.isPackaged
    ? "https://leather-works.onrender.com"
    : process.env.VITE_API_URL;

  const employee = await getEmployeeById(companyId, employeeId);

  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  // Get installation-specific photo directory
  const employeePhotoDir = getEmployeePhotoDir();

  const sanitizeFolderPart = (value: string) =>
    value
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "_")
      .trim();

  // Folder name
  const employeeFolderName = [
    sanitizeFolderPart(employee.firstName),
    sanitizeFolderPart(employee.lastName),
    employee._id,
  ].join("_");

  const employeeFolder = path.join(employeePhotoDir, employeeFolderName);

  await fs.mkdir(employeeFolder, {
    recursive: true,
  });

  const filePath = path.join(employeeFolder, photoFilename);

  console.log("DOWNLOADING PHOTO FROM:", `${API_URL}/photos/${employeeId}`);

  console.log("SAVING PHOTO TO:", filePath);

  const response = await axios.get(`${API_URL}/photos/${employeeId}`, {
    responseType: "arraybuffer",
  });

  await fs.writeFile(filePath, Buffer.from(response.data));

  return filePath;
}
