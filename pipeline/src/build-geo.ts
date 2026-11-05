import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Builds per-state district boundary files ("plans") from a Census cartographic boundary shapefile.
 *
 *   tsx src/build-geo.ts <path/to/cb_YYYY_us_cdNNN_500k.shp> <zip-path-for-hash> <source-url> <congress> <vintage>
 *
 * Output (relative to the repo root):
 *   data/geo/plans/<ST>/<ST>-cd<congress>-census<vintage>.topo.json
 *   data/geo/manifest.json   (merged: existing plans for other states / congresses are kept)
 */

interface StateRow { fips: string; postal: string; name: string }

export interface Plan {
  plan_id: string;
  state: string;
  source: string;
  source_url: string;
  source_sha256: string;
  enacted_date: string | null;
  effective_congress: number;
  effective_date: string | null;
  supersedes: string | null;
  status: "active" | "pending" | "superseded";
  district_count: number;
  file: string;
}

const root = resolve(import.meta.dirname, "../..");
const [shp, zip, sourceUrl, congressArg, vintage] = process.argv.slice(2);
if (!shp || !zip || !sourceUrl || !congressArg || !vintage) {
  console.error("usage: build-geo.ts <shp> <zip> <source-url> <congress> <vintage>");
  process.exit(2);
}
const congress = Number(congressArg);
const states: StateRow[] = JSON.parse(readFileSync(join(root, "data/geo/states.json"), "utf8"));
const postalByFips = new Map(states.map((s) => [s.fips, s.postal]));
const sha = createHash("sha256").update(readFileSync(zip)).digest("hex");

const out = mkdtempSync(join(tmpdir(), "cdgeo-"));
const mapshaper = join(root, "node_modules/.bin/mapshaper");
const field = `CD${congress}FP`;
// One mapshaper run per state, so each output file holds only that state's districts.
for (const st of states) {
  try {
    execFileSync(
      mapshaper,
      [
        shp,
        "-filter", `STATEFP == "${st.fips}"`,
        "-each", `district = (${field} == "98" || ${field} == "ZZ") ? 0 : +${field}`, // at-large (00) and delegates (98) are district 0
        "-filter-fields", "district",
        "-simplify", "percentage=12%", "keep-shapes",
        "-o", join(out, `${st.fips}.json`), "format=topojson", "precision=0.0001",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } catch (err) {
    throw new Error(`mapshaper failed for ${st.postal}: ${(err as Error).message}`);
  }
}

const manifestPath = join(root, "data/geo/manifest.json");
let existing: Plan[] = [];
try { existing = JSON.parse(readFileSync(manifestPath, "utf8")).plans; } catch {}

const plans: Plan[] = [];
for (const f of readdirSync(out)) {
  const fips = f.replace(/\.json$/, "");
  const postal = postalByFips.get(fips);
  if (!postal) throw new Error(`unknown state FIPS in output: ${f}`);
  const topo = JSON.parse(readFileSync(join(out, f), "utf8"));
  const geoms = Object.values<any>(topo.objects)[0].geometries as any[];
  const planId = `${postal}-cd${congress}-census${vintage}`;
  const rel = `plans/${postal}/${planId}.topo.json`;
  mkdirSync(join(root, "data/geo/plans", postal), { recursive: true });
  copyFileSync(join(out, f), join(root, "data/geo", rel));
  plans.push({
    plan_id: planId,
    state: postal,
    source: `Census cartographic boundary file cb_${vintage}_us_cd${congress}_500k`,
    source_url: sourceUrl,
    source_sha256: sha,
    enacted_date: null,
    effective_congress: congress,
    effective_date: null,
    supersedes: null,
    status: "active",
    district_count: geoms.length,
    file: rel,
  });
}
rmSync(out, { recursive: true, force: true });

const kept = existing.filter((p) => !plans.some((n) => n.plan_id === p.plan_id));
const all = [...kept, ...plans].sort((a, b) => a.state.localeCompare(b.state) || a.effective_congress - b.effective_congress);
writeFileSync(manifestPath, JSON.stringify({ plans: all }, null, 1) + "\n");
const total = plans.reduce((n, p) => n + p.district_count, 0);
const bytes = plans.reduce((n, p) => n + statSync(join(root, "data/geo", p.file)).size, 0);
console.log(`wrote ${plans.length} state plans, ${total} districts, ${(bytes / 1024).toFixed(0)} KiB`);
