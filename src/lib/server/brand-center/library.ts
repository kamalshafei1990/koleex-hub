import "server-only";

/* Brand Center library — the shared server pieces of the /api/brand-center
   routes: reading one item with everything under it, and the input checks
   every write uses (lengths, allowed values). */

import { supabaseServer } from "@/lib/server/supabase-server";

export const IMPORTANCE = ["core", "optional", "later"] as const;
export const DECISION = ["yes", "later", "no"] as const;
export const ITEM_STATUS = ["draft", "approved", "retired"] as const;
export const DESIGN_KIND = ["print_file", "editable", "logo_pack", "mockup", "photo", "vendor_brief", "template", "other"] as const;
export const DESIGN_STATUS = ["draft", "active", "retired"] as const;

/** A trimmed string of at most `max` characters, or undefined when absent. */
export function text(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length ? s.slice(0, max) : undefined;
}

export function oneOf<T extends readonly string[]>(v: unknown, list: T): T[number] | undefined {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

/** A key from a label: lowercase letters, digits and dashes. */
export function keyFrom(label: string): string {
  return label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || `k-${Date.now().toString(36)}`;
}

/** One item with its types, options and designs (+ files), or null. */
export async function loadItem(tenantId: string, itemId: string) {
  const { data: item, error } = await supabaseServer
    .from("brand_items")
    .select("id, section_id, group_id, key, name, name_i18n, use_text, use_i18n, importance, decision, status, note, owner_note, rules, roles, sort, updated_at")
    .eq("tenant_id", tenantId).eq("id", itemId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) return null;
  const [section, group, types, options, designs] = await Promise.all([
    supabaseServer.from("brand_sections").select("id, key, no, name, name_i18n").eq("id", item.section_id).maybeSingle(),
    item.group_id ? supabaseServer.from("brand_groups").select("id, name, name_i18n").eq("id", item.group_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabaseServer.from("brand_item_types").select("id, key, label, label_i18n, sort").eq("item_id", itemId).order("sort"),
    supabaseServer.from("brand_item_options").select("id, type_id, key, label, label_i18n, recommended, chosen, sort").eq("item_id", itemId).order("sort"),
    supabaseServer.from("brand_designs").select("id, option_ids, name, name_i18n, kind, status, is_default, notes, created_at, updated_at").eq("item_id", itemId).order("created_at"),
  ]);
  const err = section.error ?? group.error ?? types.error ?? options.error ?? designs.error;
  if (err) throw new Error(err.message);
  const designIds = (designs.data ?? []).map((d) => d.id);
  const files = designIds.length
    ? await supabaseServer.from("brand_files").select("id, design_id, file_name, mime, size_bytes, width_mm, height_mm, purpose, created_at").in("design_id", designIds).order("created_at")
    : { data: [], error: null };
  if (files.error) throw new Error(files.error.message);
  return {
    item,
    section: section.data,
    group: group.data,
    types: (types.data ?? []).map((t) => ({ ...t, options: (options.data ?? []).filter((o) => o.type_id === t.id) })),
    designs: (designs.data ?? []).map((d) => ({ ...d, files: (files.data ?? []).filter((f) => f.design_id === d.id) })),
  };
}

/* ── files (plan step C5) ──────────────────────────────────────────────── */

export const BRAND_BUCKET = "brand-center";
/** Files at or under this go through our own route (reliable on every line);
 *  larger ones are PUT straight to storage with a signed token. Just under
 *  the platform's 4.5 MB request cap. */
export const DIRECT_UPLOAD_OVER = 4.2 * 1024 * 1024;
export const MAX_FILE_BYTES = 500 * 1024 * 1024;

export function purposeOf(fileName: string): "print_pdf" | "pdf" | "svg" | "png" | "jpg" | "dxf" | "ai" | "other" {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return /print|cmyk|bleed|press/i.test(fileName) ? "print_pdf" : "pdf";
  if (ext === "svg") return "svg";
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "dxf") return "dxf";
  if (ext === "ai" || ext === "eps") return "ai";
  return "other";
}

/** A storage path under <tenant>/<item>/<design>/ with a safe file name. */
export function filePath(tenantId: string, itemId: string, designId: string, fileName: string): string {
  const safe = fileName.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-120) || "file";
  return `${tenantId}/${itemId}/${designId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
}
