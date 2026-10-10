import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStates, projectStatePoint } from '../src/us-map.js';
import { zipLocations } from '../src/zip-data.js';

test('all 50 state detail maps fit their canvas and project their ZIP coordinates',()=>{
  assert.equal(mapStates.length,50);
  assert.equal(new Set(mapStates.map(s=>s.code)).size,50);
  for(const region of mapStates){
    const [[x0,y0],[x1,y1]]=region.detailBounds;
    assert.ok(region.detailPath.startsWith('M'),region.name);
    assert.ok(!/NaN|Infinity/.test(region.detailPath),region.name);
    assert.ok(x0>=0&&y0>=0&&x1<=960&&y1<=600,`${region.name} outline fits`);
    assert.ok(zipLocations[region.code].length>0,`${region.name} has ZIPs`);
    for(const [zip,,lon,lat] of zipLocations[region.code]){
      const [x,y]=projectStatePoint(region,lon,lat);
      assert.ok(Number.isFinite(x)&&Number.isFinite(y),`${zip} coordinates`);
      assert.ok(x>=0&&y>=0&&x<=960&&y<=600,`${zip} fits ${region.name}`);
    }
  }
});

test('postal locations retain leading zeros and belong to their expected state',()=>{
  const seen=new Set();
  for(const rows of Object.values(zipLocations))for(const [zip] of rows){
    assert.match(zip,/^\d{5}$/);
    assert.ok(!seen.has(zip),`duplicate ${zip}`);seen.add(zip);
  }
  for(const [state,zip,city] of [['RI','02903','Providence'],['CA','94107','San Francisco'],['AK','99546','Adak'],['HI','96720','Hilo'],['NY','10001','New York']]){
    const entry=zipLocations[state].find(row=>row[0]===zip);
    assert.ok(entry,`${zip} in ${state}`);assert.equal(entry[1],city);
  }
});
