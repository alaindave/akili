const calculateIPR = (
  taxableSalary: number,
  grossSalary: number,
  socialRate?: number
): number => {
  if (!socialRate) return 0;
  //Calculate social security contributions
  const INSS = (grossSalary * socialRate) / 100;
  const finalTaxableSalary = taxableSalary - INSS;
  if (finalTaxableSalary < 150_000) {
    // 0% below 150,000 BIF
    return 0;
  }

  if (finalTaxableSalary <= 300_000) {
    return (finalTaxableSalary - 150_000) * 0.2;
  }
  return (finalTaxableSalary - 300_000) * 0.3 + 30_000;
};

export default calculateIPR;
