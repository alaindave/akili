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
