import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { app } from "electron";
import { getCompanyLogoDir } from "../storage/directories.js";
import { getCompanyById } from "../database/repositories/companies.repository.js";

export async function downloadCompanyLogo(
  companyId: string,
  mimeType?: string | null
) {
  const API_URL = app.isPackaged
    ? "https://leather-works.onrender.com"
    : process.env.VITE_API_URL;

  if (!API_URL) {
    throw new Error("VITE_API_URL is not configured");
  }

  const company = await getCompanyById(companyId);

  if (!company) {
    throw new Error(`Company ${companyId} not found`);
  }

  if (!company.logoPath) {
    throw new Error(`Company ${companyId} logo path not found`);
  }

  // Get installation-specific company logo directory
  const companyLogoDir = getCompanyLogoDir();

  // Determine file extension from MIME type
  const extension = (() => {
    switch (mimeType) {
      case "image/png":
        return ".png";

      case "image/webp":
        return ".webp";

      case "image/jpeg":
      case "image/jpg":
        return ".jpg";

      default:
        return ".png";
    }
  })();

  // File path:
  // company_logos/<companyId>/logo.<extension>
  const logoRelativePath = path.join(companyId, `logo${extension}`);

  const absolutePath = path.join(companyLogoDir, logoRelativePath);

  // Create the parent directory
  const logoDir = path.dirname(absolutePath);

  await fs.mkdir(logoDir, {
    recursive: true,
  });

  console.log(
    "DOWNLOADING COMPANY LOGO FROM:",
    `${API_URL}/company-logo/${companyId}`
  );

  console.log("SAVING COMPANY LOGO TO:", absolutePath);

  const response = await axios.get(`${API_URL}/company-logo/${companyId}`, {
    responseType: "arraybuffer",
  });

  /*
   * ----------------------------------------------------------
   * REMOVE EXISTING LOGO FILE IF IT IS A DIRECTORY
   * ----------------------------------------------------------
   */

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

  /*
   * ----------------------------------------------------------
   * REMOVE OLD LOGO EXTENSIONS
   * ----------------------------------------------------------
   */

  const oldExtensions = [".png", ".jpg", ".jpeg", ".webp"];

  for (const oldExtension of oldExtensions) {
    const oldPath = path.join(companyLogoDir, companyId, `logo${oldExtension}`);

    if (oldPath === absolutePath) {
      continue;
    }

    try {
      await fs.rm(oldPath, {
        force: true,
      });
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  /*
   * ----------------------------------------------------------
   * SAVE LOGO
   * ----------------------------------------------------------
   */

  await fs.writeFile(absolutePath, Buffer.from(response.data));

  console.log("COMPANY LOGO SAVED SUCCESSFULLY:", absolutePath);

  return absolutePath;
}
