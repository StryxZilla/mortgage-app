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

The refresh workflow runs Thursdays and Fridays at 18:30 UTC, after PMMS's
scheduled publication, and supports manual dispatch. It checks out the Pages
source branch, downloads the official workbook without an API key, validates
both series, commits only changed rate data, and explicitly requests a Pages
build. GitHub schedules require this workflow on the default branch (`main`);
the site continues to publish from `codex/build-interactive-mortgage-calculator`.
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
and suppressed estimates remain blank and require user input. Census's
`10,000+` and `200-` annotations remain lower/upper bounds, with explicit
instructions to adjust the starting amount. Selecting a new ZIP refreshes its
tax default; editing a price keeps an entered annual tax bill fixed. Users can
enter their actual annual bill or switch to a percentage of home price.

Regenerate taxes with `node scripts/generate-property-taxes.mjs INPUT.json`,
where `INPUT.json` contains `rows: [[fiveDigitZip, estimate, annotation], ...]`
from a complete 2024 ACS `B25103_001E` / `B25103_001EA` extract. The generated
snapshot retains the source URL and raw-input SHA-256. No API credentials
are shipped to the browser. Run `python3 scripts/download-rates.py` to refresh
rates, `npm test` to validate the data/calculations and `npm run build` to build.
