import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { BillsTable } from "./BillsTable";
import { DataProvider, type LoadAll, type LoadTopology } from "./data";
import { Header } from "./Header";
import { ViewModeProvider } from "./mode";
import { StateView } from "./StateView";
import { UsMap } from "./UsMap";
import type { FetchBills, PriorityBillsFile } from "./types";

const fetchBills: FetchBills = async () => {
  const res = await fetch(`${import.meta.env.BASE_URL}data/priority-bills.json`);
  if (!res.ok) throw new Error(`priority-bills.json: HTTP ${res.status}`);
  return res.json();
};

function Landing({ load = fetchBills }: { load?: FetchBills }) {
  const [file, setFile] = useState<PriorityBillsFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    load().then(setFile, (e) => setError(String(e)));
  }, [load]);

  return (
    <>
      <UsMap />
      <h2>Priority bills</h2>
      {error && <p role="alert">Could not load bills: {error}</p>}
      {file && (
        <>
          <p className="asof">As of {new Date(file.fetched_at).toLocaleDateString()} · {file.sources.join(", ")}</p>
          <BillsTable bills={file.bills} />
        </>
      )}
    </>
  );
}

/** App shell. The header sits outside <Routes>, so it stays mounted (with its state) as pages change. */
export default function App({ loadData, loadTopology }: { loadData?: LoadAll; loadTopology?: LoadTopology } = {}) {
  return (
    <ViewModeProvider>
      <DataProvider load={loadData}>
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/state/:fips" element={<StateView loadTopology={loadTopology} />} />
          </Routes>
        </main>
      </DataProvider>
    </ViewModeProvider>
  );
}
