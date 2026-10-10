import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function normalizePropertyTax(raw, annotation = '') {
  const flag = String(annotation ?? '').trim();
  const bound = flag.match(/^([\d,]+)([+-])$/);
  if (bound) {
    const value = Number(bound[1].replaceAll(',', ''));
    return Number.isSafeInteger(value) && value >= 0
      ? { value, ...(bound[2] === '+' ? { atLeast: true } : { atMost: true }) } : null;
  }
  if (flag || raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? { value } : null;
}

export function generatePropertyTaxes(rows, sourceSha256) {
  const values = {}, atLeast = [], atMost = [], seen = new Set();
  for (const [zip, raw, flag] of rows) {
    if (!/^\d{5}$/.test(zip) || seen.has(zip)) throw new Error('Invalid or duplicate tax-data ZIP.');
    seen.add(zip);
    const estimate = normalizePropertyTax(raw, flag);
    if (!estimate) continue;
    values[zip] = estimate.value;
    if (estimate.atLeast) atLeast.push(zip);
    if (estimate.atMost) atMost.push(zip);
  }
  if (seen.size < 30000) throw new Error('Tax data must include the complete nationwide extract.');
  return { schemaVersion: 1, source: {
    name: 'U.S. Census Bureau, ACS 5-year', variable: 'B25103_001E', annotationVariable: 'B25103_001EA',
    metric: 'Median annual real estate taxes paid, owner-occupied housing', year: 2024, period: '2020–2024',
    retrievedDate: new Date().toISOString().slice(0, 10), sourceSha256,
    url: 'https://data.census.gov/table/ACSDT5Y2024.B25103',
    apiUrl: 'https://api.census.gov/data/2024/acs/acs5?get=NAME,B25103_001E,B25103_001EA&for=zip%20code%20tabulation%20area:*'
  }, coverage: { sourceZctas: seen.size, reportedValues: Object.keys(values).length,
    unavailable: seen.size - Object.keys(values).length },
    values: Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b))),
    atLeast: atLeast.sort(), atMost: atMost.sort() };
}

async function main() {
  const raw = await readFile(process.argv[2], 'utf8');
  const data = generatePropertyTaxes(JSON.parse(raw).rows, createHash('sha256').update(raw).digest('hex'));
  await writeFile('src/zip-property-taxes.json', `${JSON.stringify(data)}\n`);
  console.log(data.coverage);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
