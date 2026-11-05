import { useMemo, useState } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import type { PriorityBill } from "./types";

const col = createColumnHelper<PriorityBill>();

const baseColumns = [
  col.accessor("rank", { header: "#" }),
  col.accessor("title", {
    header: "Bill",
    cell: (c) => (
      <a href={c.row.original.congress_url} target="_blank" rel="noopener noreferrer">
        {c.row.original.bill_id}: {c.getValue()}
      </a>
    ),
  }),
  col.accessor((b) => (b.latest_action ? `${b.latest_action.date}: ${b.latest_action.text}` : ""), {
    id: "latest_action",
    header: "Latest action",
  }),
  col.accessor("source", { header: "Source" }),
];
const trackedColumn = col.accessor("tracked_count", { header: "Tracked by", cell: (c) => c.getValue() ?? "—" });

export function BillsTable({ bills, pageSize = 10 }: { bills: PriorityBill[]; pageSize?: number }) {
  const data = useMemo(() => bills, [bills]);
  // Only show the "Tracked by" column when some source supplied counts (GovTrack does, Congress.gov doesn't).
  const columns = useMemo(
    () => (bills.some((b) => b.tracked_count != null) ? [...baseColumns.slice(0, 2), trackedColumn, ...baseColumns.slice(2)] : baseColumns),
    [bills],
  );
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const pages = table.getPageCount();

  return (
    <section aria-label="Priority bills">
      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pages > 1 && (
        <nav aria-label="Pagination">
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </button>
          <span>
            Page {pagination.pageIndex + 1} of {pages}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
