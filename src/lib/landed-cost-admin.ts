/* ---------------------------------------------------------------------------
   Landed Cost Simulator — Supabase CRUD operations
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type { SimulationRow } from "./landed-cost-types";

const TABLE = "landed_cost_simulations";

export async function fetchSimulations(): Promise<SimulationRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) { console.error("[LCS] Fetch:", error.message); return []; }
  return (data as SimulationRow[]) || [];
}

export async function fetchSimulation(id: string): Promise<SimulationRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();
  if (error) { console.error("[LCS] FetchOne:", error.message); return null; }
  return data as SimulationRow;
}

export async function createSimulation(sim: Partial<SimulationRow>): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(sim)
    .select("id")
    .single();
  if (error) { console.error("[LCS] Create:", error.message); return null; }
  return (data as { id: string }).id;
}

export async function updateSimulation(id: string, sim: Partial<SimulationRow>): Promise<boolean> {
  const { error } = await supabase
    .from(TABLE)
    .update({ ...sim, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("[LCS] Update:", error.message); return false; }
  return true;
}

export async function deleteSimulation(id: string): Promise<boolean> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) { console.error("[LCS] Delete:", error.message); return false; }
  return true;
}

export async function duplicateSimulation(id: string): Promise<string | null> {
  const sim = await fetchSimulation(id);
  if (!sim) return null;
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = sim;
  return createSimulation({ ...rest, name: `${sim.name} (Copy)`, status: "draft" });
}

/* ── Product lookup ── */

/* P0-B: product lookups go through /api/products* (auth + Product-Data
   projection — hs_code/cost_price reach only PD/SA callers, which the
   landed-cost tool already requires) instead of the anon client. */
export async function fetchProductsForLookup(): Promise<{ id: string; product_name: string; brand: string | null; hs_code: string | null }[]> {
  try {
    const res = await fetch("/api/products", { credentials: "include" });
    if (!res.ok) return [];
    const json = (await res.json()) as { products?: { id: string; product_name: string; brand: string | null; hs_code: string | null }[] };
    return (json.products ?? [])
      .map((p) => ({ id: p.id, product_name: p.product_name, brand: p.brand ?? null, hs_code: p.hs_code ?? null }))
      .sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""));
  } catch { return []; }
}

export async function fetchModelsForProduct(productId: string): Promise<{
  id: string; model_name: string; sku: string; cost_price: number | null;
  weight: number | null; cbm: number | null; packing_type: string | null;
  global_price: number | null;
}[]> {
  try {
    const res = await fetch(`/api/product-models?product_id=${encodeURIComponent(productId)}`, { credentials: "include" });
    if (!res.ok) return [];
    const json = (await res.json()) as { models?: Record<string, unknown>[] };
    return (json.models ?? []).map((m) => ({
      id: m.id as string,
      model_name: (m.model_name as string) ?? "",
      sku: (m.sku as string) ?? "",
      cost_price: (m.cost_price as number | null) ?? null,
      weight: (m.weight as number | null) ?? null,
      cbm: (m.cbm as number | null) ?? null,
      packing_type: (m.packing_type as string | null) ?? null,
      global_price: (m.global_price as number | null) ?? null,
    }));
  } catch { return []; }
}
