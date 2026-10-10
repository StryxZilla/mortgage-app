import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { estimateInsurance } from '../src/insurance.js';
import { estimateTaxPercent } from '../src/property-taxes.js';
import { equitySeries, equityChartMarkup } from '../src/equity-chart.js';
import { regionalDefaults, nearbyDefaults, nearbyZips } from '../src/area-estimates.js';
import { parsePriceDistribution } from '../src/price-distribution.js';

const json = async name => JSON.parse(await readFile(new URL('../src/'+name,import.meta.url),'utf8'));
const insurance = await json('insurance-benchmarks.json');
const distribution = (await json('price-distribution-cache.json'))['94107'];

test('tax proxies use sourced medians and preserve a nearby-area ratio',()=>{
  assert.equal(estimateTaxPercent({zip:'02903',annualTax:4622},{zip:'02903',value:408900}),1.1303);
  assert.equal(estimateTaxPercent({zip:'94101',annualTax:4000,fallback:'nearby',proxyRate:1.25},{zip:'94101',value:600000}),1.25);
  assert.equal(estimateTaxPercent({zip:'02903',annualTax:0},{zip:'02903',value:408900}),0);
  assert.equal(estimateTaxPercent({zip:'02903',annualTax:4622},{zip:'77002',value:408900}),null);
});

test('insurance follows published state premiums and the coverage curve, without extrapolation',()=>{
  assert.equal(Object.keys(insurance.states).length,51);
  assert.equal(estimateInsurance(insurance,'CA',400000).monthly,151.67);
  assert.equal(estimateInsurance(insurance,'RI',400000).annual,2230);
  assert.equal(estimateInsurance(insurance,'CA',500000).annual,1820*3005/2490);
  assert.equal(estimateInsurance(insurance,'CA',450000).annual,1820*((2490+3005)/2)/2490);
  for(const coverage of [0,199999,800001,NaN])assert.equal(estimateInsurance(insurance,'CA',coverage),null);
  assert.equal(estimateInsurance(insurance,'XX',400000),null);
});

test('equity values follow actual months and continue after early payoff',()=>{
  const base={price:600000,down:20,rate:6,term:30,extra:0,appreciation:3};
  const points=equitySeries(base),five=points.find(p=>p.month===60);
  const monthlyRate=.06/12,principal=480000,payment=principal*monthlyRate/(1-(1+monthlyRate)**-360);
  const balance=principal*(1+monthlyRate)**60-payment*((1+monthlyRate)**60-1)/monthlyRate;
  assert.ok(Math.abs(five.balance-balance)<.001);
  assert.ok(Math.abs(five.equity-(600000*1.03**5-balance))<.001);
  const paid=equitySeries({...base,extra:10000,appreciation:0});
  assert.equal(paid.at(-1).month,360);
  assert.equal(paid.find(p=>p.month===240).balance,0);
  assert.equal(paid.find(p=>p.month===240).equity,600000);
  assert.ok(equitySeries({...base,appreciation:-10}).some(p=>p.equity<0));
  const short=equityChartMarkup({...base,term:15});
  assert.match(short,/15 yr/);assert.doesNotMatch(short,/20 yr|30 yr/);
});

test('distribution bands reconcile to Census totals and reject suppressed or inconsistent counts',()=>{
  const parsed=parsePriceDistribution(distribution,'94107');
  assert.equal(parsed.total,5871);assert.equal(parsed.bins.length,8);
  assert.equal(parsed.bins.at(-1).count,1085);
  assert.equal(parsed.bins.reduce((n,b)=>n+b.count,0),parsed.total);
  assert.ok(Math.abs(parsed.bins.reduce((n,b)=>n+b.percent,0)-100)<.0001);
  for(const invalid of [null,-666666666,100000]){
    const copy=structuredClone(distribution);copy.data['86000US94107'].B25075.estimate.B25075002=invalid;
    assert.equal(parsePriceDistribution(copy,'94107'),null);
  }
  assert.equal(parsePriceDistribution(distribution,'00000'),null);
});

test('missing postal ZIP defaults use the closest reported area, then sourced regional medians',async()=>{
  const original=globalThis.fetch;
  const homes=await json('zip-home-values.json'),taxes=await json('zip-property-taxes.json');
  globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('property-taxes')?taxes:homes});
  try{
    const nearby=await nearbyDefaults('94101','CA');
    assert.equal(nearby.home.fallback,'nearby');assert.notEqual(nearby.home.sourceZip,'94101');
    assert.ok(nearby.home.distanceMiles<50);
    const closest=nearbyZips('94101').find(row=>homes.values[row.zip]);
    assert.equal(nearby.home.sourceZip,closest.zip);
    assert.equal(nearby.tax.proxyRate,+(taxes.values[nearby.tax.sourceZip]/homes.values[nearby.tax.sourceZip]*100).toFixed(4));
    const regional=regionalDefaults('00000','CA');
    assert.equal(regional.home.value,734700);assert.equal(regional.tax.annualTax,5124);
    assert.equal(regional.home.fallback,'state');
    assert.equal(regionalDefaults('00000','XX').home.value,332700);
  }finally{globalThis.fetch=original;}
});
