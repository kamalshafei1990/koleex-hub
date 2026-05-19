"use client";

/* ---------------------------------------------------------------------------
   /finance/approvals — unified pending-approval queue.

   - Approve / Reject inline (CEO + Accountant + super admin only)
   - Anyone can Submit drafts
   - Recent activity (audit trail) on the right
   --------------------------------------------------------------------------- */

import { humanizeError } from "@/lib/ui/humanize-error";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ErpEyebrow, ErpHairline, ErpPage, ErpPanel,
} from "@/components/ui/erp/ErpUi";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

type Entity = "expense" | "payment" | "bill" | "journal";
type Status = "draft" | "submitted" | "pending" | "approved" | "rejected";
interface PendingItem {
  kind: Entity; id: string; ref: string;
  amount: number; currency: string; status: Status;
  submitted_at: string | null; party_name: string | null; href: string;
}
interface ActivityRow {
  id: string; entity_kind: Entity; entity_id: string;
  action: string; actor_label: string | null; note: string | null; created_at: string;
}

const KIND_ICON: Record<Entity, RrIconName> = {
  expense: "receipt", payment: "money", bill: "file-invoice", journal: "books",
};
const KIND_LABEL: Record<Entity, string> = {
  expense: "Expense", payment: "Payment", bill: "Bill", journal: "Journal",
};
const STATUS_BADGE: Record<Status, string> = {
  draft:     "bg-white/[0.06] text-gray-300 border-white/[0.08]",
  submitted: "bg-amber-400/[0.10] text-amber-200/90 border-amber-400/30",
  pending:   "bg-amber-400/[0.10] text-amber-200/90 border-amber-400/30",
  approved:  "bg-emerald-400/[0.10] text-emerald-200/90 border-emerald-400/30",
  rejected:  "bg-rose-400/[0.10] text-rose-200/90 border-rose-400/30",
};

function fmtAmt(n: number, ccy: string) {
  return `${ccy} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export default function FinanceApprovals() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [busyId, setBusyId]   = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [pendRes, actRes] = await Promise.all([
        fetch("/api/approvals"),
        fetch("/api/approvals/activity?limit=40"),
      ]);
      const pendJ = await pendRes.json();
      const actJ  = await actRes.json();
      if (!pendRes.ok) throw new Error(pendJ.error || `HTTP ${pendRes.status}`);
      if (!actRes.ok)  throw new Error(actJ.error  || `HTTP ${actRes.status}`);
      setItems(pendJ.items);
      setCanApprove(!!pendJ.can_approve);
      setActivity(actJ.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function transition(it: PendingItem, action: "submit" | "approve" | "reject") {
    let reason: string | undefined;
    if (action === "reject") {
      const v = window.prompt("Reason for rejection (min 3 chars):");
      if (!v || v.trim().length < 3) return;
      reason = v.trim();
    }
    setBusyId(`${it.kind}-${it.id}`);
    try {
      const r = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: it.kind, entityId: it.id, action, reason }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
      await fetchAll();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ErpPage
      title="Approvals"
      subtitle="Review and approve pending work"
      icon="badge-check"
      backHref="/finance/workspace"
      action={
        <Link href="/finance/workspace"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]">
          <RrIcon name="arrow-left" size={12} />
          Workspace
        </Link>
      }
    >
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Pending list */}
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-baseline justify-between">
            <ErpEyebrow>Pending ({items.length})</ErpEyebrow>
            {!canApprove && (
              <span className="text-[10.5px] text-gray-500">Read-only · approver permission required</span>
            )}
          </div>
          <ErpPanel>
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11.5px] text-gray-500">No items awaiting action.</div>
            ) : (
              <ul>
                {items.map((it) => {
                  const id = `${it.kind}-${it.id}`;
                  const busy = busyId === id;
                  return (
                    <li key={id} className="border-b border-white/[0.025] last:border-b-0">
                      <div className="flex items-center gap-3 px-3 py-2">
                        <RrIcon name={KIND_ICON[it.kind]} size={12} />
                        <Link href={it.href} className="min-w-0 flex-1 hover:underline">
                          <div className="truncate text-[12.5px] font-medium">{it.ref}</div>
                          <div className="text-[10.5px] text-gray-500">
                            {KIND_LABEL[it.kind]} · {it.party_name ?? "—"} · {fmtTime(it.submitted_at)}
                          </div>
                        </Link>
                        <div className="font-mono text-[12px] tabular-nums text-gray-300">
                          {it.amount === 0 && it.kind === "journal" ? "—" : fmtAmt(it.amount, it.currency)}
                        </div>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] ${STATUS_BADGE[it.status]}`}>
                          {it.status}
                        </span>
                        <div className="flex gap-1.5">
                          {it.status === "draft" && (
                            <ActionBtn label="Submit" disabled={busy}
                                       onClick={() => transition(it, "submit")} tone="neutral" />
                          )}
                          {(it.status === "submitted" || it.status === "pending") && canApprove && (
                            <>
                              <ActionBtn label="Approve" disabled={busy}
                                         onClick={() => transition(it, "approve")} tone="positive" />
                              <ActionBtn label="Reject" disabled={busy}
                                         onClick={() => transition(it, "reject")} tone="warning" />
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ErpPanel>
        </div>

        {/* Activity */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <ErpEyebrow>Activity</ErpEyebrow>
            <span className="text-[10.5px] text-gray-500">Last {activity.length} events</span>
          </div>
          <ErpPanel>
            {activity.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11.5px] text-gray-500">No activity yet.</div>
            ) : (
              <ul>
                {activity.map((a) => (
                  <li key={a.id} className="border-b border-white/[0.025] last:border-b-0 px-3 py-2">
                    <div className="flex items-baseline justify-between text-[11.5px]">
                      <span className="font-medium">
                        {a.actor_label ?? "system"} <span className="text-gray-500">· {a.action}</span>
                      </span>
                      <span className="text-[10px] text-gray-500">{fmtTime(a.created_at)}</span>
                    </div>
                    <div className="text-[10.5px] text-gray-500">
                      {KIND_LABEL[a.entity_kind]} · {a.entity_id.slice(0, 8)}
                      {a.note ? ` · ${a.note}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ErpPanel>
        </div>
      </div>
      <ErpHairline className="mt-6" />
    </ErpPage>
  );
}

function ActionBtn({ label, onClick, tone, disabled }: {
  label: string; onClick: () => void; tone: "positive" | "warning" | "neutral"; disabled?: boolean;
}) {
  const cls =
    tone === "positive" ? "border-emerald-300/40 hover:bg-emerald-300/[0.06] text-emerald-200" :
    tone === "warning"  ? "border-rose-300/40 hover:bg-rose-300/[0.06] text-rose-200" :
                          "border-white/[0.10] hover:bg-white/[0.06] text-gray-200";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            className={`rounded-md border px-2.5 py-1 text-[11px] disabled:opacity-50 ${cls}`}>
      {label}
    </button>
  );
}
