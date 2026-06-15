/* ---------------------------------------------------------------------------
   Product Attributes — Master lists for product attribute values.
   Stored as JSON in Supabase Storage (config/product-attributes.json).
   Images stored in media/attributes/{type}/{slug}.{ext}
   --------------------------------------------------------------------------- */

import {
  uploadToStorage,
  removeFromStorage,
  listStorage,
  publicUrl,
} from "./storage-client";

/* P0-B: product-table reads/writes go through /api/products/attributes
   (auth + Product-Data gated server-side). Config JSON + attribute images
   still use the storage proxy (./storage-client → /api/storage). */
async function jget<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch { return fallback; }
}

const BUCKET = "media";
const CONFIG_PATH = "config/product-attributes.json";

export interface AttributeItem {
  name: string;
  image?: string | null;
  countries?: string[];   // ISO country codes for flag display
  description?: string;
}

/* Representation mode for a value in the Visual Library:
   how it should be shown to the customer. */
export type VisualMode = "icon" | "photo" | "text" | "icon_text";

export interface AttributeConfig {
  tags: string[];
  tag_colors: Record<string, string>;
  plug_types: AttributeItem[];
  colors: string[];
  voltage: string[];
  watt: string[];
  levels: string[];
  /* Visual Library overlay — keyed by `${attrType}:${value}`.
     value_images: the icon/photo URL chosen for that value.
     value_modes:  how to render it (icon / photo / text / icon+text).
     Both are additive and optional — older configs simply omit them. */
  value_images?: Record<string, string>;
  value_modes?: Record<string, VisualMode>;
}

// ── Plug type SVG icons — socket face only, clean outline style ──
const PLUG_V = "v2"; // cache-bust version
export const DEFAULT_PLUG_TYPES: AttributeItem[] = [
  { name: "Type A", countries: ["US", "CA", "MX", "JP"], description: "Two flat parallel pins",
    image: `/images/plug-types/A.svg?${PLUG_V}` },
  { name: "Type B", countries: ["US", "CA", "MX", "BR"], description: "Two flat parallel + round ground",
    image: `/images/plug-types/B.svg?${PLUG_V}` },
  { name: "Type C", countries: ["EU", "KR", "EG", "SA", "AE"], description: "Two round pins — Europlug",
    image: `/images/plug-types/C.svg?${PLUG_V}` },
  { name: "Type D", countries: ["IN", "LK", "NP"], description: "Three large round pins triangle",
    image: `/images/plug-types/D.svg?${PLUG_V}` },
  { name: "Type F", countries: ["DE", "FR", "ES", "NL", "SE", "TR", "KR", "RU"], description: "Schuko — two round pins + grounding clips",
    image: `/images/plug-types/F.svg?${PLUG_V}` },
  { name: "Type G", countries: ["GB", "IE", "MY", "SG", "HK", "AE", "KW", "QA"], description: "Three rectangular pins — BS 1363",
    image: `/images/plug-types/G.svg?${PLUG_V}` },
  { name: "Type H", countries: ["IL"], description: "Three pins — V-shaped (Israel SI 32)",
    image: `/images/plug-types/H.svg?${PLUG_V}` },
  { name: "Type I", countries: ["AU", "CN", "NZ", "AR"], description: "Two angled flat + vertical ground",
    image: `/images/plug-types/I.svg?${PLUG_V}` },
  { name: "Type J", countries: ["CH", "LI"], description: "Three round pins — Swiss SEV 1011",
    image: `/images/plug-types/J.svg?${PLUG_V}` },
  { name: "Type K", countries: ["DK", "GL"], description: "Three round pins — Danish DS 60884-2-D1",
    image: `/images/plug-types/K.svg?${PLUG_V}` },
  { name: "Type L", countries: ["IT", "CL", "UY"], description: "Three round pins in a row — CEI 23-50",
    image: `/images/plug-types/L.svg?${PLUG_V}` },
];

const DEFAULT_CONFIG: AttributeConfig = {
  tags: [],
  tag_colors: {},
  plug_types: DEFAULT_PLUG_TYPES,
  colors: [],
  voltage: [],
  watt: [],
  levels: ["Entry", "Mid", "Premium", "Enterprise"],
  value_images: {},
  value_modes: {},
};

// ── Config CRUD ──

export async function fetchAttributeConfig(): Promise<AttributeConfig> {
  try {
    // Public bucket — fetch via public URL instead of anon-key .download()
    const resp = await fetch(publicUrl(BUCKET, CONFIG_PATH), { cache: "no-store" });
    if (!resp.ok) return { ...DEFAULT_CONFIG };
    const raw = (await resp.json()) as Record<string, unknown>;

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
      value_images: (raw.value_images as Record<string, string>) || {},
      value_modes: (raw.value_modes as Record<string, VisualMode>) || {},
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
  const result = await uploadToStorage(BUCKET, CONFIG_PATH, blob, {
    cacheControl: "0",
    upsert: true,
    contentType: "application/json",
  });
  if (!result.ok) { console.error("[Config] Save:", result.error); return false; }
  return true;
}

// ── Image upload for attributes ──

export async function uploadAttributeImage(
  attrType: string, slug: string, file: File,
): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const filePath = `attributes/${attrType}/${slug}.${ext}`;
  const result = await uploadToStorage(BUCKET, filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (!result.ok) { console.error("[AttrImage] Upload:", result.error); return null; }
  return result.data.publicUrl;
}

export async function deleteAttributeImage(attrType: string, slug: string): Promise<boolean> {
  const list = await listStorage(BUCKET, `attributes/${attrType}`, { limit: 200 });
  if (!list.ok) return true;
  const match = list.files.find(f => f.name.replace(/\.[^.]+$/, "") === slug);
  if (match) {
    await removeFromStorage(BUCKET, [`attributes/${attrType}/${match.name}`]);
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
  const empty: AttributeUsage = {
    tags: {}, plug_types: {}, colors: {}, voltage: {}, watt: {}, levels: {}, brands: {},
  };
  const json = await jget<{ usage?: AttributeUsage }>("/api/products/attributes?usage=1", {});
  return json.usage ?? empty;
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
  try {
    const res = await fetch("/api/products/attributes", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "rename", attrType, oldValue, newValue }),
    });
    return res.ok;
  } catch { return false; }
}

// ── Delete value from all products ──

export async function deleteAttributeFromProducts(
  attrType: string,
  value: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/products/attributes", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "delete", attrType, oldValue: value }),
    });
    return res.ok;
  } catch { return false; }
}

// ── Product counts by classification slug ──

export async function fetchProductCountsByClassification(): Promise<{
  byDivision: Record<string, number>;
  byCategory: Record<string, number>;
  bySubcategory: Record<string, number>;
}> {
  return jget("/api/products/attributes?classification=1", {
    byDivision: {}, byCategory: {}, bySubcategory: {},
  });
}
