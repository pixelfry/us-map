import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const root = resolve(import.meta.dirname, "../..");

export interface StateRow { fips: string; postal: string; name: string }

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

export const loadStates = (): StateRow[] => JSON.parse(readFileSync(join(root, "data/geo/states.json"), "utf8"));

/**
 * Convert one state's districts from a shapefile to simplified TopoJSON.
 * The district number is the Census CDnnnFP field; at-large (00) and delegate (98) both become district 0; ZZ areas are dropped.
 */
export function convertState(shp: string, field: string, outFile: string, stateFips?: string): void {
  const args = [shp];
  if (stateFips) args.push("-filter", `STATEFP == "${stateFips}"`);
  // "ZZ" marks areas assigned to no district (e.g. open water); they are not districts.
  args.push(
    "-filter", `${field} != "ZZ"`,
    "-each", `district = (${field} == "98") ? 0 : +${field}`,
    "-filter-fields", "district",
    "-simplify", "percentage=12%", "keep-shapes",
    "-o", outFile, "format=topojson", "precision=0.0001",
  );
  execFileSync(join(root, "node_modules/.bin/mapshaper"), args, { stdio: ["ignore", "ignore", "pipe"] });
}

export function districtCount(topoFile: string): number {
  const topo = JSON.parse(readFileSync(topoFile, "utf8"));
  return (Object.values<any>(topo.objects)[0].geometries as unknown[]).length;
}

/** Copy a built file into data/geo/plans and return its manifest-relative path. */
export function installPlanFile(builtFile: string, postal: string, planId: string): string {
  const rel = `plans/${postal}/${planId}.topo.json`;
  mkdirSync(join(root, "data/geo/plans", postal), { recursive: true });
  copyFileSync(builtFile, join(root, "data/geo", rel));
  return rel;
}

/** Merge new plans into data/geo/manifest.json, replacing any with the same plan_id. */
export function mergeManifest(newPlans: Plan[]): Plan[] {
  const path = join(root, "data/geo/manifest.json");
  let existing: Plan[] = [];
  try { existing = JSON.parse(readFileSync(path, "utf8")).plans; } catch {}
  const kept = existing.filter((p) => !newPlans.some((n) => n.plan_id === p.plan_id));
  const all = [...kept, ...newPlans].sort((a, b) => a.state.localeCompare(b.state) || a.effective_congress - b.effective_congress);
  writeFileSync(path, JSON.stringify({ plans: all }, null, 1) + "\n");
  return all;
}
