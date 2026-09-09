import {
  PayrollCalculationType,
  PayrollComponentType,
} from "./PayrollComponent.js";

export default interface PayrollEmployeeProfile {
  companyId: string;
  _id?: string;
  employeeId: string;
  componentId: string;
  name: string;
  displayName: string;
  displayOrder: number;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  calculationBase?:
    | "BASE_SALARY"
    | "GROSS_SALARY"
    | "TAXABLE_SALARY"
    | "TOTAL_EARNINGS"
    | "TOTAL_DEDUCTIONS"
    | "NET_SALARY";
  value: number | null;
  taxable?: number;
  isOverridden?: number;
  requiresHRApproval?: number;
  enabled?: number;
  serverVersion: number;
  synced?: number;
  createdAt?: string;
  updatedAt?: string;
  lastSyncedAt?: string | null;
  isDeleted?: number;
}

export interface CreatePayrollProfileDto {
  companyId: string;
  name: string;
  displayName: string;
  displayOrder?: number;
  componentId?: string;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  value: number | null;
  calculationBase?:
    | "BASE_SALARY"
    | "GROSS_SALARY"
    | "TAXABLE_SALARY"
    | "TOTAL_EARNINGS"
    | "TOTAL_DEDUCTIONS"
    | "NET_SALARY"
    | null;
  taxable?: number;
  requiresHRApproval?: number | null;
  enabled?: number;
}
