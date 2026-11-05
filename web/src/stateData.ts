import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";

export type PartyCode = "D" | "R" | "I" | "O";

export interface Member {
  bioguide_id: string;
  name: string;
  state: string;
  chamber: "sen" | "rep";
  district: number | null;
  party: string;
  party_code: PartyCode;
  senate_class: number | null;
  term_start: string;
  term_end: string;
  election_date: string;
  election_status: "upcoming" | "held";
  url: string | null;
}

export interface Plan {
  plan_id: string;
  state: string;
  source: string;
  source_url: string;
  effective_congress: number;
  effective_date: string | null;
  status: "active" | "pending" | "superseded";
  district_count: number;
  file: string;
}

export interface StateRecord { fips: string; postal: string; name: string }

export interface StateData {
  state: StateRecord;
  plan: Plan;
  topology: Topology;
  members: Member[]; // members of this state only
}

export type LoadStateData = (fips: string) => Promise<StateData>;

const DELEGATE_STATES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);

/** The plan in force: the single active plan for the state; if several, the newest Congress. */
export function activePlan(plans: Plan[], state: string): Plan | null {
  const active = plans.filter((p) => p.state === state && p.status === "active");
  return active.sort((a, b) => b.effective_congress - a.effective_congress)[0] ?? null;
}

export function districtFeatures(topology: Topology): FeatureCollection<Geometry, { district: number }> {
  const obj = Object.values(topology.objects)[0];
  return feature(topology, obj as any) as unknown as FeatureCollection<Geometry, { district: number }>;
}

export interface RepRow {
  district: number;
  label: string;      // "District 3", "At-large", "Delegate"
  member: Member | null; // null = vacant
}

export function districtLabel(state: string, district: number, plan: { district_count: number }): string {
  if (district !== 0) return `District ${district}`;
  return DELEGATE_STATES.has(state) ? "Delegate" : plan.district_count === 1 ? "At-large" : "District 0";
}

/** Join members to the districts of the plan in force. Rows follow plan order; a district with no member is vacant. */
export function buildRows(data: Pick<StateData, "state" | "plan" | "topology" | "members">) {
  const districts = districtFeatures(data.topology).features.map((f) => f.properties.district).sort((a, b) => a - b);
  const senators = data.members.filter((m) => m.chamber === "sen").sort((a, b) => a.name.localeCompare(b.name));
  const reps: RepRow[] = districts.map((d) => ({
    district: d,
    label: districtLabel(data.state.postal, d, data.plan),
    member: data.members.find((m) => m.chamber === "rep" && m.district === d) ?? null,
  }));
  return { senators, reps };
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

export function electionText(m: Pick<Member, "election_date" | "election_status">): string {
  return `${formatDate(m.election_date)} (${m.election_status})`;
}

export const PARTY_NAME: Record<PartyCode, string> = { D: "Democrat", R: "Republican", I: "Independent", O: "Other" };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export const loadStateData: LoadStateData = async (fips) => {
  const base = import.meta.env.BASE_URL;
  const [states, manifest, membersFile] = await Promise.all([
    getJson<StateRecord[]>(`${base}geo/states.json`),
    getJson<{ plans: Plan[] }>(`${base}geo/manifest.json`),
    getJson<{ members: Member[] }>(`${base}data/members.json`),
  ]);
  const state = states.find((s) => s.fips === fips);
  if (!state) throw new Error(`Unknown state code ${fips}`);
  const plan = activePlan(manifest.plans, state.postal);
  if (!plan) throw new Error(`No active district plan for ${state.postal}`);
  const topology = await getJson<Topology>(`${base}geo/${plan.file}`);
  return { state, plan, topology, members: membersFile.members.filter((m) => m.state === state.postal) };
};
