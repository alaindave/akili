import path from "path";
import { getCompanyFilesRoot } from "./companyStorage.js";
import fs from "fs/promises";

export function getEmployeePhotoDir() {
  return path.join(getCompanyFilesRoot(), "employees_photos");
}

export function getEmployeeDocumentsDir() {
  return path.join(getCompanyFilesRoot(), "employees_documents");
}

export function getCompanyLogoDir() {
  return path.join(getCompanyFilesRoot(), "company_logo");
}

export async function ensureStorageDirectories() {
  const folders = [
    getEmployeePhotoDir(),
    getEmployeeDocumentsDir(),
    getCompanyLogoDir(),
  ];

  for (const folder of folders) {
    await fs.mkdir(folder, {
      recursive: true,
    });

    console.log("FOLDER CREATED:", folder);
  }
}
