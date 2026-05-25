"use client";

/* ---------------------------------------------------------------------------
   InventoryMovementDetail — drawer with full movement context.

   Surfaces the operational + audit data that Scope 8 demands:
     · source document (if source_type/source_id)
     · approval status + approver + timestamp
     · posted_by + posted_at
     · voided_by + voided_at + void_reason
     · accounting_entry_id (if linked)
     · inline list of audit log entries for this movement
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";
import { movementLabel } from "./InventoryUi";
import { DetailsAccordion, HumanStatusPill, humanStatus, operatorLabel } from "./InventoryUx";
import type { MovementType } from "@/lib/inventory/types";

interface MovementDetail {
  id: string;
  movement_no: string;
  movement_date: string;
  inventory_item_id: string;
  warehouse_id: string;
  movement_type: MovementType;
  direction: "in" | "out";
  quantity: number;
  unit: string;
  unit_cost: number | null;
  currency: string;
  source_type: string | null;
  source_id: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  posted_by: string | null;
  posted_at: string | null;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  metadata: Record<string, unknown>;
}

interface AuditEntry {
  id: string;
  action: string;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function InventoryMovementDetail({
  movementId,
  onClose,
}: {
  movementId: string;
  onClose: () => void;
}) {
  const [movement, setMovement] = useState<MovementDetail | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [transferLink, setTransferLink] = useState<{ transfer_id: string; transfer_no: string } | null>(null);
  const [returnLink, setReturnLink] = useState<{ return_id: string; return_no: string; return_type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/inventory/movements/${movementId}`, {
          cache: "no-store",
          credentials: "include",
        });
        const j = await r.json();
        if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
        if (cancelled) return;
        const mv = j.movement as MovementDetail;
        setMovement(mv);

        const a = await fetch(
          `/api/inventory/audit-log?entity_type=movement&entity_id=${movementId}`,
          { cache: "no-store", credentials: "include" },
        );
        const aj = await a.json();
        if (a.ok && !cancelled) setAudit((aj.entries ?? []) as AuditEntry[]);

        /* INV-H3A traceability: if this movement is tied to a transfer,
           fetch the transfer header link so we can render "View transfer →". */
        if (mv.source_type === "inventory_transfer") {
          const lr = await fetch(`/api/inventory/transfers/by-movement/${movementId}`, {
            cache: "no-store",
            credentials: "include",
          });
          const lj = await lr.json();
          if (lr.ok && lj.link && !cancelled) {
            setTransferLink(lj.link as { transfer_id: string; transfer_no: string });
          }
        }
        /* INV-H3B traceability: if this movement is tied to a return,
           fetch the return header link so we can render "Return → <no>". */
        if (mv.source_type === "inventory_return") {
          const lr = await fetch(`/api/inventory/returns/by-movement/${movementId}`, {
            cache: "no-store",
            credentials: "include",
          });
          const lj = await lr.json();
          if (lr.ok && lj.link && !cancelled) {
            setReturnLink(lj.link as { return_id: string; return_no: string; return_type: string });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [movementId]);

  const m = movement;
  const accountingEntryId =
    m && typeof m.metadata?.accounting_entry_id === "string"
      ? (m.metadata.accounting_entry_id as string)
      : null;
  const sourceLink = m?.source_type && m?.source_id
    ? sourceDocumentLink(m.source_type, m.source_id)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 bg-black/40"
        aria-label="Close"
      />
      <div className="w-full max-w-md overflow-y-auto border-l border-[var(--border-color)] bg-[var(--bg-primary)] p-5 text-[var(--text-primary)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              Movement detail
            </div>
            <div className="mt-0.5 font-mono text-[13px]">{m?.movement_no ?? "—"}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-color)] px-2 py-1 text-[11px] hover:bg-[var(--bg-surface)]"
          >
            Close
          </button>
        </div>

        {loading && <div className="text-[12px] text-[var(--text-dim)]">Loading…</div>}
        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-300">
            {error}
          </div>
        )}

        {m && (
          <div className="space-y-4 text-[12px]">
            {/* INV-H6 — operator-first default view: action + qty + status. */}
            <Row label="Action" value={operatorLabel(m.movement_type)} />
            <Row label="Direction" value={m.direction === "in" ? "IN (+)" : "OUT (−)"} />
            <Row label="Quantity" value={`${m.quantity} ${m.unit}`} />
            <Row label="Status" value={<HumanStatusPill status={m.status} />} />
            {m.reference && <Row label="Reference" value={m.reference} />}
            {(sourceLink || transferLink || returnLink) && (
              <div className="flex flex-col gap-1">
                {sourceLink && (
                  <a href={sourceLink.href} className="text-[11.5px] text-[var(--accent-primary,#3b82f6)] hover:underline">
                    Open {sourceLink.label} →
                  </a>
                )}
                {transferLink && (
                  <a href={`/inventory/transfers/${transferLink.transfer_id}`} className="text-[11.5px] text-[var(--accent-primary,#3b82f6)] hover:underline">
                    Transfer → {transferLink.transfer_no}
                  </a>
                )}
                {returnLink && (
                  <a href={`/inventory/returns/${returnLink.return_id}`} className="text-[11.5px] text-[var(--accent-primary,#3b82f6)] hover:underline">
                    Return → {returnLink.return_no}
                  </a>
                )}
              </div>
            )}

            {/* INV-H6 — Everything below collapses behind "Details". */}
            <DetailsAccordion label="Details">
              <div className="space-y-3 text-[11.5px]">
                <Row label="Raw type" value={<span className="font-mono">{movementLabel(m.movement_type)}</span>} />
                <Row
                  label="Unit cost"
                  value={m.unit_cost != null ? `${m.unit_cost} ${m.currency}` : "—"}
                />
                <Row label="Approval" value={humanStatus(m.approval_status)} />
                {m.approved_at && (
                  <Row label="Approved at" value={new Date(m.approved_at).toLocaleString()} />
                )}
                {m.rejection_reason && <Row label="Rejection reason" value={m.rejection_reason} />}
                {m.source_type && <Row label="Source type" value={<span className="font-mono">{m.source_type}</span>} />}
                {m.posted_at  && <Row label="Posted at" value={new Date(m.posted_at).toLocaleString()} />}
                {m.voided_at  && <Row label="Voided at" value={new Date(m.voided_at).toLocaleString()} />}
                {m.void_reason && <Row label="Void reason" value={m.void_reason} />}
                {accountingEntryId && <Row label="Journal entry" value={<span className="font-mono">{accountingEntryId}</span>} />}

                <div>
                  <div className="mb-2 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Audit log</div>
                  {audit.length === 0 && <div className="text-[11px] text-[var(--text-dim)]">No audit entries.</div>}
                  <ul className="space-y-1.5">
                    {audit.map((a) => (
                      <li key={a.id} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11.5px] font-medium">{a.action}</span>
                          <span className="text-[10.5px] text-[var(--text-dim)]">{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                        {a.metadata && Object.keys(a.metadata).length > 0 && (
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10.5px] text-[var(--text-dim)]">
                            {JSON.stringify(a.metadata, null, 0)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </DetailsAccordion>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px,1fr] items-baseline gap-3">
      <div className="text-[10.5px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
        {label}
      </div>
      <div className="break-words text-[var(--text-secondary)]">{value}</div>
    </div>
  );
}

/** Resolve source_type → human-readable destination link. */
function sourceDocumentLink(
  sourceType: string,
  sourceId: string,
): { href: string; label: string } | null {
  if (sourceType === "purchase_receipt" || sourceType === "purchase_receipt_item") {
    return { href: `/purchase/receipts/${sourceId}`, label: "purchase receipt" };
  }
  if (sourceType === "sales_shipment" || sourceType === "sales_shipment_item") {
    return { href: `/sales/shipments/${sourceId}`, label: "sales shipment" };
  }
  if (sourceType === "purchase_order_item") {
    return { href: `/purchase/orders/${sourceId}`, label: "purchase order" };
  }
  if (sourceType === "sales_order_item") {
    return { href: `/sales/orders/${sourceId}`, label: "sales order" };
  }
  return null;
}
