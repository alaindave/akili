import { get, run } from "../db.js";
import { addToSyncQueue } from "./sync.repository.js";
import Company from "../../../common/types/company.js";

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
      createdAt,
      updatedAt,
      serverVersion,
      lastSyncedAt,
      synced,
      isDeleted
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)

    ON CONFLICT(_id)
    DO UPDATE SET
      name = excluded.name,
      legalName=excluded.legalName,
      logoPath = excluded.logoPath,
      address = excluded.address,
      city = excluded.city,
      country = excluded.country,
      phone = excluded.phone,
      email = excluded.email,
      website = excluded.website,
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
      company.legalName,
      company.logoPath ?? null,
      company.address ?? null,
      company.city ?? null,
      company.country ?? null,
      company.phone ?? null,
      company.email ?? null,
      company.website ?? null,
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
   UPSERT COMPANY ID
========================================================= */

/**
 * Used during first-admin login.
 *
 * This establishes the company that this local
 * Electron installation belongs to.
 */
export async function upsertCompanyId(company: Company): Promise<void> {
  console.log("NEW COMPANY TO UPSERT", company);
  const existing = await get<Company>(
    `
    SELECT *
    FROM companies
    WHERE companyId=?
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
        createdAt,
        updatedAt,
        serverVersion,
        lastSyncedAt,
        synced,
        isDeleted
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
        company.createdAt ?? now,
        company.updatedAt ?? now,
        company.serverVersion ?? 0,
        company.lastSyncedAt ?? null,
        1,
        0,
      ]
    );

    return;
  }

  // if (existing.companyId === company.companyId) {
  //   return;
  // }

  // throw new Error(
  //   `This installation is already associated with company ${existing.companyId}`
  // );
}

/* =========================================================
   GET COMPANY
========================================================= */

export async function getCompany(companyId: string): Promise<Company | null> {
  return await get<Company>(
    `
    SELECT *
    FROM companies
    WHERE companyID=? 
    AND isDeleted = 0
    LIMIT 1
    `,
    [companyId]
  );
}

/* =========================================================
   GET COMPANY ID
========================================================= */

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
  await run(
    `
    UPDATE companies
    SET
      name = ?,
      legalName=?,
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
      new Date().toISOString(),
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
