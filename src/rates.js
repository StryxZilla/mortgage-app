export const RATE_SOURCE = 'https://www.freddiemac.com/pmms';

export function validateRates(data, today = new Date()) {
  if (data?.schemaVersion !== 1 || data.source?.name !== 'Freddie Mac PMMS') throw new Error('Invalid rate source.');
  for (const term of [15, 30]) {
    const rows = data.series?.[term];
    if (!Array.isArray(rows) || rows.length < 2) throw new Error('Missing mortgage-rate history.');
    let previous = '';
    for (const [date, value] of rows) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || date <= previous ||
          Date.parse(date) > today.getTime() + 86400000 || !Number.isFinite(value) || value <= 0 || value > 30) {
        throw new Error('Invalid mortgage-rate observation.');
      }
      previous = date;
    }
  }
  if (data.series[15].at(-1)[0] !== data.series[30].at(-1)[0]) throw new Error('Rate publication dates do not match.');
  return data;
}

export function rateForTerm(data, term) { return data.series[term === 15 ? 15 : 30].at(-1)[1]; }
export function isRateStale(data, today = new Date()) {
  return today.getTime() - Date.parse(data.series[30].at(-1)[0]) > 14 * 86400000;
}
export async function getMortgageRates() {
  const response = await fetch(new URL('./mortgage-rates.json', import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw new Error('Mortgage rates could not load.');
  return validateRates(await response.json());
}
