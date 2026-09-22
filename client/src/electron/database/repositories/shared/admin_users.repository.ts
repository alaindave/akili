import AdminUser from "../../../../common/types/AdminUser.js";
import { get, all, run } from "../../db.js";

export async function upsertAdminUser(adminUser: Partial<AdminUser>) {
  console.log("ADMIN USER TO UPSERT:", adminUser);

  try {
    await run(
      `
      INSERT INTO admin_users (
        companyId,
        _id,
        firstName,
        lastName,
        email,
        role,
        serverVersion,
        updatedAt,
        lastSyncedAt,
        isDeleted

      )
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(_id)
      DO UPDATE SET
        firstName = excluded.firstName,
        lastName = excluded.lastName,
        email= excluded.email,
        role = excluded.role,
        serverVersion = excluded.serverVersion,
        updatedAt = excluded.updatedAt,
        isDeleted=excluded.isDeleted

      `,
      [
        adminUser.companyId,
        adminUser._id,
        adminUser.firstName,
        adminUser.lastName,
        adminUser.email,
        adminUser.role,
        adminUser.serverVersion,
        adminUser.updatedAt ?? new Date().toISOString(),
        new Date().toISOString(),
        adminUser.isDeleted,
      ]
    );
  } catch (error) {
    console.error("AN ERROR OCCURED DURING ADMIN USERS UPSERT:", error);
  }
}

export async function getAllAdminUsers(
  companyId: string
): Promise<AdminUser[] | null> {
  return all(
    `
      SELECT *
      FROM admin_users
      WHERE companyId=?
      ORDER BY lastName ASC
    `,
    [companyId]
  );
}

export async function getAdminUsersById(
  companyId: string,
  _id: string
): Promise<AdminUser | null> {
  return get(
    ` 
      SELECT *
      FROM admin_users
      WHERE companyId  = ?
        AND _id=?
    
    `,
    [companyId, _id]
  );
}
