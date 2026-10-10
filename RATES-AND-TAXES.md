# Mortgage rates and property taxes

Mortgage rates use Freddie Mac's Primary Mortgage Market Survey (PMMS), a
national weekly average for conventional purchase applications from borrowers
with good credit and 20% down. These are interest rates, not APRs or personal
lender quotes. Sources and publication dates are shown in the calculator and
the rate-history dialog. The initial 2021–present series was retrieved from
FRED (`MORTGAGE15US`, `MORTGAGE30US`); subsequent refreshes download Freddie
Mac's public historical workbook directly.

15- and 30-year calculations use their respective series. Freddie Mac does
not publish a 20-year series; the calculator explicitly identifies the 30-year
benchmark as a proxy for that term. A manually selected rate is retained for
all comparison terms until the user chooses “Use weekly benchmark.”

Rate updates remain manual, as requested. The prepared refresh workflow is
not installed on the default branch and no scheduled rate refresh is enabled.
Run the downloader below, review the snapshot, and deploy the Pages branch
`codex/build-interactive-mortgage-calculator` to publish a refresh.
Failed downloads never replace the last successful data. Observations older
than 14 days receive a visible stale-data warning.

The interactive dialog provides 1-month, 6-month, 1-year and 5-year ranges,
pointer exploration and a keyboard-accessible weekly slider. Its close button,
Escape key and backdrop dismiss it, and focus returns to the opening button.

Property taxes are Census ACS 2020–2024 five-year estimates from
`B25103_001E`: **median annual real estate taxes paid by owner-occupied
households** in each ZIP Code Tabulation Area. This is a historical annual
dollar amount, not a jurisdiction's statutory tax rate or a property's actual
bill. ZIP areas can cross taxing jurisdictions. Assessment rules, exemptions,
special assessments and reassessment after purchase can change a home's bill.
An exact figure requires that property's assessor/tax-collector record.

The extract covers all 33,772 ZCTAs, with 30,107 reported estimates. Missing
and suppressed estimates use the clearly identified fallback process below. Census's
`10,000+` and `200-` annotations remain lower/upper bounds, with explicit
instructions to adjust the starting amount. The default annual percentage is
the ZIP's median annual tax divided by its median home value. This ratio of
two medians is a planning proxy, not a statutory or property-specific rate.
It scales with the entered home price. Users can override the percentage or
enter an actual annual bill, which stays fixed when the home price changes.

## Missing data and home-value distribution

Missing ZIP home values use the nearest reported ZIP among the 32 closest
postal ZIP centers within 50 miles. Missing taxes use the nearest ZIP with
both reported home and tax medians, retaining that area's ratio. Distances
refer to ZIP centers; they do not identify the nearest parcel or jurisdiction.
If no qualifying neighbor is found, sourced state ACS medians are used,
then national medians if the state is unknown. Local snapshots also permit
these regional defaults when data loading fails. Defaults are italicized and
identify the source area; manual edits take precedence over late responses.

The eight distribution bands aggregate ACS 2024 five-year table B25075.
They describe estimated owner-occupied home values, not active listings or
recent sale prices. ZIP 94107 is cached locally; other ZCTAs load through the
public Census Reporter API. A postal ZIP without a ZCTA can use its nearby
default ZIP's distribution, clearly identified. If unavailable, the chart
shows that status without blocking the mortgage calculator.

## Insurance and equity

Insurance starts with NerdWallet / Quadrant's May 6, 2026 state-average
premium at $400,000 dwelling coverage, a $1,000 deductible and good credit.
The user can adjust dwelling rebuild coverage independently of sale price.
The model scales each state premium using the published national premium
curve from $200,000 to $800,000 coverage, with linear interpolation. This
assumes the national coverage effect applies to each state; it is not a ZIP
or property quote. Coverage outside that range requires an entered premium.
Flood, earthquake and separately insured wind can cost extra; Hawaii's
benchmark excludes hurricane wind. User-entered premiums are retained.
Sources and the benchmark date appear beside the insurance inputs.

Equity uses the amortized balance and the editable home-appreciation
assumption. Hover explores annual values; five-year markers support taps and
keyboard focus, and a slider explores every annual observation plus the
actual payoff month. The selected term remains visible after early payoff.

Regenerate taxes with `node scripts/generate-property-taxes.mjs INPUT.json`,
where `INPUT.json` contains `rows: [[fiveDigitZip, estimate, annotation], ...]`
from a complete 2024 ACS `B25103_001E` / `B25103_001EA` extract. The generated
snapshot retains the source URL and raw-input SHA-256. No API credentials
are shipped to the browser. Run `python3 scripts/download-rates.py` to refresh
rates, `npm test` to validate the data/calculations and `npm run build` to build.
