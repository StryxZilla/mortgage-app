import assert from 'node:assert/strict';
import test from 'node:test';
import { amortizationSchedule, calculateMortgage, monthlyPrincipalAndInterest } from '../src/mortgage.js';

test('calculates a conventional fixed payment', () => {
  assert.equal(Math.round(monthlyPrincipalAndInterest(400000, 6, 30)), 2398);
});

test('supports a zero-interest loan', () => {
  assert.equal(monthlyPrincipalAndInterest(120000, 0, 10), 1000);
});

test('adds PMI below 20% down and removes it at 20%', () => {
  const base = { price: 500000, rate: 6, term: 30, tax: 1.1, insurance: 150, hoa: 0, pmiRate: .55 };
  assert.ok(calculateMortgage({ ...base, down: 10 }).pmi > 0);
  assert.equal(calculateMortgage({ ...base, down: 20 }).pmi, 0);
});

test('extra payments shorten the amortization schedule', () => {
  const base = { price: 500000, down: 20, rate: 6, term: 30, tax: 1.1, insurance: 150, hoa: 0, pmiRate: .55, appreciation: 3 };
  const regular = amortizationSchedule({ ...base, extra: 0 });
  const accelerated = amortizationSchedule({ ...base, extra: 500 });
  assert.ok(accelerated.at(-1).month < regular.at(-1).month);
  assert.equal(Math.round(regular.at(-1).balance), 0);
});
