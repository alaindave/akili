import PayrollProfile from "../models/modules/hr/payrollEmployeeProfile.model.js";

export async function migratePayrollProfileIndex() {
  // Install the replacement first; duplicate active records abort safely.
  await PayrollProfile.collection.createIndex(
    { companyId: 1, employeeId: 1, componentId: 1 },
    { unique: true, partialFilterExpression: { isDeleted: 0 } }
  );
  for (const index of await PayrollProfile.collection.indexes()) {
    if (index.unique && index.name && Object.keys(index.key).length === 2 &&
        index.key.employeeId === 1 && index.key.componentId === 1) {
      await PayrollProfile.collection.dropIndex(index.name);
    }
  }
}
