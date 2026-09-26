"use client";

/* ---------------------------------------------------------------------------
   Finance tab warm-up — the data half of an instant tab switch.

   The header prefetches a tab's ROUTE (so the segment skeleton never shows);
   this warms the tab's DATA into the same warm cache the screen reads on
   mount, under the same key and in the same shape as that screen's own
   loader. Arrive on the tab and it paints from the cache at once, while the
   screen's normal refetch runs behind the painted frame.

   Each entry mirrors one screen's loader exactly. Add a route here only
   together with the screen that reads the key — a shape drift shows as a
   blank or wrong first paint, so the loader lives next to the key it fills.

   Cheap by design: nothing runs when the entry is younger than the stale
   window, and each key is fetched at most once at a time.
   --------------------------------------------------------------------------- */

import { DEFAULT_STALE_MS, warmAge, writeWarm } from "@/lib/warm-cache";

type Loader = () => Promise<unknown>;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}

const PLAN: Record<string, Array<{ key: string; load: Loader }>> = {
  "/finance": [
    { key: "fin:dash:kpi:quarter", load: async () => (await getJson<{ kpi?: unknown }>("/api/finance/dashboard?period=quarter")).kpi ?? null },
  ],
  "/finance/orders": [
    { key: "fin:orders", load: async () => (await getJson<{ orders?: unknown[] }>("/api/finance/orders")).orders ?? [] },
  ],
  "/finance/customers": [
    { key: "fin:customers", load: async () => (await getJson<{ customers?: unknown[] }>("/api/finance/customers")).customers ?? [] },
  ],
  "/finance/suppliers": [
    { key: "fin:suppliers", load: async () => (await getJson<{ suppliers?: unknown[] }>("/api/finance/suppliers")).suppliers ?? [] },
  ],
  "/finance/expenses": [
    {
      key: "fin:expenses",
      load: async () => {
        const [e, c] = await Promise.all([
          getJson<{ expenses?: unknown[] }>("/api/finance/expenses"),
          getJson<{ categories?: unknown[] }>("/api/finance/expense-categories"),
        ]);
        return { expenses: e.expenses ?? [], categories: c.categories ?? [] };
      },
    },
  ],
  "/finance/payments": [
    { key: "fin:payments", load: async () => (await getJson<{ payments?: unknown[] }>("/api/finance/payments")).payments ?? [] },
  ],
  "/finance/bank-accounts": [
    { key: "fin:bank-accounts", load: async () => (await getJson<{ accounts?: unknown[] }>("/api/finance/bank-accounts")).accounts ?? [] },
  ],
  "/finance/setup": [
    { key: "fin:setup", load: async () => (await getJson<{ snapshot?: unknown }>("/api/finance/setup/status")).snapshot ?? null },
  ],
  "/finance/treasury-plans": [
    { key: "fin:treasury-plans", load: async () => (await getJson<{ plans?: unknown[] }>("/api/finance/treasury-plans")).plans ?? [] },
  ],
  "/finance/approvals": [
    {
      key: "fin:approvals",
      load: async () => {
        const [pend, act] = await Promise.all([
          getJson<{ items?: unknown[]; can_approve?: boolean }>("/api/approvals"),
          getJson<{ items?: unknown[] }>("/api/approvals/activity?limit=40"),
        ]);
        return { items: pend.items, canApprove: !!pend.can_approve, activity: act.items };
      },
    },
  ],
  "/finance/fx-rates": [
    {
      key: "fin:fx",
      load: async () => {
        const [r, s] = await Promise.all([
          getJson<{ rates?: unknown[] }>("/api/finance/fx/rates"),
          getJson<{ status?: unknown }>("/api/finance/fx/status").catch(() => ({} as { status?: unknown })),
        ]);
        return { rates: r.rates ?? [], status: s.status ?? null };
      },
    },
  ],
  "/finance/notifications": [
    { key: "fin:notifications", load: async () => (await getJson<{ notifications?: unknown[] }>("/api/finance/notifications")).notifications ?? [] },
  ],
  "/finance/workspace": [
    {
      key: "fin:workspace",
      load: async () => {
        const j = await getJson<{ snapshot?: unknown; visibility?: unknown }>("/api/finance/workspace");
        return { snapshot: j.snapshot, visibility: j.visibility };
      },
    },
  ],
  "/finance/accounting/queue": [
    { key: "fin:queue:pending:all", load: () => getJson("/api/accounting/queue?status=pending&limit=200") },
  ],
  "/finance/accounting/trial-balance": [
    { key: `fin:tb::${new Date().toISOString().slice(0, 10)}`, load: async () => (await getJson<{ trial_balance?: unknown }>(`/api/accounting/trial-balance?to=${new Date().toISOString().slice(0, 10)}`)).trial_balance ?? null },
  ],
};

const inflight = new Set<string>();

/** Warm every dataset behind a finance route. Safe to call often. */
export function warmFinanceRoute(href: string): void {
  const path = href.split("?")[0];
  const plan = PLAN[path];
  if (!plan) return;
  for (const { key, load } of plan) {
    if (warmAge(key) < DEFAULT_STALE_MS || inflight.has(key)) continue;
    inflight.add(key);
    void load()
      .then((d) => { if (d !== null && d !== undefined) writeWarm(key, d); })
      .catch(() => { /* a failed warm-up costs nothing: the screen loads as it always did */ })
      .finally(() => inflight.delete(key));
  }
}
