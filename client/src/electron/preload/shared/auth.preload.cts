type OfflineUser = import("../../../common/types/OfflineUser", {
  with: { "resolution-mode": "require" },
}).default;
import { invoke } from "../../ipc/ipc.cjs";

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignUpCredentials {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  signUpCode: string;
}

export const authApi = {
  auth: {
    login: (credentials: LoginCredentials) => invoke("auth:login", credentials),

    signup: (credentials: SignUpCredentials) =>
      invoke("auth:signup", credentials),

    logout: () => invoke("auth:logout"),
  },

  offlineUsers: {
    save: (companyId: string, user: OfflineUser) =>
      invoke("offline-users:save", companyId, user),

    saveNotes: (companyId: string, _id: string, notes: string) =>
      invoke("offline-users:saveNotes", companyId, _id, notes),

    login: (credentials: LoginCredentials) =>
      invoke("offline-users:login", credentials),

    getById: (_id: string) =>
      invoke("offline-users:getById", _id),

    getByEmail: (email: string) =>
      invoke("offline-users:getByEmail", email),

    getAll: () => invoke("offline-users:getAll"),

    delete: (_id: string) =>
      invoke("offline-users:delete", _id),
  },
};
