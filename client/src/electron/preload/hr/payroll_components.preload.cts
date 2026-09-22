type CreatePayrollComponentDto = import(
  "../../../common/types/payroll/PayrollComponent",
  {
    with: { "resolution-mode": "require" },
  }
).CreatePayrollComponentDto;
type PayrollComponent = import(
  "../../../common/types/payroll/PayrollComponent",
  {
    with: { "resolution-mode": "require" },
  }
).default;
import { invoke } from "../../ipc/ipc.cjs";

export const payrollComponentsApi = {
  create: (companyId: string, component: CreatePayrollComponentDto) =>
    invoke("payroll-components:create", companyId, component),

  getAll: (companyId: string, type?: "EARNING" | "DEDUCTION") =>
    invoke("payroll-components:getAll", companyId, type),

  getEnabled: (companyId: string, type?: "EARNING" | "DEDUCTION") =>
    invoke("payroll-components:getEnabled", companyId, type),

  getById: (companyId: string, id: string) =>
    invoke("payroll-components:getById", companyId, id),

  update: (companyId: string, components: PayrollComponent[]) =>
    invoke("payroll-components:update", companyId, components),

  delete: (companyId: string, id: string) =>
    invoke("payroll-components:delete", companyId, id),

  enable: (companyId: string, id: string) =>
    invoke("payroll-components:enable", companyId, id),

  disable: (companyId: string, id: string) =>
    invoke("payroll-components:disable", companyId, id),

  upsert: (companyId: string, component: PayrollComponent) =>
    invoke("payroll-components:upsert", companyId, component),

  getUnsynced: (companyId: string) =>
    invoke("payroll-components:getUnsynced", companyId),

  markSynced: (companyId: string, id: string) =>
    invoke("payroll-components:markSynced", companyId, id),
};
