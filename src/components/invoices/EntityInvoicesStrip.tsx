"use client";

/* ---------------------------------------------------------------------------
   EntityInvoicesStrip — compact "Invoices" card any detail page can drop
   in to show a customer's recent invoices. Mirrors the shape of
   EntityPlanningStrip + EntityTasksStrip so every detail page gets a
   consistent triad of strips.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import InvoicesIcon from "@/components/icons/InvoicesIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import {
  fetchInvoices,
  formatMoney,
  isOverdue,
  STATUS_COLOR,
  type InvoiceRow,
} from "@/lib/invoices";

export default function EntityInvoicesStrip({
  customerId,
  limit = 5,
  title = "Invoices",
}: {
  customerId: string;
  limit?: number;
  title?: string;
}) {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetchInvoices({ customer_id: customerId, status: "all" }).then((rows) => {
      if (!cancelled) setInvoices(rows.slice(0, limit));
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, limit]);

  if (invoices === null) {
    return (
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 flex items-center gap-2">
        <SpinnerIcon className="h-4 w-4 text-[var(--text-dim)] animate-spin" />
        <span className="text-[12px] text-[var(--text-dim)]">Loading invoices…</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <InvoicesIcon size={14} className="text-[var(--text-dim)]" />
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {title}
          </h3>
          <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full">
            {invoices.length}
          </span>
        </div>
        <Link
          href="/invoices"
          className="text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          Open
          <ExternalLinkIcon size={10} />
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="px-4 py-5 text-[12px] text-[var(--text-dim)] text-center">
          No invoices for this customer.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {invoices.map((inv) => {
            const overdue = isOverdue(inv);
            const effective = overdue ? "overdue" : inv.status;
            const color = STATUS_COLOR[effective];
            return (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                    {inv.inv_no ?? "—"}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] truncate">
                    {inv.issue_date}{inv.due_date ? ` → ${inv.due_date}` : ""}
                    {overdue ? " · Overdue" : ""}
                  </div>
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-primary)] text-end shrink-0">
                  {formatMoney(inv.total, inv.currency)}
                  <div className="text-[9px] text-[var(--text-dim)]">
                    {formatMoney(inv.balance, inv.currency)} open
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
