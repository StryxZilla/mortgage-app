// Input: { cities: { stateCode: [{ id, name, pop }] }, geometry: GeoJSON }
// Usage: node scripts/project-city-geometries.mjs RAW.json PROJECTED.json
import {readFile,writeFile} from 'node:fs/promises';
import {projectStatePoint} from '../src/us-map.js';

const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Provide raw-source and projected-output JSON paths.');
const source=JSON.parse(await readFile(input,'utf8'));
const geometry=new Map(source.geometry.features.map(f=>[f.properties.geoid,f.geometry]));
const project=(coords,state)=>typeof coords[0]==='number'?projectStatePoint(state,...coords):coords.map(c=>project(c,state));
for(const[state,cities]of Object.entries(source.cities))for(const city of cities){
  const original=geometry.get(city.id);
  if(!original)throw new Error('Missing city geometry: '+city.id);
  city.geometry={...original,coordinates:project(original.coordinates,state)};
}
delete source.geometry;
await writeFile(output,JSON.stringify(source));
