"use client";

import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

export default function FinanceLoading() {
  const { t } = useTranslation(financeT);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-2 mb-8 mt-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] truncate">
              {t("app.title", "Finance")}
            </h1>
          </div>
          <div className="h-4 w-64 md:w-96 rounded bg-[var(--bg-surface)]" />
        </div>
        
        {/* Top KPI Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
            />
          ))}
        </div>
        
        {/* Main Chart Area Skeleton */}
        <div className="h-[400px] w-full rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]" />
      </div>
    </div>
  );
}
