import test from 'node:test';
import assert from 'node:assert/strict';
import {mapStates,projectStatePoint} from '../src/us-map.js?v=maps-3';
import {zipLocations} from '../src/zip-data.js';
import {unprojectStatePoint,postalMapLocation,getZipMapLocation} from '../src/local-map-data.js';
import {basemaps} from '../src/local-map.js';

test('local maps preserve ZIP coordinates, including leading zeros, Hawaii and Aleutians',()=>{
 for(const zip of ['94107','02903','96720','99546']){
  const expected=Object.values(zipLocations).flat().find(row=>row[0]===zip);
  assert.deepEqual(postalMapLocation(zip).center,[expected[3],expected[2]]);
 }
 assert.equal(postalMapLocation('00000'),null);
});
test('the geographic fallback inverts all 50 state projections',()=>{
 for(const region of mapStates){
  const rows=zipLocations[region.code];
  for(const row of [rows[0],rows[Math.floor(rows.length/2)],rows.at(-1)]){
   const projected=projectStatePoint(region,row[2],row[3]);
   const [latitude,longitude]=unprojectStatePoint(region,projected);
   assert.ok(Math.abs(latitude-row[3])<1e-7,region.code+' latitude');
   assert.ok(Math.abs(longitude-row[2])<1e-7,region.code+' longitude');
  }
 }
 assert.equal(unprojectStatePoint(null,[0,0]),null);
});
test('postal coordinates require no lookup and missing data does not invent a center',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return{ok:true,json:async()=>({areas:[]})}};
 try{
  assert.equal((await getZipMapLocation('94107','CA')).kind,'postal');
  assert.equal(calls,0);
  assert.equal(await getZipMapLocation('00000','CA'),null);
  assert.equal(calls,1);
  assert.equal(await getZipMapLocation('xyz','CA'),null);
  assert.equal(await getZipMapLocation('00000','XX'),null);
 }finally{globalThis.fetch=original;}
});
test('basemaps use the providers documented tile order and native detail',()=>{
 assert.equal(basemaps.road.url,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
 assert.equal(basemaps.terrain.url,'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}');
 assert.equal(basemaps.terrain.maxNativeZoom,16);
 assert.match(basemaps.road.attribution,/OpenStreetMap/);
 assert.match(basemaps.terrain.attribution,/USGS/);
});
