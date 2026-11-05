import { writeFile, mkdir } from "node:fs/promises";
import { fetchGovtrackHtml } from "./browser.js";

// One-off: save the rendered page as a test fixture. Run manually, not on a schedule.
const html = await fetchGovtrackHtml();
await mkdir("test/fixtures", { recursive: true });
await writeFile("test/fixtures/govtrack-bills.html", html);
console.log(`saved ${html.length} bytes`);
