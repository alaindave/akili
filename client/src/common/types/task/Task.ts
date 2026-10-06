import AdminUser from "../shared/AdminUser.js";
import PopulatedTaskComment from "./PopulatedTaskComment.js";
import User from "../shared/User.js";

export type Priority = "HAUTE" | "MOYENNE" | "BASSE";

export type AppModule =
  | "HR"
  | "INVENTORY"
  | "PROCUREMENT"
  | "PRODUCTION"
  | "SALES"
  | "ACCOUNTING";

export default interface Task {
  companyId: string;
  module: AppModule;
  _id: string;
  taskNumber?: string;
  author: Omit<User, "password" | "notes">;
  recipients: AdminUser[];
  subject: string;
  message: string;
  comments?: PopulatedTaskComment[];
  priority: Priority;
  deadline: string;
  serverVersion?: number;
  isResolved?: number;
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  lastSyncedAt?: string;
  synced?: number;
  isDeleted?: number;
}
