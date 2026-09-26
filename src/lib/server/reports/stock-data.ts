import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the Inventory numbers (Phase 5C, owner's picks 26 Sep
   2026). Needs the Inventory app (the report route checks it).

     stock_count     the stock lines of the ONE warehouse the report is
                     about: the quantity in the system and — with the role's
                     cost switch — the average cost; the keeper types what
                     they counted beside it (templates.ts DataInputDef)
     stock_writeoffs the stock taken out by adjustment in the days
     stock_moves     every movement in the days
     low_stock       the stock lines that are low — Inventory's ONE rule
                     (lib/inventory/low-stock: at or under the reorder point,
                     else the minimum), the same the alert and the dashboard use

   A report NEVER changes stock (owner's pick): a count or a write-off is
   adjusted in Inventory, with its own approval. Voided movements never
   count. Nothing here writes.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { canSeeCostData } from "@/lib/experience";
import type { ReportDataRow } from "@/lib/reports/templates";
import { DATA_ABOUT, type StockSource } from "@/lib/reports/report-data";
import { toOrder } from "@/lib/reports/numbers-5c";
import { isLowStock, lowStockThreshold } from "@/lib/inventory/low-stock";

export interface StockCtx { auth: ServerAuthContext; start: string; end: string; about: (type: "warehouse") => string | null }
type Answer = { rows: ReportDataRow[]; noCost?: boolean } | "denied" | "about";

const chunks = <T,>(xs: T[], n = 100): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const num = (v: unknown): number | null => { if (v === null || v === undefined || v === "") return null; const x = Number(v); return Number.isFinite(x) ? Math.round(x * 10_000) / 10_000 : null; };
function listOf<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}
const LIMIT = 101;

type Item = { id: string; item_code: string | null; item_name: string | null; unit_of_measure: string | null; reorder_point: number | string | null; min_stock: number | string | null; max_stock: unknown; track_stock: boolean | null };

async function warehouses(auth: ServerAuthContext): Promise<Map<string, string>> {
  let q = supabaseServer.from("inventory_warehouses").select("id, name, code").is("deleted_at", null).limit(500);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  return new Map(listOf<{ id: string; name: string | null; code: string | null }>(await q, "warehouses").map((w) => [w.id, w.name || w.code || "—"]));
}

async function items(auth: ServerAuthContext, ids: string[]): Promise<Map<string, Item>> {
  const out = new Map<string, Item>();
  for (const part of chunks(Array.from(new Set(ids)))) {
    let q = supabaseServer.from("inventory_items").select("id, item_code, item_name, unit_of_measure, reorder_point, min_stock, max_stock, track_stock").in("id", part).is("deleted_at", null);
    if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
    for (const it of listOf<Item>(await q, "items")) out.set(it.id, it);
  }
  return out;
}

export async function stockData(src: StockSource, x: StockCtx): Promise<Answer> {
  const about = DATA_ABOUT[src];
  const wid = about ? x.about("warehouse") : null;
  if (about?.required && !wid) return "about";
  const whs = await warehouses(x.auth);
  if (wid && !whs.has(wid)) return "denied";
  const { start: from, end: to } = x;

  if (src === "stock_count" || src === "low_stock") {
    let q = supabaseServer.from("inventory_stock_balances").select("id, inventory_item_id, warehouse_id, qty_on_hand").limit(2000);
    if (x.auth.tenant_id) q = q.eq("tenant_id", x.auth.tenant_id);
    if (wid) q = q.eq("warehouse_id", wid);
    const bals = listOf<{ id: string; inventory_item_id: string; warehouse_id: string; qty_on_hand: unknown }>(await q, "stock balances");
    const its = await items(x.auth, bals.map((b) => b.inventory_item_id));
    if (src === "low_stock") {
      return { rows: bals.flatMap((b) => {
        const it = its.get(b.inventory_item_id);
        const onHand = num(b.qty_on_hand) ?? 0;
        const limit = lowStockThreshold(it);
        if (!it || !limit || !isLowStock(onHand, it)) return [];
        return [{ key: b.id, cells: { item: it.item_name || it.item_code || "—", warehouse: whs.get(b.warehouse_id) ?? "—", on_hand: onHand, reorder: limit.at, to_order: toOrder(onHand, limit.at, num(it.max_stock)) } }];
      }).sort((a, b) => Number(a.cells.on_hand) - Number(b.cells.on_hand)) };
    }
    /* What stock is worth only with the role's cost switch — never shown
       as nothing when it is hidden. */
    const cost = canSeeCostData(x.auth);
    const value = new Map<string, { avg: number | null; currency: string | null }>();
    if (cost && bals.length) {
      let vq = supabaseServer.from("inventory_valuation").select("inventory_item_id, average_cost, currency").eq("warehouse_id", wid!).limit(2000);
      if (x.auth.tenant_id) vq = vq.eq("tenant_id", x.auth.tenant_id);
      for (const v of listOf<{ inventory_item_id: string; average_cost: unknown; currency: string | null }>(await vq, "valuation")) value.set(v.inventory_item_id, { avg: num(v.average_cost), currency: v.currency });
    }
    const rows = bals.map((b) => {
      const it = its.get(b.inventory_item_id);
      const v = value.get(b.inventory_item_id);
      return { key: b.id, ...(v?.currency ? { currency: v.currency } : {}), cells: { code: it?.item_code ?? "", item: it?.item_name || "—", unit: it?.unit_of_measure ?? "", system: num(b.qty_on_hand) ?? 0, unit_cost: cost ? v?.avg ?? null : null } };
    }).sort((a, b) => String(a.cells.item).localeCompare(String(b.cells.item)));
    return cost ? { rows } : { rows, noCost: true };
  }

  /* Movements in the days (voided never count). */
  let q = supabaseServer.from("inventory_stock_movements").select("id, movement_no, movement_date, warehouse_id, inventory_item_id, movement_type, direction, quantity, reference, notes, status, approval_status, metadata")
    .neq("status", "voided").is("deleted_at", null).gte("movement_date", from).lte("movement_date", to).order("movement_date", { ascending: true }).limit(LIMIT);
  if (x.auth.tenant_id) q = q.eq("tenant_id", x.auth.tenant_id);
  if (wid) q = q.eq("warehouse_id", wid);
  if (src === "stock_writeoffs") q = q.eq("movement_type", "adjustment_out");
  type Mv = { id: string; movement_no: string | null; movement_date: string | null; warehouse_id: string; inventory_item_id: string; movement_type: string; direction: string | null; quantity: unknown; reference: string | null; notes: string | null; status: string; approval_status: string | null; metadata: Record<string, unknown> | null };
  const moves = listOf<Mv>(await q, "stock movements");
  const its = await items(x.auth, moves.map((m) => m.inventory_item_id));
  const itemName = (id: string) => { const it = its.get(id); return it?.item_name || it?.item_code || "—"; };
  if (src === "stock_writeoffs") {
    return { rows: moves.map((m) => ({ key: m.id, cells: {
      no: m.movement_no ?? "—", date: day(m.movement_date), item: itemName(m.inventory_item_id), warehouse: whs.get(m.warehouse_id) ?? "—", qty: num(m.quantity),
      reason: (typeof m.metadata?.adjustment_reason === "string" ? m.metadata.adjustment_reason : "") || m.notes || m.reference || "",
      status: m.approval_status && m.approval_status !== "not_required" ? m.approval_status : m.status,
    } })) };
  }
  return { rows: moves.map((m) => {
    const qty = num(m.quantity) ?? 0;
    const into = m.direction === "in";
    return { key: m.id, cells: { no: m.movement_no ?? "—", date: day(m.movement_date), move: m.movement_type, item: itemName(m.inventory_item_id), warehouse: whs.get(m.warehouse_id) ?? "—", qty_in: into ? qty : null, qty_out: into ? null : qty } };
  }) };
}
