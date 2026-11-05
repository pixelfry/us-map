import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { LoadAll, LoadTopology } from "./data";
import {
  balance, buildRows, districtLabel, electionText, linesChanged, membersFor, planForMode, undecidedFor,
  type AllData, type Plan, type StateData, type ViewMode,
} from "./stateData";

// Real committed data: data/geo (Census boundaries, 119th active + 120th pending), members.json, incoming.json.
const root = resolve(import.meta.dirname, "../..");
const read = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const all: AllData = {
  states: read("data/geo/states.json"),
  plans: read("data/geo/manifest.json").plans,
  diff: read("data/geo/plan-diff.json"),
  current: read("data/generated/members.json").members,
  incoming: read("data/generated/incoming.json"),
};
const loadData: LoadAll = async () => all;
const loadTopology: LoadTopology = async (plan: Plan) => read(`data/geo/${plan.file}`);

function dataFor(postal: string, mode: ViewMode): StateData {
  const state = all.states.find((s) => s.postal === postal)!;
  const plan = planForMode(all.plans, postal, mode)!;
  return {
    state, mode, plan, topology: read(`data/geo/${plan.file}`),
    members: membersFor(all, mode).filter((m) => m.state === postal),
    undecided: undecidedFor(all, mode).filter((u) => u.state === postal),
    linesChanged: linesChanged(all.diff, postal),
  };
}

describe("buildRows, current Congress", () => {
  it("Virginia: 2 senators and 11 districts, each with a member", () => {
    const { senators, reps } = buildRows(dataFor("VA", "current"));
    expect(senators).toHaveLength(2);
    expect(reps.map((r) => r.district)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(reps.every((r) => r.member)).toBe(true);
  });
  it("Texas: 38 districts, the vacant seat has neither member nor undecided entry", () => {
    const { reps } = buildRows(dataFor("TX", "current"));
    expect(reps).toHaveLength(38);
    const r = reps.find((x) => x.district === 23)!;
    expect(r.member).toBeNull();
    expect(r.undecided).toBeNull();
  });
  it("labels at-large states and delegates", () => {
    expect(buildRows(dataFor("AK", "current")).reps[0].label).toBe("At-large");
    expect(buildRows(dataFor("DC", "current")).reps[0].label).toBe("Delegate");
    expect(districtLabel("VA", 4, { district_count: 11 })).toBe("District 4");
  });
  it("formats election text without timezone drift", () => {
    expect(electionText({ election_date: "2026-11-03", election_status: "held" })).toBe("Nov 3, 2026 (held)");
  });
});

describe("buildRows, incoming Congress", () => {
  it("uses the pending plan and names the winners", () => {
    const d = dataFor("VA", "incoming");
    expect(d.plan.status).toBe("pending");
    const { reps } = buildRows(d);
    expect(reps.find((r) => r.district === 1)!.member!.name).toBe("Shannon Taylor");
  });
  it("lists undecided seats with their candidates, for the Senate and the House", () => {
    expect(buildRows(dataFor("AK", "incoming")).senators.filter((s) => s.undecided)).toHaveLength(1);
    const la5 = buildRows(dataFor("LA", "incoming")).reps.find((r) => r.district === 5)!;
    expect(la5.member).toBeNull();
    expect(la5.undecided!.candidates.length).toBe(2);
  });
  it("flags states whose lines changed (Texas) and not those that did not (Virginia)", () => {
    expect(dataFor("TX", "incoming").linesChanged).toBe(true);
    expect(dataFor("VA", "incoming").linesChanged).toBe(false);
  });
});

describe("balance", () => {
  const count = (arr: { party_code: string }[], code: string) => arr.filter((m) => m.party_code === code).length;
  it("current: matches an independent count of the member file; seats add up to 435 and 100", () => {
    const b = balance(all, "current");
    const sens = all.current.filter((m) => m.chamber === "sen");
    expect(b.senate.D).toBe(count(sens, "D"));
    expect(b.senate.R).toBe(count(sens, "R"));
    expect(b.senate.D + b.senate.R + b.senate.I + b.senate.O).toBe(100);
    expect(b.house.D + b.house.R + b.house.I + b.house.O + b.house.vacant + b.house.undecided).toBe(435);
    expect(b.house.vacant).toBe(2);
  });
  it("incoming: Senate has 2 undecided, House counts only the 435 voting seats", () => {
    const b = balance(all, "incoming");
    expect(b.senate.undecided).toBe(2);
    expect(b.senate.D + b.senate.R + b.senate.I + b.senate.O + b.senate.undecided).toBe(100);
    expect(b.house.D + b.house.R + b.house.I + b.house.O + b.house.undecided + b.house.vacant).toBe(435);
    expect(b.house.vacant).toBe(0);
    expect(b.house.undecided).toBeGreaterThan(0);
  });
});

describe("App shell: persistent header and view switch", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).endsWith("priority-bills.json")) return new Response(readFileSync(resolve(root, "data/generated/priority-bills.json")));
      return new Response("not found", { status: 404 });
    });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  const renderApp = (path = "/", load: LoadAll = loadData) =>
    render(<MemoryRouter initialEntries={[path]}><App loadData={load} loadTopology={loadTopology} /></MemoryRouter>);
  const pressed = (name: RegExp) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

  it("starts on the current Congress with its balance of power", async () => {
    renderApp();
    expect(pressed(/Current Congress/)).toBe("true");
    expect(pressed(/Incoming/)).toBe("false");
    expect((await screen.findByLabelText("Current balance of power")).textContent).toMatch(/Senate.*House/);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("switching to Incoming shows the provisional notice and the new balance", async () => {
    renderApp();
    await screen.findByLabelText("Current balance of power");
    fireEvent.click(screen.getByRole("button", { name: /Incoming/ }));
    expect(pressed(/Incoming/)).toBe("true");
    const note = await screen.findByRole("note");
    expect(note.textContent).toMatch(/Provisional/);
    expect(note.textContent).toMatch(/Wikipedia/);
    expect((await screen.findByLabelText("Incoming balance of power")).textContent).toMatch(/2 undecided/);
    expect(localStorage.getItem("us-map:view")).toBe("incoming");
  });

  it("the header and the chosen view persist when navigating to a state, and the state page follows the view", async () => {
    renderApp();
    await screen.findByLabelText("Current balance of power");
    fireEvent.click(screen.getByRole("button", { name: /Incoming/ }));
    fireEvent.click(await screen.findByRole("link", { name: "Virginia" }));
    expect(await screen.findByRole("heading", { name: "Virginia" })).toBeTruthy();
    expect(pressed(/Incoming/)).toBe("true"); // same header, same selection
    const reps = within(await screen.findByRole("table", { name: "Representatives" }));
    expect(reps.getByText("Shannon Taylor")).toBeTruthy();
    expect(reps.queryByText(/Wittman/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Current Congress/ }));
    await waitFor(() => expect(within(screen.getByRole("table", { name: "Representatives" })).getByText(/Wittman/)).toBeTruthy());
    expect(within(screen.getByRole("table", { name: "Representatives" })).queryByText("Shannon Taylor")).toBeNull();
  });

  it("restores the saved view after a reload", async () => {
    localStorage.setItem("us-map:view", "incoming");
    renderApp();
    expect(pressed(/Incoming/)).toBe("true");
  });

  it("shows undecided seats in a state page: Louisiana's runoffs and Alaska's Senate race", async () => {
    localStorage.setItem("us-map:view", "incoming");
    renderApp("/state/22");
    const reps = within(await screen.findByRole("table", { name: "Representatives" }));
    expect(reps.getAllByText(/^Undecided:/)).toHaveLength(2);
    cleanup();
    renderApp("/state/02");
    const sens = within(await screen.findByRole("table", { name: "Senators" }));
    expect(sens.getAllByText(/^Undecided:/)).toHaveLength(1);
    expect(document.querySelectorAll("path.party-fill-undecided")).toHaveLength(1);
  });

  it("shows an error in the header when data fails to load", async () => {
    renderApp("/", async () => { throw new Error("boom"); });
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((a) => a.textContent?.includes("boom"))).toBe(true);
  });
});
