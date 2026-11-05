import { chromium, type Browser } from "playwright";

export const GOVTRACK_BILLS_URL = "https://www.govtrack.us/congress/bills/";

// Identifying suffix appended to the browser's own User-Agent so the operator can tell who we are.
export const UA_SUFFIX = "us-map/0.1 (personal project; once-daily fetch)";

export class ChallengeError extends Error {}

export async function launch(): Promise<Browser> {
  // Playwright's bundled browser if present; override with CHROMIUM_PATH (e.g. /usr/bin/chromium).
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  return chromium.launch({ headless: true, executablePath });
}

/** Load the GovTrack bills page once and return the rendered HTML. Never tries to defeat a challenge. */
export async function fetchGovtrackHtml(): Promise<string> {
  const browser = await launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const ua = await page.evaluate(() => navigator.userAgent);
    await context.close();
    const ctx = await browser.newContext({ userAgent: `${ua} ${UA_SUFFIX}` });
    const p = await ctx.newPage();
    const resp = await p.goto(GOVTRACK_BILLS_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const html = await p.content();
    if (!resp || resp.status() >= 400 || /Just a moment\.\.\./.test(html)) {
      throw new ChallengeError(`GovTrack returned status ${resp?.status()} / challenge page`);
    }
    return html;
  } finally {
    await browser.close();
  }
}
