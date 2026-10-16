import { all, get, run } from "../../db.js";
import type { CompanySummary } from "../../../../common/types/shared/Company.js";
import { addToSyncQueue } from "./sync.repository.js";
import Company from "../../../../common/types/shared/Company.js";
import { getCompanyFilesRoot, validateStorageCompany } from "../../../storage/companyStorage.js";
import path from "path";
import fs from "fs";

function localLogoPath(company: Company): string | null {
  const value = company.logoPath?.replace(/\\/g, "/") ?? null;
  const legacyPrefix = `company_logo/${company.companyId}/`;
  return value?.startsWith(legacyPrefix) ? `company_logo/${value.slice(legacyPrefix.length)}` : value;
}

export async function getConfiguredCompanies(): Promise<CompanySummary[]> {
  return all<CompanySummary>(
    `SELECT companyId, name, address, city, country FROM companies
     WHERE isDeleted = 0 ORDER BY name COLLATE NOCASE, companyId`
  );
}

/* =========================================================
   UPSERT
========================================================= */

/**
 * Used primarily when pulling a company from the server.
 */
export async function upsertCompany(company: Company): Promise<void> {
  const existing = await get<Company>(
    `
    SELECT *
    FROM companies
    WHERE companyId = ?
    LIMIT 1
    `,
    [company.companyId]
  );

  // Server-owned initialization state must reconcile even with pending profile edits.
  await reconcileCompanyInventory(company);

  /*
   * Do not overwrite a newer local version.
   */
  if (existing && existing.serverVersion > company.serverVersion) {
    return;
  }

  /*
   * Do not overwrite local unsynced changes.
   */
  if (existing && existing.synced === 0) {
    return;
  }

  await run(
    `
    INSERT INTO companies (
      _id,
      companyId,
      name,
      legalName,
      logoPath,
      address,
      city,
      country,
      phone,
      email,
      website,
      attendanceClockIn,
      createdAt,
      updatedAt,
      serverVersion,
      lastSyncedAt,
      synced,
      isDeleted
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)

    ON CONFLICT(_id)
    DO UPDATE SET
      name = excluded.name,
      legalName = excluded.legalName,
      logoPath = excluded.logoPath,
      address = excluded.address,
      city = excluded.city,
      country = excluded.country,
      phone = excluded.phone,
      email = excluded.email,
      website = excluded.website,
      attendanceClockIn = excluded.attendanceClockIn,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt,
      serverVersion = excluded.serverVersion,
      lastSyncedAt = excluded.lastSyncedAt,
      synced = excluded.synced,
      isDeleted = excluded.isDeleted
    `,
    [
      company._id,
      company.companyId,
      company.name,
      company.legalName ?? null,
      localLogoPath(company),
      company.address ?? null,
      company.city ?? null,
      company.country ?? null,
      company.phone ?? null,
      company.email ?? null,
      company.website ?? null,
      company.attendanceClockIn ?? "08:00",
      company.createdAt,
      company.updatedAt,
      company.serverVersion ?? 0,
      company.lastSyncedAt ?? null,
      company.synced ?? 1,
      company.isDeleted ?? 0,
    ]
  );
  await reconcileCompanyInventory(company);
}

export async function reconcileCompanyInventory(company: Company): Promise<void> {
  if (!company.inventoryInitialized) return;
  await run(`UPDATE companies SET inventoryInitialized = 1,
    inventoryInitializedAt = ?, inventoryInitializationDocumentId = ?,
    inventoryInitializationDocumentNumber = ? WHERE companyId = ?`, [
    company.inventoryInitializedAt ?? null, company.inventoryInitializationDocumentId ?? null,
    company.inventoryInitializationDocumentNumber ?? null, company.companyId,
  ]);
}

/* =========================================================
   LOGO
========================================================= */

export async function getLogoUrl(logoPath: string): Promise<string | null> {
  if (!logoPath) {
    return null;
  }

  try {
    const userDataPath = getCompanyFilesRoot();

    const fullPath = path.join(userDataPath, logoPath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const buffer = await fs.promises.readFile(fullPath);

    const extension = path.extname(fullPath).toLowerCase();

    let mimeType = "image/png";

    if (extension === ".jpg" || extension === ".jpeg") {
      mimeType = "image/jpeg";
    } else if (extension === ".webp") {
      mimeType = "image/webp";
    } else if (extension === ".gif") {
      mimeType = "image/gif";
    } else if (extension === ".svg") {
      mimeType = "image/svg+xml";
    }

    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.error("Failed to get company logo:", error);

    return null;
  }
}

/* =========================================================
   UPDATE LOGO
========================================================= */

export async function updateLogo(
  companyId: string,
  mimeType: string,
  data: ArrayBuffer
): Promise<string> {
  validateStorageCompany(companyId);
  if (!companyId) {
    throw new Error("companyId est obligatoire.");
  }

  if (!data || data.byteLength === 0) {
    throw new Error("Le fichier logo est vide.");
  }

  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error("Format de logo non supporté. Utilisez JPG, PNG ou WEBP.");
  }

  const userDataPath = getCompanyFilesRoot();

  const companyLogoDirectory = path.join(
    userDataPath,
    "company_logo"
  );

  await fs.promises.mkdir(companyLogoDirectory, {
    recursive: true,
  });

  let extension = ".png";

  if (mimeType === "image/jpeg") {
    extension = ".jpg";
  } else if (mimeType === "image/webp") {
    extension = ".webp";
  }

  const newFileName = `logo${extension}`;

  const fullPath = path.join(companyLogoDirectory, newFileName);

  const possibleExtensions = [".png", ".jpg", ".jpeg", ".webp"];

  for (const oldExtension of possibleExtensions) {
    const oldPath = path.join(companyLogoDirectory, `logo${oldExtension}`);

    if (oldPath !== fullPath) {
      try {
        await fs.promises.unlink(oldPath);
      } catch (error: any) {
        if (error?.code !== "ENOENT") {
          console.error("Failed to remove old company logo:", error);
        }
      }
    }
  }

  const buffer = Buffer.from(data);

  await fs.promises.writeFile(fullPath, buffer);

  const relativeLogoPath = path.posix.join("company_logo", newFileName);

  const now = new Date().toISOString();

  await run(
    `
      UPDATE companies
      SET
        logoPath = ?,
        updatedAt = ?,
        synced = 0
      WHERE companyId = ?
    `,
    [relativeLogoPath, now, companyId]
  );

  const updatedCompany = await getCompanyById(companyId);

  if (!updatedCompany) {
    throw new Error(`Company not found after logo update: ${companyId}`);
  }

  await addToSyncQueue({
    companyId,
    entity: "company_logo",
    entityId: companyId,
    operation: "update",
    payload: JSON.stringify({
      _id: companyId,
      companyId,
      logoPath: relativeLogoPath,
      originalName: newFileName,
      mimeType,
      size: buffer.length,
      updatedAt: now,
    }),
  });

  return relativeLogoPath;
}

/* =========================================================
   UPSERT COMPANY ID
========================================================= */
export async function upsertCompanyId(company: Company): Promise<void> {
  console.log("COMPANY TO UPSERT:", company);

  const existing = await get<Company>(
    `
    SELECT *
    FROM companies
    WHERE companyId = ?
    LIMIT 1
    `,
    [company.companyId]
  );

  const now = new Date().toISOString();

  if (!existing) {
    await run(
      `
      INSERT INTO companies (
        _id,
        companyId,
        name,
        legalName,
        logoPath,
        address,
        city,
        country,
        phone,
        email,
        website,
        attendanceClockIn,
        createdAt,
        updatedAt,
        serverVersion,
        lastSyncedAt,
        synced,
        isDeleted
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        company._id,
        company.companyId,
        company.name,
        company.legalName ?? null,
        localLogoPath(company),
        company.address ?? null,
        company.city ?? null,
        company.country ?? null,
        company.phone ?? null,
        company.email ?? null,
        company.website ?? null,
        company.attendanceClockIn ?? "08:00",
        company.createdAt ?? now,
        company.updatedAt ?? now,
        company.serverVersion ?? 0,
        company.lastSyncedAt ?? null,
        1,
        0,
      ]
    );

    console.log(`COMPANY ASSOCIATED WITH INSTALLATION: ${company.companyId}`);

    await reconcileCompanyInventory(company);

    return;
  }

  await reconcileCompanyInventory(company);
}

/* =========================================================
   GET COMPANY ID
========================================================= */

/**
 * The authenticated company is the active company for this installation.
 */
export async function getCompanyId(activeCompanyId: string): Promise<string | null> {
  const company = await get<{ companyId: string }>(
    `
    SELECT companyId
    FROM companies
    WHERE isDeleted = 0 AND companyId = ?
    LIMIT 1
    `,
    [activeCompanyId]
  );

  return company?.companyId ?? null;
}

/* =========================================================
   UPDATE COMPANY
========================================================= */

export async function updateCompany(company: Company): Promise<void> {
  const now = new Date().toISOString();

  await run(
    `
    UPDATE companies
    SET
      name = ?,
      legalName = ?,
      logoPath = ?,
      address = ?,
      city = ?,
      country = ?,
      phone = ?,
      email = ?,
      website = ?,
      updatedAt = ?,
      synced = 0
    WHERE companyId = ?
    `,
    [
      company.name,
      company.legalName,
      localLogoPath(company),
      company.address ?? null,
      company.city ?? null,
      company.country ?? null,
      company.phone ?? null,
      company.email ?? null,
      company.website ?? null,
      now,
      company.companyId,
    ]
  );

  const updated = await getCompanyById(company.companyId);

  if (!updated) {
    throw new Error(`Company not found after update: ${company.companyId}`);
  }

  await addToSyncQueue({
    companyId: company.companyId,
    entity: "company",
    entityId: company.companyId,
    operation: "update",
    payload: JSON.stringify(updated),
  });
}

/* =========================================================
   GET COMPANY BY ID
========================================================= */

export async function getCompanyById(
  companyId: string
): Promise<Company | null> {
  return await get<Company>(
    `
    SELECT *
    FROM companies
    WHERE companyId = ?
    LIMIT 1
    `,
    [companyId]
  );
}

/* =========================================================
   MARK COMPANY AS SYNCED
========================================================= */

export async function markCompanySynced(
  companyId: string,
  serverVersion?: number
): Promise<void> {
  if (serverVersion !== undefined) {
    await run(
      `
      UPDATE companies
      SET
        synced = 1,
        serverVersion = ?,
        lastSyncedAt = ?
      WHERE companyId = ?
      `,
      [serverVersion, new Date().toISOString(), companyId]
    );

    return;
  }

  await run(
    `
    UPDATE companies
    SET
      synced = 1,
      lastSyncedAt = ?
    WHERE companyId = ?
    `,
    [new Date().toISOString(), companyId]
  );
}

/* =========================================================
   GET UNSYNCED COMPANY
========================================================= */

export async function getUnsyncedCompany(companyId: string): Promise<Company | null> {
  return await get<Company>(
    `
    SELECT *
    FROM companies
    WHERE synced = 0
      AND isDeleted = 0
      AND companyId = ?
    LIMIT 1
    `,
    [companyId]
  );
}

/* =========================================================
   DELETE COMPANY
========================================================= */

export async function deleteCompany(companyId: string): Promise<void> {
  const company = await getCompanyById(companyId);

  if (!company) {
    return;
  }

  const now = new Date().toISOString();

  await run(
    `
    UPDATE companies
    SET
      isDeleted = 1,
      updatedAt = ?,
      synced = 0
    WHERE companyId = ?
    `,
    [now, companyId]
  );

  const deletedCompany = await getCompanyById(companyId);

  await addToSyncQueue({
    companyId,
    entity: "company",
    entityId: companyId,
    operation: "delete",
    payload: JSON.stringify(
      deletedCompany ?? {
        companyId,
        isDeleted: 1,
      }
    ),
  });
}

/* =========================================================
   RESTORE COMPANY
========================================================= */

export async function restoreCompany(companyId: string): Promise<void> {
  const now = new Date().toISOString();

  await run(
    `
    UPDATE companies
    SET
      isDeleted = 0,
      updatedAt = ?,
      synced = 0
    WHERE companyId = ?
    `,
    [now, companyId]
  );

  const company = await getCompanyById(companyId);

  if (!company) {
    throw new Error(`Company not found after restore: ${companyId}`);
  }

  await addToSyncQueue({
    companyId,
    entity: "company",
    entityId: companyId,
    operation: "update",
    payload: JSON.stringify(company),
  });
}
