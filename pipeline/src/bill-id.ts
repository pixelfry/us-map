export type BillType = "hr" | "s" | "hres" | "sres" | "hjres" | "sjres" | "hconres" | "sconres";

const CONGRESS_GOV_SLUG: Record<BillType, string> = {
  hr: "house-bill",
  s: "senate-bill",
  hres: "house-resolution",
  sres: "senate-resolution",
  hjres: "house-joint-resolution",
  sjres: "senate-joint-resolution",
  hconres: "house-concurrent-resolution",
  sconres: "senate-concurrent-resolution",
};

export interface BillRef {
  congress: number;
  type: BillType;
  number: number;
}

/** Parse a GovTrack-style bill path such as "119/hr22" or "/congress/bills/119/hconres14". */
export function parseBillId(input: string): BillRef {
  const m = /(\d{1,3})\/([a-z]+)(\d+)\/?$/.exec(input.trim());
  if (!m) throw new Error(`Not a bill id: ${input}`);
  const type = m[2] as BillType;
  if (!(type in CONGRESS_GOV_SLUG)) throw new Error(`Unknown bill type "${m[2]}" in ${input}`);
  return { congress: Number(m[1]), type, number: Number(m[3]) };
}

export function formatBillId(ref: BillRef): string {
  return `${ref.congress}/${ref.type}${ref.number}`;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** Official Congress.gov URL for a bill. */
export function congressGovUrl(ref: BillRef): string {
  return `https://www.congress.gov/bill/${ordinal(ref.congress)}-congress/${CONGRESS_GOV_SLUG[ref.type]}/${ref.number}`;
}
