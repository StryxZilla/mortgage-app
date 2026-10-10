The state boundaries come from [us-atlas 3.0.1](https://github.com/topojson/us-atlas), which distributes simplified U.S. Census Bureau boundaries. `states-10m.json` is the source for all 50 states. The national map uses an Albers USA projection with Alaska and Hawaii insets. Every state detail map uses its own conic equal-area projection, centered on that state's longitude. This avoids reusing the national inset clipping for Alaska and Hawaii and gives each state a natural local orientation.

`src/us-map.js` is generated, including the small `projectStatePoint` helper that places ZIP longitude/latitude coordinates in the same projection as the state outline. The website requires no mapping library at runtime.

To regenerate the geometry without adding runtime packages to the app:

```sh
npm install --prefix ../work/map-data-tools --no-audit --no-fund d3-geo@3.1.1 topojson-client@3.1.0 us-atlas@3.0.1
MAP_DEPENDENCY_ROOT=../work/map-data-tools node scripts/generate-map.mjs
```

Alaska's source boundary crosses the antimeridian. The generator computes its center using the wrapped longitude interval so both the mainland and the western Aleutian islands are retained. Hawaii's national label is anchored on its largest island rather than the ocean centroid of the archipelago.

ZIP locations come from [zipcodes 8.0.0](https://www.npmjs.com/package/zipcodes/v/8.0.0), combining federalgovernmentzipcodes.us postal records and [GeoNames](https://www.geonames.org/) coordinates. The generated data retains the package's BSD license and GeoNames attribution. It contains 41,396 unique, five-digit ZIP records across the 50 states; DC and territories are outside this map's scope. Two invalid or outside-state source records are excluded. These are historical, approximate postal centers, not ZIP boundary polygons or a live USPS feed.

Regenerate the ZIP dataset by unpacking `zipcodes@8.0.0` and passing its package directory to `node scripts/generate-zips.mjs /path/to/package`. The checked-in browser data requires no server or runtime dependencies. The state view groups nearby centers into clickable clusters and supports searching all available ZIPs by city or ZIP, including leading zeros.

`npm test` validates all 50 state frames, all ZIP projections, unique postal codes, and known locations in Alaska, Hawaii, Rhode Island, California, and New York. Browser verification also covers all 50 state dialogs at desktop, tablet, and phone widths, plus marker zoom, map panning, reset, ZIP selection, and keyboard navigation.
