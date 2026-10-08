"use client";

/* ---------------------------------------------------------------------------
   ConflictDialog — what a 409 schedule_conflict from the server looks like.

   Lists each clash (double booking, approved leave, an approved business
   trip, Calendar out-of-office time) in plain words, D/M/Y and 24-hour
   times on the planner's clock. A super admin (the server says so through
   can_override) gets "Save anyway", which retries the SAME write with
   force; everyone else gets the reason and a way back to change it.

   role="alertdialog" on purpose: the item modal's Escape handler ignores
   Escape while an alertdialog is stacked on top, so closing this never
   closes the form underneath (and the user's edits) by accident.
   --------------------------------------------------------------------------- */

import { useEffect, useId, useState } from "react";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import { fmtDMY } from "@/lib/finance/format";
import { formatRange, type PlanningConflict, type PlanningConflictInfo } from "@/lib/planning";
import { toWall } from "@/lib/calendar-tz";

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

const dmyKey = (key?: string) => {
  if (!key) return "—";
  const [y, m, d] = key.split("-");
  return y && m && d ? `${d}/${m}/${y}` : key;
};

export default function ConflictDialog({
  info,
  tz,
  onClose,
  onOverride,
}: {
  info: PlanningConflictInfo | null;
  /** The planner's zone (lib/planning-tz). */
  tz: string;
  onClose: () => void;
  /** Retry the write with force. Resolves when done (the dialog then closes). */
  onOverride: () => Promise<void>;
}) {
  const { t } = useTranslation(planningT);
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [info, busy, onClose]);

  if (!info) return null;
  const listed = info.conflicts;
  const describe = (c: PlanningConflict) => {
    const res = c.resource_name ?? "—";
    switch (c.kind) {
      case "leave":
      case "travel":
        return fill(t(c.kind === "travel" ? "conflict.travel" : "conflict.leave"), {
          res,
          from: dmyKey(c.leave_start),
          to: dmyKey(c.leave_end),
        });
      case "out_of_office":
        return fill(t("conflict.away"), {
          res,
          /* An all-day event reads as its days; a timed one as its span. */
          range: c.leave_start
            ? `${dmyKey(c.leave_start)} – ${dmyKey(c.leave_end)}`
            : c.away_start_at && c.away_end_at
              ? formatRange(c.away_start_at, c.away_end_at, tz)
              : "—",
        });
      default:
        return fill(t("conflict.double"), {
          res,
          other: c.other_title || "—",
          range: c.other_start_at && c.other_end_at ? formatRange(c.other_start_at, c.other_end_at, tz) : "—",
        });
    }
  };
  const more = Math.max(0, info.total - listed.length);

  const override = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onOverride();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="kx-glass-pop kx-pop-in w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <ExclamationIcon size={14} className="text-red-600 dark:text-red-400 shrink-0" />
            <h2 id={titleId} className="text-[13px] font-semibold text-[var(--text-primary)]">
              {t("conflict.title")}
            </h2>
          </div>
          <p className="text-[12px] text-[var(--text-dim)]">{t("conflict.intro")}</p>
          <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto">
            {listed.map((c, i) => (
              <li
                key={`${c.kind}-${c.index}-${c.other_id ?? i}`}
                className="rounded-lg border border-red-500/25 bg-red-500/[0.06] px-2.5 py-1.5 text-[12px] leading-snug text-[var(--text-primary)]"
              >
                {describe(c)}
                {(info.total > 1 || listed.length > 1) && (
                  <span className="block text-[10px] text-[var(--text-dim)] mt-0.5">
                    {c.title ? `${c.title} · ` : ""}
                    {fmtDMY(toWall(c.start_at, tz))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {more > 0 && <p className="text-[11px] text-[var(--text-dim)]">{fill(t("conflict.more"), { n: more })}</p>}
          {!info.canOverride && <p className="text-[11px] text-[var(--text-dim)]">{t("conflict.managerOnly")}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            autoFocus
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
          >
            {info.canOverride ? t("btn.cancel") : t("btn.close")}
          </button>
          {info.canOverride && (
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void override()}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[12px] font-semibold text-red-700 dark:text-red-300 hover:bg-red-500/15 disabled:opacity-50"
            >
              {busy ? t("btn.saving") : t("conflict.saveAnyway")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
