"use client";

/* SecurityHeader — top control bar (Phase 2A · A3).
   Back link · title · window selector · refresh · last-updated. No data logic
   (pure presentational; callbacks come from the orchestrator). */

import Link from "next/link";
import type { AnalyticsWindow } from "@/lib/security/view-model";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const WINDOWS: { id: AnalyticsWindow; label: string }[] = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
];

export interface SecurityHeaderProps {
  window: AnalyticsWindow;
  onWindow: (w: AnalyticsWindow) => void;
  onRefresh: () => void;
  refreshing: boolean;
  generatedAt?: string;
}

export default function SecurityHeader({ window, onWindow, onRefresh, refreshing, generatedAt }: SecurityHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <Link href="/accounts" className="mt-1 text-[var(--text-dim)] hover:text-[var(--text-primary)]" aria-label="Back to accounts">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Login Security</h1>
          {generatedAt && (
            <p className="text-xs text-[var(--text-dim)]">
              Updated {new Date(generatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div role="tablist" aria-label="Time window" className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              role="tab"
              aria-selected={window === w.id}
              onClick={() => onWindow(w.id)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
                window === w.id ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:opacity-50"
          aria-label="Refresh"
        >
          {refreshing ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <span>Refresh</span>}
        </button>
      </div>
    </div>
  );
}
