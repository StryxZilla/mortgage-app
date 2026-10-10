let datasetPromise;

// Ratio of ZIP medians is a useful price-scaling proxy, not an assessed rate.
export function estimateTaxPercent(tax, homeValue) {
  if (tax?.fallback && Number.isFinite(tax.proxyRate) && tax.proxyRate >= 0) return tax.proxyRate;
  if (!tax || !homeValue || tax.zip !== homeValue.zip || !(homeValue.value > 0) ||
      !Number.isFinite(tax.annualTax) || tax.annualTax < 0) return null;
  return +(tax.annualTax / homeValue.value * 100).toFixed(4);
}

export function lookupPropertyTax(data, zip) {
  if (!/^\d{5}$/.test(zip) || !Object.hasOwn(data.values, zip)) return null;
  const sourceUrl = new URL(data.source.url);
  sourceUrl.searchParams.set('g', `860XX00US${zip}`);
  return { zip, annualTax: data.values[zip], period: data.source.period,
    sourceUrl: sourceUrl.href, atLeast: data.atLeast.includes(zip), atMost: data.atMost.includes(zip) };
}

export async function getZipPropertyTax(zip) {
  if (typeof zip !== 'string' || !/^\d{5}$/.test(zip)) return null;
  datasetPromise ??= fetch(new URL('./zip-property-taxes.json', import.meta.url), { cache: 'no-cache' })
    .then(response => { if (!response.ok) throw new Error('Property-tax data could not load.'); return response.json(); })
    .then(data => {
      if (data?.schemaVersion !== 1 || data.source?.variable !== 'B25103_001E' ||
          !data.source?.period || !data.source?.url || !data.values || Array.isArray(data.values) ||
          !Array.isArray(data.atLeast) || !Array.isArray(data.atMost) ||
          Object.entries(data.values).some(([zip, value]) => !/^\d{5}$/.test(zip) || !Number.isSafeInteger(value) || value < 0)) {
        throw new Error('Invalid property-tax dataset.');
      }
      return data;
    }).catch(error => { datasetPromise = undefined; throw error; });
  return lookupPropertyTax(await datasetPromise, zip);
}
