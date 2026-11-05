import { useEffect, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { Link, useParams } from "react-router-dom";
import {
  PARTY_NAME, buildRows, districtFeatures, electionText, formatDate, loadStateData,
  type LoadStateData, type Member, type PartyCode, type StateData,
} from "./stateData";

const W = 640;
const H = 460;

function MemberName({ m }: { m: Member }) {
  return m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer">{m.name}</a> : <>{m.name}</>;
}

function PartyBadge({ code }: { code: PartyCode }) {
  return <span className={`party party-${code}`}>{code} · {PARTY_NAME[code]}</span>;
}

function StateBody({ data }: { data: StateData }) {
  const [hover, setHover] = useState<number | null>(null);
  const { state, plan, topology } = data;
  const { senators, reps } = buildRows(data);
  const collection = districtFeatures(topology);
  // Alaska's Aleutians cross the antimeridian; rotate so the whole state sits together.
  const projection = geoMercator().rotate(state.postal === "AK" ? [154, 0] : [0, 0]).fitSize([W, H], collection);
  const path = geoPath(projection);
  const memberByDistrict = new Map(reps.map((r) => [r.district, r.member]));
  const anyHeld = data.members.some((m) => m.election_status === "held");

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Congressional districts of ${state.name}, colored by party`} style={{ width: "100%", maxHeight: "60vh" }}>
        {collection.features.map((f) => {
          const d = f.properties.district;
          const member = memberByDistrict.get(d) ?? null;
          const cls = member ? `party-fill-${member.party_code}` : "party-fill-vacant";
          const row = reps.find((r) => r.district === d)!;
          return (
            <path
              key={d}
              d={path(f) ?? ""}
              className={`district ${cls}${hover === d ? " active" : ""}`}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${row.label}: ${member ? `${member.name} (${member.party_code})` : "Vacant"}`}</title>
            </path>
          );
        })}
      </svg>
      <ul className="legend" aria-label="Party colors">
        {(["D", "R", "I"] as PartyCode[]).map((c) => (
          <li key={c}><span className={`swatch party-fill-${c}`} /> {PARTY_NAME[c]}</li>
        ))}
        <li><span className="swatch party-fill-vacant" /> Vacant</li>
      </ul>
      <p className="asof">
        District lines: {plan.source}, {plan.effective_congress}th Congress ({plan.plan_id}).
      </p>

      <h3>Senators</h3>
      <table aria-label="Senators">
        <thead>
          <tr><th>Name</th><th>Party</th><th>Class</th><th>Term ends</th><th>Election</th></tr>
        </thead>
        <tbody>
          {senators.map((m) => (
            <tr key={m.bioguide_id}>
              <td><MemberName m={m} /></td>
              <td><PartyBadge code={m.party_code} /></td>
              <td>{m.senate_class}</td>
              <td>{formatDate(m.term_end)}</td>
              <td>{electionText(m)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{state.postal === "DC" || ["PR", "GU", "VI", "AS", "MP"].includes(state.postal) ? "Delegate" : "Representatives"}</h3>
      <table aria-label="Representatives">
        <thead>
          <tr><th>District</th><th>Name</th><th>Party</th><th>Term ends</th><th>Election</th></tr>
        </thead>
        <tbody>
          {reps.map((r) => (
            <tr key={r.district} className={hover === r.district ? "active" : ""} onMouseEnter={() => setHover(r.district)} onMouseLeave={() => setHover(null)}>
              <td>{r.label}</td>
              {r.member ? (
                <>
                  <td><MemberName m={r.member} /></td>
                  <td><PartyBadge code={r.member.party_code} /></td>
                  <td>{formatDate(r.member.term_end)}</td>
                  <td>{electionText(r.member)}</td>
                </>
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
          show results; it changes when new members are sworn in.
        </p>
      )}
    </>
  );
}

export function StateView({ load = loadStateData }: { load?: LoadStateData }) {
  const { fips = "" } = useParams();
  const [data, setData] = useState<StateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    load(fips).then(setData, (e) => setError(String(e.message ?? e)));
  }, [fips, load]);

  return (
    <section>
      <p><Link to="/">← All states</Link></p>
      <h2>{data?.state.name ?? "Loading…"}</h2>
      {error && <p role="alert">Could not load this state: {error}</p>}
      {data && <StateBody data={data} />}
    </section>
  );
}
