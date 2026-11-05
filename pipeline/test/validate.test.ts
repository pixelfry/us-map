import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFromDisk, validate } from "../src/validate.js";

// Runs against the committed real data (data/geo + data/generated/members.json).
const { plans: allPlans, topologies, members } = loadFromDisk(resolve(import.meta.dirname, "../.."));
const plans = allPlans.filter((p) => p.status === "active"); // current Congress; the pending 120th plans are tested in incoming.test.ts

describe("committed data", () => {
  it("has a plan for every state and 441 districts (435 + 6 delegates)", () => {
    expect(plans).toHaveLength(56);
    expect(plans.reduce((n, p) => n + p.district_count, 0)).toBe(441);
  });
  it("passes cross-validation with no problems", () => {
    expect(validate(plans, topologies, members).problems).toEqual([]);
  });
  it("detects a member in a district the plan lacks", () => {
    const bad = members.map((m) => (m.state === "VA" && m.district === 1 ? { ...m, district: 99 } : m));
    const { problems, vacancies } = validate(plans, topologies, bad);
    expect(problems.some((p) => p.startsWith("VA-99"))).toBe(true);
    expect(vacancies).toContainEqual({ state: "VA", district: 1 });
  });
  it("detects two active plans for one state", () => {
    const dup = [...plans, { ...plans.find((p) => p.state === "VA")!, plan_id: "VA-dup" }];
    expect(validate(dup, topologies, members).problems).toContain("VA: expected 1 active plan, found 2");
  });
});
