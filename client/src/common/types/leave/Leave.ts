export default interface Leave {
  companyId: string;
  managerEmail: string;
  _id: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  submittedAt: string;
  submittedMonth: string;
  startDate: string;
  endDate: string;
  subject: string;
  notes: string;
  status: "ATTENTE_APPROBATION" | "APPROUVÉ" | "REFUSÉ" | "ANNULÉ";
  serverVersion: number;
  createdAt?: string;
  updatedAt?: string;
  lastSyncedAt?: string;
  synced: number;
  isDeleted: number;
}
