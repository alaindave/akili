export interface Company {
  _id: string;
  companyId: string;
  inventoryInitialized?: boolean;
  inventoryInitializedAt?: string | null;
  inventoryInitializationDocumentId?: string | null;
  inventoryInitializationDocumentNumber?: string | null;
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  logo: string | null;
  currency: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
}
