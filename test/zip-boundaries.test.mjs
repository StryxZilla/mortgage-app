import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mapStates } from '../src/us-map.js';

test('all 50 states have complete, selectable Census ZIP-area geometry',async()=>{
  let total=0;
  for(const state of mapStates){
    const data=JSON.parse(await readFile(new URL(`../src/zip-boundaries/${state.code}.json`,import.meta.url),'utf8'));
    assert.equal(data.state,state.code);
    assert.equal(data.source.type,'ZCTA');assert.equal(data.source.year,2010);
    assert.ok(data.areas.length>0,state.name);
    const seen=new Set();
    for(const area of data.areas){
      assert.match(area.zip,/^\d{5}$/);
      assert.ok(!seen.has(area.zip),`${state.code} duplicate ${area.zip}`);seen.add(area.zip);
      assert.ok(area.path.startsWith('M')&&area.path.endsWith('Z'),`${state.code} ${area.zip} closed polygon`);
      assert.ok(!/NaN|Infinity|undefined/.test(area.path),`${state.code} ${area.zip} valid path`);
      const [[x0,y0],[x1,y1]]=area.bounds;
      assert.ok([x0,y0,x1,y1,...area.center].every(Number.isFinite));
      assert.ok(x0<x1&&y0<y1,`${state.code} ${area.zip} nonempty shape`);
      assert.ok(area.center[0]>=x0&&area.center[0]<=x1&&area.center[1]>=y0&&area.center[1]<=y1,`${state.code} ${area.zip} label bounds`);
    }
    total+=seen.size;
  }
  assert.equal(total,33039,'retain every source state-clipped ZIP area');
});

test('known urban/island ZIPs and cross-state ZIP portions retain their outlines',async()=>{
  for(const [state,zip] of [['CA','94107'],['RI','02903'],['AK','99546'],['HI','96720'],['DE','21912']]){
    const data=JSON.parse(await readFile(new URL(`../src/zip-boundaries/${state}.json`,import.meta.url),'utf8'));
    const area=data.areas.find(area=>area.zip===zip);
    assert.ok(area,`${state} ${zip} polygon`);
    assert.ok(area.path.length>30);
  }
});
