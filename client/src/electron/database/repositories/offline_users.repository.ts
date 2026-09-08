import type OfflineUser from "../../../common/types/OfflineUser.js";
import { get, all, run } from "../db.js";
import { addToSyncQueue } from "./sync.repository.js";

/**
 * Create or update an offline user for a specific company.
 */
export async function createOrUpdateOfflineUser(user: OfflineUser) {
  console.log("OFFLINE USER TO CREATE OR UPDATE: ", user);

  await run(
    `
    INSERT INTO offline_users (
      companyId,
      _id,
      email,
      password,
      role,
      firstName,
      lastName,
      notes,
      lastVerifiedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)

    ON CONFLICT(email)
    DO UPDATE SET
      password = excluded.password,
      role = excluded.role,
      firstName = excluded.firstName,
      lastName = excluded.lastName,
      notes = excluded.notes,
      updatedAt = CURRENT_TIMESTAMP,
      lastVerifiedAt = excluded.lastVerifiedAt
    `,
    [
      user.companyId,
      user._id,
      user.email,
      user.password,
      user.role,
      user.firstName,
      user.lastName,
      user.notes,
      user.lastVerifiedAt,
    ]
  );

  return getOfflineUserByEmail(user.companyId, user.email);
}

/**
 * Get an offline user by ID for a specific company.
 */
export async function getOfflineUserById(
  companyId: string,
  _id: string
): Promise<OfflineUser | undefined | null> {
  return get<OfflineUser>(
    `
    SELECT *
    FROM offline_users
    WHERE _id = ?
      AND companyId = ?
    `,
    [_id, companyId]
  );
}

/**
 * Get an offline user by email for a specific company.
 */
export async function getOfflineUserByEmail(
  companyId: string,
  email: string
): Promise<OfflineUser | undefined | null> {
  return get<OfflineUser>(
    `
    SELECT *
    FROM offline_users
    WHERE email = ?
      AND companyId = ?
    `,
    [email, companyId]
  );
}

/**
 * Update notes for an offline user.
 */
export async function saveNotes(companyId: string, _id: string, notes: string) {
  const time = new Date().toISOString();

  await run(
    `
    UPDATE offline_users
    SET
      notes = ?,
      updatedAt = datetime('now')
    WHERE _id = ?
      AND companyId = ?
    `,
    [notes, _id, companyId]
  );

  const savedNotes = {
    companyId,
    _id,
    notes,
    createdAt: time,
    updatedAt: time,
  };

  console.log("Notes to save to sync queue", savedNotes);

  await addToSyncQueue({
    companyId,
    entity: "user_notes",
    entityId: _id,
    operation: "update",
    payload: JSON.stringify(savedNotes),
  });

  return getOfflineUserById(companyId, _id);
}

/**
 * Get all offline users for a specific company.
 */
export async function getAllOfflineUsers(
  companyId: string
): Promise<OfflineUser[]> {
  return all<OfflineUser>(
    `
    SELECT *
    FROM offline_users
    WHERE companyId = ?
    ORDER BY firstName ASC
    `,
    [companyId]
  );
}

/**
 * Update the last verification timestamp.
 */
export async function updateLastVerifiedAt(companyId: string, _id: string) {
  await run(
    `
    UPDATE offline_users
    SET
      lastVerifiedAt = datetime('now'),
      updatedAt = datetime('now')
    WHERE _id = ?
      AND companyId = ?
    `,
    [_id, companyId]
  );

  return getOfflineUserById(companyId, _id);
}

/**
 * Delete an offline user for a specific company.
 */
export async function deleteOfflineUser(companyId: string, _id: string) {
  await run(
    `
    DELETE FROM offline_users
    WHERE _id = ?
      AND companyId = ?
    `,
    [_id, companyId]
  );

  return true;
}
