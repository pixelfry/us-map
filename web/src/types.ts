export interface PriorityBill {
  rank: number;
  bill_id: string;
  title: string;
  tracked_count: number | null;
  source: string;
  congress_url: string;
  latest_action?: { date: string; text: string };
}

export interface PriorityBillsFile {
  fetched_at: string;
  sources: string[];
  bills: PriorityBill[];
}

/** Swappable so the table can move from a static file to a paged API without UI changes. */
export type FetchBills = () => Promise<PriorityBillsFile>;
