export default interface OfflineUser {
  companyId: string;
  _id: string;
  email: string;
  password: string;
  role: "ADMIN" | "MANAGER" | "VIEWER";
  firstName: string;
  lastName: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  lastVerifiedAt?: string;
}
