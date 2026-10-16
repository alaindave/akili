type OfflineUser = import("../../../common/types/shared/OfflineUser", {
  with: { "resolution-mode": "require" },
}).default;
type LoginCredentials = import("../../../common/types/shared/Credentials", {
  with: { "resolution-mode": "require" },
}).LoginCredentials;
type SignUpCredentials = import("../../../common/types/shared/Credentials", {
  with: { "resolution-mode": "require" },
}).SignUpCredentials;
type CompanySetupCredentials = import("../../../common/types/shared/Credentials", {
  with: { "resolution-mode": "require" },
}).CompanySetupCredentials;
type CompanySetupResult = import("../../../common/types/shared/Credentials", {
  with: { "resolution-mode": "require" },
}).CompanySetupResult;
import { invoke } from "../../ipc/ipc.cjs";



export const authApi = {
  auth: {
    login: (credentials: LoginCredentials) => invoke("auth:login", credentials),

    signup: (credentials: SignUpCredentials) =>
      invoke("auth:signup", credentials),

    setupCompany: (credentials: CompanySetupCredentials) =>
      invoke<CompanySetupResult>("auth:setup-company", credentials),

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
