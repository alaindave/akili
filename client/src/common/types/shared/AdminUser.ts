export default interface AdminUser {
  companyId: string;
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "MANAGER" | "ADMIN" | "VIEWER";
  serverVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  lastSyncedAt?: string;
  synced?: number;
  isDeleted?: number;
}
