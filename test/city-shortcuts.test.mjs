import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stateCities} from '../src/city-shortcuts.js';
import {priceDistributionBin} from '../src/price-distribution.js';

test('each state has five population-ranked shortcuts with selectable ZIP geometry',async()=>{
  assert.equal(Object.keys(stateCities).length,50);
  for(const[state,cities]of Object.entries(stateCities)){
    assert.equal(cities.length,5,state);
    const source=JSON.parse(await readFile(new URL(`../src/zip-boundaries/${state}.json`,import.meta.url),'utf8'));
    const mapped=new Set(source.areas.map(area=>area.zip));
    for(const[rank,city]of cities.entries()){
      assert.ok(city.population>0);
      if(rank)assert.ok(cities[rank-1].population>=city.population);
      assert.ok(city.zips.length>0,city.name);
      assert.ok(city.zips.every(zip=>mapped.has(zip)),state+' '+city.name);
      assert.ok(city.view.every(Number.isFinite));
      assert.ok(city.view[2]>=12&&city.view[2]<960);
      assert.ok(Math.abs(city.view[3]/city.view[2]-.625)<.0001);
    }
  }
});

test('geographic shortcuts span NYC boroughs and avoid unrelated similarly named cities',()=>{
  const ny=stateCities.NY.find(city=>city.name==='New York');
  for(const zip of ['10001','11201','10451','11354','10301'])assert.ok(ny.zips.includes(zip),zip);
  assert.ok(!ny.zips.includes('13417')); // New York Mills, outside NYC.
  const sf=stateCities.CA.find(city=>city.name==='San Francisco');
  assert.ok(sf.zips.includes('94107'));assert.ok(!sf.zips.includes('94612')); // Oakland.
});

test('price bands select the correct side of every boundary, including the open upper band',()=>{
  const edges=[100000,200000,300000,500000,750000,1000000,2000000];
  edges.forEach((edge,index)=>{assert.equal(priceDistributionBin(edge-1),index);assert.equal(priceDistributionBin(edge),index+1);});
  assert.equal(priceDistributionBin(100000000),7);
  for(const value of [null,undefined,NaN,Infinity,0,-1])assert.equal(priceDistributionBin(value),null);
});
