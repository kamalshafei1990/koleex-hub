"use client";

/* ---------------------------------------------------------------------------
   "Reports about this" — on a customer's, supplier's, product's or order's
   own page (Reports Phase 4A, owner's pick 25 Sep 2026): the reports linked
   to it that THIS viewer may read (the report's own read rule, server-side).

   Tiny on purpose — it lives in other apps' pages: its own few words, every
   report's type and status already worded by the server, and it asks only
   once the page has finished fetching (whenNetworkQuiet), never alongside
   the data the page paints with. Someone outside Reports sees nothing.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation, type Translations } from "@/lib/i18n";
import { whenNetworkQuiet } from "@/lib/net-idle";

const WORDS: Translations = {
  title: { en: "Reports about this", zh: "相关报告", ar: "تقارير عنه" },
  empty: { en: "No reports about this yet.", zh: "暂无相关报告。", ar: "مفيش تقارير عنه لسه." },
};

interface AboutReport { id: string; typeName: string; statusLabel: string; status: string; authorName: string; submittedAt: string | null; updatedAt: string }

const dmy = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

export default function ReportsAboutCard({ type, id, className }: { type: "customer" | "supplier" | "product" | "order"; id: string; className?: string }) {
  const { t, lang } = useTranslation(WORDS);
  const [rows, setRows] = useState<AboutReport[] | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let alive = true;
    void whenNetworkQuiet({ quietMs: 300, maxWaitMs: 3000 })
      .then(() => fetch(`/api/work-reports/about?type=${type}&id=${encodeURIComponent(id)}&lang=${lang}`, { credentials: "include", cache: "no-store" }))
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401 || res.status === 403) { setHidden(true); return; }
        const body = res.ok ? ((await res.json()) as { reports?: AboutReport[] }) : { reports: [] };
        if (alive) setRows(body.reports ?? []);
      })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [type, id, lang]);

  if (hidden) return null;
  return (
    <section aria-labelledby={`kx-about-${type}`} className={className ?? "kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"}>
      <h2 id={`kx-about-${type}`} className="mb-2 text-[13px] font-semibold text-[var(--text-primary)]">{t("title")}</h2>
      {rows === null ? (
        <div aria-hidden className="space-y-2">
          <div className="h-9 animate-pulse rounded-lg bg-[var(--bg-surface-subtle)]" />
          <div className="h-9 animate-pulse rounded-lg bg-[var(--bg-surface-subtle)]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[12.5px] text-[var(--text-dim)]">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/reports/${r.id}`} className="flex items-center gap-3 py-2 hover:opacity-80">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{r.typeName}</span>
                  <span className="block truncate text-[11.5px] text-[var(--text-dim)] tabular-nums">{r.authorName} · {dmy(r.submittedAt ?? r.updatedAt)}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${r.status === "draft" ? "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]" : r.status === "returned" ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"}`}>
                  {r.statusLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
