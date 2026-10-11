import { getZipMapLocation } from './local-map-data.js';

export const basemaps = {
  road: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  },
  terrain: {
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    maxNativeZoom: 16,
    attribution: '<a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank" rel="noopener noreferrer">USGS The National Map</a>',
  },
};

let leafletPromise, map, layer, observer, requestId = 0, timeout;
let style = 'road';

export function localMapMarkup() {
  return `<section class="zip-local-panel" aria-label="Selected ZIP map">
    <p class="mini">EXPLORE THE NEIGHBORHOOD</p><h2 class="local-map-title">Your ZIP, up close</h2>
    <div class="local-map-toolbar"><div class="local-map-styles" role="group" aria-label="Map view"><button data-basemap="road" aria-pressed="true">Road</button><button data-basemap="terrain" aria-pressed="false">Terrain</button></div><button class="local-map-reset" disabled>Recenter ZIP</button></div>
    <div class="local-map-frame"><div class="local-map" role="region" aria-label="Interactive ZIP map"></div><div class="local-map-notice" role="status"><span>Loading map…</span><button class="local-map-retry" hidden>Retry</button></div></div>
    <p class="local-map-caption">Drag to explore · Pinch or use +/− to zoom</p>
    <p class="local-map-location-note"></p>
  </section>`;
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./vendor/leaflet/leaflet.js', import.meta.url).href;
      script.onload = () => resolve(window.L);
      script.onerror = () => { script.remove(); leafletPromise = null; reject(new Error('Map controls could not load.')); };
      document.head.append(script);
    });
  }
  return leafletPromise;
}

function notice(text, retry = false) {
  const root = document.querySelector('.local-map-notice');
  root.hidden = !text;
  root.querySelector('span').textContent = text;
  const button = root.querySelector('button');
  if (!retry && document.activeElement === button) {
    const target = document.querySelector('.local-map[tabindex]') || document.querySelector('.close-modal');
    target.focus({ preventScroll: true });
  }
  button.hidden = !retry;
}

function setBasemap(L, next) {
  style = next;
  if (layer) { map.removeLayer(layer); layer.off(); }
  clearTimeout(timeout);
  document.querySelectorAll('[data-basemap]').forEach(button => button.setAttribute('aria-pressed', button.dataset.basemap === style));
  const currentLayer = L.tileLayer(basemaps[style].url, {
    ...basemaps[style], maxZoom: 19, keepBuffer: 1, updateWhenIdle: true,
  });
  layer = currentLayer;
  let loaded = 0, failed = 0;
  currentLayer.on('loading', () => {
    loaded = 0; failed = 0;
    notice(`Loading ${style === 'road' ? 'road' : 'terrain'} map…`);
    clearTimeout(timeout);
    timeout = setTimeout(() => { if (layer === currentLayer) notice('Map tiles are taking too long to load. Try another view or retry.', true); }, 15000);
  });
  currentLayer.on('tileload', () => loaded++);
  currentLayer.on('tileerror', () => failed++);
  currentLayer.on('load', () => {
    if (layer !== currentLayer) return;
    clearTimeout(timeout);
    notice(failed ? loaded ? 'Some map tiles could not load. Try another view or retry.' : 'Map tiles could not load. Try another view or retry.' : '', failed > 0);
  });
  currentLayer.addTo(map);
  document.querySelector('.local-map').dataset.basemap = style;
}

export async function showZipMap(zip, state) {
  destroyZipMap();
  const id = requestId, container = document.querySelector('.local-map');
  const title = document.querySelector('.local-map-title');
  title.textContent = `ZIP ${zip}`;
  container.setAttribute('aria-label', `Interactive road and terrain map for ZIP ${zip}`);
  const reset = document.querySelector('.local-map-reset');
  reset.disabled = true;
  document.querySelectorAll('[data-basemap]').forEach(button => { button.disabled = true; button.setAttribute('aria-pressed', button.dataset.basemap === style); });
  notice('Loading map…');
  document.querySelector('.local-map-retry').onclick = () => showZipMap(zip, state);
  try {
    const [L, location] = await Promise.all([loadLeaflet(), getZipMapLocation(zip, state)]);
    if (id !== requestId || !container.isConnected || !document.querySelector('.calc-modal.open')) return;
    if (!location) { notice(`No map location is available for ZIP ${zip}.`); return; }
    title.textContent = location.city ? `${location.city} · ${zip}` : `ZIP ${zip}`;
    document.querySelector('.local-map-location-note').textContent = location.kind === 'postal'
      ? 'Centered on an approximate ZIP location, not a property address.'
      : 'Centered inside the Census ZIP area, not a property address.';
    // Immediate zoom completion also makes rapid ZIP changes safe during pinch gestures.
    map = L.map(container, { scrollWheelZoom: false, zoomAnimation: false, minZoom: 2, maxZoom: 19, zoomControl: true });
    map.setView(location.center, 13);
    // This marker identifies the ZIP location; it is not a listing or a home.
    const marker = L.circleMarker(location.center, { radius: 8, color: '#fff', weight: 3, fillColor: '#7966d2', fillOpacity: 1 }).addTo(map);
    const label = document.createElement('span'); label.textContent = `ZIP ${zip} · approximate location`;
    marker.bindTooltip(label, { direction: 'top' });
    L.control.scale({ imperial: true, metric: false, position: 'bottomleft' }).addTo(map);
    setBasemap(L, style);
    reset.disabled = false;
    reset.onclick = () => map.setView(location.center, 13);
    document.querySelectorAll('[data-basemap]').forEach(button => { button.disabled = false; button.onclick = () => setBasemap(L, button.dataset.basemap); });
    document.querySelector('.local-map-retry').onclick = () => { if (map) setBasemap(L, style); };
    observer = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
    observer.observe(container);
    container.dataset.zip = zip;
    container.dataset.latitude = location.center[0];
    container.dataset.longitude = location.center[1];
  } catch {
    if (id === requestId && container.isConnected) notice('The ZIP map could not load. Your mortgage calculator is still available.', true);
  }
}

export function destroyZipMap() {
  requestId++;
  clearTimeout(timeout);
  observer?.disconnect(); observer = null;
  const container = map?.getContainer();
  map?.remove(); map = null;
  layer?.off(); layer = null;
  if (container) {
    container.className = 'local-map';
    container.removeAttribute('tabindex');
    for (const key of ['zip', 'latitude', 'longitude', 'basemap']) delete container.dataset[key];
  }
}
