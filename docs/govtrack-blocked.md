# GovTrack fetch is blocked (2026-11-05)

`govtrack.us/congress/bills/` sits behind a Cloudflare managed challenge.

Observed on 2026-11-05:

- `curl` with an identifying User-Agent: HTTP 403, "Just a moment..." page.
- Playwright + system Chromium (headless): HTTP 403, title "Just a moment...", UA contains `HeadlessChrome`.
- A normal desktop-profile browser session: the same interstitial, still showing after an 8 s wait. The page was growing, which looks like a widget that needs interaction.

Not tried, on purpose: solving the challenge, spoofing the User-Agent to hide headless, stealth plugins, or proxies. The pipeline treats a challenge as a failure and keeps the last good snapshot.

Because no real rendered HTML could be fetched, `pipeline/src/fetch-priority-bills.ts` has no parser yet and exits non-zero. The file `data/generated/priority-bills.json` is a dev sample: the 12 bills GovTrack listed on 2026-11-05, read through the Hermes web extractor.

## Ways forward

1. Ask GovTrack (hello@govtrack.us) for permission or an allowlist for a once-a-day fetch of that one page.
2. A one-off manual step: save the page from a real browser into `pipeline/test/fixtures/govtrack-bills.html`, write the parser against it, and refresh the data by hand or from a logged-in browser session.
3. Drop GovTrack as the source and use a Congress.gov-based ranking. This changes the definition of "priority".

Option 1 is the only one that gives a durable automated pipeline using GovTrack's data.
