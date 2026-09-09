import path from "path";
import { app } from "electron";
import fs from "fs/promises";

export function getEmployeePhotoDir() {
  return path.join(app.getPath("userData"), "employees_photos");
}

export function getEmployeeDocumentsDir() {
  return path.join(app.getPath("userData"), "employees_documents");
}

export async function ensureStorageDirectories() {
  const folders = [getEmployeePhotoDir(), getEmployeeDocumentsDir()];

  for (const folder of folders) {
    await fs.mkdir(folder, {
      recursive: true,
    });

    console.log("FOLDER CREATED:", folder);
  }
}
