import { zipLocations } from './zip-data.js';
import { mapStates } from './us-map.js?v=maps-3';

const byZip = new Map(Object.values(zipLocations).flat().map(row => [row[0], row]));

// Invert the existing state projection for mapped ZIPs without a postal center.
export function unprojectStatePoint(region, point) {
  const p = region?.detailProjection;
  if (!p || !point?.every(Number.isFinite)) return null;
  const x = (point[0] - p.translate[0]) / p.scale;
  const y = p.r0 - (p.centerY - (point[1] - p.translate[1]) / p.scale);
  const radius = Math.sign(p.n) * Math.hypot(x, y);
  const angle = Math.atan2(Math.sign(p.n) * x, Math.sign(p.n) * y);
  const latitude = Math.asin(Math.max(-1, Math.min(1, (p.c - (radius * p.n) ** 2) / (2 * p.n)))) * 180 / Math.PI;
  const longitude = ((p.longitude + angle / p.n * 180 / Math.PI + 540) % 360) - 180;
  return [latitude, longitude];
}

export function postalMapLocation(zip) {
  const row = byZip.get(zip);
  if (!row || !Number.isFinite(row[2]) || !Number.isFinite(row[3])) return null;
  return { center: [row[3], row[2]], city: row[1], kind: 'postal' };
}

export async function getZipMapLocation(zip, state) {
  if (typeof zip !== 'string' || !/^\d{5}$/.test(zip)) return null;
  const postal = postalMapLocation(zip);
  if (postal) return postal;
  const region = mapStates.find(region => region.code === state);
  if (!region) return null;
  const response = await fetch(new URL(`./zip-boundaries/${state}.json?v=zip-areas-1`, import.meta.url));
  if (!response.ok) throw new Error('ZIP map location could not load.');
  const area = (await response.json()).areas?.find(area => area.zip === zip);
  const center = area && unprojectStatePoint(region, area.center);
  return center ? { center, city: '', kind: 'area' } : null;
}
