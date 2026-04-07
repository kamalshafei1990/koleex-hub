/* ---------------------------------------------------------------------------
   Product Attributes — Master lists for product attribute values.
   Stored as JSON in Supabase Storage (config/product-attributes.json).
   Images stored in media/attributes/{type}/{slug}.{ext}
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";

const BUCKET = "media";
const CONFIG_PATH = "config/product-attributes.json";

export interface AttributeItem {
  name: string;
  image?: string | null;
  countries?: string[];   // ISO country codes for flag display
  description?: string;
}

export interface AttributeConfig {
  tags: string[];
  tag_colors: Record<string, string>;
  plug_types: AttributeItem[];
  colors: string[];
  voltage: string[];
  watt: string[];
  levels: string[];
}

// ── Plug type SVG icons — socket face only, clean outline style ──
export const DEFAULT_PLUG_TYPES: AttributeItem[] = [
  { name: "Type A", countries: ["US", "CA", "MX", "JP"], description: "Two flat parallel pins",
    image: "/images/plug-types/A.svg" },
  { name: "Type B", countries: ["US", "CA", "MX", "BR"], description: "Two flat parallel + round ground",
    image: "/images/plug-types/B.svg" },
  { name: "Type C", countries: ["EU", "KR", "EG", "SA", "AE"], description: "Two round pins — Europlug",
    image: "/images/plug-types/C.svg" },
  { name: "Type D", countries: ["IN", "LK", "NP"], description: "Three large round pins triangle",
    image: "/images/plug-types/D.svg" },
  { name: "Type F", countries: ["DE", "FR", "ES", "NL", "SE", "TR", "KR", "RU"], description: "Schuko — two round pins + grounding clips",
    image: "/images/plug-types/F.svg" },
  { name: "Type G", countries: ["GB", "IE", "MY", "SG", "HK", "AE", "KW", "QA"], description: "Three rectangular pins — BS 1363",
    image: "/images/plug-types/G.svg" },
  { name: "Type H", countries: ["IL"], description: "Three pins — V-shaped (Israel SI 32)",
    image: "/images/plug-types/H.svg" },
  { name: "Type I", countries: ["AU", "CN", "NZ", "AR"], description: "Two angled flat + vertical ground",
    image: "/images/plug-types/I.svg" },
  { name: "Type J", countries: ["CH", "LI"], description: "Three round pins — Swiss SEV 1011",
    image: "/images/plug-types/J.svg" },
  { name: "Type K", countries: ["DK", "GL"], description: "Three round pins — Danish DS 60884-2-D1",
    image: "/images/plug-types/K.svg" },
  { name: "Type L", countries: ["IT", "CL", "UY"], description: "Three round pins in a row — CEI 23-50",
    image: "/images/plug-types/L.svg" },
];

const DEFAULT_CONFIG: AttributeConfig = {
  tags: [],
  tag_colors: {},
  plug_types: DEFAULT_PLUG_TYPES,
  colors: [],
  voltage: [],
  watt: [],
  levels: ["Entry", "Mid", "Premium", "Enterprise"],
};

// ── Config CRUD ──

export async function fetchAttributeConfig(): Promise<AttributeConfig> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(CONFIG_PATH);
    if (error || !data) return { ...DEFAULT_CONFIG };
    const text = await data.text();
    const raw = JSON.parse(text) as Record<string, unknown>;

    // Plug types: ALWAYS use DEFAULT_PLUG_TYPES from code.
    // Stored plug_types are ONLY used for custom user-created types (not in defaults).
    const defaultNames = new Set(DEFAULT_PLUG_TYPES.map(d => d.name));
    const customPlugTypes: AttributeItem[] = [];
    if (Array.isArray(raw.plug_types)) {
      for (const p of raw.plug_types) {
        const item = typeof p === "string" ? { name: p, image: null } : (p as AttributeItem);
        if (!defaultNames.has(item.name)) customPlugTypes.push(item);
      }
    }

    return {
      tags: (raw.tags as string[]) || DEFAULT_CONFIG.tags,
      tag_colors: (raw.tag_colors as Record<string, string>) || {},
      plug_types: [...DEFAULT_PLUG_TYPES, ...customPlugTypes],
      colors: (raw.colors as string[]) || DEFAULT_CONFIG.colors,
      voltage: (raw.voltage as string[]) || DEFAULT_CONFIG.voltage,
      watt: (raw.watt as string[]) || DEFAULT_CONFIG.watt,
      levels: (raw.levels as string[]) || DEFAULT_CONFIG.levels,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveAttributeConfig(config: AttributeConfig): Promise<boolean> {
  // Strip SVG data URIs from default plug types before saving — they come from code, not storage
  const defaultNames = new Set(DEFAULT_PLUG_TYPES.map(d => d.name));
  const cleanConfig = {
    ...config,
    plug_types: config.plug_types.map(p => {
      if (defaultNames.has(p.name) && p.image?.startsWith("data:")) {
        return { ...p, image: null }; // Don't save code-generated SVGs
      }
      return p;
    }),
  };
  const blob = new Blob([JSON.stringify(cleanConfig, null, 2)], { type: "application/json" });
  const { error } = await supabase.storage.from(BUCKET).upload(CONFIG_PATH, blob, {
    cacheControl: "0",
    upsert: true,
  });
  if (error) { console.error("[Config] Save:", error.message); return false; }
  return true;
}

// ── Image upload for attributes ──

export async function uploadAttributeImage(
  attrType: string, slug: string, file: File,
): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const filePath = `attributes/${attrType}/${slug}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    cacheControl: "3600", upsert: true,
  });
  if (error) { console.error("[AttrImage] Upload:", error.message); return null; }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function deleteAttributeImage(attrType: string, slug: string): Promise<boolean> {
  // List to find exact file (we don't know the extension)
  const { data: files } = await supabase.storage.from(BUCKET).list(`attributes/${attrType}`, { limit: 200 });
  const match = (files || []).find(f => f.name.replace(/\.[^.]+$/, "") === slug);
  if (match) {
    await supabase.storage.from(BUCKET).remove([`attributes/${attrType}/${match.name}`]);
  }
  return true;
}

// ── Usage counts from products (single query, all attribute types) ──

export type AttributeUsage = {
  tags: Record<string, number>;
  plug_types: Record<string, number>;
  colors: Record<string, number>;
  voltage: Record<string, number>;
  watt: Record<string, number>;
  levels: Record<string, number>;
  brands: Record<string, number>;
};

export async function fetchAttributeUsage(): Promise<AttributeUsage> {
  const { data } = await supabase.from("products").select("tags, plug_types, colors, voltage, watt, level, brand");
  const result: AttributeUsage = {
    tags: {}, plug_types: {}, colors: {}, voltage: {}, watt: {}, levels: {}, brands: {},
  };
  for (const row of (data || []) as Record<string, unknown>[]) {
    for (const t of (row.tags as string[] | null) || []) result.tags[t] = (result.tags[t] || 0) + 1;
    for (const p of (row.plug_types as string[] | null) || []) result.plug_types[p] = (result.plug_types[p] || 0) + 1;
    for (const c of (row.colors as string[] | null) || []) result.colors[c] = (result.colors[c] || 0) + 1;
    for (const v of (row.voltage as string[] | null) || []) result.voltage[v] = (result.voltage[v] || 0) + 1;
    if (row.watt) result.watt[row.watt as string] = (result.watt[row.watt as string] || 0) + 1;
    if (row.level) result.levels[row.level as string] = (result.levels[row.level as string] || 0) + 1;
    if (row.brand) result.brands[row.brand as string] = (result.brands[row.brand as string] || 0) + 1;
  }
  return result;
}

// ── Merge config with actual product values ──

export function mergeConfigWithUsage(config: AttributeConfig, usage: AttributeUsage): AttributeConfig {
  const mergeStr = (arr: string[], used: Record<string, number>) => {
    const set = new Set(arr);
    for (const key of Object.keys(used)) {
      if (!set.has(key)) { set.add(key); arr.push(key); }
    }
    return arr;
  };
  const mergeItems = (arr: AttributeItem[], used: Record<string, number>) => {
    const set = new Set(arr.map(a => a.name));
    for (const key of Object.keys(used)) {
      if (!set.has(key)) { set.add(key); arr.push({ name: key, image: null }); }
    }
    return arr;
  };
  return {
    tags: mergeStr([...config.tags], usage.tags),
    tag_colors: { ...config.tag_colors },
    plug_types: mergeItems([...config.plug_types], usage.plug_types),
    colors: mergeStr([...config.colors], usage.colors),
    voltage: mergeStr([...config.voltage], usage.voltage),
    watt: mergeStr([...config.watt], usage.watt),
    levels: mergeStr([...config.levels], usage.levels),
  };
}

// ── Rename value across all products ──

export async function renameAttributeInProducts(
  attrType: string,
  oldValue: string,
  newValue: string,
): Promise<boolean> {
  if (["tags", "plug_types", "colors", "voltage"].includes(attrType)) {
    const { data: products } = await supabase
      .from("products")
      .select(`id, ${attrType}`)
      .contains(attrType, [oldValue]);
    for (const p of (products || []) as unknown as Record<string, unknown>[]) {
      const arr = (p[attrType] as string[]) || [];
      const updated = arr.map(v => (v === oldValue ? newValue : v));
      await supabase.from("products").update({ [attrType]: updated }).eq("id", p.id as string);
    }
    return true;
  }
  if (attrType === "watt") {
    const { error } = await supabase.from("products").update({ watt: newValue }).eq("watt", oldValue);
    return !error;
  }
  if (attrType === "levels") {
    const { error } = await supabase.from("products").update({ level: newValue }).eq("level", oldValue);
    return !error;
  }
  if (attrType === "brands") {
    const { error } = await supabase.from("products").update({ brand: newValue }).eq("brand", oldValue);
    return !error;
  }
  return false;
}

// ── Delete value from all products ──

export async function deleteAttributeFromProducts(
  attrType: string,
  value: string,
): Promise<boolean> {
  if (["tags", "plug_types", "colors", "voltage"].includes(attrType)) {
    const { data: products } = await supabase
      .from("products")
      .select(`id, ${attrType}`)
      .contains(attrType, [value]);
    for (const p of (products || []) as unknown as Record<string, unknown>[]) {
      const arr = (p[attrType] as string[]) || [];
      const updated = arr.filter(v => v !== value);
      await supabase.from("products").update({ [attrType]: updated }).eq("id", p.id as string);
    }
    return true;
  }
  if (attrType === "watt") {
    const { error } = await supabase.from("products").update({ watt: null }).eq("watt", value);
    return !error;
  }
  if (attrType === "levels") {
    const { error } = await supabase.from("products").update({ level: null }).eq("level", value);
    return !error;
  }
  if (attrType === "brands") {
    const { error } = await supabase.from("products").update({ brand: null }).eq("brand", value);
    return !error;
  }
  return false;
}

// ── Product counts by classification slug ──

export async function fetchProductCountsByClassification(): Promise<{
  byDivision: Record<string, number>;
  byCategory: Record<string, number>;
  bySubcategory: Record<string, number>;
}> {
  const { data } = await supabase.from("products").select("division_slug, category_slug, subcategory_slug");
  const byDivision: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySubcategory: Record<string, number> = {};
  for (const row of (data || []) as Record<string, string>[]) {
    if (row.division_slug) byDivision[row.division_slug] = (byDivision[row.division_slug] || 0) + 1;
    if (row.category_slug) byCategory[row.category_slug] = (byCategory[row.category_slug] || 0) + 1;
    if (row.subcategory_slug) bySubcategory[row.subcategory_slug] = (bySubcategory[row.subcategory_slug] || 0) + 1;
  }
  return { byDivision, byCategory, bySubcategory };
}
