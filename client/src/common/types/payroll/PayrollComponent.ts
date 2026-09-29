export type PayrollComponentType = "EARNING" | "DEDUCTION";

export type PayrollCalculationType =
  | "FIXE"
  | "POURCENTAGE_BASE"
  | "POURCENTAGE_BRUT"
  | "POURCENTAGE_IMPOSABLE"
  | "MANUEL"
  | "QUANTITE_TAUX"
  | "FORMULE_IPR"
  | "FORMULE_INSS"
  | "FORMULE_ABSENCE"
  | "FORMULE_RETARD";

export interface CreatePayrollComponentDto {
  companyId: string;
  name: string;
  displayName: string;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  displayOrder: number;
  defaultValue: number;
  requiresHRApproval?: number;
  taxable?: number;
}

export default interface PayrollComponent {
  companyId: string;
  _id: string;
  name: string;
  displayName: string;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  defaultValue?: number | null;
  taxable?: number;
  displayOrder: number;
  requiresHRApproval?: number;
  enabled: number;
  isSystem: number;
  serverVersion: number;
  synced: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  isDeleted: number;
}
