import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enactedBills, passedBills, SOURCE_ENACTED, SOURCE_PASSED } from "../src/congress-gov.js";

// Real responses saved from api.congress.gov on 2026-11-05.
const load = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const updated = load("congress-bills-updated.json");
const laws = load("congress-laws.json");

describe("enactedBills (real /law/119 response)", () => {
  const out = enactedBills(laws);
  it("returns the newest 50, ranked 1..50, newest first", () => {
    expect(out).toHaveLength(50);
    expect(out.map((b) => b.rank)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    const dates = out.map((b) => b.latest_action!.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
  it("labels the source and links to congress.gov", () => {
    expect(out.every((b) => b.source === SOURCE_ENACTED)).toBe(true);
    expect(out.every((b) => /^https:\/\/www\.congress\.gov\/bill\/119th-congress\/[a-z-]+\/\d+$/.test(b.congress_url))).toBe(true);
    expect(out[0].bill_id).toMatch(/^119\/(hr|s|hjres|sjres)\d+$/);
  });
  it("can return all of them", () => {
    expect(enactedBills(laws, 1000).length).toBe(laws.bills.length);
  });
});

describe("passedBills (real /bill/119 response)", () => {
  const out = passedBills(updated);
  it("keeps only chamber-passage milestones", () => {
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((b) => /^(Received in the|Presented|Passed|Resolving|Message)/i.test(b.latest_action!.text))).toBe(true);
    expect(out.every((b) => b.source === SOURCE_PASSED)).toBe(true);
  });
  it("excludes committee referrals and motions to reconsider", () => {
    expect(out.some((b) => /Motion to reconsider/.test(b.latest_action!.text))).toBe(false);
    expect(out.some((b) => /^Referred to/.test(b.latest_action!.text))).toBe(false);
  });
});
