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

export async function fetchProductsForLookup(): Promise<{ id: string; product_name: string; brand: string | null; hs_code: string | null }[]> {
  const { data } = await supabase
    .from("products")
    .select("id, product_name, brand, hs_code")
    .order("product_name");
  return (data || []) as { id: string; product_name: string; brand: string | null; hs_code: string | null }[];
}

export async function fetchModelsForProduct(productId: string): Promise<{
  id: string; model_name: string; sku: string; cost_price: number | null;
  weight: number | null; cbm: number | null; packing_type: string | null;
  global_price: number | null;
}[]> {
  const { data } = await supabase
    .from("product_models")
    .select("id, model_name, sku, cost_price, weight, cbm, packing_type, global_price")
    .eq("product_id", productId)
    .order("order");
  return (data || []) as {
    id: string; model_name: string; sku: string; cost_price: number | null;
    weight: number | null; cbm: number | null; packing_type: string | null;
    global_price: number | null;
  }[];
}
