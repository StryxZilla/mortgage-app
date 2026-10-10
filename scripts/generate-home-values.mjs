import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VARIABLE = 'B25077_001E';
const ANNOTATION = 'B25077_001EA';
const DEFAULT_YEAR = 2024;

// ACS publishes the open-ended median classes as display annotations. Their
// numeric API encodings (such as 2000001) are not exact dollar estimates.
export function normalizeHomeValue(raw, annotation = '') {
  const flag = String(annotation ?? '').trim();
  const bound = flag.match(/^([\d,]+)([+-])$/);
  if (bound) {
    const value = Number(bound[1].replaceAll(',', ''));
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return { value, ...(bound[2] === '+' ? { atLeast: true } : { atMost: true }) };
  }
  // An unrecognized annotation is unavailable rather than guessed.
  if (flag) return null;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? { value } : null;
}

export function sourceRows(input) {
  if (Array.isArray(input)) {
    const [header, ...rows] = input;
    const zipColumn = header.indexOf('zip code tabulation area');
    const valueColumn = header.indexOf(VARIABLE);
    const annotationColumn = header.indexOf(ANNOTATION);
    if (zipColumn < 0 || valueColumn < 0 || annotationColumn < 0) {
      throw new Error('Census response must include ZIP, estimate, and estimate annotation columns.');
    }
    return rows.map(row => [row[zipColumn], row[valueColumn], row[annotationColumn]]);
  }
  if (Array.isArray(input.rows)) return input.rows;
  const data = input.data?.alexandria?.[0]?.data ?? input;
  if (Array.isArray(data.records)) {
    return data.records.map(record => [
      record.geo?.fips?.zcta,
      record.values?.[VARIABLE],
      record.source_flags?.[VARIABLE] ?? record.annotations?.[VARIABLE]?.symbol ?? record.annotations?.[VARIABLE]?.code ?? null,
    ]);
  }
  throw new Error('Unsupported Census input format.');
}

export function generateHomeValues(input, { year = DEFAULT_YEAR, retrievedDate, sourceSha256 } = {}) {
  const rows = sourceRows(input);
  const values = {}, atLeast = [], atMost = [], seen = new Set();
  for (const [zip, raw, annotation] of rows) {
    if (typeof zip !== 'string' || !/^\d{5}$/.test(zip)) throw new Error(`Invalid source ZCTA: ${zip}`);
    if (seen.has(zip)) throw new Error(`Duplicate source ZCTA: ${zip}`);
    seen.add(zip);
    const normalized = normalizeHomeValue(raw, annotation);
    if (!normalized) continue;
    values[zip] = normalized.value;
    if (normalized.atLeast) atLeast.push(zip);
    if (normalized.atMost) atMost.push(zip);
  }
  if (rows.length < 30000) throw new Error('Expected a complete nationwide ZCTA extract, not a partial page.');
  const sortedValues = Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
  return {
    schemaVersion: 1,
    source: {
      name: 'U.S. Census Bureau, ACS 5-year',
      metric: 'Median owner-occupied home value',
      variable: VARIABLE,
      annotationVariable: ANNOTATION,
      year,
      period: `${year - 4}–${year}`,
      ...(input.source?.releaseDate ? { releaseDate: input.source.releaseDate } : {}),
      retrievedDate: retrievedDate ?? input.source?.retrievedDate ?? new Date().toISOString().slice(0, 10),
      geography: 'ZIP Code Tabulation Areas (ZCTAs)',
      url: `https://data.census.gov/table/ACSDT5Y${year}.B25077`,
      apiUrl: `https://api.census.gov/data/${year}/acs/acs5?get=NAME,${VARIABLE},${ANNOTATION}&for=zip%20code%20tabulation%20area:*`,
      ...(sourceSha256 ? { sourceSha256 } : {}),
    },
    coverage: {
      sourceZctas: seen.size,
      reportedValues: Object.keys(values).length,
      exactEstimates: Object.keys(values).length - atLeast.length - atMost.length,
      topCodedValues: atLeast.length,
      bottomCodedValues: atMost.length,
      unavailable: seen.size - Object.keys(values).length,
    },
    values: sortedValues,
    atLeast: atLeast.sort(),
    atMost: atMost.sort(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  const year = args[1] ? Number(args[1]) : DEFAULT_YEAR;
  if (!Number.isInteger(year) || year < 2009 || year > 2035) throw new Error('Invalid ACS year.');
  let raw;
  if (inputPath) {
    raw = await readFile(resolve(inputPath), 'utf8');
  } else {
    const url = new URL(`https://api.census.gov/data/${year}/acs/acs5`);
    url.searchParams.set('get', `NAME,${VARIABLE},${ANNOTATION}`);
    url.searchParams.set('for', 'zip code tabulation area:*');
    if (process.env.CENSUS_API_KEY) url.searchParams.set('key', process.env.CENSUS_API_KEY);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Census request failed: HTTP ${response.status}`);
    raw = await response.text();
    if (!raw.trim().startsWith('[')) throw new Error('Census did not return JSON. Set CENSUS_API_KEY or pass a complete downloaded extract.');
  }
  const sourceSha256 = createHash('sha256').update(raw).digest('hex');
  const data = generateHomeValues(JSON.parse(raw), { year, sourceSha256 });
  const output = new URL('../src/zip-home-values.json', import.meta.url);
  await writeFile(output, JSON.stringify(data) + '\n');
  console.log(`Saved ${data.coverage.reportedValues} reported medians or annotated bounds from ${data.coverage.sourceZctas} ZCTAs (${data.source.period}).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
