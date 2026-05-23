import "server-only";

/* ===========================================================================
   INV-H4A — Variant + Batch engine.

   Public surface:
     • createVariant / listVariants / getVariant / updateVariant / archiveVariant
     • createBatch   / listBatches   / getBatch   / updateBatch
     • applyBatchMovement(batchId, direction, qty, tenantId)
         Maintains inventory_batches.quantity_remaining when a movement is
         posted or voided. Wired from posting.ts. NOT a parallel ledger —
         the stock_balances ledger is still the source of truth; this just
         keeps the batch counter aligned for visibility + traceability.

   Variants are item-level metadata. Batches are warehouse-scoped lots that
   may or may not be tied to a variant. Neither replaces the (item, warehouse)
   key in inventory_stock_balances — they SUBDIVIDE it.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export type VariantStatus = "active" | "inactive" | "archived";
export type BatchStatus = "active" | "archived";

export interface InventoryItemVariant {
  id: string;
  tenant_id: string;
  inventory_item_id: string;
  variant_code: string;
  variant_name: string;
  attributes: Record<string, unknown>;
  sku_suffix: string | null;
  barcode: string | null;
  qr_code: string | null;
  cost_price: number | null;
  currency: string | null;
  weight: number | null;
  dimensions: string | null;
  status: VariantStatus;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InventoryBatch {
  id: string;
  tenant_id: string;
  inventory_item_id: string;
  variant_id: string | null;
  batch_no: string;
  supplier_batch_no: string | null;
  manufacture_date: string | null;
  expiry_date: string | null;
  quantity_initial: number;
  quantity_remaining: number;
  warehouse_id: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  status: BatchStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type BatchExpiryStatus = "normal" | "near_expiry" | "expired" | "depleted";

export interface InventoryBatchWithRefs extends InventoryBatch {
  expiry_status: BatchExpiryStatus;
  item_code: string | null;
  item_name: string | null;
  variant_name: string | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
}

/* ─── Utilities ───────────────────────────────────────────── */

function humanError(e: { message?: string; code?: string } | null | undefined, fallback: string): string {
  const raw = e?.message ?? "";
  if (/INV_H4A_BATCH_VARIANT_ITEM_MISMATCH/.test(raw))
    return "Batch's variant must belong to the same item.";
  if (/INV_H4A_BATCH_VARIANT_MISSING/.test(raw))
    return "Selected variant does not exist.";
  if (/INV_H4A_MOVEMENT_VARIANT_ITEM_MISMATCH/.test(raw))
    return "Movement's variant must belong to the chosen item.";
  if (/INV_H4A_MOVEMENT_BATCH_ITEM_MISMATCH/.test(raw))
    return "Movement's batch must belong to the chosen item.";
  if (/INV_H4A_MOVEMENT_BATCH_VARIANT_MISMATCH/.test(raw))
    return "Movement's batch must match the chosen variant (or both must be empty).";
  if (/INV_H4A_MOVEMENT_BATCH_MISSING/.test(raw))
    return "Selected batch does not exist.";
  if (/uq_inv_variants_code/.test(raw))
    return "A variant with this code already exists in this tenant.";
  if (/uq_inv_variants_item_name/.test(raw))
    return "A variant with this name already exists for this item.";
  if (/uq_inv_variants_barcode/.test(raw))
    return "Another variant already uses this barcode.";
  if (/uq_inv_batches_no/.test(raw))
    return "A batch with this number already exists in this tenant.";
  if (/violates check constraint/i.test(raw)) return "Invalid value for a field.";
  if (/22P\d{2}|^P\d{4}/.test(raw)) return fallback;
  return raw || fallback;
}

export function classifyBatchExpiry(
  b: { expiry_date: string | null; quantity_remaining: number },
  todayISO?: string,
): BatchExpiryStatus {
  if ((Number(b.quantity_remaining) || 0) <= 0) return "depleted";
  if (!b.expiry_date) return "normal";
  const today = todayISO ?? new Date().toISOString().slice(0, 10);
  if (b.expiry_date < today) return "expired";
  const thirty = new Date();
  thirty.setDate(thirty.getDate() + 30);
  const limit = thirty.toISOString().slice(0, 10);
  if (b.expiry_date <= limit) return "near_expiry";
  return "normal";
}

/* ─── Variants ────────────────────────────────────────────── */

export interface CreateVariantInput {
  tenant_id: string;
  inventory_item_id: string;
  variant_code?: string;
  variant_name: string;
  attributes?: Record<string, unknown>;
  sku_suffix?: string | null;
  barcode?: string | null;
  qr_code?: string | null;
  cost_price?: number | null;
  currency?: string | null;
  weight?: number | null;
  dimensions?: string | null;
  status?: VariantStatus;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
}

function generateVariantCode(itemCode: string, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
  const tail = (Date.now().toString(36) + Math.random().toString(36).slice(2))
    .replace(/\./g, "")
    .slice(-5)
    .toUpperCase();
  return `${itemCode}-${slug || "var"}-${tail}`;
}

export async function createVariant(
  input: CreateVariantInput,
): Promise<{ ok: boolean; variant?: InventoryItemVariant; error?: string; code?: string }> {
  if (!input.tenant_id) return { ok: false, error: "tenant_id required" };
  if (!input.inventory_item_id) return { ok: false, error: "inventory_item_id required" };
  if (!input.variant_name?.trim()) return { ok: false, error: "variant_name required" };

  /* Pull item code so we can mint a default variant_code if absent. */
  let variantCode = input.variant_code?.trim();
  if (!variantCode) {
    const { data: item } = await supabaseServer
      .from("inventory_items")
      .select("item_code")
      .eq("id", input.inventory_item_id)
      .eq("tenant_id", input.tenant_id)
      .maybeSingle();
    const code = (item as { item_code?: string } | null)?.item_code ?? "ITEM";
    variantCode = generateVariantCode(code, input.variant_name);
  }

  const { data, error } = await supabaseServer
    .from("inventory_item_variants")
    .insert({
      tenant_id: input.tenant_id,
      inventory_item_id: input.inventory_item_id,
      variant_code: variantCode,
      variant_name: input.variant_name.trim(),
      attributes: input.attributes ?? {},
      sku_suffix: input.sku_suffix ?? null,
      barcode: input.barcode ?? null,
      qr_code: input.qr_code ?? null,
      cost_price: input.cost_price ?? null,
      currency: input.currency ?? null,
      weight: input.weight ?? null,
      dimensions: input.dimensions ?? null,
      status: input.status ?? "active",
      metadata: input.metadata ?? {},
      created_by: input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: humanError(error, "Failed to create variant") };
  return { ok: true, variant: data as InventoryItemVariant };
}

export async function listVariants(opts: {
  tenantId: string;
  inventoryItemId?: string;
  status?: VariantStatus;
  search?: string;
  limit?: number;
}): Promise<InventoryItemVariant[]> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  let q = supabaseServer
    .from("inventory_item_variants")
    .select("*")
    .eq("tenant_id", opts.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.inventoryItemId) q = q.eq("inventory_item_id", opts.inventoryItemId);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.search) {
    const s = opts.search.replace(/[%_]/g, "\\$&");
    q = q.or(`variant_name.ilike.%${s}%,variant_code.ilike.%${s}%,barcode.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as InventoryItemVariant[];
}

export async function getVariant(
  tenantId: string,
  variantId: string,
): Promise<InventoryItemVariant | null> {
  const { data } = await supabaseServer
    .from("inventory_item_variants")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as InventoryItemVariant | null) ?? null;
}

export interface UpdateVariantInput {
  variant_name?: string;
  attributes?: Record<string, unknown>;
  sku_suffix?: string | null;
  barcode?: string | null;
  qr_code?: string | null;
  cost_price?: number | null;
  currency?: string | null;
  weight?: number | null;
  dimensions?: string | null;
  status?: VariantStatus;
  metadata?: Record<string, unknown>;
}

export async function updateVariant(
  tenantId: string,
  variantId: string,
  patch: UpdateVariantInput,
): Promise<{ ok: boolean; variant?: InventoryItemVariant; error?: string }> {
  const update: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    const cur = await getVariant(tenantId, variantId);
    return cur ? { ok: true, variant: cur } : { ok: false, error: "Variant not found" };
  }
  const { data, error } = await supabaseServer
    .from("inventory_item_variants")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: humanError(error, "Failed to update variant") };
  if (!data) return { ok: false, error: "Variant not found" };
  return { ok: true, variant: data as InventoryItemVariant };
}

/** Soft delete via status='archived'. Variants are never hard-deleted because
 *  historical movements may still reference them. */
export async function archiveVariant(
  tenantId: string,
  variantId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer
    .from("inventory_item_variants")
    .update({ status: "archived" })
    .eq("tenant_id", tenantId)
    .eq("id", variantId);
  if (error) return { ok: false, error: humanError(error, "Failed to archive variant") };
  return { ok: true };
}

/* ─── Batches ─────────────────────────────────────────────── */

export interface CreateBatchInput {
  tenant_id: string;
  inventory_item_id: string;
  variant_id?: string | null;
  batch_no?: string;
  supplier_batch_no?: string | null;
  manufacture_date?: string | null;
  expiry_date?: string | null;
  quantity_initial: number;
  warehouse_id: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
}

function generateBatchNo(itemCode: string, dateISO: string): string {
  const ymd = dateISO.slice(0, 10).replace(/-/g, "");
  const tail = (Date.now().toString(16) + Math.random().toString(16).slice(2))
    .replace(/\./g, "")
    .slice(-6)
    .toUpperCase();
  return `BATCH-${itemCode}-${ymd}-${tail}`;
}

export async function createBatch(
  input: CreateBatchInput,
): Promise<{ ok: boolean; batch?: InventoryBatch; error?: string }> {
  if (!input.tenant_id) return { ok: false, error: "tenant_id required" };
  if (!input.inventory_item_id) return { ok: false, error: "inventory_item_id required" };
  if (!input.warehouse_id) return { ok: false, error: "warehouse_id required" };
  if (!Number.isFinite(input.quantity_initial) || input.quantity_initial < 0) {
    return { ok: false, error: "quantity_initial must be >= 0" };
  }

  let batchNo = input.batch_no?.trim();
  if (!batchNo) {
    const { data: item } = await supabaseServer
      .from("inventory_items")
      .select("item_code")
      .eq("id", input.inventory_item_id)
      .eq("tenant_id", input.tenant_id)
      .maybeSingle();
    const code = (item as { item_code?: string } | null)?.item_code ?? "ITEM";
    batchNo = generateBatchNo(code, new Date().toISOString());
  }

  const { data, error } = await supabaseServer
    .from("inventory_batches")
    .insert({
      tenant_id: input.tenant_id,
      inventory_item_id: input.inventory_item_id,
      variant_id: input.variant_id ?? null,
      batch_no: batchNo,
      supplier_batch_no: input.supplier_batch_no ?? null,
      manufacture_date: input.manufacture_date ?? null,
      expiry_date: input.expiry_date ?? null,
      quantity_initial: input.quantity_initial,
      quantity_remaining: input.quantity_initial,
      warehouse_id: input.warehouse_id,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      created_by: input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: humanError(error, "Failed to create batch") };
  return { ok: true, batch: data as InventoryBatch };
}

export async function listBatches(opts: {
  tenantId: string;
  inventoryItemId?: string;
  variantId?: string;
  warehouseId?: string;
  expiryStatus?: BatchExpiryStatus | "all";
  search?: string;
  limit?: number;
}): Promise<InventoryBatchWithRefs[]> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  let q = supabaseServer
    .from("inventory_batches")
    .select("*")
    .eq("tenant_id", opts.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.inventoryItemId) q = q.eq("inventory_item_id", opts.inventoryItemId);
  if (opts.variantId) q = q.eq("variant_id", opts.variantId);
  if (opts.warehouseId) q = q.eq("warehouse_id", opts.warehouseId);
  if (opts.search) {
    const s = opts.search.replace(/[%_]/g, "\\$&");
    q = q.or(`batch_no.ilike.%${s}%,supplier_batch_no.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as InventoryBatch[];
  if (rows.length === 0) return [];

  const itemIds = Array.from(new Set(rows.map((r) => r.inventory_item_id)));
  const variantIds = Array.from(new Set(rows.map((r) => r.variant_id).filter(Boolean) as string[]));
  const whIds = Array.from(new Set(rows.map((r) => r.warehouse_id)));

  const [itemsRes, varRes, whRes] = await Promise.all([
    itemIds.length
      ? supabaseServer.from("inventory_items").select("id, item_code, item_name").in("id", itemIds)
      : Promise.resolve({ data: [] }),
    variantIds.length
      ? supabaseServer
          .from("inventory_item_variants")
          .select("id, variant_name")
          .in("id", variantIds)
      : Promise.resolve({ data: [] }),
    whIds.length
      ? supabaseServer.from("inventory_warehouses").select("id, code, name").in("id", whIds)
      : Promise.resolve({ data: [] }),
  ]);
  const itemMap = new Map<string, { item_code: string; item_name: string }>();
  for (const i of (itemsRes.data ?? []) as Array<{ id: string; item_code: string; item_name: string }>) {
    itemMap.set(i.id, { item_code: i.item_code, item_name: i.item_name });
  }
  const varMap = new Map<string, string>();
  for (const v of (varRes.data ?? []) as Array<{ id: string; variant_name: string }>) {
    varMap.set(v.id, v.variant_name);
  }
  const whMap = new Map<string, { code: string; name: string }>();
  for (const w of (whRes.data ?? []) as Array<{ id: string; code: string; name: string }>) {
    whMap.set(w.id, { code: w.code, name: w.name });
  }

  const enriched: InventoryBatchWithRefs[] = rows.map((b) => ({
    ...b,
    quantity_initial: Number(b.quantity_initial) || 0,
    quantity_remaining: Number(b.quantity_remaining) || 0,
    expiry_status: classifyBatchExpiry(b),
    item_code: itemMap.get(b.inventory_item_id)?.item_code ?? null,
    item_name: itemMap.get(b.inventory_item_id)?.item_name ?? null,
    variant_name: b.variant_id ? varMap.get(b.variant_id) ?? null : null,
    warehouse_code: whMap.get(b.warehouse_id)?.code ?? null,
    warehouse_name: whMap.get(b.warehouse_id)?.name ?? null,
  }));

  if (opts.expiryStatus && opts.expiryStatus !== "all") {
    return enriched.filter((b) => b.expiry_status === opts.expiryStatus);
  }
  return enriched;
}

export async function getBatch(
  tenantId: string,
  batchId: string,
): Promise<InventoryBatchWithRefs | null> {
  const list = await listBatches({ tenantId, limit: 1 });
  /* listBatches doesn't filter by id — do a targeted fetch instead. */
  const { data } = await supabaseServer
    .from("inventory_batches")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", batchId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return list.find((b) => b.id === batchId) ?? null;
  const row = data as InventoryBatch;
  const enriched = await listBatches({ tenantId, inventoryItemId: row.inventory_item_id, limit: 200 });
  return enriched.find((b) => b.id === batchId) ?? null;
}

export interface UpdateBatchInput {
  supplier_batch_no?: string | null;
  manufacture_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  status?: BatchStatus;
}

export async function updateBatch(
  tenantId: string,
  batchId: string,
  patch: UpdateBatchInput,
): Promise<{ ok: boolean; batch?: InventoryBatch; error?: string }> {
  const update: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    const { data } = await supabaseServer
      .from("inventory_batches")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", batchId)
      .is("deleted_at", null)
      .maybeSingle();
    return data ? { ok: true, batch: data as InventoryBatch } : { ok: false, error: "Batch not found" };
  }
  const { data, error } = await supabaseServer
    .from("inventory_batches")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("id", batchId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: humanError(error, "Failed to update batch") };
  if (!data) return { ok: false, error: "Batch not found" };
  return { ok: true, batch: data as InventoryBatch };
}

/* ─── applyBatchMovement — quantity_remaining maintenance ─── */

/** Adjust inventory_batches.quantity_remaining for a movement.
 *
 *  Called by posting.ts:
 *    • on POST  with the movement's signed delta (direction='in' → +qty, 'out' → -qty)
 *    • on VOID  with the OPPOSITE delta (in→subtract, out→add) — i.e. reverse the
 *      original effect.
 *
 *  Returns ok:false with humanized error if an OUT movement would drive the
 *  batch's remaining below zero. The engine treats this as a refused post.
 */
export async function applyBatchMovement(
  tenantId: string,
  batchId: string,
  delta: number,
): Promise<{ ok: boolean; remaining?: number; error?: string }> {
  const { data: batch, error: getErr } = await supabaseServer
    .from("inventory_batches")
    .select("id, quantity_remaining, batch_no")
    .eq("tenant_id", tenantId)
    .eq("id", batchId)
    .maybeSingle();
  if (getErr) return { ok: false, error: humanError(getErr, "Failed to read batch") };
  if (!batch) return { ok: false, error: "Batch not found" };

  const current = Number((batch as { quantity_remaining: number }).quantity_remaining) || 0;
  const next = current + delta;
  if (next < 0) {
    return {
      ok: false,
      error: `Batch ${(batch as { batch_no: string }).batch_no} only has ${current} remaining (can't subtract ${Math.abs(delta)}).`,
    };
  }
  const { error: upErr } = await supabaseServer
    .from("inventory_batches")
    .update({ quantity_remaining: next })
    .eq("tenant_id", tenantId)
    .eq("id", batchId);
  if (upErr) return { ok: false, error: humanError(upErr, "Failed to update batch remaining") };
  return { ok: true, remaining: next };
}

/** Aggregate balance shape used when balances API is asked to group by
 *  item+variant+batch+warehouse. Built on top of inventory_stock_movements
 *  (posted only, not voided) so it's always reconcilable. */
export interface DrilledBalanceRow {
  inventory_item_id: string;
  variant_id: string | null;
  batch_id: string | null;
  warehouse_id: string;
  qty_on_hand: number;
  /** Weighted-average per (item, variant, batch, warehouse) bucket. */
  avg_cost: number;
  inventory_value: number;
  currency: string;
}

export async function buildDrilledBalances(opts: {
  tenantId: string;
  inventoryItemId?: string;
  warehouseId?: string;
}): Promise<DrilledBalanceRow[]> {
  let q = supabaseServer
    .from("inventory_stock_movements")
    .select("inventory_item_id, variant_id, batch_id, warehouse_id, direction, quantity, unit_cost, currency, status, created_at")
    .eq("tenant_id", opts.tenantId)
    .eq("status", "posted")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (opts.inventoryItemId) q = q.eq("inventory_item_id", opts.inventoryItemId);
  if (opts.warehouseId) q = q.eq("warehouse_id", opts.warehouseId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  interface Bucket {
    inventory_item_id: string;
    variant_id: string | null;
    batch_id: string | null;
    warehouse_id: string;
    qty: number;
    avg: number;
    currency: string;
  }
  const buckets = new Map<string, Bucket>();
  for (const m of (data ?? []) as Array<{
    inventory_item_id: string;
    variant_id: string | null;
    batch_id: string | null;
    warehouse_id: string;
    direction: "in" | "out";
    quantity: number;
    unit_cost: number | null;
    currency: string;
  }>) {
    const key = `${m.inventory_item_id}|${m.variant_id ?? ""}|${m.batch_id ?? ""}|${m.warehouse_id}`;
    const b = buckets.get(key) ?? {
      inventory_item_id: m.inventory_item_id,
      variant_id: m.variant_id,
      batch_id: m.batch_id,
      warehouse_id: m.warehouse_id,
      qty: 0,
      avg: 0,
      currency: m.currency || "USD",
    };
    const q = Number(m.quantity) || 0;
    if (m.direction === "in") {
      const c = m.unit_cost != null ? Number(m.unit_cost) : null;
      const newQty = b.qty + q;
      if (c != null && newQty > 0) {
        b.avg = (b.qty * b.avg + q * c) / newQty;
      }
      b.qty = newQty;
    } else {
      b.qty = Math.max(0, b.qty - q);
    }
    b.currency = m.currency || b.currency;
    buckets.set(key, b);
  }

  return Array.from(buckets.values()).map((b) => ({
    inventory_item_id: b.inventory_item_id,
    variant_id: b.variant_id,
    batch_id: b.batch_id,
    warehouse_id: b.warehouse_id,
    qty_on_hand: b.qty,
    avg_cost: b.avg,
    inventory_value: b.qty * b.avg,
    currency: b.currency,
  }));
}

export async function getBatchKpis(tenantId: string): Promise<{
  expired: number;
  near_expiry: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const thirty = new Date();
  thirty.setDate(thirty.getDate() + 30);
  const limit = thirty.toISOString().slice(0, 10);

  const [exp, near] = await Promise.all([
    supabaseServer
      .from("inventory_batches")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .gt("quantity_remaining", 0)
      .lt("expiry_date", today),
    supabaseServer
      .from("inventory_batches")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .gt("quantity_remaining", 0)
      .gte("expiry_date", today)
      .lte("expiry_date", limit),
  ]);
  return {
    expired: Number(exp.count ?? 0),
    near_expiry: Number(near.count ?? 0),
  };
}
