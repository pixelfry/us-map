import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PriorityBill, PriorityBillsFile } from "./types.js";

/**
 * Combine ranked lists from several sources into one list. Earlier sources keep their order and come
 * first; a bill already present from an earlier source is not repeated. Ranks are reassigned 1..N.
 */
export function mergeSources(lists: PriorityBill[][]): PriorityBill[] {
  const seen = new Set<string>();
  const out: PriorityBill[] = [];
  for (const list of lists) {
    for (const bill of [...list].sort((a, b) => a.rank - b.rank)) {
      if (seen.has(bill.bill_id)) continue;
      seen.add(bill.bill_id);
      out.push({ ...bill, rank: out.length + 1 });
    }
  }
  return out;
}

export async function readPriorityFile(path: string): Promise<PriorityBillsFile | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as PriorityBillsFile;
  } catch (err: any) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

/** Atomic write: a crash mid-write never leaves a truncated file for the site to serve. */
export async function writePriorityFile(path: string, file: PriorityBillsFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(file, null, 2) + "\n");
  await rename(tmp, path);
}
