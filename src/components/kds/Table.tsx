"use client";

/* KDS Table — ELECTED TBL-6 by owner 2026-08-02 (Customers server-list
   style), re-expressed in Tailwind: rounded-[10px] bordered wrapper,
   STICKY sentence-case 13px semibold header on bg-surface, 13px cells,
   hairline row rules. Compose freely:

     <Table>
       <thead><tr><Th>Name</Th>…</tr></thead>
       <tbody><tr className={ROW}><Td>…</Td></tr></tbody>
     </Table>
*/

export const ROW = "cursor-pointer transition-colors hover:bg-[var(--bg-surface-subtle)]";

export function Th({ className = "", children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      className={`sticky top-0 z-[1] bg-[var(--bg-surface)] px-3 py-2 text-start text-[13px] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ className = "", children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...rest} className={`px-3 py-2 text-[13px] border-b border-[var(--border-subtle)] ${className}`}>
      {children}
    </td>
  );
}

export default function Table({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`overflow-x-auto rounded-[10px] border border-[var(--border-subtle)] ${className}`}>
      <table className="w-full border-collapse [&_tbody_tr:last-child_td]:border-b-0">{children}</table>
    </div>
  );
}
