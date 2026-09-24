import { get, run } from "../../db.js";
import { addToSyncQueue } from "./sync.repository.js";
import Company from "../../../../common/types/Company.js";
import { app } from "electron";
import path from "path";
import fs from "fs";

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
    LIMIT 1
    `
  );

  /*
   * This installation can only belong to one company.
   *
   * If a company already exists and it is a different company,
   * refuse to overwrite it.
   */
  if (existing && existing.companyId !== company.companyId) {
    throw new Error(
      `This installation is already associated with company ${existing.companyId}`
    );
  }

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
      company.logoPath ?? null,
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
}

/* =========================================================
   LOGO
========================================================= */

export async function getLogoUrl(logoPath: string): Promise<string | null> {
  if (!logoPath) {
    return null;
  }

  try {
    const userDataPath = app.getPath("userData");

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

  const userDataPath = app.getPath("userData");

  const companyLogoDirectory = path.join(
    userDataPath,
    "company_logo",
    companyId
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

  const relativeLogoPath = path.join("company_logo", companyId, newFileName);

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
    LIMIT 1
    `
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
        company.logoPath ?? null,
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

    return;
  }

  if (existing.companyId === company.companyId) {
    return;
  }

  throw new Error(
    `This installation is already associated with company ${existing.companyId}`
  );
}

/* =========================================================
   GET COMPANY ID
========================================================= */

/**
 * One local installation per company.
 */
export async function getCompanyId(): Promise<string | null> {
  const company = await get<{ companyId: string }>(
    `
    SELECT companyId
    FROM companies
    WHERE isDeleted = 0
    LIMIT 1
    `
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
      company.logoPath ?? null,
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

export async function getUnsyncedCompany(): Promise<Company | null> {
  return await get<Company>(
    `
    SELECT *
    FROM companies
    WHERE synced = 0
      AND isDeleted = 0
    LIMIT 1
    `
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
