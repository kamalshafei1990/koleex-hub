import "server-only";

/* ---------------------------------------------------------------------------
   Shared CRUD for the Visual Division Registry entities (divisions, categories,
   subcategories, product systems). One place for slug generation, field
   whitelisting and tenant-scoped queries so every route stays tiny + coherent.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { slugify } from "@/lib/visual-library/collection-fields";

export interface EntityConfig {
  table: string;
  parentKey?: string;                 // FK column to a parent entity (e.g. division_id)
  parentTable?: string;               // parent table for ownership validation
  fields: string[];                   // writable scalar fields (besides name/slug/code/parent)
  defaultSort: string;                // column for ordering
}

export const ENTITIES: Record<string, EntityConfig> = {
  divisions: {
    table: "visual_divisions",
    fields: ["description", "icon_asset_id", "cover_asset_id", "visual_style", "dna_profile_id", "approval_state", "sort_order", "active"],
    defaultSort: "sort_order",
  },
  categories: {
    table: "visual_categories", parentKey: "division_id", parentTable: "visual_divisions",
    fields: ["description", "icon_asset_id", "cover_asset_id", "visual_style", "usage_context", "dna_profile_id", "approval_state", "sort_order", "active"],
    defaultSort: "sort_order",
  },
  subcategories: {
    table: "visual_subcategories", parentKey: "category_id", parentTable: "visual_categories",
    fields: ["description", "icon_asset_id", "visual_style", "machine_type", "operational_context", "dna_profile_id", "usage_rules", "approval_state", "sort_order", "active"],
    defaultSort: "sort_order",
  },
  systems: {
    table: "visual_product_systems", parentKey: "subcategory_id", parentTable: "visual_subcategories",
    fields: ["description", "system_type", "visual_style", "icon_asset_id", "feature_priority", "complexity_level", "ui_relevance", "machine_relevance", "active"],
    defaultSort: "feature_priority",
  },
};

async function uniqueSlug(tenantId: string, table: string, base: string): Promise<string> {
  const root = slugify(base) || "item";
  let slug = root;
  for (let n = 2; n < 50; n++) {
    const { data } = await supabaseServer.from(table).select("id").eq("tenant_id", tenantId).eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

export async function listEntity(cfg: EntityConfig, tenantId: string, parentId?: string | null) {
  let q = supabaseServer.from(cfg.table).select("*").eq("tenant_id", tenantId);
  if (cfg.parentKey && parentId) q = q.eq(cfg.parentKey, parentId);
  q = q.order(cfg.defaultSort, { ascending: cfg.defaultSort !== "feature_priority" }).order("name", { ascending: true });
  return q;
}

function pick(cfg: EntityConfig, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of cfg.fields) if (f in body) out[f] = body[f];
  return out;
}

export async function createEntity(cfg: EntityConfig, tenantId: string, body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "name required", status: 400 };
  const row: Record<string, unknown> = { tenant_id: tenantId, name, ...pick(cfg, body) };
  row.code = typeof body.code === "string" && body.code.trim() ? body.code.trim() : null;
  row.slug = await uniqueSlug(tenantId, cfg.table, typeof body.slug === "string" && body.slug ? body.slug : name);
  if (cfg.parentKey) {
    const parentId = typeof body[cfg.parentKey] === "string" ? (body[cfg.parentKey] as string) : "";
    if (!parentId) return { error: `${cfg.parentKey} required`, status: 400 };
    // ownership check
    const { data: owned } = await supabaseServer.from(cfg.parentTable!).select("id").eq("id", parentId).eq("tenant_id", tenantId).maybeSingle();
    if (!owned) return { error: "parent not found", status: 404 };
    row[cfg.parentKey] = parentId;
  }
  const { data, error } = await supabaseServer.from(cfg.table).insert(row).select("*").maybeSingle();
  if (error) return { error: error.message, status: 500 };
  return { data };
}

export async function patchEntity(cfg: EntityConfig, tenantId: string, id: string, body: Record<string, unknown>) {
  const patch = pick(cfg, body);
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.code === "string") patch.code = body.code.trim() || null;
  if (Object.keys(patch).length === 0) return { error: "no editable fields", status: 400 };
  const { data, error } = await supabaseServer.from(cfg.table).update(patch).eq("id", id).eq("tenant_id", tenantId).select("*").maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data) return { error: "not found", status: 404 };
  return { data };
}

/* Soft archive (never hard-delete). */
export async function archiveEntity(cfg: EntityConfig, tenantId: string, id: string) {
  const { error } = await supabaseServer.from(cfg.table).update({ active: false, approval_state: "archived" }).eq("id", id).eq("tenant_id", tenantId);
  if (error) return { error: error.message, status: 500 };
  return { data: { ok: true } };
}
