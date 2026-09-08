import "dotenv/config";

import { randomInt, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

import Company from "../models/company.model.js";
import Role from "../models/role.model.js";
import AdminUser from "../models/adminUser.model.js";
import { defaultRoles } from "../permissions/defaultRole.js";
import { createDefaultPayrollComponents } from "../utils/createDefaultPayrollComponent.js";
import { getNextSyncVersion } from "../utils/syncVersion.js";

interface CreateCompanyInput {
  companyName: string;
  companyLegalName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
}

interface CreateCompanyResult {
  company: any;
  adminUser: any;
  roles: any[];
}

function generateSignUpCode(): string {
  const numbers = randomInt(100000, 1000000);

  return `AKL-${numbers}`;
}

function getDuplicateKeyInfo(error: unknown) {
  if (!(error instanceof Error) || !("code" in error)) {
    return null;
  }

  const mongoError = error as {
    code?: number;
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
    message?: string;
  };

  if (mongoError.code !== 11000) {
    return null;
  }

  return {
    keyPattern: mongoError.keyPattern,
    keyValue: mongoError.keyValue,
    message: mongoError.message,
  };
}

export async function createCompany(
  input: CreateCompanyInput
): Promise<CreateCompanyResult> {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const session = await mongoose.startSession();

    try {
      let result: CreateCompanyResult | undefined;

      try {
        await session.withTransaction(async () => {
          const _id = randomUUID();
          const now = new Date();
          const signUpCode = generateSignUpCode();

          // ==========================================
          // Get sync versions
          // ==========================================

          const companyServerVersion = await getNextSyncVersion("company");

          const adminUserServerVersion = await getNextSyncVersion("admin_user");

          // ==========================================
          // Create company
          // ==========================================

          const company = await Company.create(
            [
              {
                _id,
                companyId: _id,
                name: input.companyName.trim(),
                legalName: input.companyLegalName,
                address: input.address,
                city: input.city,
                country: input.country,
                phone: input.phone,
                email: input.email,
                signUpCode,
                serverVersion: companyServerVersion,
                createdAt: now,
                updatedAt: now,
                isDeleted: 0,
              },
            ],
            { session }
          );

          // ==========================================
          // Create default roles
          // ==========================================

          const roles = [];

          for (const defaultRole of defaultRoles) {
            const role = await Role.create(
              [
                {
                  _id: randomUUID(),
                  companyId: _id,
                  name: defaultRole.name,
                  permissions: defaultRole.permissions,
                  createdAt: now,
                  updatedAt: now,
                  isDeleted: 0,
                },
              ],
              { session }
            );

            roles.push(role[0]);
          }

          const adminRole = roles.find((role) => role.name === "ADMIN");

          if (!adminRole) {
            throw new Error("Default ADMIN role was not created");
          }

          // ==========================================
          // Create default payroll components
          // ==========================================

          await createDefaultPayrollComponents(_id, now, session);

          // ==========================================
          // Create admin user
          // ==========================================

          const passwordHash = await bcrypt.hash(input.adminPassword, 12);

          const adminUser = await AdminUser.create(
            [
              {
                _id: randomUUID(),
                companyId: _id,
                firstName: input.adminFirstName.trim(),
                lastName: input.adminLastName.trim(),
                email: input.adminEmail.toLowerCase().trim(),
                passwordHash,
                role: adminRole.name,
                serverVersion: adminUserServerVersion,
                createdAt: now,
                updatedAt: now,
                isDeleted: 0,
              },
            ],
            { session }
          );

          // ==========================================
          // Transaction result
          // ==========================================

          result = {
            company: company[0],
            adminUser: adminUser[0],
            roles,
          };
        });
      } catch (error) {
        const duplicate = getDuplicateKeyInfo(error);

        console.error("DUPLICATE KEY ERROR:", duplicate);

        if (
          duplicate?.keyPattern &&
          "signUpCode" in duplicate.keyPattern &&
          attempt < maxAttempts
        ) {
          console.warn(
            `Signup code collision detected. Retrying (${attempt}/${maxAttempts})...`
          );

          continue;
        }

        throw error;
      }

      if (!result) {
        throw new Error("Company creation failed");
      }

      console.log("COMPANY CREATED SUCCESSFULLY.");

      console.log("COMPANY SIGN UP CODE:", result.company.signUpCode);

      console.log("COMPANY SERVER VERSION:", result.company.serverVersion);

      console.log("ADMIN USER SERVER VERSION:", result.adminUser.serverVersion);

      return result;
    } finally {
      await session.endSession();
    }
  }

  throw new Error(
    `Failed to generate a unique company signup code after ${maxAttempts} attempts`
  );
}
