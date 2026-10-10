import PayrollRun from "../models/modules/hr/payrollRun.model.js";

// Install the replacement before dropping the old global constraint. Duplicate
// active runs stop the migration rather than deleting financial records.
export async function migratePayrollIndex() {
  await PayrollRun.collection.createIndex(
    { companyId: 1, month: 1, year: 1 },
    {
      name: "payroll_company_period_active",
      unique: true,
      partialFilterExpression: {
        isDeleted: 0,
        status: { $in: ["BROUILLON", "VERIFICATION", "APPROUVÉ", "PAYÉ"] },
      },
    }
  );
  const indexes = await PayrollRun.collection.indexes();
  for (const index of indexes) {
    if (
      index.unique &&
      Object.keys(index.key).length === 2 &&
      index.key.month === 1 &&
      index.key.year === 1 &&
      index.name
    ) {
      await PayrollRun.collection.dropIndex(index.name);
    }
  }
}
