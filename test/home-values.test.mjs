import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookupHomeValue } from '../src/home-values.js';
import { normalizeHomeValue, sourceRows, generateHomeValues } from '../scripts/generate-home-values.mjs';

const data = JSON.parse(await readFile(new URL('../src/zip-home-values.json', import.meta.url), 'utf8'));

test('latest Census extract retains nationwide coverage and exact five-digit ZIPs', () => {
  assert.equal(data.source.year, 2024);
  assert.equal(data.source.period, '2020–2024');
  assert.equal(data.source.variable, 'B25077_001E');
  assert.equal(data.source.releaseDate, '2026-01-29');
  assert.equal(data.coverage.sourceZctas, 33772);
  assert.equal(data.coverage.reportedValues, 30260);
  assert.equal(data.coverage.unavailable, 3512);
  assert.equal(Object.keys(data.values).length, data.coverage.reportedValues);
  assert.equal(data.coverage.exactEstimates + data.atLeast.length + data.atMost.length, data.coverage.reportedValues);
  assert.match(data.source.sourceSha256, /^[a-f\d]{64}$/);
  for (const [zip, value] of Object.entries(data.values)) {
    assert.match(zip, /^\d{5}$/);
    assert.ok(Number.isSafeInteger(value) && value > 0, zip);
  }
  for (const [zip, expected] of [['94107', 1222500], ['02903', 408900], ['10001', 561100], ['99546', 139100], ['96720', 485400]]) {
    const result = lookupHomeValue(data, zip);
    assert.equal(result.value, expected, zip);
    assert.equal(result.zip, zip);
    assert.equal(new URL(result.sourceUrl).searchParams.get('g'), `860XX00US${zip}`);
    assert.equal(result.atLeast, undefined);
    assert.equal(result.atMost, undefined);
  }
});

test('open-ended Census medians are bounds and unavailable ZIPs have no invented value', () => {
  assert.equal(data.atLeast.length, 100);
  assert.equal(data.atMost.length, 22);
  assert.equal(new Set(data.atLeast).size, data.atLeast.length);
  assert.equal(new Set(data.atMost).size, data.atMost.length);
  for (const zip of data.atLeast) {
    assert.equal(data.values[zip], 2000000, zip);
    assert.ok(!data.atMost.includes(zip), zip);
  }
  for (const zip of data.atMost) assert.equal(data.values[zip], 10000, zip);
  assert.equal(lookupHomeValue(data, '94027').atLeast, true);
  assert.equal(lookupHomeValue(data, '14169').atMost, true);
  for (const zip of ['01003', '35011', '00000', '2903', '', 2903, null]) {
    assert.equal(lookupHomeValue(data, zip), null, String(zip));
  }
  assert.deepEqual(normalizeHomeValue('2000001', '2,000,000+'), { value: 2000000, atLeast: true });
  assert.deepEqual(normalizeHomeValue('9999', '10,000-'), { value: 10000, atMost: true });
  assert.deepEqual(normalizeHomeValue('408900', null), { value: 408900 });
  for (const raw of [null, undefined, '', '-666666666', '-999999999', '-333333333', 'NaN', 0]) {
    assert.equal(normalizeHomeValue(raw), null);
  }
  assert.equal(normalizeHomeValue('100000', 'unrecognized flag'), null);
});

test('the generator requires estimate annotations and rejects truncated extracts', () => {
  assert.deepEqual(sourceRows([
    ['NAME', 'B25077_001E', 'B25077_001EA', 'zip code tabulation area'],
    ['ZCTA5 02903', '408900', null, '02903'],
  ]), [['02903', '408900', null]]);
  assert.throws(() => sourceRows([
    ['B25077_001E', 'zip code tabulation area'], ['408900', '02903'],
  ]), /annotation/);
  assert.throws(() => generateHomeValues({ rows: [['02903', '408900', null]] }), /complete nationwide/);
});

test('lazy loading shares a request and retries after a failed download', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const { getZipHomeValue } = await import('../src/home-values.js?download-retry-test');
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => data };
  };
  try {
    assert.equal(await getZipHomeValue('2903'), null);
    assert.equal(calls, 0);
    const results = await Promise.allSettled([getZipHomeValue('02903'), getZipHomeValue('94107')]);
    assert.ok(results.every(result => result.status === 'rejected'));
    assert.equal(calls, 1);
    assert.equal((await getZipHomeValue('02903')).value, 408900);
    assert.equal((await getZipHomeValue('94107')).value, 1222500);
    assert.equal(await getZipHomeValue('01003'), null);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
