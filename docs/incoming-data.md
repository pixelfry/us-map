# Incoming Congress (Nov 3, 2026 election)

The header's "Incoming" view shows who holds each seat after the 2026 election. It is provisional.

## Sources

- Winners: Wikipedia, "2026 United States House of Representatives elections" and "2026 United States Senate
  elections", read through the MediaWiki API by `npm run pipeline:incoming`. The revision ids are recorded in
  `data/generated/incoming.json` (`sources`). A winner is the candidate Wikipedia marks with a check mark. Wikipedia is
  crowd-edited and results are not certified, so this is not an official result.
- District lines: Census TIGER/Line 2026 `tl_2026_<fips>_cd120.zip` (120th Congress), one zip per state, from
  https://www2.census.gov/geo/tiger/TIGER2026/CD/. Built into pending plans by `build-geo-tiger.ts`. 56 plans, 441 districts.
  `ZZ` features (areas in no district, such as open water) are dropped; before that was fixed they showed up as an extra
  "district 0" in CT, IL and NH.

## Rules

- Undecided: a seat with no winner marked is undecided. Louisiana lists a general-election round and a runoff in one
  cell; the runoff is the deciding round, so LA-5 and LA-6 are undecided until it is held.
- Seats not on the ballot carry over: 65 senators, and Puerto Rico's resident commissioner (four-year term).
- Terms: House and delegates 2027-01-03 to 2029-01-03 (next election 2028-11-07). Senate Class 2 winners to 2033-01-03
  (next election 2032-11-02). The Florida and Ohio specials (Class 3 seats) end 2029-01-03.
- Names are matched to the sitting roster (same state and chamber, same last name, a shared given-name prefix) so
  re-elected members keep their bioguide id and website; everyone else gets a placeholder id `new:<state>-...`.
- The builder aborts without writing if any plan district lacks a Wikipedia row, a row matches no district, two winners are
  marked, a state with a contest lacks exactly one senator whose term is ending, or the totals are not 100 and 441.
- Fixtures in `pipeline/test/fixtures/wikipedia-*-race-tables.html` are the race tables saved on 2026-11-05
  (`build-incoming.ts --save-fixtures` refreshes them).

## Which states' lines changed

`npm run -w pipeline diff:plans` compares each state's active and pending plan by sampling a 50x50 grid of points and
counting those assigned to a different district number (`data/geo/plan-diff.json`). Centroids and areas were tried first
and flagged almost every coastal state, because the 119th file is clipped to the coastline and TIGER is not.

On 2026-11-05, ten states exceeded the 2% threshold: AL, CA, FL, LA, MO, NC, OH, TN, TX, UT. MD, MA, NJ, SC, MN and WV
moved under 1%, which is boundary noise. Ballotpedia reports nine states redistricted between 2024 and 2026, so this
count differs by one; I did not reconcile which state accounts for the difference.

## State of the data (2026-11-05)

Senate: 52 D, 2 I, 44 R, 2 undecided (Alaska, Mississippi). House voting seats: 250 D, 153 R, 32 undecided.
These match the direction of national reporting but are not independently verified.
