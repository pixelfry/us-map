import { fetchGovtrackHtml } from "./browser.js";
import { readPriorityFile } from "./priority-store.js";

const OUT = "../data/generated/priority-bills.json";

// GovTrack source. The fetch half is real; the parse half is intentionally not written yet:
// it needs a real rendered-HTML fixture (test/fixtures/govtrack-bills.html), and GovTrack's
// Cloudflare check currently returns 403 to headless Chromium. See docs/govtrack-blocked.md.
try {
  const html = await fetchGovtrackHtml();
  console.error(`fetched ${html.length} bytes, but parser is not implemented (no fixture yet)`);
  process.exit(2);
} catch (err) {
  const last = await readPriorityFile(OUT);
  console.error(`GovTrack fetch failed: ${(err as Error).message}`);
  console.error(last ? `keeping last good snapshot from ${last.fetched_at}` : "no previous snapshot exists");
  process.exit(1); // loud failure; the existing snapshot file is untouched
}
