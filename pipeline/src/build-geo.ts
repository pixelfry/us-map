import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertState, districtCount, installPlanFile, loadStates, mergeManifest, type Plan } from "./geo-lib.js";

export type { Plan };

/**
 * Builds per-state district plans from a national Census cartographic boundary shapefile.
 *   tsx src/build-geo.ts <cb_YYYY_us_cdNNN_500k.shp> <zip-for-hash> <source-url> <congress> <vintage>
 * Output: data/geo/plans/<ST>/<ST>-cd<congress>-census<vintage>.topo.json and data/geo/manifest.json
 */
const [shp, zip, sourceUrl, congressArg, vintage] = process.argv.slice(2);
if (!shp || !zip || !sourceUrl || !congressArg || !vintage) {
  console.error("usage: build-geo.ts <shp> <zip> <source-url> <congress> <vintage>");
  process.exit(2);
}
const congress = Number(congressArg);
const sha = createHash("sha256").update(readFileSync(zip)).digest("hex");
const out = mkdtempSync(join(tmpdir(), "cdgeo-"));
const plans: Plan[] = [];
for (const st of loadStates()) {
  const built = join(out, `${st.fips}.json`);
  try {
    convertState(shp, `CD${congress}FP`, built, st.fips);
  } catch (err) {
    throw new Error(`mapshaper failed for ${st.postal}: ${(err as Error).message}`);
  }
  const planId = `${st.postal}-cd${congress}-census${vintage}`;
  plans.push({
    plan_id: planId,
    state: st.postal,
    source: `Census cartographic boundary file cb_${vintage}_us_cd${congress}_500k`,
    source_url: sourceUrl,
    source_sha256: sha,
    enacted_date: null,
    effective_congress: congress,
    effective_date: null,
    supersedes: null,
    status: "active",
    district_count: districtCount(built),
    file: installPlanFile(built, st.postal, planId),
  });
}
rmSync(out, { recursive: true, force: true });
mergeManifest(plans);
console.log(`wrote ${plans.length} state plans, ${plans.reduce((n, p) => n + p.district_count, 0)} districts`);
