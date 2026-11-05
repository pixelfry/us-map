import { congressGovUrl, formatBillId, parseBillId } from "./bill-id.js";
import type { PriorityBill } from "./types.js";

/**
 * Congress.gov API source. Congress.gov has no "most tracked" signal, so "priority" here means
 * legislation that reached a major milestone:
 *   - passed one chamber / presented to the President (still live), listed first
 *   - recently became law
 * Both lists are ordered by date of the latest action, newest first.
 */

export const SOURCE_PASSED = "congress-gov: passed a chamber";
export const SOURCE_ENACTED = "congress-gov: became law";

interface ApiBill {
  congress: number;
  type: string;
  number: string;
  title: string;
  latestAction?: { actionDate: string; text: string };
  laws?: { number: string; type: string }[];
}

export interface BillListResponse {
  bills: ApiBill[];
}

// Latest-action texts that mean the bill cleared a chamber or is on its way to the President.
const PASSED_RE =
  /^(Received in the (Senate|House)\b|Presented to President|Passed (Senate|House)|Passed\/agreed to in (Senate|House)|Resolving differences|Message on (Senate|House) action)/i;

function toBill(b: ApiBill, source: string): Omit<PriorityBill, "rank"> {
  const ref = parseBillId(`${b.congress}/${b.type.toLowerCase()}${b.number}`);
  return {
    bill_id: formatBillId(ref),
    title: b.title,
    tracked_count: null,
    source,
    congress_url: congressGovUrl(ref),
    latest_action: b.latestAction ? { date: b.latestAction.actionDate, text: b.latestAction.text } : undefined,
  };
}

function newestFirst<T extends { latest_action?: { date: string } }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.latest_action?.date ?? "").localeCompare(a.latest_action?.date ?? ""));
}

/**
 * Bills from /law/{congress}: everything that became law, ordered by latest action, newest first.
 * The endpoint is authoritative (every entry has a `laws` array), so no text matching is used. A law's
 * latest action can postdate enactment (e.g. a committee report filed later), so the date shown is
 * "latest action", not "date enacted".
 */
export function enactedBills(resp: BillListResponse, max = 50): PriorityBill[] {
  return newestFirst(
    resp.bills.filter((b) => (b.laws?.length ?? 0) > 0).map((b) => toBill(b, SOURCE_ENACTED)),
  )
    .slice(0, max)
    .map((b, i) => ({ ...b, rank: i + 1 }));
}

/** Bills from /bill/{congress} whose latest action is a chamber-passage milestone, newest first. */
export function passedBills(resp: BillListResponse, max = 50): PriorityBill[] {
  return newestFirst(
    resp.bills.filter((b) => b.latestAction && PASSED_RE.test(b.latestAction.text)).map((b) => toBill(b, SOURCE_PASSED)),
  )
    .slice(0, max)
    .map((b, i) => ({ ...b, rank: i + 1 }));
}

const API = "https://api.congress.gov/v3";

export async function fetchCongressJson(path: string, apiKey: string): Promise<BillListResponse> {
  const url = `${API}${path}${path.includes("?") ? "&" : "?"}format=json&limit=250`;
  const res = await fetch(url, {
    headers: { "x-api-key": apiKey, "user-agent": "us-map/0.1 (personal project)" },
  });
  if (!res.ok) throw new Error(`Congress.gov ${path}: HTTP ${res.status}`);
  return (await res.json()) as BillListResponse;
}
