export type Role = "MANAGER" | "ADMIN" | "VIEWER";

export interface JwtPayload {
  _id: string;
  email: string;
  role: string;
  companyId: string;
}
