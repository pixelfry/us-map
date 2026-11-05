import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIncomingHouse, buildIncomingSenate, sameName, wikiPartyCode } from "../src/incoming.js";
import { loadStates, type Plan } from "../src/geo-lib.js";
import type { Member } from "../src/members.js";
import { parseRaceRows } from "../src/wikipedia.js";

// Fixtures are the race tables from Wikipedia's 2026 House and Senate election pages, saved 2026-11-05
// (see `build-incoming.ts --save-fixtures`). Plans and members are the committed real data.
const root = resolve(import.meta.dirname, "../..");
const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const houseRows = parseRaceRows(fx("wikipedia-house-race-tables.html"));
const senateRows = parseRaceRows(fx("wikipedia-senate-race-tables.html"));
const plans: Plan[] = JSON.parse(readFileSync(resolve(root, "data/geo/manifest.json"), "utf8")).plans;
const topologies = new Map<string, any>(plans.map((p) => [p.plan_id, JSON.parse(readFileSync(resolve(root, "data/geo", p.file), "utf8"))]));
const current: Member[] = JSON.parse(readFileSync(resolve(root, "data/generated/members.json"), "utf8")).members;
const ctx = { states: loadStates(), current, today: "2026-11-05" };

describe("parseRaceRows", () => {
  it("finds one row per House seat on the ballot, with no duplicates (prior specials excluded)", () => {
    const labels = houseRows.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.filter((l) => l.startsWith("Texas")).length).toBe(38);
    expect(labels.length).toBeGreaterThanOrEqual(435);
  });
  it("reads winners from the check mark", () => {
    const va1 = houseRows.find((r) => r.label === "Virginia 1")!;
    expect(va1.candidates.find((c) => c.winner)).toMatchObject({ name: "Shannon Taylor", party: "Democratic" });
    expect(va1.candidates).toHaveLength(2);
  });
  it("treats Louisiana's runoff as the deciding round, so the race is undecided", () => {
    const la5 = houseRows.find((r) => r.label === "Louisiana 5")!;
    expect(la5.candidates.map((c) => c.name).sort()).toEqual(["Gabe Firment", "Patricia Moore"]);
    expect(la5.candidates.some((c) => c.winner)).toBe(false);
  });
  it("Senate: 35 contests, including the Florida and Ohio specials; Alaska and Mississippi have no winner", () => {
    expect(senateRows).toHaveLength(35);
    expect(senateRows.filter((r) => r.candidates.some((c) => c.winner))).toHaveLength(33);
    for (const state of ["Alaska", "Mississippi"]) {
      expect(senateRows.find((r) => r.label === state)!.candidates.some((c) => c.winner)).toBe(false);
    }
    expect(senateRows.map((r) => r.label)).toContain("Florida (Class 3)");
  });
});

describe("buildIncomingHouse", () => {
  const h = buildIncomingHouse(ctx, plans, topologies, houseRows);
  it("accounts for every one of the 441 seats and reports no problems", () => {
    expect(h.problems).toEqual([]);
    expect(h.members.length + h.undecided.length).toBe(441);
  });
  it("uses the pending (new) district lines, e.g. Texas has 38 and every district is decided or undecided once", () => {
    const keys = [...h.members, ...h.undecided].filter((x) => x.state === "TX").map((x) => x.district);
    expect(new Set(keys).size).toBe(38);
  });
  it("re-elected incumbents keep their identity, newcomers get a placeholder id", () => {
    const scott = h.members.find((m) => m.state === "VA" && m.district === 3)!;
    expect(scott.bioguide_id).toBe(current.find((m) => m.state === "VA" && m.district === 3)!.bioguide_id);
    const taylor = h.members.find((m) => m.state === "VA" && m.district === 1)!;
    expect(taylor.bioguide_id.startsWith("new:")).toBe(true);
    expect(taylor).toMatchObject({ party_code: "D", term_start: "2027-01-03", term_end: "2029-01-03", election_date: "2028-11-07", election_status: "upcoming" });
  });
  it("lists the runoff candidates for an undecided seat", () => {
    expect(h.undecided.find((u) => u.state === "LA" && u.district === 5)!.candidates).toHaveLength(2);
  });
  it("reports a plan district with no Wikipedia row, and a row with no district", () => {
    const missing = buildIncomingHouse(ctx, plans, topologies, houseRows.filter((r) => r.label !== "Virginia 1"));
    expect(missing.problems.some((p) => p.startsWith("VA-1"))).toBe(true);
    const dup = buildIncomingHouse(ctx, plans, topologies, [...houseRows, houseRows.find((r) => r.label === "Virginia 1")!]);
    expect(dup.problems).toContain("duplicate Wikipedia row for VA-1");
    const extra = buildIncomingHouse(ctx, plans, topologies, [...houseRows, { label: "Virginia 12", candidates: [], status: "" }]);
    expect(extra.problems.some((p) => p.startsWith("VA-12"))).toBe(true);
  });
});

describe("buildIncomingSenate", () => {
  const s = buildIncomingSenate(ctx, senateRows);
  it("keeps 100 seats: 98 decided or carried over plus Alaska and Mississippi undecided", () => {
    expect(s.problems).toEqual([]);
    expect(s.members).toHaveLength(98);
    expect(s.undecided.map((u) => u.state).sort()).toEqual(["AK", "MS"]);
  });
  it("carries over senators who were not on the ballot, with their existing term", () => {
    const kaine = s.members.find((m) => m.name.includes("Kaine"))!;
    expect(kaine.basis).toBe("carried-over");
    expect(kaine.term_end).toBe("2031-01-03");
  });
  it("gives class 2 winners a term to 2033 and the specials a term to 2029", () => {
    const talarico = s.members.find((m) => m.state === "TX" && m.basis === "elected")!;
    expect(talarico).toMatchObject({ senate_class: 2, term_end: "2033-01-03", election_date: "2032-11-02" });
    const brown = s.members.find((m) => m.state === "OH" && m.basis === "elected")!;
    expect(brown).toMatchObject({ senate_class: 3, term_end: "2029-01-03", election_date: "2028-11-07" });
  });
  it("every state still has two senators or undecided seats", () => {
    const count = new Map<string, number>();
    [...s.members, ...s.undecided].forEach((m) => count.set(m.state, (count.get(m.state) ?? 0) + 1));
    expect([...count.values()].every((n) => n === 2)).toBe(true);
    expect(count.size).toBe(50);
  });
});

describe("helpers", () => {
  it("matches names across nicknames, middle names, suffixes and accents", () => {
    expect(sameName("Jennifer L. McClellan", "Jennifer McClellan")).toBe(true);
    expect(sameName("Donald S. Beyer, Jr.", "Don Beyer")).toBe(true);
    expect(sameName("Ben Ray Luján", "Ben Ray Lujan")).toBe(true);
    expect(sameName("Robert C. \"Bobby\" Scott", "Bobby Scott")).toBe(true);
    expect(sameName("Bobby Scott", "Tim Scott")).toBe(false);
    expect(sameName("Scott", "Scott")).toBe(false); // a single token is not enough to call it the same person
  });
  it("maps Wikipedia party labels", () => {
    expect(wikiPartyCode("Democratic")).toBe("D");
    expect(wikiPartyCode("DFL")).toBe("D");
    expect(wikiPartyCode("Republican")).toBe("R");
    expect(wikiPartyCode("Independent")).toBe("I");
    expect(wikiPartyCode("Libertarian")).toBe("O");
  });
});
