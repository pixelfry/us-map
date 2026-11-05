import { useMemo, useState } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import type { PriorityBill } from "./types";

const col = createColumnHelper<PriorityBill>();

const columns = [
  col.accessor("rank", { header: "#" }),
  col.accessor("title", {
    header: "Bill",
    cell: (c) => (
      <a href={c.row.original.congress_url} target="_blank" rel="noopener noreferrer">
        {c.row.original.bill_id}: {c.getValue()}
      </a>
    ),
  }),
  col.accessor("tracked_count", { header: "Tracked by", cell: (c) => c.getValue() ?? "—" }),
  col.accessor("source", { header: "Source" }),
];

export function BillsTable({ bills, pageSize = 10 }: { bills: PriorityBill[]; pageSize?: number }) {
  const data = useMemo(() => bills, [bills]);
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
