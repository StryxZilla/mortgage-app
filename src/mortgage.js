export function monthlyPrincipalAndInterest(principal, annualRate, years) {
  const months = years * 12;
  if (principal <= 0 || months <= 0) return 0;
  const rate = annualRate / 100 / 12;
  if (rate === 0) return principal / months;
  return principal * rate * (1 + rate) ** months / ((1 + rate) ** months - 1);
}

export function calculateMortgage(input) {
  const downAmount = input.price * input.down / 100;
  const principal = Math.max(0, input.price - downAmount);
  const principalAndInterest = monthlyPrincipalAndInterest(principal, input.rate, input.term);
  const propertyTax = input.taxMode === 'annual'
    ? Math.max(0, Number(input.annualTax) || 0) / 12
    : input.price * input.tax / 100 / 12;
  const insurance = Number(input.insurance) || 0;
  const hoa = Number(input.hoa) || 0;
  const pmi = input.down < 20 ? principal * (Number(input.pmiRate) || 0.55) / 100 / 12 : 0;
  const total = principalAndInterest + propertyTax + insurance + hoa + pmi;
  return { downAmount, principal, principalAndInterest, propertyTax, insurance, hoa, pmi, total };
}

export function amortizationSchedule(input) {
  const mortgage = calculateMortgage(input);
  const monthlyRate = input.rate / 100 / 12;
  const extra = Math.max(0, Number(input.extra) || 0);
  const appreciation = (Number(input.appreciation) || 0) / 100;
  let balance = mortgage.principal;
  let interestPaid = 0;
  const points = [{ month: 0, balance, equity: mortgage.downAmount, homeValue: input.price, interestPaid: 0 }];

  for (let month = 1; month <= input.term * 12 && balance > 0.01; month += 1) {
    const interest = balance * monthlyRate;
    const principalPaid = Math.min(balance, Math.max(0, mortgage.principalAndInterest - interest) + extra);
    balance -= principalPaid;
    interestPaid += interest;
    if (month % 12 === 0 || balance <= 0.01) {
      const homeValue = input.price * (1 + appreciation) ** (month / 12);
      points.push({ month, balance: Math.max(0, balance), equity: homeValue - balance, homeValue, interestPaid });
    }
  }
  return points;
}
