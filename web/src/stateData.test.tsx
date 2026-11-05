import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { StateView } from "./StateView";
import { activePlan, buildRows, districtLabel, electionText, type LoadStateData, type Member, type Plan, type StateData, type StateRecord } from "./stateData";

// Real committed data: data/geo (Census 119th Congress boundaries) and data/generated/members.json.
const root = resolve(import.meta.dirname, "../..");
const read = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const states: StateRecord[] = read("data/geo/states.json");
const plans: Plan[] = read("data/geo/manifest.json").plans;
const allMembers: Member[] = read("data/generated/members.json").members;

function dataFor(postal: string): StateData {
  const state = states.find((s) => s.postal === postal)!;
  const plan = activePlan(plans, postal)!;
  return { state, plan, topology: read(`data/geo/${plan.file}`), members: allMembers.filter((m) => m.state === postal) };
}

describe("buildRows on real data", () => {
  it("Virginia: 2 senators and 11 districts, each with a member", () => {
    const { senators, reps } = buildRows(dataFor("VA"));
    expect(senators).toHaveLength(2);
    expect(reps).toHaveLength(11);
    expect(reps.every((r) => r.member)).toBe(true);
    expect(reps.map((r) => r.district)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it("Texas: 38 districts, with the vacant seat shown as vacant", () => {
    const { reps } = buildRows(dataFor("TX"));
    expect(reps).toHaveLength(38);
    expect(reps.find((r) => r.district === 23)!.member).toBeNull();
  });
  it("labels at-large states and delegates", () => {
    expect(buildRows(dataFor("AK")).reps[0].label).toBe("At-large");
    expect(buildRows(dataFor("DC")).reps[0].label).toBe("Delegate");
    expect(districtLabel("VA", 4, { district_count: 11 })).toBe("District 4");
  });
  it("a state with no plan resolves to null", () => {
    expect(activePlan(plans, "ZZ")).toBeNull();
  });
  it("formats election text without timezone drift", () => {
    expect(electionText({ election_date: "2026-11-03", election_status: "held" })).toBe("Nov 3, 2026 (held)");
  });
});

function renderState(fips: string, postal: string) {
  const load: LoadStateData = async () => dataFor(postal);
  return render(
    <MemoryRouter initialEntries={[`/state/${fips}`]}>
      <Routes><Route path="/state/:fips" element={<StateView load={load} />} /></Routes>
    </MemoryRouter>,
  );
}

describe("StateView", () => {
  it("shows Virginia's senators, 11 representatives, colored districts, and election dates", async () => {
    renderState("51", "VA");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Virginia" })).toBeTruthy());
    const sen = within(await screen.findByRole("table", { name: "Senators" }));
    expect(sen.getAllByRole("row")).toHaveLength(3); // header + 2
    const reps = within(screen.getByRole("table", { name: "Representatives" }));
    expect(reps.getAllByRole("row")).toHaveLength(12); // header + 11
    expect(document.querySelectorAll("path.district")).toHaveLength(11);
    expect(document.querySelectorAll("path.district[class*='party-fill-D'], path.district[class*='party-fill-R']").length).toBe(11);
    expect(screen.getAllByText(/\(held\)|\(upcoming\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Census cartographic boundary file/)).toBeTruthy();
  });

  it("shows Vacant for Texas's empty seat", async () => {
    renderState("48", "TX");
    const reps = within(await screen.findByRole("table", { name: "Representatives" }));
    expect(reps.getAllByRole("row")).toHaveLength(39);
    expect(reps.getByText("Vacant")).toBeTruthy();
    expect(document.querySelectorAll("path.party-fill-vacant")).toHaveLength(1);
  });

  it("shows an error when loading fails", async () => {
    const load: LoadStateData = async () => { throw new Error("boom"); };
    render(
      <MemoryRouter initialEntries={["/state/51"]}>
        <Routes><Route path="/state/:fips" element={<StateView load={load} />} /></Routes>
      </MemoryRouter>,
    );
    expect((await screen.findByRole("alert")).textContent).toContain("boom");
  });
});
