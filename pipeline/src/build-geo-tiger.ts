import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertState, districtCount, installPlanFile, loadStates, mergeManifest, type Plan } from "./geo-lib.js";

/**
 * Builds pending plans for an incoming Congress from per-state Census TIGER/Line zips
 * (tl_<vintage>_<fips>_cd<congress>.zip). Each new plan supersedes the state's active plan.
 *   tsx src/build-geo-tiger.ts <dir-of-zips> <source-url-base> <congress> <vintage>
 */
const [dir, urlBase, congressArg, vintage] = process.argv.slice(2);
if (!dir || !urlBase || !congressArg || !vintage) {
  console.error("usage: build-geo-tiger.ts <dir-of-zips> <source-url-base> <congress> <vintage>");
  process.exit(2);
}
const congress = Number(congressArg);
const manifest: Plan[] = JSON.parse(readFileSync(join(import.meta.dirname, "../../data/geo/manifest.json"), "utf8")).plans;
const work = mkdtempSync(join(tmpdir(), "tiger-"));
const plans: Plan[] = [];

for (const st of loadStates()) {
  const name = `tl_${vintage}_${st.fips}_cd${congress}.zip`;
  const zip = join(dir, name);
  const sha = createHash("sha256").update(readFileSync(zip)).digest("hex");
  const unz = join(work, st.fips);
  execFileSync("unzip", ["-q", "-o", zip, "-d", unz]); // untrusted archive: extracted into its own fresh directory
  const shp = readdirSync(unz).find((f) => f.endsWith(".shp"));
  if (!shp) throw new Error(`no .shp in ${name}`);
  const built = join(work, `${st.fips}.json`);
  convertState(join(unz, shp), `CD${congress}FP`, built);
  const planId = `${st.postal}-cd${congress}-tiger${vintage}`;
  const current = manifest.find((p) => p.state === st.postal && p.status === "active");
  plans.push({
    plan_id: planId,
    state: st.postal,
    source: `Census TIGER/Line ${vintage} congressional districts (${congress}th Congress)`,
    source_url: `${urlBase}${name}`,
    source_sha256: sha,
    enacted_date: null,
    effective_congress: congress,
    effective_date: `${1789 + 2 * (congress - 1)}-01-03`, // a Congress begins Jan 3 of its first year
    supersedes: current?.plan_id ?? null,
    status: "pending",
    district_count: districtCount(built),
    file: installPlanFile(built, st.postal, planId),
  });
}
rmSync(work, { recursive: true, force: true });
mergeManifest(plans);
console.log(`wrote ${plans.length} pending plans, ${plans.reduce((n, p) => n + p.district_count, 0)} districts`);
