export interface LegislatorTerm {
  type: "sen" | "rep";
  start: string;
  end: string;
  state: string;
  district?: number;
  class?: number;
  party: string;
  url?: string;
}

export interface Legislator {
  id: { bioguide: string };
  name: { first: string; last: string; official_full?: string | null };
  terms: LegislatorTerm[];
}

export type PartyCode = "D" | "R" | "I" | "O";

export interface Member {
  bioguide_id: string;
  name: string;
  state: string;                 // postal code
  chamber: "sen" | "rep";
  district: number | null;       // null for senators; 0 = at-large or non-voting delegate
  party: string;
  party_code: PartyCode;
  senate_class: number | null;
  term_start: string;
  term_end: string;
  election_date: string;         // election that decides who holds this seat after term_end
  election_status: "upcoming" | "held";
  url: string | null;
}

export interface MembersFile {
  fetched_at: string;
  source: string;
  members: Member[];
}

export function partyCode(party: string): PartyCode {
  if (party === "Democrat") return "D";
  if (party === "Republican") return "R";
  if (party === "Independent") return "I";
  return "O";
}

/** Federal general election day: the Tuesday after the first Monday in November. */
export function generalElectionDate(year: number): string {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const firstMonday = 1 + ((8 - nov1.getUTCDay()) % 7);
  return new Date(Date.UTC(year, 10, firstMonday + 1)).toISOString().slice(0, 10);
}

/**
 * Terms end on Jan 3 of the year after the election that fills them, so a term ending Jan 3 of
 * year Y is decided on general election day of Y-1. A term with any other end date (e.g. a seat
 * with a special election) uses that end date as the election date.
 */
export function electionFor(termEnd: string, today: string): { date: string; status: "upcoming" | "held" } {
  const m = /^(\d{4})-01-03$/.exec(termEnd);
  const date = m ? generalElectionDate(Number(m[1]) - 1) : termEnd;
  return { date, status: date <= today ? "held" : "upcoming" };
}

export function toMembers(legislators: Legislator[], today: string): Member[] {
  const out: Member[] = [];
  for (const l of legislators) {
    const t = l.terms[l.terms.length - 1];
    const e = electionFor(t.end, today);
    out.push({
      bioguide_id: l.id.bioguide,
      name: l.name.official_full || `${l.name.first} ${l.name.last}`,
      state: t.state,
      chamber: t.type,
      district: t.type === "rep" ? (t.district ?? 0) : null,
      party: t.party,
      party_code: partyCode(t.party),
      senate_class: t.type === "sen" ? (t.class ?? null) : null,
      term_start: t.start,
      term_end: t.end,
      election_date: e.date,
      election_status: e.status,
      url: t.url ?? null,
    });
  }
  return out.sort(
    (a, b) =>
      a.state.localeCompare(b.state) ||
      (a.chamber === b.chamber ? 0 : a.chamber === "sen" ? -1 : 1) ||
      (a.district ?? 0) - (b.district ?? 0) ||
      a.name.localeCompare(b.name),
  );
}
