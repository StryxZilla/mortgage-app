let datasetPromise;

function validateDataset(data) {
  if (data?.schemaVersion !== 1 || data.source?.variable !== 'B25077_001E' ||
      !Number.isInteger(data.source?.year) || !data.source?.url ||
      !data.values || typeof data.values !== 'object' || Array.isArray(data.values) ||
      !Array.isArray(data.atLeast) || !Array.isArray(data.atMost)) {
    throw new Error('The ZIP home-value dataset is invalid.');
  }
  for (const [zip, value] of Object.entries(data.values)) {
    if (!/^\d{5}$/.test(zip) || !Number.isSafeInteger(value) || value <= 0) {
      throw new Error('The ZIP home-value dataset contains an invalid estimate.');
    }
  }
  return data;
}

export function lookupHomeValue(data, zip) {
  if (typeof zip !== 'string' || !/^\d{5}$/.test(zip) ||
      !Object.hasOwn(data.values, zip)) return null;
  const sourceUrl = new URL(data.source.url);
  sourceUrl.searchParams.set('g', `860XX00US${zip}`);
  return {
    zip,
    value: data.values[zip],
    year: data.source.year,
    period: data.source.period,
    source: data.source.name,
    metric: data.source.metric,
    sourceUrl: sourceUrl.href,
    ...(data.atLeast.includes(zip) ? { atLeast: true } : {}),
    ...(data.atMost.includes(zip) ? { atMost: true } : {}),
  };
}

export async function getZipHomeValue(zip) {
  if (typeof zip !== 'string' || !/^\d{5}$/.test(zip)) return null;
  if (!datasetPromise) {
    datasetPromise = fetch(new URL('./zip-home-values.json?v=home-values-2', import.meta.url), { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`ZIP home values failed to load (HTTP ${response.status}).`);
        return response.json();
      })
      .then(validateDataset)
      .catch(error => { datasetPromise = undefined; throw error; });
  }
  return lookupHomeValue(await datasetPromise, zip);
}
