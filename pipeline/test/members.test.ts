import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { electionFor, generalElectionDate, toMembers, type Legislator } from "../src/members.js";

// Real data, trimmed to the current term, saved from congress-legislators on 2026-11-05.
const legislators: Legislator[] = JSON.parse(readFileSync(new URL("./fixtures/legislators-current-trimmed.json", import.meta.url), "utf8"));
const members = toMembers(legislators, "2026-11-05");

describe("generalElectionDate", () => {
  it.each([[2024, "2024-11-05"], [2026, "2026-11-03"], [2028, "2028-11-07"], [2030, "2030-11-05"], [2032, "2032-11-02"]])("%i", (y, d) => {
    expect(generalElectionDate(y)).toBe(d);
  });
});

describe("electionFor", () => {
  it("maps a Jan 3 term end to the previous November", () => {
    expect(electionFor("2027-01-03", "2026-11-05")).toEqual({ date: "2026-11-03", status: "held" });
    expect(electionFor("2029-01-03", "2026-11-05")).toEqual({ date: "2028-11-07", status: "upcoming" });
  });
  it("uses a non-Jan-3 end date as the election date", () => {
    expect(electionFor("2026-11-03", "2026-11-05").date).toBe("2026-11-03");
  });
  it("treats election day itself as held", () => {
    expect(electionFor("2027-01-03", "2026-11-03").status).toBe("held");
    expect(electionFor("2027-01-03", "2026-11-02").status).toBe("upcoming");
  });
});

describe("toMembers on the real roster", () => {
  it("has 100 senators and two per state", () => {
    const sens = members.filter((m) => m.chamber === "sen");
    expect(sens).toHaveLength(100);
    const per = new Map<string, number>();
    sens.forEach((s) => per.set(s.state, (per.get(s.state) ?? 0) + 1));
    expect(per.size).toBe(50);
    expect([...per.values()].every((n) => n === 2)).toBe(true);
  });
  it("has voting reps plus six delegates, and every voting rep has a district", () => {
    const reps = members.filter((m) => m.chamber === "rep");
    const delegates = reps.filter((m) => ["DC", "PR", "GU", "VI", "AS", "MP"].includes(m.state));
    expect(delegates).toHaveLength(6);
    expect(reps.length - 6).toBeLessThanOrEqual(435);
    expect(reps.every((m) => m.district !== null)).toBe(true);
  });
  it("senators carry a class and election dates match term ends", () => {
    for (const s of members.filter((m) => m.chamber === "sen")) {
      expect([1, 2, 3]).toContain(s.senate_class);
      expect(s.election_date <= s.term_end).toBe(true);
    }
  });
  it("sorts senators before reps within a state", () => {
    const va = members.filter((m) => m.state === "VA").map((m) => m.chamber);
    expect(va.slice(0, 2)).toEqual(["sen", "sen"]);
  });
});
