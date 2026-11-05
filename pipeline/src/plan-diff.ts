import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { geoBounds, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { loadStates, root, type Plan } from "./geo-lib.js";

type Fc = FeatureCollection<Geometry, { district: number }>;

const readPlan = (p: Plan): Fc => {
  const topo = JSON.parse(readFileSync(join(root, "data/geo", p.file), "utf8"));
  return feature(topo, Object.values<any>(topo.objects)[0]) as unknown as Fc;
};

export interface PlanDiff {
  state: string;
  from: string;
  to: string;
  sampled: number;              // sample points that fall on land in both plans
  moved_fraction: number;       // share of those points assigned to a different district number
  changed_districts: number[];  // districts where more than `districtTol` of their points moved
}

/**
 * Compare two plans of one state by sampling a grid of points. A point "moves" if it lies in district X
 * in plan A and district Y != X in plan B. Points outside either plan (water, coast generalization) are
 * ignored, so boundary products with different coastlines can be compared without false positives.
 * Comparing centroids or areas instead would flag every coastal district.
 */
export function diffPlans(a: Fc, b: Fc, grid = 50, districtTol = 0.03): Pick<PlanDiff, "sampled" | "moved_fraction" | "changed_districts"> {
  const [[w, s], [e, n]] = geoBounds({ type: "FeatureCollection", features: [...a.features, ...b.features] } as any);
  const lonSpan = e >= w ? e - w : e + 360 - w; // handles the antimeridian (Alaska)
  const find = (fc: Fc, pt: [number, number]): number | null => {
    for (const f of fc.features) if (geoContains(f as Feature, pt)) return f.properties.district;
    return null;
  };
  const per = new Map<number, { total: number; moved: number }>();
  let sampled = 0, moved = 0;
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      let lon = w + ((i + 0.5) / grid) * lonSpan;
      if (lon > 180) lon -= 360;
      const lat = s + ((j + 0.5) / grid) * (n - s);
      const da = find(a, [lon, lat]);
      if (da === null) continue;
      const db = find(b, [lon, lat]);
      if (db === null) continue;
      sampled++;
      const rec = per.get(da) ?? { total: 0, moved: 0 };
      rec.total++;
      if (da !== db) { rec.moved++; moved++; }
      per.set(da, rec);
    }
  }
  return {
    sampled,
    moved_fraction: sampled ? moved / sampled : 0,
    changed_districts: [...per].filter(([, r]) => r.moved / r.total > districtTol).map(([d]) => d).sort((x, y) => x - y),
  };
}

export function diffAll(plans: Plan[]): PlanDiff[] {
  const out: PlanDiff[] = [];
  for (const st of loadStates()) {
    const active = plans.find((p) => p.state === st.postal && p.status === "active");
    const pending = plans.find((p) => p.state === st.postal && p.status === "pending");
    if (!active || !pending) continue;
    out.push({ state: st.postal, from: active.plan_id, to: pending.plan_id, ...diffPlans(readPlan(active), readPlan(pending)) });
  }
  return out;
}

/** A state's lines changed if enough sampled points moved to a different district. */
export const linesChanged = (d: PlanDiff, threshold = 0.02) => d.moved_fraction > threshold;

if (import.meta.url === `file://${process.argv[1]}`) {
  const plans: Plan[] = JSON.parse(readFileSync(join(root, "data/geo/manifest.json"), "utf8")).plans;
  const diffs = diffAll(plans);
  for (const d of diffs.filter((x) => x.moved_fraction > 0.002)) console.log(`${d.state}: ${(d.moved_fraction * 100).toFixed(1)}% of ${d.sampled} points moved; districts ${d.changed_districts.join(",") || "-"}`);
  const changed = diffs.filter((d) => linesChanged(d));
  writeFileSync(
    join(root, "data/geo/plan-diff.json"),
    JSON.stringify({ method: "50x50 grid sample per state; points on land in both plans", changed_threshold: 0.02, diffs }, null, 1) + "\n",
  );
  console.log(`${changed.length} of ${diffs.length} plans have different lines: ${changed.map((d) => d.state).join(" ")}`);
}
