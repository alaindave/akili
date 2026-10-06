export default interface User {
  _id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "MANAGER" | "ADMIN" | "VIEWER";
  notes: string;
  password?: string;
}
