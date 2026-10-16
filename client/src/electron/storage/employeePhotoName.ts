import type Employee from "../../common/types/hr/employees/Employee.js";

export function employeePhotoName(employee: Pick<Employee, "firstName" | "lastName" | "matricule">, extension: string): string {
  const parts = [employee.firstName, employee.lastName, employee.matricule].map(value => {
    if (typeof value !== "string" || !value.trim()) throw new Error("Employee photo requires first name, last name and matricule");
    return value.normalize("NFC").trim().replace(/[^\p{L}\p{N}_-]+/gu, "_");
  });
  if (!/^\.(jpg|jpeg|png|webp|gif)$/i.test(extension)) throw new Error("Unsupported employee photo extension");
  const name = `${parts.join("_")}${extension.toLowerCase()}`;
  if (Buffer.byteLength(name) > 240) throw new Error("Employee photo filename is too long");
  return name;
}

export function employeePhotoExtension(mimeType?: string | null): string {
  switch (mimeType) {
    case "image/png": return ".png";
    case "image/webp": return ".webp";
    case "image/gif": return ".gif";
    default: return ".jpg";
  }
}
