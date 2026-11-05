import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { ViewMode } from "./stateData";

const KEY = "us-map:view";

function initial(): ViewMode {
  try {
    return localStorage.getItem(KEY) === "incoming" ? "incoming" : "current";
  } catch {
    return "current";
  }
}

const ModeContext = createContext<{ mode: ViewMode; setMode: (m: ViewMode) => void }>({ mode: "current", setMode: () => {} });

/** The selected view (current or incoming Congress) lives above the router, so it survives page changes and reloads. */
export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(initial);
  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    try { localStorage.setItem(KEY, m); } catch { /* storage unavailable: the choice just won't persist */ }
  }, []);
  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

export const useViewMode = () => useContext(ModeContext);
