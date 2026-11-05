# us-map

Interactive map of the US Congress: states, districts colored by party, members and
re-election dates, and a table of priority bills linking to congress.gov.

Design and stack notes live in the Obsidian vault: Projects/Map project.md.
Stack: React + Vite + TypeScript frontend; Node/TypeScript pipeline; Playwright (headless Chromium) for the GovTrack fetch.

## Commands

    npm install
    npm run dev          # web app on localhost
    npm test             # pipeline + web tests
    npm run build
    npm run pipeline:bills   # GovTrack fetch (currently blocked, see docs/govtrack-blocked.md)

`data/generated/priority-bills.json` is a dev sample until the pipeline can fetch GovTrack.
