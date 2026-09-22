type PayrollComponent = import(
  "../../../common/types/payroll/PayrollComponent",
  {
    with: { "resolution-mode": "require" },
  }
).default;
type CreatePayrollProfileDto = import(
  "../../../common/types/payroll/PayrollEmployeeProfile",
  {
    with: { "resolution-mode": "require" },
  }
).CreatePayrollProfileDto;
type PayrollEmployeeProfile = import(
  "../../../common/types/payroll/PayrollEmployeeProfile",
  {
    with: { "resolution-mode": "require" },
  }
).default;

import { invoke } from "../../ipc/ipc.cjs";

export const payrollProfileApi = {
  create: (
    companyId: string,
    employeeID: string,
    profile: CreatePayrollProfileDto
  ) => invoke("payrollEmployeeProfiles:create", companyId, employeeID, profile),

  createMany: (companyId: string, employeeId: string, profiles: CreatePayrollProfileDto[]) =>
    invoke("payrollEmployeeProfiles:createMany", companyId, employeeId, profiles),

  update: (companyId: string, profiles: PayrollEmployeeProfile[]) =>
    invoke("payrollEmployeeProfiles:update", companyId, profiles),

  updateMany: (companyId: string, profiles: PayrollEmployeeProfile[]) =>
    invoke("payrollEmployeeProfiles:updateMany", companyId, profiles),

  upsert: (profile: PayrollEmployeeProfile) =>
    invoke("payrollEmployeeProfiles:upsert", profile),

  upsertMany: (profiles: PayrollEmployeeProfile[]) =>
    invoke("payrollEmployeeProfiles:upsertMany", profiles),

  get: (companyId: string, _id: string) =>
    invoke("payrollEmployeeProfiles:get", companyId, _id),

  getAll: (
    companyId: string,
    employeeID?: string,
    type?: "EARNING" | "DEDUCTION"
  ) => invoke("payrollEmployeeProfiles:getAll", companyId, employeeID, type),

  getByEmployee: (companyId: string, employeeId: string) =>
    invoke("payrollEmployeeProfiles:getByEmployee", companyId, employeeId),

  getByComponent: (
    companyId: string,
    employeeId: string,
    componentId: string
  ) =>
    invoke(
      "payrollEmployeeProfiles:getByComponent",
      companyId,
      employeeId,
      componentId
    ),

  getUnsynced: (companyId: string) =>
    invoke("payrollEmployeeProfiles:getUnsynced", companyId),

  markSynced: (companyId: string, _id: string) =>
    invoke("payrollEmployeeProfiles:markSynced", companyId, _id),

  markManySynced: (companyId: string, ids: string[]) =>
    invoke("payrollEmployeeProfiles:markManySynced", companyId, ids),

  delete: (companyId: string, _id: string) =>
    invoke("payrollEmployeeProfiles:delete", companyId, _id),

  restore: (companyId: string, _id: string) =>
    invoke("payrollEmployeeProfiles:restore", companyId, _id),

  permanentlyDelete: (companyId: string, _id: string) =>
    invoke("payrollEmployeeProfiles:permanentlyDelete", companyId, _id),

  exists: (companyId: string, employeeId: string, componentId: string) =>
    invoke(
      "payrollEmployeeProfiles:exists",
      companyId,
      employeeId,
      componentId
    ),

  count: (companyId: string) =>
    invoke("payrollEmployeeProfiles:count", companyId),

  initialize: (companyId: string) =>
    invoke("payrollEmployeeProfiles:initialize", companyId),

  initializeForEmployee: (companyId: string, employeeId: string) =>
    invoke(
      "payrollEmployeeProfiles:initializeForEmployee",
      companyId,
      employeeId
    ),

  addComponentToEmployees: (companyId: string, component: PayrollComponent) =>
    invoke(
      "payrollEmployeeProfiles:addComponentToEmployees",
      companyId,
      component
    ),

  resetToDefaults: (companyId: string, employeeId: string) =>
    invoke("payrollEmployeeProfiles:resetToDefaults", companyId, employeeId),
};
