// Build static selectable Census ZIP area outlines. No browser dependencies.
// Source: OpenDataDE/State-zip-code-GeoJSON at the pinned commit below.
// npm install --prefix /path/to/tools topojson-server@3.0.1 topojson-client@3.1.0 topojson-simplify@3.0.3 polylabel@2.0.1
// ZIP_BOUNDARY_DEPENDENCY_ROOT=/path/to/tools node scripts/generate-zip-boundaries.mjs /path/to/source [AL ...]
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mapStates, projectStatePoint } from '../src/us-map.js';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Pass the extracted source repository directory.');
const dependencyRoot = process.env.ZIP_BOUNDARY_DEPENDENCY_ROOT;
const moduleUrl = (name, entry) => dependencyRoot
  ? pathToFileURL(resolve(dependencyRoot, 'node_modules', name, entry)).href : name;
const { topology } = await import(moduleUrl('topojson-server', 'dist/topojson-server.js'));
const { presimplify, simplify } = await import(moduleUrl('topojson-simplify', 'dist/topojson-simplify.js'));
const { feature } = await import(moduleUrl('topojson-client', 'dist/topojson-client.js'));
const { default: polylabel } = await import(moduleUrl('polylabel', 'polylabel.js'));
const requestedStates = new Set(process.argv.slice(3));
const outputDirectory = join(repository, 'src/zip-boundaries');
await mkdir(outputDirectory, { recursive: true });
// Independently audited narrow rings can need exact source arcs: protect those
// ZIPs and their neighbors' shared edges, rather than exporting invalid shapes.
let protectedZips = {};
try {
  protectedZips = JSON.parse(await readFile(join(outputDirectory, 'protected-zips.json'), 'utf8')).states;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const files = await readdir(sourceDirectory);
const minimumWeight = 0.01; // Projected Visvalingam triangle area, square SVG units.
const source = {
  name: 'U.S. Census Bureau 2010 TIGER/Line ZIP Code Tabulation Areas',
  type: 'ZCTA',
  year: 2010,
  url: 'https://github.com/OpenDataDE/State-zip-code-GeoJSON',
  commit: '4cc2657044efd08477465aed1912dca30198d441',
  description: 'Statistical ZIP areas; not USPS delivery boundaries. State files include state-clipped portions of cross-state ZIP areas.',
};
const round = value => +value.toFixed(5);
const key = point => `${point[0]},${point[1]}`;
const rings = geometry => geometry.type === 'Polygon'
  ? geometry.arcs : geometry.arcs.flat();

// Visvalingam simplification uses shared arcs, so neighboring boundaries remain
// identical. Smaller urban ZIP areas need more detail at neighborhood zoom:
// use an area-relative triangle threshold, capped by the statewide threshold.
// Protect three distinct vertices in every ring to retain small ZIP areas,
// detached islands and interior holes rather than deleting them.
function protectRings(topo, stateCode) {
  const exactAreas = new Set(protectedZips[stateCode] || []);
  for (const geometry of topo.objects.areas.geometries) {
    for (const ring of rings(geometry)) {
      const points = ring.flatMap(index => {
        const arc = topo.arcs[index < 0 ? ~index : index];
        return index < 0 ? [...arc].reverse() : arc;
      });
      const localWeight = Math.min(minimumWeight, twiceArea(points) / 2 * 0.0001);
      for (const point of points) {
        if (exactAreas.has(geometry.properties.zip) || (point[2] >= localWeight && point[2] < minimumWeight)) point[2] = Infinity;
      }
      const retained = new Set(points.filter(point => point[2] >= minimumWeight).map(key));
      if (retained.size >= 3) continue;
      for (const point of [...points].sort((a, b) => b[2] - a[2])) {
        if (retained.has(key(point))) continue;
        point[2] = Infinity;
        retained.add(key(point));
        if (retained.size >= 3) break;
      }
      if (retained.size < 3) throw new Error('Source contains a degenerate polygon ring.');
    }
  }
}

function twiceArea(ring) {
  let value = 0;
  for (let i = 1; i < ring.length; i += 1) {
    value += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  }
  return Math.abs(value);
}

const manifestStates = {};
for (const state of mapStates) {
  if (requestedStates.size && !requestedStates.has(state.code)) continue;
  const file = files.find(name => name.startsWith(`${state.code.toLowerCase()}_`) && name.endsWith('_zip_codes_geo.min.json'));
  if (!file) throw new Error(`Missing source file for ${state.code}.`);
  const raw = await readFile(join(sourceDirectory, file), 'utf8');
  const input = JSON.parse(raw);
  if (input.type !== 'FeatureCollection' || !input.features.length) throw new Error(`Invalid source: ${file}`);
  const zipSet = new Set();
  for (const area of input.features) {
    const zip = area.properties.ZCTA5CE10;
    if (!/^\d{5}$/.test(zip) || zipSet.has(zip)) throw new Error(`Invalid/duplicate ZIP in ${file}: ${zip}`);
    zipSet.add(zip);
    if (!['Polygon', 'MultiPolygon'].includes(area.geometry.type)) throw new Error(`Non-area feature: ${zip}`);
    const polygons = area.geometry.type === 'Polygon' ? [area.geometry.coordinates] : area.geometry.coordinates;
    area.geometry.coordinates = polygons.map(polygon => polygon.map(ring => ring.map(point => projectStatePoint(state, ...point))));
    area.geometry.type = 'MultiPolygon';
    area.properties = { zip, crossState: area.properties.PARTFLG10 === 'Y' };
  }
  const weighted = presimplify(topology({ areas: input }));
  protectRings(weighted, state.code);
  const simplified = feature(simplify(weighted, minimumWeight), weighted.objects.areas);
  let vertices = 0;
  const areas = simplified.features.map(area => {
    const polygons = area.geometry.coordinates;
    let west = Infinity, north = Infinity, east = -Infinity, south = -Infinity;
    const path = polygons.map(polygon => polygon.map(ring => {
      vertices += ring.length - 1;
      for (const [x, y] of ring) {
        west = Math.min(west, x); east = Math.max(east, x);
        north = Math.min(north, y); south = Math.max(south, y);
      }
      return ring.slice(0, -1).map(([x, y], index) => `${index ? 'L' : 'M'}${round(x)},${round(y)}`).join('') + 'Z';
    }).join('')).join('');
    const largest = polygons.reduce((best, polygon) => twiceArea(polygon[0]) > twiceArea(best[0]) ? polygon : best);
    const center = polylabel(largest, 0.03).slice(0, 2).map(round);
    return { zip: area.properties.zip, path, bounds: [[west, north], [east, south]].map(point => point.map(round)), center,
      ...(area.properties.crossState ? { crossState: true } : {}) };
  }).sort((a, b) => a.zip.localeCompare(b.zip));
  const json = JSON.stringify({ state: state.code, source, areas });
  await writeFile(join(outputDirectory, `${state.code}.json`), json + '\n');
  manifestStates[state.code] = { count: areas.length, bytes: Buffer.byteLength(json) + 1, vertices,
    sourceFile: file, sourceSha256: createHash('sha256').update(raw).digest('hex'),
    crossStateCount: areas.filter(area => area.crossState).length,
    protectedZips: protectedZips[state.code] || [] };
  console.log(`${state.code}: ${areas.length} ZIP areas, ${vertices} vertices, ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB`);
}
let completeStates = manifestStates;
if (requestedStates.size) {
  try {
    const previous = JSON.parse(await readFile(join(outputDirectory, 'manifest.json'), 'utf8'));
    if (previous.source.commit !== source.commit) throw new Error('Existing manifest uses a different source commit. Run a full rebuild.');
    completeStates = { ...previous.states, ...manifestStates };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
if (Object.keys(completeStates).length === mapStates.length) {
  const manifest = { source, projection: 'State detail conic equal-area from src/us-map.js, 960 x 600',
    simplification: { method: 'Shared-arc Visvalingam, with every polygon and hole retained', maximumTriangleArea: minimumWeight, ringAreaRatio: 0.0001, coordinateDecimals: 5 },
    states: Object.fromEntries(Object.entries(completeStates).sort(([a], [b]) => a.localeCompare(b))),
    totalAreas: Object.values(completeStates).reduce((sum, row) => sum + row.count, 0),
    totalBytes: Object.values(completeStates).reduce((sum, row) => sum + row.bytes, 0) };
  await writeFile(join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Generated all ${mapStates.length} states; ${manifest.totalAreas} area portions; ${(manifest.totalBytes / 1048576).toFixed(1)} MB.`);
}
