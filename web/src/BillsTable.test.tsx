import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BillsTable } from "./BillsTable";
import type { PriorityBill } from "./types";

const make = (n: number): PriorityBill[] =>
  Array.from({ length: n }, (_, i) => ({
    rank: i + 1,
    bill_id: `119/hr${i + 1}`,
    title: `Bill ${i + 1}`,
    tracked_count: 100 - i,
    source: "govtrack-most-tracked",
    congress_url: `https://www.congress.gov/bill/119th-congress/house-bill/${i + 1}`,
  }));

const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

describe("BillsTable", () => {
  it("shows 10 per page and pages through 12 bills", async () => {
    render(<BillsTable bills={make(12)} />);
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("links each bill to the congress.gov URL", () => {
    render(<BillsTable bills={make(3)} />);
    const link = screen.getByRole("link", { name: /119\/hr1: Bill 1/ });
    expect(link.getAttribute("href")).toBe("https://www.congress.gov/bill/119th-congress/house-bill/1");
  });

  it("hides the pager when everything fits on one page", () => {
    render(<BillsTable bills={make(10)} />);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("accepts far more than 12 bills", async () => {
    render(<BillsTable bills={make(95)} />);
    expect(screen.getByText("Page 1 of 10")).toBeTruthy();
  });
});
