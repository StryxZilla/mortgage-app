import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookupPropertyTax } from '../src/property-taxes.js';
import { normalizePropertyTax, generatePropertyTaxes } from '../scripts/generate-property-taxes.mjs';
import { calculateMortgage } from '../src/mortgage.js';
import { validateRates, rateForTerm, isRateStale } from '../src/rates.js';
import { rateHistory } from '../src/rate-modal.js';

const taxes=JSON.parse(await readFile(new URL('../src/zip-property-taxes.json',import.meta.url),'utf8'));
const rates=JSON.parse(await readFile(new URL('../src/mortgage-rates.json',import.meta.url),'utf8'));

test('nationwide annual tax medians retain missing data, leading zeros, and Census bounds',()=>{
  assert.equal(taxes.coverage.sourceZctas,33772);
  assert.equal(taxes.coverage.reportedValues,30107);
  assert.equal(taxes.coverage.unavailable,3665);
  assert.equal(Object.keys(taxes.values).length,taxes.coverage.reportedValues);
  assert.equal(taxes.source.variable,'B25103_001E');
  assert.equal(lookupPropertyTax(taxes,'02903').annualTax,4622);
  assert.equal(lookupPropertyTax(taxes,'77002').annualTax,3864);
  assert.equal(lookupPropertyTax(taxes,'94107').annualTax,10000);
  assert.equal(lookupPropertyTax(taxes,'94107').atLeast,true);
  assert.equal(new URL(lookupPropertyTax(taxes,'02903').sourceUrl).searchParams.get('g'),'860XX00US02903');
  for(const zip of ['94101','00000','2903'])assert.equal(lookupPropertyTax(taxes,zip),null);
  assert.deepEqual(normalizePropertyTax('10001','10,000+'),{value:10000,atLeast:true});
  assert.deepEqual(normalizePropertyTax('199','200-'),{value:200,atMost:true});
  assert.deepEqual(normalizePropertyTax('0'),{value:0});
  for(const raw of [null,'','-666666666','-999999999'])assert.equal(normalizePropertyTax(raw),null);
  assert.equal(normalizePropertyTax('5000','-'),null);
  assert.throws(()=>generatePropertyTaxes([['02903','4622','']]),/complete nationwide/);
});

test('annual tax bills stay fixed when price changes; percentage estimates scale with price',()=>{
  const base={price:600000,down:20,rate:6,term:30,insurance:180,hoa:0,tax:1.2};
  assert.equal(calculateMortgage({...base,taxMode:'annual',annualTax:7200}).propertyTax,600);
  assert.equal(calculateMortgage({...base,price:700000,taxMode:'annual',annualTax:7200}).propertyTax,600);
  assert.equal(calculateMortgage({...base,price:700000,taxMode:'percent'}).propertyTax,700);
  assert.equal(calculateMortgage({...base,taxMode:'annual',annualTax:0}).propertyTax,0);
});

test('weekly rates use the matching term; stale, future, duplicate and missing series are detected',()=>{
  validateRates(rates);
  assert.equal(rateForTerm(rates,15),rates.series[15].at(-1)[1]);
  assert.equal(rateForTerm(rates,20),rates.series[30].at(-1)[1]);
  assert.equal(rateForTerm(rates,30),rates.series[30].at(-1)[1]);
  const latest=Date.parse(rates.series[30].at(-1)[0]);
  assert.equal(isRateStale(rates,new Date(latest+2*86400000)),false);
  assert.equal(isRateStale(rates,new Date(latest+15*86400000)),true);
  const broken=structuredClone(rates);broken.series[30].push(broken.series[30].at(-1));
  assert.throws(()=>validateRates(broken),/Invalid mortgage-rate/);
  assert.throws(()=>validateRates(rates,new Date('2020-01-01')),/Invalid mortgage-rate/);
  assert.throws(()=>validateRates({...rates,series:{30:rates.series[30]}}),/Missing/);
  const mismatch=structuredClone(rates);mismatch.series[15].pop();
  assert.throws(()=>validateRates(mismatch),/publication dates/);
  assert.ok(rateHistory(rates,'5y').length>rateHistory(rates,'1y').length);
  assert.ok(rateHistory(rates,'1m').length>=4);
  assert.equal(rateHistory(rates,'1m').at(-1).date,rates.series[30].at(-1)[0]);
});

test('tax downloads share one request and retry after a failed fetch',async()=>{
  const original=globalThis.fetch;let calls=0;
  const {getZipPropertyTax}=await import('../src/property-taxes.js?retry-test');
  globalThis.fetch=async()=>{calls++;return calls===1?{ok:false}:{ok:true,json:async()=>taxes};};
  try{
    const results=await Promise.allSettled([getZipPropertyTax('02903'),getZipPropertyTax('77002')]);
    assert.ok(results.every(r=>r.status==='rejected'));assert.equal(calls,1);
    assert.equal((await getZipPropertyTax('02903')).annualTax,4622);assert.equal(calls,2);
  }finally{globalThis.fetch=original;}
});
