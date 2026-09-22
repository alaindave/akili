// Burundi income tax calculations

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
    // 20% on the amount above 150,000 BIF
    return (socialTaxableSalary - 150_000) * 0.2;
  }
  // 30% on the amount above 300,000 BIF
  // plus the 30,000 BIF tax accumulated from the previous bracket
  return (socialTaxableSalary - 300_000) * 0.3 + 30_000;
};

export default calculateIPR;
