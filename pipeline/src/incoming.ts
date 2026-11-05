import type { Member, PartyCode } from "./members.js";
import { generalElectionDate, partyCode } from "./members.js";
import type { Plan, StateRow } from "./geo-lib.js";
import type { Candidate, RaceRow } from "./wikipedia.js";
import { planDistricts } from "./validate.js";

export interface IncomingMember extends Member {
  /** "elected": named as the winner of the 2026 race. "carried-over": seat not on the ballot, so the sitting member continues. */
  basis: "elected" | "carried-over";
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
  members: IncomingMember[];
  undecided: UndecidedSeat[];
}

export const INCOMING_TERM_START = "2027-01-03";

/** Wikipedia party label to a party code. */
export function wikiPartyCode(label: string): PartyCode {
  const l = label.toLowerCase();
  if (l.startsWith("democrat") || l === "dfl" || l.includes("farmer")) return "D";
  if (l.startsWith("republican") || l === "gop") return "R";
  if (l.startsWith("independent")) return "I";
  return "O";
}

const PARTY_LABEL: Record<PartyCode, string> = { D: "Democrat", R: "Republican", I: "Independent", O: "Other" };

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Same person if the last names match and some given name of one starts like some given name of the other
 * (handles "Mike"/"Michael", middle names, quoted nicknames as in Robert C. "Bobby" Scott, and accents).
 * Callers only compare people within one state and chamber, so a shared last name is rare.
 */
export function sameName(a: string, b: string): boolean {
  const ta = norm(a).split(" ").filter(Boolean), tb = norm(b).split(" ").filter(Boolean);
  if (ta.length < 2 || tb.length < 2 || ta[ta.length - 1] !== tb[tb.length - 1]) return false;
  const givenA = ta.slice(0, -1).filter((t) => t.length >= 3), givenB = tb.slice(0, -1).filter((t) => t.length >= 3);
  return givenA.some((x) => givenB.some((y) => x.startsWith(y.slice(0, 3)) || y.startsWith(x.slice(0, 3))));
}

interface Ctx {
  states: StateRow[];
  current: Member[];
  today: string;
}

const stateByName = (states: StateRow[], name: string) => states.find((s) => s.name === name);

function labelToSeat(states: StateRow[], label: string): { state: StateRow; district: number } | null {
  const m = /^(.*?)\s+(\d+|at-large)$/i.exec(label.replace(/\u00a0/g, " ").trim());
  if (!m) return null;
  const state = stateByName(states, m[1]);
  return state ? { state, district: /at-large/i.test(m[2]) ? 0 : Number(m[2]) } : null;
}

function makeIncoming(
  c: Candidate,
  seat: { state: string; chamber: "sen" | "rep"; district: number | null; senate_class: number | null; term_end: string },
  current: Member[],
): IncomingMember {
  const code = wikiPartyCode(c.party);
  const prior = current.find((m) => m.chamber === seat.chamber && m.state === seat.state && sameName(m.name, c.name))
    ?? (seat.chamber === "rep" ? current.find((m) => m.chamber === "rep" && m.state === seat.state && sameName(m.name, c.name)) : undefined);
  const electionDate = generalElectionDate(Number(seat.term_end.slice(0, 4)) - 1);
  return {
    bioguide_id: prior?.bioguide_id ?? `new:${seat.state}-${seat.chamber}-${seat.district ?? `class${seat.senate_class}`}`,
    name: prior?.name ?? c.name,
    state: seat.state,
    chamber: seat.chamber,
    district: seat.district,
    party: PARTY_LABEL[code],
    party_code: code,
    senate_class: seat.senate_class,
    term_start: INCOMING_TERM_START,
    term_end: seat.term_end,
    election_date: electionDate,
    election_status: "upcoming",
    url: prior?.url ?? null,
    basis: "elected",
  };
}

const undecidedFrom = (rows: Candidate[]) => rows.map((c) => ({ name: c.name, party: c.party, party_code: wikiPartyCode(c.party) }));

/**
 * Incoming House: every district of each state's pending plan gets a winner, an "undecided" entry, or (for the
 * territory delegates with no 2026 race listed) the sitting delegate. Throws on any mismatch between
 * Wikipedia's rows and the plan districts, so a partial or reshuffled page can never be written silently.
 */
export function buildIncomingHouse(ctx: Ctx, plans: Plan[], topologies: Map<string, any>, rows: RaceRow[]) {
  const members: IncomingMember[] = [];
  const undecided: UndecidedSeat[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  const bySeat = new Map<string, RaceRow>();
  for (const r of rows) {
    const seat = labelToSeat(ctx.states, r.label);
    if (!seat) continue; // senate-style or unrecognized label
    const key = `${seat.state.postal}-${seat.district}`;
    if (bySeat.has(key)) problems.push(`duplicate Wikipedia row for ${key}`);
    bySeat.set(key, r);
  }
  for (const st of ctx.states) {
    const plan = plans.find((p) => p.state === st.postal && p.status === "pending") ?? plans.find((p) => p.state === st.postal && p.status === "active");
    if (!plan) { problems.push(`${st.postal}: no plan`); continue; }
    for (const d of planDistricts(topologies.get(plan.plan_id)).sort((a, b) => a - b)) {
      const key = `${st.postal}-${d}`;
      seen.add(key);
      const row = bySeat.get(key);
      const termEnd = "2029-01-03";
      if (!row) {
        const sitting = ctx.current.find((m) => m.chamber === "rep" && m.state === st.postal && m.district === d);
        // Only a delegate seat that was not on the 2026 ballot may be carried over (Puerto Rico's term is four years).
        if (sitting && st.postal === "PR") {
          members.push({ ...sitting, basis: "carried-over" });
        } else {
          problems.push(`${key}: no Wikipedia row in the plan's districts`);
        }
        continue;
      }
      const winners = row.candidates.filter((c) => c.winner);
      if (winners.length > 1) problems.push(`${key}: ${winners.length} winners marked`);
      if (winners.length === 1) {
        members.push(makeIncoming(winners[0], { state: st.postal, chamber: "rep", district: d, senate_class: null, term_end: termEnd }, ctx.current));
      } else {
        undecided.push({ state: st.postal, chamber: "rep", district: d, senate_class: null, candidates: undecidedFrom(row.candidates) });
      }
    }
  }
  for (const key of bySeat.keys()) if (!seen.has(key)) problems.push(`${key}: Wikipedia row has no district in the plan`);
  return { members, undecided, problems };
}

/**
 * Incoming Senate. Seats not on the 2026 ballot carry over. For each contested seat, the sitting senator whose
 * term is ending (election_status "held") in that state is replaced by the winner, or the seat is undecided.
 * Class 2 seats get a full term to 2033; the Florida and Ohio specials (Class 3) end 2029.
 */
export function buildIncomingSenate(ctx: Ctx, rows: RaceRow[]) {
  const members: IncomingMember[] = [];
  const undecided: UndecidedSeat[] = [];
  const problems: string[] = [];
  const sens = ctx.current.filter((m) => m.chamber === "sen");
  const contests = new Map<string, { row: RaceRow; special: boolean }>();
  for (const r of rows) {
    const m = /^(.*?)\s*(?:\(Class (\d)\))?$/.exec(r.label.trim());
    const st = m && stateByName(ctx.states, m[1].trim());
    if (!st) continue;
    if (contests.has(st.postal)) { problems.push(`${st.postal}: more than one Senate contest row`); continue; }
    contests.set(st.postal, { row: r, special: m![2] === "3" });
  }
  for (const s of sens) {
    const contest = contests.get(s.state);
    if (!contest || s.election_status !== "held") {
      members.push({ ...s, basis: "carried-over" });
      continue;
    }
    const { row, special } = contest;
    const cls = special ? 3 : 2;
    const termEnd = special ? "2029-01-03" : "2033-01-03";
    const winners = row.candidates.filter((c) => c.winner);
    if (winners.length > 1) problems.push(`${s.state}: ${winners.length} Senate winners marked`);
    if (winners.length === 1) {
      members.push(makeIncoming(winners[0], { state: s.state, chamber: "sen", district: null, senate_class: cls, term_end: termEnd }, ctx.current));
    } else {
      undecided.push({ state: s.state, chamber: "sen", district: null, senate_class: cls, candidates: undecidedFrom(row.candidates) });
    }
  }
  for (const st of contests.keys()) {
    const ending = sens.filter((s) => s.state === st && s.election_status === "held").length;
    if (ending !== 1) problems.push(`${st}: expected one senator with an ending term, found ${ending}`);
  }
  return { members, undecided, problems };
}
