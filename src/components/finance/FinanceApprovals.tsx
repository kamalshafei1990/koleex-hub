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
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

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
const STATUS_BADGE: Record<Status, string> = {
  draft:     "bg-[var(--bg-surface-hover)] text-[var(--text-highlight)] border-[var(--border-subtle)]",
  submitted: "bg-amber-400/[0.10] text-amber-700/90 dark:text-amber-200/90 border-amber-600/40 dark:border-amber-400/30",
  pending:   "bg-amber-400/[0.10] text-amber-700/90 dark:text-amber-200/90 border-amber-600/40 dark:border-amber-400/30",
  approved:  "bg-emerald-400/[0.10] text-emerald-200/90 border-emerald-600/40 dark:border-emerald-400/30",
  rejected:  "bg-rose-400/[0.10] text-rose-700/90 dark:text-rose-200/90 border-rose-600/40 dark:border-rose-400/30",
};

function fmtAmt(n: number, ccy: string) {
  return `${ccy} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export default function FinanceApprovals() {
  const { t } = useTranslation(financeT);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [busyId, setBusyId]   = useState<string | null>(null);

  const kindLabel = (k: Entity) => {
    switch (k) {
      case "expense": return t("approvals.kind.expense", "Expense");
      case "payment": return t("approvals.kind.payment", "Payment");
      case "bill":    return t("approvals.kind.bill", "Bill");
      case "journal": return t("approvals.kind.journal", "Journal");
    }
  };
  const statusLabel = (s: Status) => t(`approvals.status.${s}`, s);

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
      const v = window.prompt(t("approvals.rejectPrompt", "Reason for rejection (min 3 chars):"));
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
      title={t("approvals.title", "Approvals")}
      subtitle={t("approvals.subtitleQueue", "Review and approve pending work")}
      icon="badge-check"
      backHref="/finance/workspace"
      action={
        <Link href="/finance/workspace"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-surface-hover)]">
          <RrIcon name="arrow-left" size={12} />
          {t("approvals.workspace", "Workspace")}
        </Link>
      }
    >
      {loading && <div className="text-sm text-[var(--text-dim)]">{t("common.loading", "Loading…")}</div>}
      {error && <div className="text-sm text-rose-600 dark:text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Pending list */}
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-baseline justify-between">
            <ErpEyebrow>{t("approvals.pendingCount", "Pending ({n})").replace("{n}", String(items.length))}</ErpEyebrow>
            {!canApprove && (
              <span className="text-[10.5px] text-[var(--text-dim)]">{t("approvals.readOnly", "Read-only · approver permission required")}</span>
            )}
          </div>
          <ErpPanel>
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11.5px] text-[var(--text-dim)]">{t("approvals.empty", "No items awaiting action.")}</div>
            ) : (
              <ul>
                {items.map((it) => {
                  const id = `${it.kind}-${it.id}`;
                  const busy = busyId === id;
                  return (
                    <li key={id} className="border-b border-[var(--border-faint)] last:border-b-0">
                      <div className="flex items-center gap-3 px-3 py-2">
                        <RrIcon name={KIND_ICON[it.kind]} size={12} />
                        <Link href={it.href} className="min-w-0 flex-1 hover:underline">
                          <div className="truncate text-[12.5px] font-medium">{it.ref}</div>
                          <div className="text-[10.5px] text-[var(--text-dim)]">
                            {kindLabel(it.kind)} · {it.party_name ?? "—"} · {fmtTime(it.submitted_at)}
                          </div>
                        </Link>
                        <div className="font-mono text-[12px] tabular-nums text-[var(--text-highlight)]">
                          {it.amount === 0 && it.kind === "journal" ? "—" : fmtAmt(it.amount, it.currency)}
                        </div>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] ${STATUS_BADGE[it.status]}`}>
                          {statusLabel(it.status)}
                        </span>
                        <div className="flex gap-1.5">
                          {it.status === "draft" && (
                            <ActionBtn label={t("approvals.btn.submit", "Submit")} disabled={busy}
                                       onClick={() => transition(it, "submit")} tone="neutral" />
                          )}
                          {(it.status === "submitted" || it.status === "pending") && canApprove && (
                            <>
                              <ActionBtn label={t("approvals.btn.approve", "Approve")} disabled={busy}
                                         onClick={() => transition(it, "approve")} tone="positive" />
                              <ActionBtn label={t("approvals.btn.reject", "Reject")} disabled={busy}
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
            <ErpEyebrow>{t("approvals.activity", "Activity")}</ErpEyebrow>
            <span className="text-[10.5px] text-[var(--text-dim)]">{t("approvals.lastEvents", "Last {n} events").replace("{n}", String(activity.length))}</span>
          </div>
          <ErpPanel>
            {activity.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11.5px] text-[var(--text-dim)]">{t("approvals.activityEmpty", "No activity yet.")}</div>
            ) : (
              <ul>
                {activity.map((a) => (
                  <li key={a.id} className="border-b border-[var(--border-faint)] last:border-b-0 px-3 py-2">
                    <div className="flex items-baseline justify-between text-[11.5px]">
                      <span className="font-medium">
                        {a.actor_label ?? t("approvals.system", "system")} <span className="text-[var(--text-dim)]">· {a.action}</span>
                      </span>
                      <span className="text-[10px] text-[var(--text-dim)]">{fmtTime(a.created_at)}</span>
                    </div>
                    <div className="text-[10.5px] text-[var(--text-dim)]">
                      {kindLabel(a.entity_kind)} · {a.entity_id.slice(0, 8)}
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
    tone === "positive" ? "border-emerald-500/60 dark:border-emerald-300/40 hover:bg-emerald-500/12 dark:hover:bg-emerald-300/[0.06] text-emerald-700 dark:text-emerald-200" :
    tone === "warning"  ? "border-rose-500/60 dark:border-rose-300/40 hover:bg-rose-500/12 dark:hover:bg-rose-300/[0.06] text-rose-700 dark:text-rose-200" :
                          "border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-highlight)]";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            className={`rounded-md border px-2.5 py-1 text-[11px] disabled:opacity-50 ${cls}`}>
      {label}
    </button>
  );
}
