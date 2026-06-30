"use client";

import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";

export default function ProductDataLoading() {
  const { t } = useTranslation(PRODUCTS_UI_I18N);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8 animate-pulse">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] shrink-0" />
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight text-[var(--text-primary)] truncate">
              {t("list.productData", "Product Data")}
            </h1>
          </div>
          <div className="h-10 w-32 rounded-lg bg-[var(--bg-surface)]" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="h-10 flex-1 rounded-xl bg-[var(--bg-surface)]" />
          <div className="h-10 w-24 rounded-xl bg-[var(--bg-surface)]" />
        </div>

        {/* List Skeleton */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-4 border-b border-[var(--border-subtle)] last:border-b-0"
            >
              <div className="h-12 w-12 rounded-xl bg-[var(--bg-surface-subtle)] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-[var(--bg-surface-subtle)]" />
                <div className="h-3 w-32 rounded bg-[var(--bg-surface-subtle)]" />
              </div>
              <div className="hidden md:block h-4 w-24 rounded bg-[var(--bg-surface-subtle)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
