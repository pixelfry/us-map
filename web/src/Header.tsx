import { Link } from "react-router-dom";
import { useData } from "./data";
import { useViewMode } from "./mode";
import { balance, formatDate, type Balance, type ViewMode } from "./stateData";

const OPTIONS: { mode: ViewMode; label: string }[] = [
  { mode: "current", label: "Current Congress" },
  { mode: "incoming", label: "Incoming (Nov 3, 2026 election)" },
];

function Seats({ title, c, extra }: { title: string; c: { D: number; R: number; I: number; O: number }; extra: string }) {
  return (
    <span className="seats">
      <strong>{title}</strong> <span className="party-D">{c.D} D</span> · <span className="party-R">{c.R} R</span>
      {c.I > 0 && <> · <span className="party-I">{c.I} I</span></>}
      {c.O > 0 && <> · {c.O} other</>}
      {extra && <> · <span className="muted">{extra}</span></>}
    </span>
  );
}

function BalanceLine({ b, mode }: { b: Balance; mode: ViewMode }) {
  const sUnd = b.senate.undecided ? `${b.senate.undecided} undecided` : "";
  const hExtra = [b.house.undecided ? `${b.house.undecided} undecided` : "", b.house.vacant > 0 ? `${b.house.vacant} vacant` : ""].filter(Boolean).join(", ");
  return (
    <p className="balance" aria-label={mode === "incoming" ? "Incoming balance of power" : "Current balance of power"}>
      <Seats title="Senate" c={b.senate} extra={sUnd} /> <span className="sep">|</span> <Seats title="House" c={b.house} extra={hExtra} />
    </p>
  );
}

/** Persistent site header: home link, the Current/Incoming switch, and the balance of power for the selected view. */
export function Header() {
  const { mode, setMode } = useViewMode();
  const data = useData();
  return (
    <header className="site-header">
      <div className="bar">
        <Link to="/" className="brand">US Congress Map</Link>
        <div role="group" aria-label="Congress view" className="toggle">
          {OPTIONS.map((o) => (
            <button key={o.mode} aria-pressed={mode === o.mode} onClick={() => setMode(o.mode)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {data.status === "ready" && <BalanceLine b={balance(data.data, mode)} mode={mode} />}
      {mode === "incoming" && data.status === "ready" && (
        <p className="provisional" role="note">
          Provisional. Winners are as listed on Wikipedia as of {formatDate(data.data.incoming.fetched_at.slice(0, 10))}, not official
          or certified results. Seats not yet called are shown as undecided. The House uses the district lines of the 2026 election.
        </p>
      )}
      {data.status === "error" && <p role="alert">Could not load congressional data: {data.error}</p>}
    </header>
  );
}
