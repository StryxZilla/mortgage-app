The state boundaries come from [us-atlas 3.0.1](https://github.com/topojson/us-atlas), which distributes simplified U.S. Census Bureau boundaries. `states-10m.json` is the source for all 50 states. The national map uses an Albers USA projection with Alaska and Hawaii insets. Every state detail map uses its own conic equal-area projection, centered on that state's longitude. This avoids reusing the national inset clipping for Alaska and Hawaii and gives each state a natural local orientation.

`src/us-map.js` is generated, including the small `projectStatePoint` helper that places ZIP longitude/latitude coordinates in the same projection as the state outline. The website requires no mapping library at runtime.

To regenerate the geometry without adding runtime packages to the app:

```sh
npm install --prefix ../work/map-data-tools --no-audit --no-fund d3-geo@3.1.1 topojson-client@3.1.0 us-atlas@3.0.1
MAP_DEPENDENCY_ROOT=../work/map-data-tools node scripts/generate-map.mjs
```

Alaska's source boundary crosses the antimeridian. The generator computes its center using the wrapped longitude interval so both the mainland and the western Aleutian islands are retained. Hawaii's national label is anchored on its largest island rather than the ocean centroid of the archipelago.

ZIP locations come from [zipcodes 8.0.0](https://www.npmjs.com/package/zipcodes/v/8.0.0), combining federalgovernmentzipcodes.us postal records and [GeoNames](https://www.geonames.org/) coordinates. The generated data retains the package's BSD license and GeoNames attribution. It contains 41,396 unique, five-digit ZIP records across the 50 states; DC and territories are outside this map's scope. Two invalid or outside-state source records are excluded. These are historical, approximate postal centers, not ZIP boundary polygons or a live USPS feed.

Regenerate the postal directory by unpacking `zipcodes@8.0.0` and passing its package directory to `node scripts/generate-zips.mjs /path/to/package`. The checked-in browser data requires no server or runtime dependencies. State views outline every available Census ZIP area with clickable polygons, loading one state's geometry at a time. Search and the complete scrollable list include postal ZIPs without a mapped area, preserving leading zeros. See [ZIP-BOUNDARIES.md](ZIP-BOUNDARIES.md) for the 2010 Census boundary source, coverage, geometry handling, and regeneration.

`npm test` validates all 50 state frames, all postal ZIP projections, unique postal codes, the complete 33,039 ZIP area portions, and known locations. Browser verification covers all 50 state dialogs at desktop and phone widths, the full ZIP lists, polygon selection, search, zoom, map panning, reset, loading retries, and keyboard navigation. An independent geometry audit checks the ZIP assets against their source files, including islands, holes, shared edges, and interior label centers.

City shortcuts use the five largest Census places in each state from ACS
2020–2024 table B01003, including census-designated places. Population and
TIGER 2024 place polygons were retrieved through [Census Reporter](https://api.censusreporter.org/)
on October 10, 2026. The generated `src/city-shortcuts.js` retains place IDs,
population, local ZIP lists, view frames and source metadata. Some lengthy
consolidated-government names are shortened for the buttons.

Purple highlights identify mapped ZIP areas whose interior label center is
inside a shortcut's place polygon or whose area overlaps it by at least 25%.
Where neither rule identifies a ZIP, the greatest area overlap supplies a
local shortcut. These ZIP areas can extend beyond municipal boundaries.
The view fits the ZIP/place intersections, excluding tiny border or water
slivers and offshore areas without mapped ZIPs. Selecting a city filters the
ZIP list and strengthens its map highlights; All ZIPs or reset restores the
whole state. Manual search clears the city filter. Shortcuts also work when
selected while ZIP outlines are still loading.

For regeneration, assemble raw input with `cities: {state: [{id,name,pop}]}`
and a `geometry` GeoJSON FeatureCollection. Population comes from
`/1.0/data/show/acs2024_5yr?table_ids=B01003&geo_ids=160|04000USNN`;
polygons come from `/1.0/geo/show/tiger2024?geo_ids=PLACE_IDS`. Project this
input with `node scripts/project-city-geometries.mjs RAW.json PROJECTED.json`,
then run `python scripts/generate-city-shortcuts.py PROJECTED.json` in an
environment with Shapely. The website needs no new runtime dependencies or
external requests for these shortcuts.
