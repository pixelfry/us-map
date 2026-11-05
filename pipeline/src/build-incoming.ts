import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { loadStates, root, type Plan } from "./geo-lib.js";
import { buildIncomingHouse, buildIncomingSenate, type IncomingFile } from "./incoming.js";
import type { Member } from "./members.js";
import { extractRaceTables, fetchWikiPage, parseRaceRows } from "./wikipedia.js";

/**
 * Builds data/generated/incoming.json: who holds each seat after the Nov 3, 2026 election, per Wikipedia.
 *   tsx src/build-incoming.ts [--save-fixtures]
 * Provisional: Wikipedia is crowd-edited and races are still being called. Uncalled seats are listed as undecided.
 * Any inconsistency (a plan district with no row, two winners, a missing senator) aborts without writing.
 */
const HOUSE = "2026 United States House of Representatives elections";
const SENATE = "2026 United States Senate elections";
const saveFixtures = process.argv.includes("--save-fixtures");
const OUT = join(root, "data/generated/incoming.json");

const [house, senate] = [await fetchWikiPage(HOUSE), await fetchWikiPage(SENATE)];
if (saveFixtures) {
  mkdirSync(join(root, "pipeline/test/fixtures"), { recursive: true });
  writeFileSync(join(root, "pipeline/test/fixtures/wikipedia-house-race-tables.html"), extractRaceTables(house.html));
  writeFileSync(join(root, "pipeline/test/fixtures/wikipedia-senate-race-tables.html"), extractRaceTables(senate.html));
  console.log("saved fixtures");
}

const plans: Plan[] = JSON.parse(readFileSync(join(root, "data/geo/manifest.json"), "utf8")).plans;
const topologies = new Map<string, any>();
for (const p of plans) topologies.set(p.plan_id, JSON.parse(readFileSync(join(root, "data/geo", p.file), "utf8")));
const current: Member[] = JSON.parse(readFileSync(join(root, "data/generated/members.json"), "utf8")).members;
const ctx = { states: loadStates(), current, today: new Date().toISOString().slice(0, 10) };

const h = buildIncomingHouse(ctx, plans, topologies, parseRaceRows(house.html));
const s = buildIncomingSenate(ctx, parseRaceRows(senate.html));
const problems = [...h.problems, ...s.problems];
const seats = (arr: { chamber: string }[], c: string) => arr.filter((m) => m.chamber === c).length;
if (seats(s.members, "sen") + seats(s.undecided, "sen") !== 100) problems.push("Senate total is not 100");
if (seats(h.members, "rep") + seats(h.undecided, "rep") !== 441) problems.push("House total is not 441 (435 + 6 delegates)");
if (problems.length) {
  console.error(`aborting, ${problems.length} problems; ${OUT} untouched:\n` + problems.slice(0, 40).join("\n"));
  process.exit(1);
}

const file: IncomingFile = {
  fetched_at: new Date().toISOString(),
  provisional: true,
  note: "Provisional. Winners are as listed on Wikipedia when fetched; this is not an official or certified result. Uncalled seats are undecided.",
  sources: [house, senate].map((p) => ({ name: `Wikipedia: ${p.title}`, url: `https://en.wikipedia.org/wiki/${p.title.replace(/ /g, "_")}`, revid: p.revid })),
  members: [...s.members, ...h.members],
  undecided: [...s.undecided, ...h.undecided],
};
const tmp = `${OUT}.${process.pid}.tmp`;
writeFileSync(tmp, JSON.stringify(file, null, 1) + "\n");
renameSync(tmp, OUT);
const elected = file.members.filter((m) => m.basis === "elected").length;
console.log(`wrote ${file.members.length} incoming members (${elected} newly elected or re-elected, ${file.members.length - elected} carried over), ${file.undecided.length} undecided seats`);
console.log("undecided:", file.undecided.map((u) => `${u.state}${u.district === null ? "-Senate" : `-${u.district}`}`).join(" "));
