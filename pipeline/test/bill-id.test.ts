import { describe, expect, it } from "vitest";
import { congressGovUrl, formatBillId, parseBillId } from "../src/bill-id.js";

describe("bill ids", () => {
  it("parses a GovTrack path and builds the congress.gov URL", () => {
    const ref = parseBillId("119/hr22");
    expect(ref).toEqual({ congress: 119, type: "hr", number: 22 });
    expect(congressGovUrl(ref)).toBe("https://www.congress.gov/bill/119th-congress/house-bill/22");
  });

  it("accepts a full GovTrack URL path", () => {
    expect(parseBillId("/congress/bills/119/hconres14")).toEqual({ congress: 119, type: "hconres", number: 14 });
  });

  it.each([
    ["119/s26", "https://www.congress.gov/bill/119th-congress/senate-bill/26"],
    ["119/hres7", "https://www.congress.gov/bill/119th-congress/house-resolution/7"],
    ["119/hconres14", "https://www.congress.gov/bill/119th-congress/house-concurrent-resolution/14"],
    ["112/sjres3", "https://www.congress.gov/bill/112th-congress/senate-joint-resolution/3"],
    ["101/hr1", "https://www.congress.gov/bill/101st-congress/house-bill/1"],
    ["102/hr1", "https://www.congress.gov/bill/102nd-congress/house-bill/1"],
    ["103/hr1", "https://www.congress.gov/bill/103rd-congress/house-bill/1"],
    ["111/hr1", "https://www.congress.gov/bill/111th-congress/house-bill/1"],
    ["113/hr1", "https://www.congress.gov/bill/113th-congress/house-bill/1"],
  ])("maps %s", (id, url) => {
    expect(congressGovUrl(parseBillId(id))).toBe(url);
  });

  it("round-trips", () => {
    expect(formatBillId(parseBillId("119/hr3633"))).toBe("119/hr3633");
  });

  it("rejects junk and unknown types", () => {
    expect(() => parseBillId("hello")).toThrow();
    expect(() => parseBillId("119/xx5")).toThrow(/Unknown bill type/);
  });
});
