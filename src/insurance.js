let datasetPromise;

export function estimateInsurance(data, state, coverage) {
  const statePremium = data.states[state];
  const curve = data.coveragePremiums;
  if (!Number.isFinite(coverage) || !Number.isFinite(statePremium) ||
      coverage < curve[0][0] || coverage > curve.at(-1)[0]) return null;
  const upper = curve.findIndex(([limit]) => limit >= coverage);
  let nationalPremium = curve[upper][1];
  if (upper > 0 && curve[upper][0] !== coverage) {
    const [lowCoverage, lowPremium] = curve[upper - 1];
    const [highCoverage, highPremium] = curve[upper];
    nationalPremium = lowPremium + (coverage-lowCoverage)/(highCoverage-lowCoverage)*(highPremium-lowPremium);
  }
  const annual = statePremium * nationalPremium / data.source.nationalBasePremium;
  return { monthly: Math.round(annual / 12 * 100) / 100, annual, coverage, state,
    baselineAnnual: statePremium, baselineCoverage: data.source.baseCoverage,
    date: data.source.updatedDate, sourceUrl: data.source.url };
}

export async function getInsuranceBenchmarks() {
  datasetPromise ??= fetch(new URL('./insurance-benchmarks.json', import.meta.url), { cache:'no-cache' })
    .then(response => { if (!response.ok) throw new Error('Insurance benchmarks could not load.'); return response.json(); })
    .then(data => {
      if (data?.schemaVersion !== 1 || data.source?.name !== 'NerdWallet / Quadrant Information Services' ||
          data.source.baseCoverage !== 400000 || !(data.source.nationalBasePremium > 0) ||
          !data.source.updatedDate || !data.source.url || !data.states ||
          Object.keys(data.states).length !== 51 || Object.values(data.states).some(n=>!Number.isFinite(n)||n<=0) ||
          !Array.isArray(data.coveragePremiums) || data.coveragePremiums.length < 2 ||
          data.coveragePremiums.some(([coverage,premium],i,rows)=>!Number.isFinite(coverage)||!Number.isFinite(premium)||premium<=0||coverage<=0||(i>0&&coverage<=rows[i-1][0]))) {
        throw new Error('Invalid insurance benchmarks.');
      }
      return data;
    }).catch(error => { datasetPromise = undefined; throw error; });
  return datasetPromise;
}
