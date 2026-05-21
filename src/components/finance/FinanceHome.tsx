"use client";

/* ---------------------------------------------------------------------------
   /finance — the operator landing IS the Coffee-Inc-2 dashboard.

   The previous "5 tiles + bar chart" front door was wrong: in Coffee
   Inc 2 you open the Finance Floor and the financial statements
   dashboard is right there. Daily operator navigation (Orders /
   Customers / Suppliers / Expenses / Accounting) already lives in
   FinanceTabs above, so the home page simply embeds the chromeless
   StatementsDashboard with the standard FinanceHeader on top.

   Setup-health banner is preserved (it surfaces missing onboarding
   items so empty KPIs aren't a mystery).
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { StatementsDashboard } from "@/components/finance/VisualStatements";
import RrIcon from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

interface SetupHealth {
  ready: boolean;
  completion: number;
  missingCount: number;
  missingTitles: string[];
}

export default function FinanceHome() {
  const { t } = useTranslation(financeT);
  const [setupHealth, setSetupHealth] = useState<SetupHealth | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetch("/api/finance/setup/status", { cache: "no-store" }).then((r) => r.ok ? r.json() : null);
        if (s?.snapshot) {
          const snap = s.snapshot as { ready: boolean; completion: number; cards: Array<{ status: string; title: string }> };
          const missing = snap.cards.filter((c) => c.status === "empty");
          setSetupHealth({
            ready: snap.ready,
            completion: snap.completion,
            missingCount: missing.length,
            missingTitles: missing.slice(0, 3).map((c) => c.title),
          });
        }
      } catch { /* setup-status is non-critical */ }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <FinanceHeader
          title={t("app.title", "Finance")}
          subtitle={t("app.subtitle", "Income · Balance Sheet · Cash Flow — your full picture at a glance.")}
        />

        {setupHealth && !setupHealth.ready && setupHealth.missingCount > 0 && (
          <SetupHealthBanner health={setupHealth} />
        )}

        <div className="mt-5">
          <StatementsDashboard />
        </div>
      </div>
    </div>
  );
}

function SetupHealthBanner({ health }: { health: SetupHealth }) {
  const { t } = useTranslation(financeT);
  const pct = Math.round(health.completion * 100);
  const items = health.missingTitles.join(" · ");
  const more = health.missingCount > health.missingTitles.length
    ? t("home.banner.more", " · +{n} more").replace("{n}", String(health.missingCount - health.missingTitles.length))
    : "";
  return (
    <section className="mt-5">
      <Link
        href="/finance/setup"
        className="group relative flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 transition-colors hover:border-[var(--border-color)]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
          <RrIcon name="shield-check" size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-300/70" />
            {t("home.banner.kicker", "Finance setup · {pct}% complete").replace("{pct}", String(pct))}
          </div>
          <div className="mt-0.5 text-[13px] font-semibold text-[var(--text-primary)]">
            {health.missingCount === 1
              ? t("home.banner.oneMissing", "1 setup item is empty — your KPIs may understate cash and AR/AP until it's filled.")
              : t("home.banner.manyMissing", "{n} setup items are empty — your KPIs may understate cash and AR/AP until they're filled.").replace("{n}", String(health.missingCount))}
          </div>
          <div className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">{items}{more}</div>
        </div>
        <RrIcon name="arrow-up-right" size={11} className="mt-1 text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-primary)]" />
      </Link>
    </section>
  );
}
