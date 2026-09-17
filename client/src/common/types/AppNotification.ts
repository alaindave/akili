export type AppNotificationType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "REMINDER";

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: AppNotificationType;
  createdAt: string;
  remindAt?: string;
}
