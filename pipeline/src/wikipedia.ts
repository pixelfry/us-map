import { parse, type HTMLElement } from "node-html-parser";

export interface Candidate {
  name: string;
  party: string;    // as printed on Wikipedia, e.g. "Democratic", "DFL", "Independent"
  winner: boolean;  // true only if Wikipedia marks this candidate as the winner
}

export interface RaceRow {
  label: string;        // first cell: "Virginia 1", "Alaska at-large", "Florida (Class 3)", "Alabama"
  candidates: Candidate[];
  status: string;       // "Incumbent re-elected.", "Democratic gain.", ...
}

const API = "https://en.wikipedia.org/w/api.php";

export interface WikiPage { title: string; revid: number; html: string }

/** Rendered HTML of a Wikipedia article through the MediaWiki API. */
export async function fetchWikiPage(title: string): Promise<WikiPage> {
  const url = `${API}?${new URLSearchParams({ action: "parse", page: title, prop: "text|revid", format: "json", formatversion: "2", disabletoc: "1" })}`;
  const res = await fetch(url, { headers: { "user-agent": "us-map/0.1 (personal project)" } });
  if (!res.ok) throw new Error(`Wikipedia ${title}: HTTP ${res.status}`);
  const d: any = await res.json();
  if (!d.parse?.text) throw new Error(`Wikipedia ${title}: unexpected response`);
  return { title, revid: d.parse.revid, html: d.parse.text };
}

const clean = (s: string) => s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function parseCandidate(li: HTMLElement): Candidate | null {
  // A hidden <span>Y</span> accompanies the green check mark Wikipedia puts beside a winner.
  const winner = li.querySelectorAll("span").some((s) => /display:\s*none/.test(s.getAttribute("style") ?? "") && clean(s.text) === "Y");
  let text = clean(li.text.replace(/\[[^\]]*\]/g, "")).replace(/^▌\s*/, ""); // drop footnote marks like [179]
  if (winner) text = text.replace(/^Y\s+/, "");
  const m = /^(.*?)\s*\(([^()]+)\)\s*(?:[\d.,]+%?)?\s*$/.exec(text);
  if (!m) return null;
  return { name: m[1].replace(/\s*\(incumbent\)$/i, "").trim(), party: m[2].trim(), winner };
}

function raceTables(root: HTMLElement): HTMLElement[] {
  return root.querySelectorAll("table.wikitable").filter((t) => {
    const head = t.text.slice(0, 600);
    // "This race ... Member" is the table of specials held during the preceding Congress (it repeats seats such
    // as Texas 18 with the special's result). The delegates table also says "This race" but has "Delegate".
    const isPriorSpecials = /This race/.test(head) && !/Delegate/.test(head);
    return !isPriorSpecials && /Candidates/.test(head) && t.querySelectorAll("li").some((li) => li.text.includes("▌"));
  });
}

/** Only the race tables, with images, styles and footnote marks removed. Used to keep test fixtures small. */
export function extractRaceTables(html: string): string {
  const root = parse(html);
  return raceTables(root)
    .map((t) => {
      t.querySelectorAll("img, style, sup, link").forEach((n) => n.remove());
      return t.outerHTML;
    })
    .join("\n");
}

/**
 * Race rows from Wikipedia's "Elections leading to the next Congress" tables: any table whose header has a
 * "Candidates" column and whose rows carry candidate lists (<ul><li>▌ ...). Tables of competitive seats and
 * ratings have no candidate lists and are skipped. A row's first cell labels the race.
 */
export function parseRaceRows(html: string): RaceRow[] {
  const rows: RaceRow[] = [];
  for (const table of raceTables(parse(html))) {
    for (const tr of table.querySelectorAll("tr")) {
      // Some rows (Louisiana) list "General election:" and then "Runoff:" inside one list. The runoff is the
      // deciding round: a check mark in the first round only means the candidate advanced. A "Runoff:" label
      // therefore discards the candidates collected so far.
      const lists = tr.querySelectorAll("ul").filter((ul) => ul.querySelectorAll("li").some((li) => li.text.includes("▌")));
      if (!lists.length) continue;
      let lis: HTMLElement[] = [];
      for (const li of lists[lists.length - 1].querySelectorAll("li")) {
        if (/^\s*Runoff/i.test(li.text)) lis = [];
        else if (li.text.includes("▌")) lis.push(li);
      }
      if (!lis.length) continue;
      const th = tr.querySelector("th");
      if (!th) continue;
      const candidates = lis.map(parseCandidate).filter((c): c is Candidate => c !== null);
      if (candidates.length !== lis.length) {
        throw new Error(`could not parse a candidate in row "${clean(th.text)}": ${lis.map((l) => clean(l.text)).join(" | ")}`);
      }
      const statusCell = tr.querySelectorAll("td").find((td) => /re-elected|gain|hold|retire|lost|elected|advanced|runoff|TBD/i.test(td.text) && !td.querySelector("li"));
      rows.push({ label: clean(th.text), candidates, status: clean(statusCell?.text ?? "") });
    }
  }
  return rows;
}
