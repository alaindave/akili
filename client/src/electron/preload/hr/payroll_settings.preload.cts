import { invoke } from "../../ipc/ipc.cjs";

export const payrollSettingsApi = {
  get: (companyId: string) => invoke("payroll-settings:get", companyId),

  getById: (companyId: string, _id: string) =>
    invoke("payroll-settings:getById", companyId, _id),

  create: (
    companyId: string,
    data: {
      currency: string;
      workingDays: number;
      workingHours: number;
      paymentDay: number;
    }
  ) => invoke("payroll-settings:create", companyId, data),

  update: (
    companyId: string,
    settings: {
      _id: string;
      currency: string;
      workingDays: number;
      workingHours: number;
      paymentDay: number;
      synced: number;
      createdAt: string;
      updatedAt: string;
      lastSyncedAt?: string;
      isDeleted: number;
    }
  ) => invoke("payroll-settings:update", companyId, settings),

  updateFields: (
    companyId: string,
    _id: string,
    fields: {
      currency?: string;
      workingDays?: number;
      workingHours?: number;
      paymentDay?: number;
    }
  ) => invoke("payroll-settings:updateFields", companyId, _id, fields),

  delete: (companyId: string, _id: string) =>
    invoke("payroll-settings:delete", companyId, _id),

  restore: (companyId: string, _id: string) =>
    invoke("payroll-settings:restore", companyId, _id),

  markSynced: (companyId: string, _id: string) =>
    invoke("payroll-settings:markSynced", companyId, _id),

  getUnsynced: (companyId: string) =>
    invoke("payroll-settings:getUnsynced", companyId),
};
