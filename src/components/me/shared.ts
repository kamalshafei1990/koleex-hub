"use client";

/* My HR — the employee's own page. Shared bits for its six tabs. */

import type { MyHrBundle } from "@/lib/me-hr-types";

export type MeTab = "overview" | "leave" | "attendance" | "payslips" | "documents" | "profile";
export const ME_TABS: MeTab[] = ["overview", "leave", "attendance", "payslips", "documents", "profile"];

export interface MeTabProps {
  bundle: MyHrBundle;
  /** Replace the bundle after a mutation returned fresh rows. */
  setBundle: (next: MyHrBundle | ((prev: MyHrBundle) => MyHrBundle)) => void;
  /** Re-fetch the whole bundle. */
  reload: () => Promise<void>;
  t: (key: string, fallback?: string) => string;
  lang: string;
  setTab: (tab: MeTab) => void;
}

/** Warm-start key — the bundle is small and personal; sessionStorage dies
 *  with the tab so it can never show another sign-in's data. */
export const ME_WARM_KEY = "kx:me:hr:v1";

export const fmtNum = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

export const fmtHours = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n)} h`;

/** Server error codes → dictionary keys. Anything unknown reads as the
 *  generic line rather than a raw code. */
export const ERROR_KEYS: Record<string, string> = {
  overlap: "hr.overlapWarning",
  exceeds_balance: "hr.exceedsBalance",
  end_before_start: "hr.endBeforeStart",
  attachment_required: "hr.me.attachmentRequired",
  half_day_period_required: "hr.me.periodRequired",
  already_in: "hr.me.alreadyIn",
  already_out: "hr.me.alreadyOut",
  not_in: "hr.me.notClockedIn",
  not_pending: "hr.me.notPending",
};

export async function meFetch<T>(input: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(input, { credentials: "include", ...init });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) return { ok: false, error: json?.error ?? `HTTP ${res.status}`, status: res.status };
    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network", status: 0 };
  }
}
