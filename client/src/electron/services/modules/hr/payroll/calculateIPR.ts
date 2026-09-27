const calculateIPR = (
  taxableSalary: number,
  grossSalary: number,
  socialRate?: number
): number => {
  if (!socialRate) return 0;
  //Calculate social security contributions
  const INSS = (grossSalary * socialRate) / 100;
  const socialTaxableSalary = taxableSalary - INSS;
  if (socialTaxableSalary < 150_000) {
    // 0% below 150,000 BIF
    return 0;
  }

  if (socialTaxableSalary <= 300_000) {
    return (socialTaxableSalary - 150_000) * 0.2;
  }
  return (socialTaxableSalary - 300_000) * 0.3 + 30_000;
};

export default calculateIPR;
