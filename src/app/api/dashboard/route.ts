import "server-only";

/* ---------------------------------------------------------------------------
   /api/dashboard — the Home dashboard's ONE request (P1 of the approved plan).

   Design contract (docs discussed 2026-08-20 with the owner):
   • ONE batched request per open — the client never fans out per widget
     (the batching law: /api/shell is the model).
   • Every widget is gated by the account's can_view on its owning module,
     server-side — the dashboard is automatically different per person.
   • Money is SA/whitelisted only; everyone else gets counts.
   • Answers are NEVER cacheable: no-store, because a dashboard that shows
     pre-save numbers after the operator just changed something is the exact
     bug family we closed in products (the HTTP-cache revert).
   • A provider that fails reports itself as failed — it must never be
     swallowed into a plausible zero (the series_cadence lesson).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { countOpenTodos } from "@/lib/todo-open-count";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

type Widget = Record<string, unknown> & { error?: string };

async function allowed(auth: ServerAuthContext, module: string): Promise<boolean> {
  return (await requireModuleAction(auth, module, "view")) === null;
}

/* ── Quotations: pipeline + open value + expiring ─────────────────────── */
async function quotationsWidget(showMoney: boolean): Promise<Widget> {
  const { data, error } = await supabaseServer
    .from("quotations")
    .select("status, total, valid_till, updated_at, created_at");
  if (error) return { error: error.message };
  const rows = data ?? [];
  const stages: Record<string, number> = {};
  let openCount = 0;
  let openValue = 0;
  let expiringSoon = 0;
  let wonValueMtd = 0;
  const now = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  for (const r of rows) {
    const st = (r.status || "draft").toLowerCase();
    stages[st] = (stages[st] ?? 0) + 1;
    const isClosed = st === "won" || st === "lost" || st === "expired" || st === "cancelled";
    if (!isClosed) {
      openCount++;
      openValue += Number(r.total) || 0;
      if (r.valid_till) {
        const t = new Date(r.valid_till).getTime();
        if (t > now && t - now < 7 * DAY_MS) expiringSoon++;
      }
    }
    if (st === "won" && r.updated_at && new Date(r.updated_at) >= monthStart) {
      wonValueMtd += Number(r.total) || 0;
    }
  }
  /* 12-week creation series — the hero curve is REAL shape, not decor.
     Bucket by weeks-ago so the newest bucket is the last point. */
  const series = new Array<number>(12).fill(0);
  for (const r of rows) {
    if (!r.created_at) continue;
    const weeksAgo = Math.floor((now - new Date(r.created_at).getTime()) / (7 * DAY_MS));
    if (weeksAgo >= 0 && weeksAgo < 12) series[11 - weeksAgo]++;
  }
  return {
    openCount, expiringSoon, stages, series,
    ...(showMoney ? { openValue: Math.round(openValue), wonValueMtd: Math.round(wonValueMtd) } : {}),
  };
}

/* ── Products: catalogue health ───────────────────────────────────────── */
async function productsWidget(): Promise<Widget> {
  const { data, error } = await supabaseServer
    .from("products")
    .select("status, updated_at");
  if (error) return { error: error.message };
  const rows = data ?? [];
  const total = rows.length;
  let active = 0, draft = 0, draftAging = 0;
  const now = Date.now();
  for (const r of rows) {
    const st = (r.status || "draft").toLowerCase();
    if (st === "active") active++;
    else if (st === "draft") {
      draft++;
      if (r.updated_at && now - new Date(r.updated_at).getTime() > 14 * DAY_MS) draftAging++;
    }
  }
  return { total, active, draft, draftAging };
}

/* ── To-do: the operator's own open items — THE one shared definition ── */
async function todoWidget(auth: ServerAuthContext): Promise<Widget> {
  try {
    const open = await countOpenTodos(supabaseServer, auth.account_id, auth.tenant_id);
    return { open };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "todo count failed" };
  }
}

/* ── Presence: who is active today + hours (reuses usage_daily — no new
     pollers, the concurrency policy stays intact) ──────────────────────── */
const SERVICE_ACCOUNTS = new Set(["approvals-actor", "qfix-actor", "exp-unmatched"]);
async function presenceWidget(): Promise<Widget> {
  const today = new Date().toISOString().slice(0, 10);
  const [usage, accounts] = await Promise.all([
    supabaseServer.from("usage_daily").select("account_id, active_seconds").eq("day", today),
    supabaseServer.from("accounts").select("id, username").eq("status", "active").eq("user_type", "internal"),
  ]);
  if (usage.error) return { error: usage.error.message };
  if (accounts.error) return { error: accounts.error.message };
  const team = (accounts.data ?? []).filter((a) => !SERVICE_ACCOUNTS.has(a.username));
  const teamIds = new Set(team.map((a) => a.id));
  let secs = 0;
  const activeIds = new Set<string>();
  for (const u of usage.data ?? []) {
    if (!teamIds.has(u.account_id)) continue;
    const s = Number(u.active_seconds) || 0;
    if (s > 0) { activeIds.add(u.account_id); secs += s; }
  }
  return { activeToday: activeIds.size, teamSize: team.length, hoursToday: Math.round(secs / 360) / 10 };
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* Money visibility: SA only for now — widening it later is a whitelist
     entry here, not a UI change (enforced server-side on purpose). */
  const showMoney = auth.is_super_admin === true;

  const [canQuotes, canProducts, canTodo, canPresence] = await Promise.all([
    allowed(auth, "Quotations"),
    allowed(auth, "Products"),
    allowed(auth, "To-do"),
    allowed(auth, "Management"),
  ]);

  const [quotations, products, todo, presence] = await Promise.all([
    canQuotes ? quotationsWidget(showMoney) : Promise.resolve(null),
    canProducts ? productsWidget() : Promise.resolve(null),
    canTodo ? todoWidget(auth) : Promise.resolve(null),
    canPresence ? presenceWidget() : Promise.resolve(null),
  ]);

  return NextResponse.json(
    { widgets: { quotations, products, todo, presence }, showMoney, ts: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
