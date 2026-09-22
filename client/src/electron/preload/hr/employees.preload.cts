type Employee = import("../../../common/types/Employee", {
  with: { "resolution-mode": "require" },
}).default;
import { invoke } from "../../ipc/ipc.cjs";

export const employeeApi = {
  create: (companyId: string, employee: Partial<Employee>) =>
    invoke("employees:create", companyId, employee),

  uploadPhoto: (
    companyId: string,
    employeeId: string,
    file: {
      name: string;
      buffer: ArrayBuffer;
    }
  ) =>
    invoke("employees:uploadPhoto", companyId, employeeId, {
      name: file.name,
      buffer: Buffer.from(file.buffer),
    }),

  getPhotoUrl: (relativePath: string) => invoke("photos:getUrl", relativePath),

  getAll: (companyId: string): Promise<Employee[]> => invoke("employees:getAll", companyId),

  getById: (companyId: string, employeeId: string) =>
    invoke("employees:getById", companyId, employeeId),

  update: (
    companyId: string,
    employeeId: string,
    updates: Partial<Employee>
  ) => invoke("employees:update", companyId, employeeId, updates),

  delete: (companyId: string, employeeId: string) =>
    invoke("employees:delete", companyId, employeeId),

  search: (companyId: string, searchTerm: string) =>
    invoke("employees:search", companyId, searchTerm),
};

