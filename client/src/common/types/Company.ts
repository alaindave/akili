export default interface Company {
  _id: string;
  companyId: string;
  name: string;
  legalName: string;
  signupCode?: string | null;
  logoPath?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  attendanceClockIn?: string;
  createdAt: string;
  updatedAt: string;
  serverVersion: number;
  lastSyncedAt?: string | null;
  synced: number;
  isDeleted: number;
}
