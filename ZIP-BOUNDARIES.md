# ZIP area boundary data

The state map outlines use **2010 U.S. Census Bureau TIGER/Line ZIP Code Tabulation Areas (ZCTAs)**. These are statistical approximations of geographic ZIP areas, not USPS delivery routes or a current postal ZIP directory. ZIP codes assigned only to PO boxes or individual organizations often have no ZCTA polygon; they can still be available through the app's ZIP search. Unassigned areas can legitimately have no ZIP polygon. A ZCTA can cross a state border, so its state-clipped portion is selectable in each relevant state.

## Source and coverage

GeoJSON mirror: [OpenDataDE/State-zip-code-GeoJSON](https://github.com/OpenDataDE/State-zip-code-GeoJSON), pinned at commit `4cc2657044efd08477465aed1912dca30198d441`. The mirror documents conversion with GDAL from Census files named `tl_2010_STATE_FIPS_CODE_zcta510.zip`; its fields include `ZCTA5CE10`, `STATEFP10`, and `PARTFLG10`. Census-produced geographic data are in the public domain. No runtime request to Census or a commercial ZIP service is required.

Every feature in all 50 source state files is included. The state files already contain portions clipped to state boundaries, including cross-state ZCTAs whose primary postal city is in another state. The data build does not filter geometry according to the separate city/centroid directory. `src/zip-boundaries/manifest.json` records feature counts, source file SHA-256 checksums, output sizes, and counts of cross-state portions for independent review.

## Geometry and browser use

Each state is a separate lazily loaded JSON asset. Records use `{zip, path, bounds, center}` with optional `crossState: true`. SVG paths use the exact same individual state conic equal-area projection as `src/us-map.js`, on a 960 × 600 canvas. Multipolygons retain detached islands; interior rings retain holes. Render with SVG `fill-rule="evenodd"`. A map label center is computed inside the largest component using `polylabel`, accounting for holes.

The build constructs shared topology before Visvalingam simplification, so neighboring polygons share the same simplified border. The triangle-area threshold is the lesser of 0.01 square SVG units and 0.01% of each ring's area, retaining extra detail in small urban ZIP areas at neighborhood zoom. At least three distinct vertices are protected in every exterior and interior ring, including tiny ZIP areas. Coordinates are rounded to five decimal places to preserve narrow shoreline features and avoid collapsing nearby vertices at deep zoom. The simplification reduces client download and drawing cost; it is intended for visual ZIP selection, not surveying or determining whether a particular street address has a ZIP code.

An independent geometry audit identifies narrow source features where simplification can introduce a self-intersection or cross an interior hole. `src/zip-boundaries/protected-zips.json` records ZIPs requiring their exact source arcs. The generator retains every original vertex on their shared arcs, including the same edges in neighboring ZIP areas, to preserve valid geometry. This protection list is a reproducible build input, and per-state coverage metadata records its entries.

One upstream source exception is Kansas ZIP area `67143`, whose 2010 Census geometry contains nested interior rings. Its original contour rings are retained with SVG evenodd fill; this source limitation is recorded separately from any introduced simplification errors.

## Regeneration

Download and extract the pinned mirror commit into a scratch directory, then install build-only tools into another scratch directory:

```sh
npm install --prefix work/zip-boundary-tools --cache work/npm-cache \
  topojson-server@3.0.1 topojson-client@3.1.0 topojson-simplify@3.0.3 polylabel@2.0.1
ZIP_BOUNDARY_DEPENDENCY_ROOT="$PWD/work/zip-boundary-tools" \
  node scripts/generate-zip-boundaries.mjs work/zip-boundary-source
```

Optional state codes after the source directory rebuild individual files for inspection and refresh an existing coverage manifest. A full run creates the initial coverage manifest. The generator uses `projectStatePoint` from the app, so regenerate ZIP boundaries if state projection parameters change. Build tools and raw source GeoJSON are not browser dependencies and do not need to be committed.
