import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { app } from "electron";

import { getEmployeePhotoDir } from "../storage/directories.js";
import { getEmployeeById } from "../database/repositories/employees.repository.js";

export async function downloadEmployeePhoto(
  companyId: string,
  employeeId: string,
  photo_version: number
) {
  const API_URL = app.isPackaged
    ? "https://leather-works.onrender.com"
    : process.env.VITE_API_URL;

  if (!API_URL) {
    throw new Error("VITE_API_URL is not configured");
  }

  const employee = await getEmployeeById(companyId, employeeId);

  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  // Get installation-specific photo directory
  const employeePhotoDir = getEmployeePhotoDir();

  // Determine file extension from the employee's MIME type
  const extension = (() => {
    const mimeType = employee.photo_mime_type;

    switch (mimeType) {
      case "image/png":
        return ".png";

      case "image/webp":
        return ".webp";

      case "image/jpeg":
      case "image/jpg":
      default:
        return ".jpg";
    }
  })();

  // File path:
  // employees_photos/<companyId>/<employeeId>/photo_v<version>.<extension>
  const photoRelativePath = path.join(
    employee.companyId,
    employee._id,
    `photo_v${photo_version}${extension}`
  );

  const absolutePath = path.join(employeePhotoDir, photoRelativePath);

  // Create the parent directory
  const photoDir = path.dirname(absolutePath);

  await fs.mkdir(photoDir, {
    recursive: true,
  });

  console.log("DOWNLOADING PHOTO FROM:", `${API_URL}/photos/${employeeId}`);

  console.log("SAVING PHOTO TO:", absolutePath);

  const response = await axios.get(`${API_URL}/photos/${employeeId}`, {
    responseType: "arraybuffer",
  });

  try {
    const existing = await fs.stat(absolutePath);

    if (existing.isDirectory()) {
      await fs.rm(absolutePath, {
        recursive: true,
        force: true,
      });
    }
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.writeFile(absolutePath, Buffer.from(response.data));

  console.log("PHOTO SAVED SUCCESSFULLY:", absolutePath);

  return absolutePath;
}
