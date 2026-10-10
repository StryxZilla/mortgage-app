The home-price default comes from the U.S. Census Bureau's [2020–2024 American Community Survey 5-year table B25077](https://data.census.gov/table/ACSDT5Y2024.B25077), variable `B25077_001E`: the **median value of owner-occupied housing units** in each ZIP Code Tabulation Area (ZCTA). The survey asks homeowners what their property would sell for. This is a survey estimate of existing homes, rather than a median of recent sale transactions, listing prices, or a live appraisal. Users can edit the amount before calculating.

The [2024 ACS release](https://www.census.gov/programs-surveys/acs/news/data-releases/2024/release.html) was published on January 29, 2026 and is the latest available ACS 5-year release when this snapshot was retrieved on October 10, 2026. Five-year estimates pool responses from 2020 through 2024. [Variable metadata](https://api.census.gov/data/2024/acs/acs5/groups/B25077.json) identifies the universe as owner-occupied housing units. ZCTAs approximate postal ZIP service areas; some postal ZIPs, such as many PO-box ZIPs, have no corresponding Census estimate.

`src/zip-home-values.json` contains the complete nationwide 33,772-ZCTA extract, including DC and Puerto Rico in the source, with 30,260 reported values or annotated bounds. Of these, 30,138 are ordinary estimates, 100 are top-coded `$2,000,000+`, and 22 are bottom-coded `$10,000-`. The 3,512 unavailable estimates are omitted from the value lookup. In this website's 50-state postal directory, 30,107 ZIPs match a reported value or bound. Leading zeros are preserved. The initially displayed ZIP loads its median automatically. Selecting a ZIP clears the previous ZIP's price while loading; ZIPs without an estimate require an entered price and show that a median is unavailable. There is no fabricated statewide or neighboring-ZIP replacement.

The Census's display annotations matter. An API estimate of `2000001` with the annotation `2,000,000+` represents the open-ended upper class, not an exact median of $2,000,001. Likewise, `9999` with `10,000-` represents the lower class. The generator stores these as editable calculation starting points of $2,000,000 or $10,000 and marks the ZIP in `atLeast` or `atMost`. The interface displays the corresponding bound. Null, negative sentinel, suppressed, and unrecognized annotated results remain unavailable.

The initial extract was retrieved through Firecrawl's `census-gov / census/data` provider using dataset `acs/acs5`, vintage `2024`, variable `B25077_001E`, and geography `zip code tabulation area:*`. All seven pages were consumed: six pages of 5,000 rows and one of 3,772. Every page reported complete results and no warnings; the provider retained the Census estimate annotations. The equivalent official query is recorded in the generated source metadata. A SHA-256 hash records the exact compact source snapshot used for generation. The checked-in data is public Census statistical data; no API key is shipped.

To refresh using the official Census API, provide a registered Census API key in the environment and run:

```sh
CENSUS_API_KEY=your_key node scripts/generate-home-values.mjs
```

The key is used only by the build-time request. It is never included in generated data or browser requests. Census data requests now require a key; metadata requests remain public. The default vintage is 2024. For a different vintage, pass an input JSON path followed by the year:

```sh
node scripts/generate-home-values.mjs /path/to/complete-census-extract.json 2024
```

Supported input formats are the official Census API array, which must include the ZIP, estimate, and estimate-annotation columns; a complete provider record response; or a compact `{source, rows}` snapshot whose rows are `[zip, rawEstimate, officialAnnotation]`. Merge all provider pages before generation. The generator rejects duplicate ZIPs, invalid ZIP strings, and extracts with fewer than 30,000 rows. An optional `source.releaseDate` in a compact snapshot preserves the documented release date.

The browser lazily loads the checked-in 453 KB JSON once and shares that request across ZIP lookups. It makes no runtime request to Census or a third-party home-value service. Failed downloads can be retried. Tests check complete coverage, genuine sample values, leading zeros, annotated bounds, missing values, and lazy-loading failure recovery.
