import test from 'node:test';
import assert from 'node:assert/strict';
import {medianColor, medianLabel, missingPriceColor, priceBands} from '../src/price-map.js';

test('fixed price bands keep boundaries comparable between cities',()=>{
  for(const [value,index] of [[1,0],[249999,0],[250000,1],[499999,1],[500000,2],[750000,3],[1000000,4],[1500000,5],[1999999,5],[2000000,6],[5000000,6]]){
    assert.equal(medianColor({value}),priceBands[index].color,String(value));
  }
});
test('missing estimates stay neutral and Census bounds remain explicit',()=>{
  for(const data of [null,undefined,{}, {value:0},{value:-1},{value:Infinity}]){
    assert.equal(medianColor(data),missingPriceColor);
    assert.equal(medianLabel(data),'No reported median');
  }
  assert.equal(medianLabel({value:1222500}),'$1,222,500');
  assert.equal(medianLabel({value:2000000,atLeast:true}),'$2,000,000+');
  assert.equal(medianLabel({value:10000,atMost:true}),'$10,000 or less');
});
