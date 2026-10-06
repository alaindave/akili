export interface InventoryBase {
  _id: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  serverVersion: number;
  synced: boolean;
  isDeleted: boolean;
}
