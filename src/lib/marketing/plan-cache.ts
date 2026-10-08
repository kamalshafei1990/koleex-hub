/* ---------------------------------------------------------------------------
   marketing/plan-cache — the weekly plan as the screens receive it
   (GET /api/marketing/plan), and the session copy the Plan tab and the
   Feed's plan card share: the last answer per week, and which Monday this
   session last saw as "this week". Kept out of the Plan tab's module so the
   Feed carries only this.
   --------------------------------------------------------------------------- */

import type { Localized, PlanPlatform, PlanStatus, PlanTask, TaskProgress } from "@/lib/marketing/week-plan";
import type { MarketingSpace } from "@/lib/marketing/spaces";

export interface PlanView {
  id: string;
  week_start: string;
  status: PlanStatus;
  tasks: PlanTask[];
  summary: Localized | null;
  version: number;
  approved_at: string | null;
  progress: Record<string, TaskProgress>;
  done: number;
  total: number;
}
export type PlanWeek = { id: string; week_start: string; status: PlanStatus; result: { done: number; total: number } | null };
export interface PlanResponse {
  week: string;
  current: string;
  plan: PlanView | null;
  history: PlanWeek[];
  platforms: PlanPlatform[];
  may: { edit: boolean; approve: boolean };
  ai: boolean;
}

export const planCacheKey = (space: MarketingSpace, week: string) => `kx.mkt.plan.${space}.${week}`;

export function readPlanCache(key: string): PlanResponse | null {
  try {
    const raw = sessionStorage.getItem(key);
    const data = raw ? (JSON.parse(raw) as PlanResponse) : null;
    return data && Array.isArray(data.history) && Array.isArray(data.platforms) ? data : null;
  } catch {
    return null;
  }
}

export function writePlanCache(key: string, data: PlanResponse): void {
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* storage blocked or full: the next visit loads again */ }
}

const lastKey = (space: MarketingSpace) => `kx.mkt.plan.${space}.last`;

export function readLastWeek(space: MarketingSpace): string | null {
  try { return sessionStorage.getItem(lastKey(space)); } catch { return null; }
}

export function writeLastWeek(space: MarketingSpace, week: string): void {
  try { sessionStorage.setItem(lastKey(space), week); } catch { /* storage blocked */ }
}
