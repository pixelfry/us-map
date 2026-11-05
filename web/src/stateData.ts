import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";

export type PartyCode = "D" | "R" | "I" | "O";
export type ViewMode = "current" | "incoming";

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
  basis?: "elected" | "carried-over"; // incoming members only
}

export interface UndecidedSeat {
  state: string;
  chamber: "sen" | "rep";
  district: number | null;
  senate_class: number | null;
  candidates: { name: string; party: string; party_code: PartyCode }[];
}

export interface IncomingFile {
  fetched_at: string;
  provisional: true;
  note: string;
  sources: { name: string; url: string; revid: number }[];
  members: Member[];
  undecided: UndecidedSeat[];
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

export interface PlanDiffFile {
  changed_threshold: number;
  diffs: { state: string; moved_fraction: number }[];
}

/** Everything the app loads once at startup. */
export interface AllData {
  states: StateRecord[];
  plans: Plan[];
  diff: PlanDiffFile;
  current: Member[];
  incoming: IncomingFile;
}

export const DELEGATE_STATES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);

/** The plan in force: the single active plan for the state; if several, the newest Congress. */
export function activePlan(plans: Plan[], state: string): Plan | null {
  const active = plans.filter((p) => p.state === state && p.status === "active");
  return active.sort((a, b) => b.effective_congress - a.effective_congress)[0] ?? null;
}

/** Incoming view uses the state's pending plan (the lines used on Nov 3, 2026); current view uses the active plan. */
export function planForMode(plans: Plan[], state: string, mode: ViewMode): Plan | null {
  if (mode === "incoming") {
    const pending = plans.filter((p) => p.state === state && p.status === "pending").sort((a, b) => b.effective_congress - a.effective_congress)[0];
    if (pending) return pending;
  }
  return activePlan(plans, state);
}

export function linesChanged(diff: PlanDiffFile, state: string): boolean {
  return (diff.diffs.find((d) => d.state === state)?.moved_fraction ?? 0) > diff.changed_threshold;
}

export const membersFor = (all: AllData, mode: ViewMode): Member[] => (mode === "incoming" ? all.incoming.members : all.current);
export const undecidedFor = (all: AllData, mode: ViewMode): UndecidedSeat[] => (mode === "incoming" ? all.incoming.undecided : []);

export interface StateData {
  state: StateRecord;
  mode: ViewMode;
  plan: Plan;
  topology: Topology;
  members: Member[];        // this state's members for the mode
  undecided: UndecidedSeat[]; // this state's undecided seats for the mode (incoming only)
  linesChanged: boolean;
}

export function districtFeatures(topology: Topology): FeatureCollection<Geometry, { district: number }> {
  const obj = Object.values(topology.objects)[0];
  return feature(topology, obj as any) as unknown as FeatureCollection<Geometry, { district: number }>;
}

export interface RepRow {
  district: number;
  label: string;                // "District 3", "At-large", "Delegate"
  member: Member | null;
  undecided: UndecidedSeat | null;
}

export interface SenRow {
  key: string;
  member: Member | null;
  undecided: UndecidedSeat | null;
}

export function districtLabel(state: string, district: number, plan: { district_count: number }): string {
  if (district !== 0) return `District ${district}`;
  return DELEGATE_STATES.has(state) ? "Delegate" : plan.district_count === 1 ? "At-large" : "District 0";
}

/** Join members to the districts of the plan in force. A district with neither a member nor an undecided entry is vacant. */
export function buildRows(data: Pick<StateData, "state" | "plan" | "topology" | "members" | "undecided">) {
  const districts = districtFeatures(data.topology).features.map((f) => f.properties.district).sort((a, b) => a - b);
  const members = data.members.filter((m) => m.chamber === "sen").sort((a, b) => a.name.localeCompare(b.name));
  const senators: SenRow[] = [
    ...members.map((m) => ({ key: m.bioguide_id, member: m, undecided: null })),
    ...data.undecided.filter((u) => u.chamber === "sen").map((u, i) => ({ key: `undecided-${i}`, member: null, undecided: u })),
  ];
  const reps: RepRow[] = districts.map((d) => ({
    district: d,
    label: districtLabel(data.state.postal, d, data.plan),
    member: data.members.find((m) => m.chamber === "rep" && m.district === d) ?? null,
    undecided: data.undecided.find((u) => u.chamber === "rep" && u.district === d) ?? null,
  }));
  return { senators, reps };
}

export interface Balance {
  senate: { D: number; R: number; I: number; O: number; undecided: number };
  house: { D: number; R: number; I: number; O: number; undecided: number; vacant: number }; // 435 voting seats; delegates excluded
}

/** Seat counts for the header. The House counts the 435 voting seats only. */
export function balance(all: AllData, mode: ViewMode): Balance {
  const members = membersFor(all, mode);
  const undecided = undecidedFor(all, mode);
  const b: Balance = {
    senate: { D: 0, R: 0, I: 0, O: 0, undecided: undecided.filter((u) => u.chamber === "sen").length },
    house: { D: 0, R: 0, I: 0, O: 0, undecided: undecided.filter((u) => u.chamber === "rep" && !DELEGATE_STATES.has(u.state)).length, vacant: 0 },
  };
  let houseSeated = 0;
  for (const m of members) {
    if (m.chamber === "sen") b.senate[m.party_code]++;
    else if (!DELEGATE_STATES.has(m.state)) { b.house[m.party_code]++; houseSeated++; }
  }
  b.house.vacant = 435 - houseSeated - b.house.undecided;
  return b;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

export function electionText(m: Pick<Member, "election_date" | "election_status">): string {
  return `${formatDate(m.election_date)} (${m.election_status})`;
}

export const PARTY_NAME: Record<PartyCode, string> = { D: "Democrat", R: "Republican", I: "Independent", O: "Other" };
