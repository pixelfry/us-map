import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Topology } from "topojson-specification";
import type { AllData, IncomingFile, Member, Plan, PlanDiffFile, StateRecord } from "./stateData";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export type LoadAll = () => Promise<AllData>;
export type LoadTopology = (plan: Plan) => Promise<Topology>;

export const loadAll: LoadAll = async () => {
  const base = import.meta.env.BASE_URL;
  const [states, manifest, diff, current, incoming] = await Promise.all([
    getJson<StateRecord[]>(`${base}geo/states.json`),
    getJson<{ plans: Plan[] }>(`${base}geo/manifest.json`),
    getJson<PlanDiffFile>(`${base}geo/plan-diff.json`),
    getJson<{ members: Member[] }>(`${base}data/members.json`),
    getJson<IncomingFile>(`${base}data/incoming.json`),
  ]);
  return { states, plans: manifest.plans, diff, current: current.members, incoming };
};

export const loadTopology: LoadTopology = (plan) => getJson<Topology>(`${import.meta.env.BASE_URL}geo/${plan.file}`);

type DataState = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: AllData };

const DataContext = createContext<DataState>({ status: "loading" });

export function DataProvider({ load = loadAll, children }: { load?: LoadAll; children: ReactNode }) {
  const [state, setState] = useState<DataState>({ status: "loading" });
  useEffect(() => {
    load().then(
      (data) => setState({ status: "ready", data }),
      (e) => setState({ status: "error", error: String(e?.message ?? e) }),
    );
  }, [load]);
  return <DataContext.Provider value={state}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
