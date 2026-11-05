import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plan } from "./geo-lib.js";
import type { Member } from "./members.js";

export interface ValidationResult {
  problems: string[];
  vacancies: { state: string; district: number }[];
}

/** Districts present in a plan file, read from its TopoJSON geometries. */
export function planDistricts(topo: any): number[] {
  const obj = Object.values<any>(topo.objects)[0];
  return obj.geometries.map((g: any) => g.properties.district as number);
}

/**
 * Cross-check members against the active plan of each state:
 *  - every state has exactly one active plan
 *  - district numbers are unique within a plan
 *  - every sitting rep's district exists in the plan, and no two reps hold the same district
 *  - districts with no sitting rep are reported as vacancies (not an error)
 */
export function validate(plans: Plan[], topologies: Map<string, any>, members: Member[]): ValidationResult {
  const problems: string[] = [];
  const vacancies: { state: string; district: number }[] = [];
  const states = new Set(plans.map((p) => p.state));

  for (const st of states) {
    const active = plans.filter((p) => p.state === st && p.status === "active");
    if (active.length !== 1) {
      problems.push(`${st}: expected 1 active plan, found ${active.length}`);
      continue;
    }
    const plan = active[0];
    const topo = topologies.get(plan.plan_id);
    if (!topo) { problems.push(`${st}: plan file for ${plan.plan_id} not loaded`); continue; }
    const districts = planDistricts(topo);
    if (new Set(districts).size !== districts.length) problems.push(`${plan.plan_id}: duplicate district numbers`);
    if (districts.length !== plan.district_count) problems.push(`${plan.plan_id}: manifest says ${plan.district_count}, file has ${districts.length}`);

    const reps = members.filter((m) => m.chamber === "rep" && m.state === st);
    const held = new Map<number, number>();
    for (const r of reps) {
      held.set(r.district!, (held.get(r.district!) ?? 0) + 1);
      if (!districts.includes(r.district!)) problems.push(`${st}-${r.district}: ${r.name} holds a district not in ${plan.plan_id}`);
    }
    for (const [d, n] of held) if (n > 1) problems.push(`${st}-${d}: ${n} members hold the same district`);
    for (const d of districts) if (!held.has(d)) vacancies.push({ state: st, district: d });
  }
  return { problems, vacancies };
}

export function loadFromDisk(root: string) {
  const plans: Plan[] = JSON.parse(readFileSync(resolve(root, "data/geo/manifest.json"), "utf8")).plans;
  const topologies = new Map<string, any>();
  for (const p of plans) topologies.set(p.plan_id, JSON.parse(readFileSync(resolve(root, "data/geo", p.file), "utf8")));
  const members: Member[] = JSON.parse(readFileSync(resolve(root, "data/generated/members.json"), "utf8")).members;
  return { plans, topologies, members };
}
