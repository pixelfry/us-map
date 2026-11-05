export interface PriorityBill {
  rank: number;
  bill_id: string;        // "119/hr22"
  title: string;
  tracked_count: number | null;
  source: string;         // e.g. "govtrack-most-tracked"
  congress_url: string;   // official congress.gov link
  latest_action?: { date: string; text: string };
}

export interface PriorityBillsFile {
  fetched_at: string;     // ISO timestamp of the last successful fetch
  sources: string[];
  bills: PriorityBill[];  // any length; the UI paginates
}
