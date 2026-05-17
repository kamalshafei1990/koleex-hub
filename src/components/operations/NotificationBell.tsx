"use client";

/* ---------------------------------------------------------------------------
   NotificationBell — slim header dropdown surfacing operational alerts.

   Auto-fetches /api/operations/snapshot on mount and shows a badge for
   alert count. Click → dropdown listing each alert as a hyperlinked row.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

type Severity = "info" | "watch" | "risk";
interface Alert {
  key: string; category: string; severity: Severity;
  title: string; detail: string;
  href: string; action_label?: string;
  count?: number;
}

const SEV_TONE: Record<Severity, string> = {
  info:  "bg-emerald-300/[0.08] text-emerald-200 border-emerald-300/30",
  watch: "bg-amber-300/[0.08]  text-amber-200  border-amber-300/30",
  risk:  "bg-rose-300/[0.08]   text-rose-200   border-rose-300/30",
};
const CATEGORY_ICON: Record<string, RrIconName> = {
  stock_low: "box-open", ar_overdue: "file-invoice-dollar",
  ap_overdue: "file-invoice", approval_pending: "badge-check",
  fx_missing: "balance-scale-left", shipment_delayed: "shipping-fast",
  bottleneck: "clock",
};

export default function NotificationBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/operations/snapshot")
      .then((r) => r.json())
      .then((j) => { if (!j.error) setAlerts(j.snapshot.alerts ?? []); })
      .catch(() => { /* swallow — non-critical */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    function clickOutside(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [open]);

  const riskCount = alerts.filter((a) => a.severity === "risk").length;
  const badgeTone =
    riskCount > 0 ? "bg-rose-400 text-rose-950" :
    alerts.length > 0 ? "bg-amber-400 text-amber-950" : "bg-white/[0.10] text-gray-300";

  return (
    <div ref={wrap} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.012] text-gray-300 hover:bg-white/[0.04]"
              aria-label={`${alerts.length} alerts`}>
        <RrIcon name="megaphone" size={13} />
        {alerts.length > 0 && (
          <span className={`absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold ${badgeTone}`}>
            {alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-[320px] max-w-[88vw] overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-primary)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Notifications</span>
            <Link href="/operations" onClick={() => setOpen(false)}
                  className="text-[10.5px] text-gray-400 hover:text-gray-200">
              Open Operations →
            </Link>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {loading && <li className="px-3 py-4 text-[11px] text-gray-500">Loading…</li>}
            {!loading && alerts.length === 0 && (
              <li className="px-3 py-6 text-center text-[11px] text-gray-500">No alerts. All clear.</li>
            )}
            {alerts.map((a) => (
              <li key={a.key} className="border-b border-white/[0.04] last:border-b-0">
                <Link href={a.href} onClick={() => setOpen(false)}
                      className="block px-3 py-2 hover:bg-white/[0.025]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[12px] font-medium">
                      <RrIcon name={CATEGORY_ICON[a.category] ?? "info"} size={10} />
                      {a.title}
                    </span>
                    <span className={`rounded border px-1.5 py-px text-[9px] uppercase tracking-[0.08em] ${SEV_TONE[a.severity]}`}>{a.severity}</span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-gray-500">{a.detail}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
