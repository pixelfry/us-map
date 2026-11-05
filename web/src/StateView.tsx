import { geoPath, geoMercator } from "d3-geo";
import { Link, useParams } from "react-router-dom";
import { stateByFips } from "./geo";

const W = 600;
const H = 450;

export function StateView() {
  const { fips = "" } = useParams();
  const state = stateByFips(fips);
  if (!state) return <p>Unknown state. <Link to="/">Back to the map</Link></p>;

  const projection = geoMercator().fitSize([W, H], state);
  const d = geoPath(projection)(state) ?? "";

  return (
    <section>
      <p><Link to="/">← All states</Link></p>
      <h2>{state.properties.name}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Outline of ${state.properties.name}`} style={{ width: "100%", maxHeight: "60vh" }}>
        <path d={d} className="state-outline" />
      </svg>
      <p className="todo">
        District boundaries, party colors, members and re-election dates arrive with the boundary-plan
        pipeline (see the design note, "District line changes").
      </p>
    </section>
  );
}
