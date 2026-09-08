import { run } from "../db.js";

export async function createPayrollTables() {
  /* =========================================================
     PAYROLL SETTINGS
  ========================================================= */

  await run(`
    CREATE TABLE IF NOT EXISTS payroll_settings (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      currency TEXT NOT NULL,
      workingDays REAL NOT NULL DEFAULT 25,
      workingHours REAL NOT NULL DEFAULT 8,
      paymentDay INTEGER NOT NULL DEFAULT 30,
      synced INTEGER NOT NULL DEFAULT 0,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastSyncedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      isDeleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  /* =========================================================
     PAYROLL COMPONENTS
  ========================================================= */

  await run(`
    CREATE TABLE IF NOT EXISTS payroll_components (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      displayName TEXT NOT NULL,
      type TEXT NOT NULL
        CHECK(type IN ('EARNING','DEDUCTION')),
      calculationType TEXT NOT NULL
        CHECK(
          calculationType IN (
            'FIXE',
            'MANUEL',
            'POURCENTAGE_BASE',
            'POURCENTAGE_BRUT',
            'POURCENTAGE_IMPOSABLE',
            'FORMULE_IPR',
            'FORMULE_ABSENCE',
            'FORMULE_RETARD'
          )
        )
        DEFAULT 'MANUEL',
      calculationBase TEXT
        CHECK(
          calculationBase IN (
            'BASE_SALARY',
            'GROSS_SALARY',
            'TOTAL_EARNINGS',
            'TAXABLE_SALARY'
          )
        ),
      defaultValue REAL DEFAULT 0,
      displayOrder INTEGER NOT NULL,
      isSystem INTEGER NOT NULL DEFAULT 1,
      requiresHRApproval INTEGER NOT NULL DEFAULT 0,
      taxable INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      lastSyncedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      isDeleted INTEGER NOT NULL DEFAULT 0

    );
  `);

  /* =========================================================
     EMPLOYEE PAYROLL PROFILES
  ========================================================= */

  await run(`
    CREATE TABLE IF NOT EXISTS payroll_employee_profiles (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      componentId TEXT,
      name TEXT NOT NULL,
      displayName TEXT NOT NULL,
      displayOrder INTEGER NOT NULL,
      type TEXT NOT NULL,
      calculationType TEXT NOT NULL
        CHECK(
          calculationType IN (
            'FIXE',
            'MANUEL',
            'POURCENTAGE_BASE',
            'POURCENTAGE_BRUT',
            'POURCENTAGE_IMPOSABLE',
            'FORMULE_IPR',
            'FORMULE_ABSENCE',
            'FORMULE_RETARD'
          )
        )
        DEFAULT 'MANUEL',
      value REAL,
      taxable INTEGER NOT NULL DEFAULT 1,
      isOverridden INTEGER NOT NULL DEFAULT 0,
      requiresHRApproval INTEGER NOT NULL DEFAULT 0,
      calculationBase TEXT
        CHECK(
          calculationBase IN (
            'BASE_SALARY',
            'GROSS_SALARY',
            'TOTAL_EARNINGS',
            'TAXABLE_SALARY'
          )
        ),
      enabled INTEGER NOT NULL DEFAULT 1,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastSyncedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER NOT NULL DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0,

      FOREIGN KEY(employeeId)
        REFERENCES employees(_id)
        ON DELETE CASCADE,

      FOREIGN KEY(componentId)
        REFERENCES payroll_components(_id)
        ON DELETE CASCADE
    );
  `);

  /* =========================================================
     PAYROLL RUNS
  ========================================================= */

  await run(`
    CREATE TABLE IF NOT EXISTS payroll_runs (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      employeeCount INTEGER NOT NULL DEFAULT 0,
      totalBasicSalary REAL NOT NULL DEFAULT 0,
      totalEarnings REAL NOT NULL DEFAULT 0,
      totalDeductions REAL NOT NULL DEFAULT 0,
      totalNetSalary REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL
        CHECK(
          status IN (
            'BROUILLON',
            'VERIFICATION',
            'APPROUVÉ',
            'PAYÉ',
            'ANNULÉ'
          )
        )
        DEFAULT 'BROUILLON',
      generatedBy TEXT NOT NULL,
      submittedForVerificationAt TEXT,
      submittedForVerificationBy TEXT,
      approvedAt TEXT,
      approvedBy TEXT,
      paidAt TEXT,
      paidBy TEXT,
      cancelledAt TEXT,
      cancelledBy TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0,
      deletedBy TEXT,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastSyncedAt DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY(generatedBy)
        REFERENCES admin_users(_id)
        ON DELETE RESTRICT,

      FOREIGN KEY(submittedForVerificationBy)
        REFERENCES admin_users(_id)
        ON DELETE RESTRICT,

      FOREIGN KEY(approvedBy)
        REFERENCES admin_users(_id)
        ON DELETE RESTRICT,

      FOREIGN KEY(paidBy)
        REFERENCES admin_users(_id)
        ON DELETE RESTRICT,

      FOREIGN KEY(cancelledBy)
        REFERENCES admin_users(_id)
        ON DELETE RESTRICT,

      FOREIGN KEY(deletedBy)
        REFERENCES admin_users(_id)
        ON DELETE RESTRICT
    );
  `);

  /* =========================================================
     PAYROLL RESULTS
  ========================================================= */

  await run(`
    CREATE TABLE IF NOT EXISTS payroll_results (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      payrollRunId TEXT NOT NULL,
      employeeId TEXT NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      baseSalary REAL NOT NULL DEFAULT 0,
      grossSalary REAL NOT NULL DEFAULT 0,
      totalEarnings REAL NOT NULL DEFAULT 0,
      totalDeductions REAL NOT NULL DEFAULT 0,
      netSalary REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL
        CHECK(
          status IN (
            'BROUILLON',
            'VERIFICATION',
            'APPROUVÉ',
            'PAYÉ',
            'ANNULÉ'
          )
        )
        DEFAULT 'BROUILLON',
      cancelledAt TEXT,
      verifiedAt TEXT,
      approvedAt TEXT,
      paidAt TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastSyncedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      isDeleted INTEGER NOT NULL DEFAULT 0,

      FOREIGN KEY(payrollRunId)
        REFERENCES payroll_runs(_id)
        ON DELETE CASCADE,

      FOREIGN KEY(employeeId)
        REFERENCES employees(_id)
    );
  `);

  /* =========================================================
     PAYROLL ITEMS
  ========================================================= */

  await run(`
    CREATE TABLE IF NOT EXISTS payroll_items (
      companyId TEXT NOT NULL,
      _id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      payrollResultId TEXT NOT NULL,
      componentId TEXT NOT NULL,
      name TEXT NOT NULL,
      displayName TEXT NOT NULL,
      type TEXT NOT NULL
        CHECK(type IN ('EARNING','DEDUCTION')),
      amount REAL NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      serverVersion INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastSyncedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      isDeleted INTEGER NOT NULL DEFAULT 0,

      FOREIGN KEY(employeeId)
        REFERENCES employees(_id),

      FOREIGN KEY(payrollResultId)
        REFERENCES payroll_results(_id)
        ON DELETE CASCADE,

      FOREIGN KEY(componentId)
        REFERENCES payroll_components(_id)
    );
  `);

  /* =========================================================
     INDEXES
  ========================================================= */

  /* ---------------------------------------------------------
     PAYROLL SETTINGS
  --------------------------------------------------------- */

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_settings_company_synced
      ON payroll_settings(companyId, synced);
  `);

  /* ---------------------------------------------------------
     PAYROLL COMPONENTS
  --------------------------------------------------------- */

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_components_company_type
      ON payroll_components(companyId, type);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_components_company_synced
      ON payroll_components(companyId, synced);
  `);

  /*
   * Prevent duplicate component names inside the same company.
   */
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_components_company_name
      ON payroll_components(companyId, name)
      WHERE isDeleted = 0;
  `);

  /* ---------------------------------------------------------
     EMPLOYEE PAYROLL PROFILES
  --------------------------------------------------------- */

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_profile_company_employee_component
      ON payroll_employee_profiles(
        companyId,
        employeeId,
        componentId
      )
      WHERE isDeleted = 0;
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_profile_company_employee
      ON payroll_employee_profiles(
        companyId,
        employeeId
      );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_profile_company_synced
      ON payroll_employee_profiles(
        companyId,
        synced
      );
  `);

  /* ---------------------------------------------------------
     PAYROLL RUNS
  --------------------------------------------------------- */

  /*
   * Only ONE active payroll run for a company/month/year.
   *
   * ANNULÉ runs are excluded, meaning a cancelled payroll
   * can be regenerated for the same period.
   */
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_company_period
      ON payroll_runs(
        companyId,
        month,
        year
      )
      WHERE isDeleted = 0
        AND status <> 'ANNULÉ';
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_company_synced
      ON payroll_runs(
        companyId,
        synced
      );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_company_status
      ON payroll_runs(
        companyId,
        status
      );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_company_period_lookup
      ON payroll_runs(
        companyId,
        year,
        month
      );
  `);

  /* ---------------------------------------------------------
     PAYROLL RESULTS
  --------------------------------------------------------- */

  /*
   * One active payroll result per employee,
   * per company, per payroll period.
   */
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_result_company_employee_period
      ON payroll_results(
        companyId,
        employeeId,
        month,
        year
      )
      WHERE isDeleted = 0
        AND status <> 'ANNULÉ';
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_results_company_run
      ON payroll_results(
        companyId,
        payrollRunId
      );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_results_company_employee
      ON payroll_results(
        companyId,
        employeeId
      );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_results_company_synced
      ON payroll_results(
        companyId,
        synced
      );
  `);

  /* ---------------------------------------------------------
     PAYROLL ITEMS
  --------------------------------------------------------- */

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_items_company_payroll
      ON payroll_items(
        companyId,
        payrollResultId
      );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_items_company_employee
      ON payroll_items(
        companyId,
        employeeId
      );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_items_company_component
      ON payroll_items(
        companyId,
        componentId
      );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_items_company_type
      ON payroll_items(
        companyId,
        type
      );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_payroll_items_company_synced
      ON payroll_items(
        companyId,
        synced
      );
  `);

  console.log("PAYROLL TABLES INITIALIZED");
}
