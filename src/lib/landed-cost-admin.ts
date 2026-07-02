/* ---------------------------------------------------------------------------
   Landed Cost Simulator — Supabase CRUD operations
   --------------------------------------------------------------------------- */

import type { SimulationRow } from "./landed-cost-types";

/* landed_cost_simulations has RLS enabled with a service-role-only policy, so
   the browser anon client can neither read nor write it. All CRUD therefore
   goes through the authenticated server routes at /api/landed-cost*, which use
   the service-role client behind a session check. */

const BASE = "/api/landed-cost";

export async function fetchSimulations(): Promise<SimulationRow[]> {
  try {
    const res = await fetch(BASE, { credentials: "include" });
    if (!res.ok) { console.error("[LCS] Fetch:", res.status); return []; }
    const json = (await res.json()) as { simulations?: SimulationRow[] };
    return json.simulations ?? [];
  } catch (e) { console.error("[LCS] Fetch:", e); return []; }
}

export async function fetchSimulation(id: string): Promise<SimulationRow | null> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { credentials: "include" });
    if (!res.ok) { console.error("[LCS] FetchOne:", res.status); return null; }
    const json = (await res.json()) as { simulation?: SimulationRow };
    return json.simulation ?? null;
  } catch (e) { console.error("[LCS] FetchOne:", e); return null; }
}

export async function createSimulation(sim: Partial<SimulationRow>): Promise<string | null> {
  try {
    const res = await fetch(BASE, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sim),
    });
    if (!res.ok) { console.error("[LCS] Create:", res.status); return null; }
    const json = (await res.json()) as { id?: string };
    return json.id ?? null;
  } catch (e) { console.error("[LCS] Create:", e); return null; }
}

export async function updateSimulation(id: string, sim: Partial<SimulationRow>): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sim),
    });
    if (!res.ok) { console.error("[LCS] Update:", res.status); return false; }
    return true;
  } catch (e) { console.error("[LCS] Update:", e); return false; }
}

export async function deleteSimulation(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { console.error("[LCS] Delete:", res.status); return false; }
    return true;
  } catch (e) { console.error("[LCS] Delete:", e); return false; }
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
