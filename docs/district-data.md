# District boundary and member data

## Sources

- Boundaries: Census cartographic boundary file `cb_2025_us_cd119_500k` (119th Congress, 1:500k),
  https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_cd119_500k.zip
  (sha256 `8e804518d333d67e24e25c61767c6a7c78fd0a0852179e8cc19c36fd66011010`).
  Downloaded to `data/raw/` (git-ignored), converted by `npm run -w pipeline build:geo` into one simplified
  TopoJSON file per state under `data/geo/plans/<ST>/`, listed in `data/geo/manifest.json`.
- Members: `unitedstates/congress-legislators` `legislators-current.json`, converted by `build:members`
  into `data/generated/members.json`.
- `data/geo/states.json`: FIPS, postal code and name for the 50 states, DC and five territories.

## Rebuilding

    mkdir -p data/raw/cd119-2025 && cd data/raw
    curl -O https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_cd119_500k.zip && mv cb_2025_us_cd119_500k.zip cd119-2025.zip
    unzip cd119-2025.zip -d cd119-2025 && cd ../..
    npx tsx pipeline/src/build-geo.ts data/raw/cd119-2025/cb_2025_us_cd119_500k.shp data/raw/cd119-2025.zip \
      https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_cd119_500k.zip 119 2025
    npm run pipeline:members
    npm run pipeline:validate

`validate` cross-checks every sitting representative's district against the plan and lists vacancies
(on 2026-11-05: FL-20 and TX-23).

## Normalization

- At-large seats (`00`) and non-voting delegates (`98`) are both district 0. congress-legislators also uses 0.
- 56 plans, 441 districts: 435 voting seats plus six delegate seats (DC, PR, GU, VI, AS, MP).

## Boundary vintages compared (2026-11-05)

The Census published both a 2024 and a 2025 vintage of the 119th Congress file. Per-district land area differs
everywhere (an annual attribute refresh), so area is not a usable change signal. Comparing district centroids
and polygon areas found no district that moved more than 2% of its extent or changed area by more than 5%. So
neither file reflects any mid-decade redistricting. Both describe the lines used to elect the sitting 119th Congress.
This matches the sitting members, and the validator passes. It also means a map redrawn after 2024 is not in this
data. When one is enacted, add it as a `pending` plan per the design note ("District line changes").

## Election dates

A term ending Jan 3 of year Y is decided on general election day of Y-1 (Tuesday after the first Monday in
November). A term with another end date uses that end date. The 2026 general election was 2026-11-03, so all
House members and Class 2 senators show "held". The member list does not carry results; it changes when the
new members are sworn in on Jan 3, 2027.
