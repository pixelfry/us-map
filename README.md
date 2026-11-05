# us-map

Interactive map of the US Congress: states, districts colored by party, members and
re-election dates, and a table of priority bills linking to congress.gov.

Design and stack notes live in the Obsidian vault: Projects/Map project.md.
Stack: React + Vite + TypeScript frontend; Node/TypeScript pipeline; Congress.gov API as the bill source.

## Commands

    npm install
    npm run dev          # web app on localhost
    npm test             # pipeline + web tests
    npm run build
    npm run pipeline:members # refresh data/generated/members.json (no key needed)
    npm run pipeline:validate # cross-check members against district plans
    npm run pipeline:bills   # refresh data/generated/priority-bills.json from the Congress.gov API

Set `CONGRESS_API_KEY` (free: https://api.congress.gov/sign-up/) in `.env`/the shell. Without it the job uses the rate-limited DEMO_KEY.
GovTrack was dropped as a source because Cloudflare blocks automated fetches (docs/govtrack-blocked.md).

District boundary and member data: see docs/district-data.md.
