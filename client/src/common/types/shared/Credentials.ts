export interface LoginCredentials {
  companyId?: string;
  email: string;
  password: string;
}

export interface SignUpCredentials {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  signUpCode: string;
}

export type CompanySetupCredentials = Pick<SignUpCredentials, "email" | "password" | "signUpCode">;

export interface CompanySetupResult {
  admin: Omit<import("./OfflineUser.js").default, "password">;
  company: Pick<import("./Company.js").default, "companyId" | "name">;
}
