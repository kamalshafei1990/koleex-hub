import "server-only";

/* ===========================================================================
   Phase O.2.1 — Inventory Item master writes.

   This module owns the lifecycle of inventory_items, inventory_item_types,
   and inventory_item_categories — the master records that every stock
   movement now refers to.

   Public surface:
     createInventoryItem(input)         — insert + optional opening balance
     updateInventoryItem(id, patch)     — limited PATCH
     archiveInventoryItem(id)           — soft delete via status flag
     restoreInventoryItem(id)
     createItemType(tenant, body)       — tenant-custom type
     updateItemType(id, patch)
     archiveItemType(id)
     ensureInventoryItemForProduct(tenant, productId)
                                        — used by O.3 receiving so PO lines
                                          transparently get an inventory item
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import { createInventoryMovement, postInventoryMovement } from "./posting";
import type {
  ColorToken,
  CreateItemInput,
  IconName,
  InventoryItem,
  InventoryItemType,
} from "./types";
import { ALLOWED_COLORS, ALLOWED_ICONS, ALLOWED_UNITS } from "./types";
import {
  guardProfileArchivable,
  guardProfileDeletable,
  guardProfilePatch,
} from "./discipline";
import { logInventoryAudit } from "./audit";

/* ─── Resolve type by id or key ──────────────────────────── */
interface ResolvedItemType {
  id: string;
  code_prefix: string;
  requires_product: boolean;
  usage_scope: "product_related" | "internal_use";
}

async function resolveItemTypeId(
  tenantId: string,
  opts: { item_type_id?: string; type_key?: string },
): Promise<ResolvedItemType | null> {
  if (opts.item_type_id) {
    /* Allow either a tenant-custom type or a system type. */
    const { data } = await supabaseServer
      .from("inventory_item_types")
      .select("id, code_prefix, tenant_id, is_system, requires_product, usage_scope")
      .eq("id", opts.item_type_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return null;
    const t = data as {
      id: string; code_prefix: string; tenant_id: string | null; is_system: boolean;
      requires_product: boolean; usage_scope: "product_related" | "internal_use";
    };
    if (!t.is_system && t.tenant_id !== tenantId) return null;       // tenant boundary
    return { id: t.id, code_prefix: t.code_prefix, requires_product: t.requires_product, usage_scope: t.usage_scope };
  }
  if (opts.type_key) {
    /* Prefer a tenant-custom row with this key; fall back to system. */
    const { data: custom } = await supabaseServer
      .from("inventory_item_types")
      .select("id, code_prefix, requires_product, usage_scope")
      .eq("tenant_id", tenantId)
      .eq("type_key", opts.type_key)
      .is("deleted_at", null)
      .maybeSingle();
    if (custom) return custom as ResolvedItemType;
    const { data: sys } = await supabaseServer
      .from("inventory_item_types")
      .select("id, code_prefix, requires_product, usage_scope")
      .is("tenant_id", null)
      .eq("is_system", true)
      .eq("type_key", opts.type_key)
      .is("deleted_at", null)
      .maybeSingle();
    if (sys) return sys as ResolvedItemType;
  }
  return null;
}

/** INV-H5B — external lookup: does the given item type require a Product link? */
export async function getItemTypeRequiresProduct(
  tenantId: string,
  opts: { item_type_id?: string; type_key?: string },
): Promise<{ ok: boolean; requires_product?: boolean; usage_scope?: "product_related" | "internal_use"; error?: string }> {
  const t = await resolveItemTypeId(tenantId, opts);
  if (!t) return { ok: false, error: "Unknown item_type_id / type_key" };
  return { ok: true, requires_product: t.requires_product, usage_scope: t.usage_scope };
}

async function nextItemCode(tenantId: string, prefix: string): Promise<string> {
  const { data, error } = await supabaseServer.rpc("fn_inventory_next_item_code", {
    p_tenant_id: tenantId,
    p_prefix: prefix,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/* ─── createInventoryItem ──────────────────────────────── */

export async function createInventoryItem(input: CreateItemInput): Promise<{
  ok: boolean;
  item?: InventoryItem;
  opening_movement_id?: string;
  error?: string;
}> {
  if (!input.tenant_id) return { ok: false, error: "tenant_id required" };
  if (!input.item_name?.trim()) return { ok: false, error: "item_name required" };

  const type = await resolveItemTypeId(input.tenant_id, {
    item_type_id: input.item_type_id,
    type_key: input.type_key,
  });
  if (!type) return { ok: false, error: "Unknown item_type_id / type_key" };

  const unit = input.unit_of_measure ?? "pcs";
  if (!ALLOWED_UNITS.includes(unit)) return { ok: false, error: `Unit '${unit}' not allowed` };

  const code = await nextItemCode(input.tenant_id, type.code_prefix);
  /* Currency stabilization — default any missing currency to the
     tenant's base currency (CNY for Chinese tenants). */
  const itemDefaultCcy = input.currency ?? (await resolveBaseCurrency(input.tenant_id));

  const { data, error } = await supabaseServer
    .from("inventory_items")
    .insert({
      tenant_id: input.tenant_id,
      item_code: code,
      item_name: input.item_name.trim(),
      item_type_id: type.id,
      category_id: input.category_id ?? null,
      subcategory: input.subcategory ?? null,
      brand: input.brand ?? null,
      unit_of_measure: unit,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      qr_code: input.qr_code ?? null,
      cost_price: input.cost_price ?? null,
      currency: itemDefaultCcy,
      min_stock: input.min_stock ?? null,
      reorder_point: input.reorder_point ?? null,
      max_stock: input.max_stock ?? null,
      track_stock: input.track_stock ?? true,
      is_consumable: input.is_consumable ?? false,
      is_sellable: input.is_sellable ?? false,
      is_purchasable: input.is_purchasable ?? true,
      weight: input.weight ?? null,
      dimensions: input.dimensions ?? null,
      image_url: input.image_url ?? null,
      description: input.description ?? null,
      notes: input.notes ?? null,
      preferred_supplier_id: input.preferred_supplier_id ?? null,
      linked_product_id: input.linked_product_id ?? null,
      default_warehouse_id: input.default_warehouse_id ?? null,
      created_by: input.created_by ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  const item = data as InventoryItem;

  /* Optional opening balance — if a quantity was supplied, post an
     opening_balance movement against the chosen (or default) warehouse. */
  let openingMovementId: string | undefined;
  const initial = Number(input.initial_quantity ?? 0);
  if (initial > 0) {
    const created = await createInventoryMovement({
      tenant_id: input.tenant_id,
      inventory_item_id: item.id,
      warehouse_id: input.initial_warehouse_id ?? input.default_warehouse_id ?? null,
      movement_type: "opening_balance",
      quantity: initial,
      unit,
      unit_cost: input.cost_price ?? null,
      currency: itemDefaultCcy,
      source_type: "inventory_item_opening_balance",
      source_id: item.id,
      reference: code,
      created_by: input.created_by ?? null,
      from_workflow: true, // INV-H2 — item-create flow is the opening's workflow
    });
    if (created.ok && created.movement) {
      const posted = await postInventoryMovement(created.movement.id, input.tenant_id, input.created_by ?? null);
      if (posted.ok) openingMovementId = created.movement.id;
    }
  }

  return { ok: true, item, opening_movement_id: openingMovementId };
}

/* ─── updateInventoryItem ──────────────────────────────── */

const PATCHABLE_FIELDS = new Set<keyof InventoryItem>([
  "item_name", "category_id", "subcategory", "brand", "unit_of_measure",
  "default_warehouse_id", "preferred_supplier_id", "linked_product_id",
  "sku", "barcode", "qr_code", "cost_price", "currency",
  "min_stock", "reorder_point", "max_stock", "track_stock",
  "track_serials" as keyof InventoryItem,
  "is_consumable", "is_sellable", "is_purchasable",
  "weight", "dimensions", "image_url", "description", "notes",
  "status",
]);

export async function updateInventoryItem(
  tenantId: string,
  itemId: string,
  patch: Partial<InventoryItem>,
  opts: { actor_id?: string | null; is_super_admin?: boolean } = {},
): Promise<{ ok: boolean; item?: InventoryItem; error?: string; code?: string }> {
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (PATCHABLE_FIELDS.has(k as keyof InventoryItem)) filtered[k] = v;
  }
  if (Object.keys(filtered).length === 0) return { ok: false, error: "No patchable fields supplied" };

  /* INV-H2 Scope 6 — locked fields after movement history. */
  const guard = await guardProfilePatch({
    tenant_id: tenantId,
    inventory_item_id: itemId,
    patch: filtered,
    is_super_admin: !!opts.is_super_admin,
  });
  if (!guard.ok) {
    await logInventoryAudit({
      tenant_id: tenantId,
      actor_id: opts.actor_id ?? null,
      action: "restricted_action_blocked",
      entity_type: "profile",
      entity_id: itemId,
      metadata: {
        reason: guard.code ?? "profile_patch_blocked",
        fields: Object.keys(filtered),
      },
    });
    return { ok: false, error: guard.error, code: guard.code };
  }

  /* Archive transition — block when stock exists. */
  if (filtered.status === "archived") {
    const archGuard = await guardProfileArchivable({ tenant_id: tenantId, inventory_item_id: itemId });
    await logInventoryAudit({
      tenant_id: tenantId,
      actor_id: opts.actor_id ?? null,
      action: archGuard.ok ? "profile_archive_attempt" : "profile_archive_blocked",
      entity_type: "profile",
      entity_id: itemId,
      metadata: { result: archGuard.ok ? "allowed" : "blocked", reason: archGuard.code ?? null },
    });
    if (!archGuard.ok) return { ok: false, error: archGuard.error, code: archGuard.code };
  }

  const { data, error } = await supabaseServer
    .from("inventory_items")
    .update(filtered)
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, item: data as InventoryItem };
}

export async function archiveInventoryItem(
  tenantId: string,
  itemId: string,
  opts: { actor_id?: string | null } = {},
): Promise<{ ok: boolean; error?: string; code?: string }> {
  const guard = await guardProfileArchivable({ tenant_id: tenantId, inventory_item_id: itemId });
  await logInventoryAudit({
    tenant_id: tenantId,
    actor_id: opts.actor_id ?? null,
    action: guard.ok ? "profile_archive_attempt" : "profile_archive_blocked",
    entity_type: "profile",
    entity_id: itemId,
    metadata: { result: guard.ok ? "allowed" : "blocked", reason: guard.code ?? null },
  });
  if (!guard.ok) return { ok: false, error: guard.error, code: guard.code };

  const { error } = await supabaseServer
    .from("inventory_items")
    .update({ status: "archived" })
    .eq("id", itemId)
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** INV-H2 — Hard-delete (soft-delete via deleted_at) a stock profile.
 *  Refuses if any posted/voided movement references the profile. */
export async function deleteInventoryItem(
  tenantId: string,
  itemId: string,
  opts: { actor_id?: string | null } = {},
): Promise<{ ok: boolean; error?: string; code?: string }> {
  const guard = await guardProfileDeletable({ tenant_id: tenantId, inventory_item_id: itemId });
  if (!guard.ok) {
    await logInventoryAudit({
      tenant_id: tenantId,
      actor_id: opts.actor_id ?? null,
      action: "restricted_action_blocked",
      entity_type: "profile",
      entity_id: itemId,
      metadata: { reason: guard.code ?? "profile_delete_blocked" },
    });
    return { ok: false, error: guard.error, code: guard.code };
  }

  const { error } = await supabaseServer
    .from("inventory_items")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", itemId)
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function restoreInventoryItem(tenantId: string, itemId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer
    .from("inventory_items")
    .update({ status: "active" })
    .eq("id", itemId)
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ─── Item Types (custom) ──────────────────────────────── */

export interface CreateItemTypeInput {
  tenant_id: string;
  type_name: string;
  code_prefix?: string;
  icon?: IconName;
  color?: ColorToken;
  description?: string | null;
  created_by?: string | null;
  /** INV-H5B — explicit usage scope. Custom types default to internal_use
   *  (requires_product=false) so operators can create stock for catalogs,
   *  uniforms, office supplies etc. without forcing a Product. */
  usage_scope?: "product_related" | "internal_use";
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}

export async function createItemType(input: CreateItemTypeInput): Promise<{
  ok: boolean;
  type?: InventoryItemType;
  error?: string;
}> {
  if (!input.tenant_id || !input.type_name?.trim()) return { ok: false, error: "type_name required" };
  const icon = (input.icon ?? "box") as IconName;
  const color = (input.color ?? "slate") as ColorToken;
  if (!ALLOWED_ICONS.includes(icon)) return { ok: false, error: `Icon '${icon}' not allowed` };
  if (!ALLOWED_COLORS.includes(color)) return { ok: false, error: `Color '${color}' not allowed` };

  const key = slugify(input.type_name);
  if (!key) return { ok: false, error: "type_name must contain alphanumeric characters" };
  const prefix = (input.code_prefix ?? input.type_name.slice(0, 2).toUpperCase()).replace(/[^A-Z0-9]/g, "").slice(0, 4) || "XX";

  /* INV-H5B — custom types default to internal_use unless caller explicitly
     opts in to product_related. */
  const usageScope = input.usage_scope ?? "internal_use";
  const requiresProduct = usageScope === "product_related";

  const { data, error } = await supabaseServer
    .from("inventory_item_types")
    .insert({
      tenant_id: input.tenant_id,
      type_key: key,
      type_name: input.type_name.trim(),
      code_prefix: prefix,
      icon, color,
      description: input.description ?? null,
      is_system: false,
      is_active: true,
      requires_product: requiresProduct,
      usage_scope: usageScope,
      created_by: input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Type with the same key or name already exists" };
    return { ok: false, error: error.message };
  }
  return { ok: true, type: data as InventoryItemType };
}

export async function updateItemType(
  tenantId: string,
  typeId: string,
  patch: Partial<Pick<InventoryItemType, "type_name" | "icon" | "color" | "description" | "is_active" | "sort_order">>,
): Promise<{ ok: boolean; type?: InventoryItemType; error?: string }> {
  /* System rows are read-only. */
  const { data: existing } = await supabaseServer
    .from("inventory_item_types")
    .select("is_system, tenant_id")
    .eq("id", typeId)
    .maybeSingle();
  const e = existing as { is_system: boolean; tenant_id: string | null } | null;
  if (!e) return { ok: false, error: "Type not found" };
  if (e.is_system) return { ok: false, error: "System types are read-only" };
  if (e.tenant_id !== tenantId) return { ok: false, error: "Type not found" };

  if (patch.icon && !ALLOWED_ICONS.includes(patch.icon as IconName)) return { ok: false, error: "Icon not allowed" };
  if (patch.color && !ALLOWED_COLORS.includes(patch.color as ColorToken)) return { ok: false, error: "Color not allowed" };

  const { data, error } = await supabaseServer
    .from("inventory_item_types")
    .update(patch)
    .eq("id", typeId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, type: data as InventoryItemType };
}

export async function archiveItemType(
  tenantId: string,
  typeId: string,
): Promise<{ ok: boolean; error?: string }> {
  /* System rows cannot be deleted. Custom types with linked items are
     soft-archived (deleted_at) rather than hard-deleted to preserve
     historical references. */
  const { data: existing } = await supabaseServer
    .from("inventory_item_types")
    .select("is_system, tenant_id")
    .eq("id", typeId)
    .maybeSingle();
  const e = existing as { is_system: boolean; tenant_id: string | null } | null;
  if (!e) return { ok: false, error: "Type not found" };
  if (e.is_system) return { ok: false, error: "System types cannot be deleted" };
  if (e.tenant_id !== tenantId) return { ok: false, error: "Type not found" };

  /* Refuse hard delete if any non-deleted items reference this type. */
  const { count } = await supabaseServer
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("item_type_id", typeId)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    /* Soft archive: mark inactive + deleted_at so it stops showing in pickers
       but historical items keep their reference. */
    const { error } = await supabaseServer
      .from("inventory_item_types")
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq("id", typeId)
      .eq("tenant_id", tenantId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  /* Hard delete safe — no items reference this type. */
  const { error } = await supabaseServer
    .from("inventory_item_types")
    .delete()
    .eq("id", typeId)
    .eq("tenant_id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ─── ensureInventoryItemForProduct ─────────────────────── */

export async function ensureInventoryItemForProduct(
  tenantId: string,
  productId: string,
): Promise<string> {
  const { data, error } = await supabaseServer.rpc("fn_inventory_ensure_item_for_product", {
    p_tenant_id: tenantId,
    p_product_id: productId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/* ─── ensureSpecialLocation ───────────────────────────────
   Find-or-create a non-warehouse location (port, forwarder,
   in_transit, customer_location, etc.). Phase O.3.1 receiving uses
   this so a receipt can land stock against a virtual location even
   when there isn't a physical warehouse involved.

   Customer locations are keyed by customer_id, not by name — the
   generated location stays unique per (tenant, customer). */

export type SpecialLocationType =
  | "port"
  | "forwarder"
  | "in_transit"
  | "consolidation_point"
  | "customer_location"
  | "supplier_location"
  | "exhibition_site"
  | "demo_location"
  | "virtual_location";

export async function ensureSpecialLocation(
  tenantId: string,
  locationType: SpecialLocationType,
  opts: { name?: string | null; customer_id?: string | null } = {},
): Promise<string> {
  const { data, error } = await supabaseServer.rpc("fn_inventory_ensure_special_location", {
    p_tenant_id: tenantId,
    p_location_type: locationType,
    p_name: opts.name ?? null,
    p_customer_id: opts.customer_id ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
