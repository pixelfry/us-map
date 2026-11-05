import { enactedBills, fetchCongressJson, passedBills, SOURCE_ENACTED, SOURCE_PASSED } from "./congress-gov.js";
import { mergeSources, readPriorityFile, writePriorityFile } from "./priority-store.js";

const OUT = "../data/generated/priority-bills.json";
const CONGRESS = Number(process.env.CONGRESS ?? 119);

// A free key (https://api.congress.gov/sign-up/) gives 5,000 requests/hour. DEMO_KEY works but
// is limited to a handful of requests per hour, which is enough for this job's two calls.
const key = process.env.CONGRESS_API_KEY || "DEMO_KEY";
if (key === "DEMO_KEY") console.error("warning: CONGRESS_API_KEY not set, using the rate-limited DEMO_KEY");

try {
  const [updated, laws] = await Promise.all([
    fetchCongressJson(`/bill/${CONGRESS}?sort=updateDate+desc`, key),
    fetchCongressJson(`/law/${CONGRESS}`, key),
  ]);
  const bills = mergeSources([passedBills(updated), enactedBills(laws)]);
  if (bills.length === 0) throw new Error("no bills parsed; refusing to overwrite the snapshot");
  await writePriorityFile(OUT, { fetched_at: new Date().toISOString(), sources: [SOURCE_PASSED, SOURCE_ENACTED], bills });
  console.log(`wrote ${bills.length} bills to ${OUT}`);
} catch (err) {
  const last = await readPriorityFile(OUT);
  console.error(`fetch failed: ${(err as Error).message}`);
  console.error(last ? `keeping last good snapshot from ${last.fetched_at}` : "no previous snapshot exists");
  process.exit(1); // loud failure; the existing snapshot file is untouched
}
