import { ipcMain } from "electron";
import bcrypt from "bcrypt";

import {
  createOrUpdateOfflineUser,
  saveNotes,
  getOfflineUserByEmail,
  getOfflineUserById,
  getAllOfflineUsers,
  deleteOfflineUser,
} from "../database/repositories/offline_users.repository.js";
import User from "../../common/types/User.js";

export function registerOfflineUsersIPC() {
  console.log("REGISTERING OFFLINE USERS IPC");

  /**
   * Create or update an offline user.
   */
  ipcMain.handle("offline-users:save", async (_, user: User) => {
    try {
      console.log("OFFLINE USER", user);
      if (!user.password) {
        throw new Error("Password missing");
      }

      const password = await bcrypt.hash(user.password, 12);

      const offline_user = await createOrUpdateOfflineUser({
        companyId: user.companyId,
        _id: user._id,
        email: user.email,
        password,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        notes: user.notes,
        lastVerifiedAt: new Date().toISOString(),
      });

      console.log("OFFLINE USER UPDATED:", offline_user);

      return offline_user;
    } catch (error) {
      console.error("offline-users:save failed", error);
      throw error;
    }
  });

  /**
   * Offline login.
   */
  ipcMain.handle(
    "offline-users:login",
    async (
      _,
      companyId: string,
      credentials: {
        email: string;
        password: string;
      }
    ) => {
      const user = await getOfflineUserByEmail(companyId, credentials.email);

      if (!user) {
        throw new Error("No offline account found.");
      }

      const valid = await bcrypt.compare(credentials.password, user.password);

      if (!valid) {
        throw new Error("Invalid credentials.");
      }

      return user;
    }
  );

  /**
   * Save user notes.
   */
  ipcMain.handle(
    "offline-users:saveNotes",
    async (_, companyId: string, _id: string, notes: string) => {
      return await saveNotes(companyId, _id, notes);
    }
  );

  /**
   * Get offline user by ID.
   */
  ipcMain.handle(
    "offline-users:getById",
    async (_, companyId: string, _id: string) => {
      return await getOfflineUserById(companyId, _id);
    }
  );

  /**
   * Get offline user by email.
   */
  ipcMain.handle(
    "offline-users:getByEmail",
    async (_, companyId: string, email: string) => {
      return await getOfflineUserByEmail(companyId, email);
    }
  );

  /**
   * Get all offline users for a company.
   */
  ipcMain.handle("offline-users:getAll", async (_, companyId: string) => {
    return await getAllOfflineUsers(companyId);
  });

  /**
   * Delete offline user.
   */
  ipcMain.handle(
    "offline-users:delete",
    async (_, companyId: string, _id: string) => {
      await deleteOfflineUser(companyId, _id);

      return true;
    }
  );
}
