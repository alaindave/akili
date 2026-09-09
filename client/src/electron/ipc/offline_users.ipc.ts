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
import OfflineUser from "../../common/types/OfflineUser.js";

export function registerOfflineUsersIPC() {
  console.log("REGISTERING OFFLINE USERS IPC");

  /**
   * Create or update an offline user.
   */
  ipcMain.handle(
    "offline-users:save",
    async (_, companyId: string, user: OfflineUser) => {
      try {
        console.log("OFFLINE USER:", user);
        if (!user.password) {
          throw new Error("Password missing");
        }

        const password = await bcrypt.hash(user.password, 12);

        const offline_user = await createOrUpdateOfflineUser({
          companyId,
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
    }
  );

  /**
   * Offline login.
   */
  ipcMain.handle(
    "offline-users:login",
    async (
      _,
      credentials: {
        email: string;
        password: string;
      }
    ) => {
      const user = await getOfflineUserByEmail(credentials.email);

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
  ipcMain.handle("offline-users:getById", async (_, _id: string) => {
    return await getOfflineUserById(_id);
  });

  /**
   * Get offline user by email.
   */
  ipcMain.handle("offline-users:getByEmail", async (_, email: string) => {
    return await getOfflineUserByEmail(email);
  });

  /**
   * Get all offline users for a company.
   */
  ipcMain.handle("offline-users:getAll", async () => {
    return await getAllOfflineUsers();
  });

  /**
   * Delete offline user.
   */
  ipcMain.handle("offline-users:delete", async (_, _id: string) => {
    await deleteOfflineUser(_id);

    return true;
  });
}
