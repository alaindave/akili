import { randomUUID } from "crypto";
import type mongoose from "mongoose";

import PayrollComponent from "../models/payrollComponent.model.js";
import { defaultPayrollComponents } from "../seeds/payroll-component.seed.js";

export async function createDefaultPayrollComponents(
  companyId: string,
  now: Date,
  session: mongoose.ClientSession
) {
  const components = [];

  for (const defaultComponent of defaultPayrollComponents) {
    const existingComponent = await PayrollComponent.findOne({
      companyId,
      name: defaultComponent.name,
    }).session(session);

    if (existingComponent) {
      components.push(existingComponent);

      console.log(
        `PAYROLL COMPONENT ALREADY EXISTS: ${defaultComponent.name} ` +
          `FOR COMPANY ${companyId}`
      );

      continue;
    }

    const [component] = await PayrollComponent.create(
      [
        {
          _id: randomUUID(),
          companyId,
          name: defaultComponent.name,
          displayName: defaultComponent.displayName,
          displayOrder: defaultComponent.displayOrder,
          type: defaultComponent.type,
          calculationType: defaultComponent.calculationType,
          calculationBase: defaultComponent.calculationBase,
          defaultValue: defaultComponent.defaultValue,
          taxable: defaultComponent.taxable,
          enabled: defaultComponent.enabled ?? 1,
          isSystem: defaultComponent.isSystem ?? 1,
          requiresHRApproval: defaultComponent.requiresHRApproval ?? 0,
          createdAt: now,
          updatedAt: now,
          serverVersion: 0,
          isDeleted: 0,
        },
      ],
      { session }
    );

    components.push(component);

    console.log(
      `CREATED PAYROLL COMPONENT: ${defaultComponent.name} ` +
        `FOR COMPANY ${companyId}`
    );
  }

  console.log(
    `DEFAULT PAYROLL COMPONENTS READY: ${components.length} ` +
      `FOR COMPANY ${companyId}`
  );

  return components;
}
