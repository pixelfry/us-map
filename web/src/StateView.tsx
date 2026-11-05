import { useEffect, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Topology } from "topojson-specification";
import { Link, useParams } from "react-router-dom";
import { loadTopology as defaultLoadTopology, useData, type LoadTopology } from "./data";
import { useViewMode } from "./mode";
import {
  DELEGATE_STATES, PARTY_NAME, buildRows, districtFeatures, electionText, formatDate, linesChanged, membersFor, planForMode, undecidedFor,
  type Member, type PartyCode, type StateData, type UndecidedSeat,
} from "./stateData";

const W = 640;
const H = 460;

function MemberName({ m }: { m: Member }) {
  return m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer">{m.name}</a> : <>{m.name}</>;
}

function PartyBadge({ code }: { code: PartyCode }) {
  return <span className={`party party-${code}`}>{code} · {PARTY_NAME[code]}</span>;
}

function Candidates({ u }: { u: UndecidedSeat }) {
  return <>{u.candidates.map((c) => `${c.name} (${c.party_code})`).join(" vs. ")}</>;
}

function StateBody({ data }: { data: StateData }) {
  const [hover, setHover] = useState<number | null>(null);
  const { state, plan, topology, mode } = data;
  const { senators, reps } = buildRows(data);
  const collection = districtFeatures(topology);
  // Alaska's Aleutians cross the antimeridian; rotate so the whole state sits together.
  const projection = geoMercator().rotate(state.postal === "AK" ? [154, 0] : [0, 0]).fitSize([W, H], collection);
  const path = geoPath(projection);
  const rowByDistrict = new Map(reps.map((r) => [r.district, r]));
  const anyHeld = mode === "current" && data.members.some((m) => m.election_status === "held");
  const isDelegate = DELEGATE_STATES.has(state.postal);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Congressional districts of ${state.name}, colored by party`} style={{ width: "100%", maxHeight: "60vh" }}>
        {collection.features.map((f) => {
          const d = f.properties.district;
          const row = rowByDistrict.get(d)!;
          const cls = row.member ? `party-fill-${row.member.party_code}` : row.undecided ? "party-fill-undecided" : "party-fill-vacant";
          const who = row.member ? `${row.member.name} (${row.member.party_code})` : row.undecided ? "Undecided" : "Vacant";
          return (
            <path
              key={d}
              d={path(f) ?? ""}
              className={`district ${cls}${hover === d ? " active" : ""}`}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${row.label}: ${who}`}</title>
            </path>
          );
        })}
      </svg>
      <ul className="legend" aria-label="Party colors">
        {(["D", "R", "I"] as PartyCode[]).map((c) => (
          <li key={c}><span className={`swatch party-fill-${c}`} /> {PARTY_NAME[c]}</li>
        ))}
        {mode === "incoming" ? (
          <li><span className="swatch party-fill-undecided" /> Undecided</li>
        ) : (
          <li><span className="swatch party-fill-vacant" /> Vacant</li>
        )}
      </ul>
      <p className="asof">
        District lines: {plan.source}, {plan.effective_congress}th Congress ({plan.plan_id}).
        {mode === "incoming" && (data.linesChanged ? " This state's lines changed for the 2026 election." : " This state's lines are unchanged from the current Congress.")}
      </p>

      <h3>Senators</h3>
      <table aria-label="Senators">
        <thead>
          <tr><th>Name</th><th>Party</th><th>Class</th><th>Term ends</th><th>{mode === "incoming" ? "Next election" : "Election"}</th></tr>
        </thead>
        <tbody>
          {senators.map((r) =>
            r.member ? (
              <tr key={r.key}>
                <td><MemberName m={r.member} /></td>
                <td><PartyBadge code={r.member.party_code} /></td>
                <td>{r.member.senate_class}</td>
                <td>{formatDate(r.member.term_end)}</td>
                <td>{electionText(r.member)}</td>
              </tr>
            ) : (
              <tr key={r.key} className="undecided">
                <td colSpan={5}>Undecided: <Candidates u={r.undecided!} /></td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <h3>{isDelegate ? "Delegate" : "Representatives"}</h3>
      <table aria-label="Representatives">
        <thead>
          <tr><th>District</th><th>Name</th><th>Party</th><th>Term ends</th><th>{mode === "incoming" ? "Next election" : "Election"}</th></tr>
        </thead>
        <tbody>
          {reps.map((r) => (
            <tr key={r.district} className={`${hover === r.district ? "active" : ""}${r.undecided ? " undecided" : ""}`} onMouseEnter={() => setHover(r.district)} onMouseLeave={() => setHover(null)}>
              <td>{r.label}</td>
              {r.member ? (
                <>
                  <td><MemberName m={r.member} /></td>
                  <td><PartyBadge code={r.member.party_code} /></td>
                  <td>{formatDate(r.member.term_end)}</td>
                  <td>{electionText(r.member)}</td>
                </>
              ) : r.undecided ? (
                <td colSpan={4}>Undecided: <Candidates u={r.undecided} /></td>
              ) : (
                <td colSpan={4}>Vacant</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {anyHeld && (
        <p className="todo">
          Elections marked "held" have already taken place. This roster comes from the sitting-member list and does not
          show results; switch to "Incoming" for the winners.
        </p>
      )}
    </>
  );
}

export function StateView({ loadTopology = defaultLoadTopology }: { loadTopology?: LoadTopology }) {
  const { fips = "" } = useParams();
  const { mode } = useViewMode();
  const all = useData();
  const [topology, setTopology] = useState<{ planId: string; topo: Topology } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = all.status === "ready" ? all.data : null;
  const state = ready?.states.find((s) => s.fips === fips) ?? null;
  const plan = ready && state ? planForMode(ready.plans, state.postal, mode) : null;

  useEffect(() => {
    if (!plan) return;
    setError(null);
    loadTopology(plan).then((topo) => setTopology({ planId: plan.plan_id, topo }), (e) => setError(String(e?.message ?? e)));
  }, [plan?.plan_id, loadTopology]); // eslint-disable-line react-hooks/exhaustive-deps

  let body: React.ReactNode = null;
  if (all.status === "error") body = <p role="alert">Could not load this state: {all.error}</p>;
  else if (ready && !state) body = <p role="alert">Unknown state code {fips}.</p>;
  else if (ready && state && !plan) body = <p role="alert">No district plan for {state.postal}.</p>;
  else if (error) body = <p role="alert">Could not load this state: {error}</p>;
  else if (ready && state && plan && topology && topology.planId === plan.plan_id) {
    const data: StateData = {
      state, mode, plan, topology: topology.topo,
      members: membersFor(ready, mode).filter((m) => m.state === state.postal),
      undecided: undecidedFor(ready, mode).filter((u) => u.state === state.postal),
      linesChanged: linesChanged(ready.diff, state.postal),
    };
    body = <StateBody data={data} />;
  }

  return (
    <section>
      <p><Link to="/">← All states</Link></p>
      <h2>{state?.name ?? "Loading…"}</h2>
      {body}
    </section>
  );
}
