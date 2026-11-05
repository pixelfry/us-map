import { geoAlbersUsa, geoPath } from "d3-geo";
import { useNavigate } from "react-router-dom";
import { states } from "./geo";

const W = 975;
const H = 610;
const path = geoPath(geoAlbersUsa().scale(1300).translate([W / 2, H / 2]));

export function UsMap() {
  const navigate = useNavigate();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of the United States" style={{ width: "100%", maxHeight: "60vh" }}>
      {states.features.map((f) => {
        const d = path(f);
        if (!d) return null; // territories outside the Albers USA projection
        return (
          <path
            key={f.id}
            d={d}
            className="state"
            role="link"
            tabIndex={0}
            aria-label={f.properties.name}
            onClick={() => navigate(`/state/${f.id}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/state/${f.id}`)}
          >
            <title>{f.properties.name}</title>
          </path>
        );
      })}
    </svg>
  );
}
