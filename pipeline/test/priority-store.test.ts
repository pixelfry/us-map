import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeSources, readPriorityFile, writePriorityFile } from "../src/priority-store.js";
import type { PriorityBill } from "../src/types.js";

const bill = (id: string, rank: number, source: string): PriorityBill => ({
  rank, bill_id: id, title: id, tracked_count: null, source, congress_url: "x",
});

describe("mergeSources", () => {
  it("keeps earlier sources first, drops duplicates, renumbers ranks, and has no size cap", () => {
    const gov = Array.from({ length: 12 }, (_, i) => bill(`119/hr${i + 1}`, i + 1, "govtrack"));
    const extra = [bill("119/hr3", 1, "congress-gov"), bill("119/s100", 2, "congress-gov"), bill("119/s101", 3, "congress-gov")];
    const merged = mergeSources([gov, extra]);
    expect(merged).toHaveLength(14);
    expect(merged.map((b) => b.rank)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(merged.find((b) => b.bill_id === "119/hr3")!.source).toBe("govtrack");
    expect(merged.slice(12).map((b) => b.bill_id)).toEqual(["119/s100", "119/s101"]);
  });
});

describe("file store", () => {
  it("returns null when missing and round-trips a write", async () => {
    const dir = await mkdtemp(join(tmpdir(), "us-map-"));
    const path = join(dir, "sub", "priority-bills.json");
    expect(await readPriorityFile(path)).toBeNull();
    const file = { fetched_at: "2026-11-05T00:00:00Z", sources: ["govtrack"], bills: [bill("119/hr1", 1, "govtrack")] };
    await writePriorityFile(path, file);
    expect(await readPriorityFile(path)).toEqual(file);
    expect((await readFile(path, "utf8")).endsWith("\n")).toBe(true);
  });
});
