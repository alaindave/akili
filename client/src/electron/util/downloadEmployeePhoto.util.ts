import axios from "axios";
import { app } from "electron";
import { validateStorageCompany } from "../storage/companyStorage.js";
import { installDownloadedPhoto } from "../services/shared/employeePhoto.service.js";

export async function downloadEmployeePhoto(
  companyId: string,
  employeeId: string,
  photo_version: number,
  mimeType?: string | null,
  expectedHash?: string | null,
  modified?: string | null
): Promise<string> {
  validateStorageCompany(companyId);
  const API_URL = app.isPackaged
    ? process.env.PRODUCTION_API_URL
    : process.env.VITE_API_URL;

  if (!API_URL) throw new Error("VITE_API_URL is not configured");
  const response = await axios.get(`${API_URL}/photos/${employeeId}`, {
    responseType: "arraybuffer",
    params: { version: photo_version, hash: expectedHash },
    timeout: 90000,
  });
  return installDownloadedPhoto(
    companyId,
    employeeId,
    Buffer.from(response.data),
    photo_version,
    mimeType,
    expectedHash,
    modified
  );
}
