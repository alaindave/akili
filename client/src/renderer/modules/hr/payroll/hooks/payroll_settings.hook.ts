import { useEffect, useState } from "react";
import { PayrollSettings } from "../../../../../common/types/payroll/Payroll";
import useAdminUser from "../../../../../store/auth.store";

export function usePayrollSettings() {
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const user = useAdminUser((store) => store.adminUser);

  useEffect(() => {
    loadPayrollSettings();
  }, []);

  const loadPayrollSettings = async () => {
    try {
      const result = await window.electron.payrollSettings.get(user.companyId);
      setSettings(result);
    } catch (error) {
      console.error("FAILED TO LOAD PAYROLL SETTINGS:", error);
    }
  };

  return settings;
}
