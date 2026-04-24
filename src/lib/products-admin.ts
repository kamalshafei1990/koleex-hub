/* ---------------------------------------------------------------------------
   Product Admin — All Supabase CRUD operations for the product catalog.
   Uses the untyped admin client for flexible insert/update.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import {
  uploadToStorage,
  removeFromStorage,
  listStorage,
  publicUrl,
} from "./storage-client";
import type {
  DivisionRow, CategoryRow, SubcategoryRow,
  ProductRow, ProductModelRow, ProductMediaRow,
  ProductTranslationRow, ModelTranslationRow,
  ProductMarketPriceRow, RelatedProductRow,
  SewingMachineSpecsRow,
} from "@/types/supabase";

const BUCKET = "media";

// ── Divisions CRUD ──

export async function fetchDivisions(): Promise<DivisionRow[]> {
  const { data } = await supabase.from("divisions").select("*").order("order");
  return (data as DivisionRow[]) || [];
}

export async function createDivision(d: Record<string, unknown>): Promise<DivisionRow | null> {
  const { data, error } = await supabase.from("divisions").insert(d).select().single();
  if (error) { console.error("[Divisions] Create:", error.message); return null; }
  return data as DivisionRow;
}

export async function updateDivision(id: string, d: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("divisions").update(d).eq("id", id);
  if (error) { console.error("[Divisions] Update:", error.message); return false; }
  return true;
}

export async function deleteDivision(id: string): Promise<boolean> {
  const { error } = await supabase.from("divisions").delete().eq("id", id);
  if (error) { console.error("[Divisions] Delete:", error.message); return false; }
  return true;
}

// ── Categories CRUD ──

export async function fetchCategories(): Promise<CategoryRow[]> {
  const { data } = await supabase.from("categories").select("*").order("order");
  return (data as CategoryRow[]) || [];
}

export async function createCategory(c: Record<string, unknown>): Promise<CategoryRow | null> {
  const { data, error } = await supabase.from("categories").insert(c).select().single();
  if (error) { console.error("[Categories] Create:", error.message); return null; }
  return data as CategoryRow;
}

export async function updateCategory(id: string, c: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("categories").update(c).eq("id", id);
  if (error) { console.error("[Categories] Update:", error.message); return false; }
  return true;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) { console.error("[Categories] Delete:", error.message); return false; }
  return true;
}

// ── Subcategories CRUD ──

export async function fetchSubcategories(): Promise<SubcategoryRow[]> {
  const { data } = await supabase.from("subcategories").select("*").order("order");
  return (data as SubcategoryRow[]) || [];
}

export async function createSubcategory(s: Record<string, unknown>): Promise<SubcategoryRow | null> {
  const { data, error } = await supabase.from("subcategories").insert(s).select().single();
  if (error) { console.error("[Subcategories] Create:", error.message); return null; }
  return data as SubcategoryRow;
}

export async function updateSubcategory(id: string, s: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("subcategories").update(s).eq("id", id);
  if (error) { console.error("[Subcategories] Update:", error.message); return false; }
  return true;
}

export async function deleteSubcategory(id: string): Promise<boolean> {
  const { error } = await supabase.from("subcategories").delete().eq("id", id);
  if (error) { console.error("[Subcategories] Delete:", error.message); return false; }
  return true;
}

// ── Category/Subcategory counts ──

export async function fetchCategoryCounts(): Promise<Record<string, number>> {
  const { data } = await supabase.from("categories").select("division_id");
  const counts: Record<string, number> = {};
  for (const row of (data || []) as { division_id: string }[]) {
    counts[row.division_id] = (counts[row.division_id] || 0) + 1;
  }
  return counts;
}

export async function fetchSubcategoryCounts(): Promise<Record<string, number>> {
  const { data } = await supabase.from("subcategories").select("category_id");
  const counts: Record<string, number> = {};
  for (const row of (data || []) as { category_id: string }[]) {
    counts[row.category_id] = (counts[row.category_id] || 0) + 1;
  }
  return counts;
}

// ── Products ──

/* All four product reads/writes now go through /api/products* so
   secret fields (cost_price, supplier, hs_code, moq, etc.) are
   stripped server-side when the caller doesn't have Product Data
   access. The UI on /products used to just HIDE those fields
   cosmetically; now they never reach the browser for customer
   sessions. Mutations are SA/Product-Data-only at the API layer. */

export async function fetchProducts(): Promise<ProductRow[]> {
  try {
    const res = await fetch("/api/products", { credentials: "include" });
    if (!res.ok) return [];
    const json = (await res.json()) as { products: ProductRow[] };
    return json.products ?? [];
  } catch (e) {
    console.error("[Products] fetchProducts:", e);
    return [];
  }
}

export async function fetchProductById(id: string): Promise<ProductRow | null> {
  if (!id) return null;
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as { product: ProductRow };
    return json.product ?? null;
  } catch (e) {
    console.error("[Products] fetchProductById:", e);
    return null;
  }
}

/**
 * Fetch a product by slug first, falling back to UUID lookup.
 * Lets routes accept either "/products/my-machine" or "/products/<uuid>".
 * The API handles the slug/UUID disambiguation server-side.
 */
export async function fetchProductByIdOrSlug(handle: string): Promise<ProductRow | null> {
  return fetchProductById(handle);
}

export async function createProduct(product: Record<string, unknown>): Promise<ProductRow | null> {
  try {
    const res = await fetch("/api/products", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      console.error("[Products] Create error:", json.error || res.status);
      return null;
    }
    const json = (await res.json()) as { product: ProductRow };
    return json.product ?? null;
  } catch (e) {
    console.error("[Products] Create error:", e);
    return null;
  }
}

export async function updateProduct(id: string, updates: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch (e) {
    console.error("[Products] Update error:", e);
    return false;
  }
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch (e) {
    console.error("[Products] Delete error:", e);
    return false;
  }
}

// ── Models ──

export async function fetchModelsByProductId(productId: string): Promise<ProductModelRow[]> {
  /* Goes through /api/product-models which strips cost_price and
     supplier server-side for non-Product-Data callers. */
  if (!productId) return [];
  try {
    const res = await fetch(
      `/api/product-models?product_id=${encodeURIComponent(productId)}`,
      { credentials: "include" },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { models: ProductModelRow[] };
    return json.models ?? [];
  } catch (e) {
    console.error("[Models] fetchByProductId:", e);
    return [];
  }
}

export async function createModel(model: Record<string, unknown>): Promise<ProductModelRow | null> {
  const { data, error } = await supabase.from("product_models").insert(model).select().single();
  if (error) { console.error("[Models] Create error:", error.message); return null; }
  return data as ProductModelRow;
}

export async function updateModel(id: string, updates: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("product_models").update(updates).eq("id", id);
  if (error) { console.error("[Models] Update error:", error.message); return false; }
  return true;
}

export async function deleteModel(id: string): Promise<boolean> {
  const { error } = await supabase.from("product_models").delete().eq("id", id);
  if (error) { console.error("[Models] Delete error:", error.message); return false; }
  return true;
}

// ── Media ──

export async function fetchMediaByProductId(productId: string): Promise<ProductMediaRow[]> {
  const { data } = await supabase.from("product_media").select("*").eq("product_id", productId).order("order");
  return (data as ProductMediaRow[]) || [];
}

export async function uploadProductFile(file: File): Promise<{ url: string; file_path: string } | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `products/${Date.now()}_${safeName}`;
  const result = await uploadToStorage(BUCKET, filePath, file, { cacheControl: "3600" });
  if (!result.ok) {
    console.error("[Media] Upload error:", result.error);
    return null;
  }
  return { url: result.data.publicUrl, file_path: result.data.path };
}

export async function createProductMedia(media: Record<string, unknown>): Promise<ProductMediaRow | null> {
  const { data, error } = await supabase.from("product_media").insert(media).select().single();
  if (error) { console.error("[Media] Create error:", error.message); return null; }
  return data as ProductMediaRow;
}

export async function deleteProductMedia(id: string): Promise<boolean> {
  const { error } = await supabase.from("product_media").delete().eq("id", id);
  if (error) { console.error("[Media] Delete error:", error.message); return false; }
  return true;
}

// ── Translations ──

export async function fetchTranslationsByProductId(productId: string): Promise<ProductTranslationRow[]> {
  const { data } = await supabase.from("product_translations").select("*").eq("product_id", productId);
  return (data as ProductTranslationRow[]) || [];
}

export async function upsertTranslation(t: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("product_translations").upsert(t, { onConflict: "product_id,locale" });
  if (error) { console.error("[Translations] Upsert error:", error.message); return false; }
  return true;
}

export async function deleteTranslation(id: string): Promise<boolean> {
  const { error } = await supabase.from("product_translations").delete().eq("id", id);
  if (error) return false;
  return true;
}

// ── Model Translations ──

export async function fetchModelTranslations(modelIds: string[]): Promise<ModelTranslationRow[]> {
  if (!modelIds.length) return [];
  const { data } = await supabase.from("model_translations").select("*").in("model_id", modelIds);
  return (data as ModelTranslationRow[]) || [];
}

export async function upsertModelTranslation(t: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("model_translations").upsert(t, { onConflict: "model_id,locale" });
  if (error) { console.error("[ModelTranslations] Upsert error:", error.message); return false; }
  return true;
}

export async function deleteModelTranslation(id: string): Promise<boolean> {
  const { error } = await supabase.from("model_translations").delete().eq("id", id);
  if (error) return false;
  return true;
}

// ── Market Prices ──

export async function fetchMarketPricesByModelIds(modelIds: string[]): Promise<ProductMarketPriceRow[]> {
  if (!modelIds.length) return [];
  const { data } = await supabase.from("product_market_prices").select("*").in("model_id", modelIds);
  return (data as ProductMarketPriceRow[]) || [];
}

export async function upsertMarketPrice(p: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("product_market_prices").upsert(p, { onConflict: "model_id,country_code" });
  if (error) { console.error("[MarketPrices] Upsert error:", error.message); return false; }
  return true;
}

export async function deleteMarketPrice(id: string): Promise<boolean> {
  const { error } = await supabase.from("product_market_prices").delete().eq("id", id);
  if (error) return false;
  return true;
}

// ── Related Products ──

export async function fetchRelatedProducts(productId: string): Promise<(RelatedProductRow & { product_name?: string })[]> {
  const { data } = await supabase
    .from("related_products")
    .select("*, products!related_products_related_id_fkey(product_name)")
    .eq("product_id", productId)
    .order("order");
  return (data || []).map((r: Record<string, unknown>) => ({
    product_id: r.product_id as string,
    related_id: r.related_id as string,
    order: r.order as number,
    product_name: (r.products as Record<string, unknown>)?.product_name as string | undefined,
  }));
}

export async function setRelatedProducts(productId: string, relatedIds: string[]): Promise<boolean> {
  await supabase.from("related_products").delete().eq("product_id", productId);
  if (!relatedIds.length) return true;
  const rows = relatedIds.map((rid, i) => ({ product_id: productId, related_id: rid, order: i }));
  const { error } = await supabase.from("related_products").insert(rows);
  if (error) { console.error("[Related] Insert error:", error.message); return false; }
  return true;
}

// ── Search ──

export async function searchProducts(query: string, excludeId?: string): Promise<Pick<ProductRow, "id" | "product_name" | "slug">[]> {
  let q = supabase.from("products").select("id,product_name,slug").ilike("product_name", `%${query}%`).limit(10);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data || []) as Pick<ProductRow, "id" | "product_name" | "slug">[];
}

// ── Model counts + supplier mapping ──

export async function fetchModelSummaries(): Promise<{
  counts: Record<string, number>;
  suppliers: Record<string, string[]>;
  allSuppliers: string[];
}> {
  /* Supplier data is stripped server-side when the caller lacks
     Product Data access — customers get populated counts but
     empty suppliers + allSuppliers. */
  try {
    const res = await fetch("/api/product-models?summary=1", { credentials: "include" });
    if (!res.ok) return { counts: {}, suppliers: {}, allSuppliers: [] };
    return (await res.json()) as {
      counts: Record<string, number>;
      suppliers: Record<string, string[]>;
      allSuppliers: string[];
    };
  } catch (e) {
    console.error("[Models] fetchSummaries:", e);
    return { counts: {}, suppliers: {}, allSuppliers: [] };
  }
}

// ── Fetch main images for all products ──

export async function fetchProductMainImages(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("product_media")
    .select("product_id, url")
    .eq("type", "main_image")
    .order("order", { ascending: true });
  const map: Record<string, string> = {};
  for (const row of (data || []) as { product_id: string; url: string }[]) {
    if (!map[row.product_id]) map[row.product_id] = row.url;
  }
  return map;
}

// ── Supplier names + logos (from contacts table) ──

export async function fetchSupplierNames(): Promise<{ id: string; name: string; logo: string | null }[]> {
  const { data } = await supabase
    .from("contacts")
    .select("id, company_name_en, photo_url")
    .eq("contact_type", "supplier")
    .order("company_name_en", { ascending: true });
  return (data || [])
    .filter((r: Record<string, unknown>) => r.company_name_en)
    .map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.company_name_en as string,
      logo: (r.photo_url as string) || null,
    }));
}

// ── Unique brand names (from products table) ──

export async function fetchUniqueBrands(): Promise<string[]> {
  const { data } = await supabase.from("products").select("brand");
  const brands = new Set<string>();
  for (const row of (data || []) as { brand: string | null }[]) {
    if (row.brand) brands.add(row.brand);
  }
  return Array.from(brands).sort();
}

// ── Unique tags (from products table) ──

export async function fetchUniqueTags(): Promise<string[]> {
  const { data } = await supabase.from("products").select("tags");
  const tags = new Set<string>();
  for (const row of (data || []) as { tags: string[] | null }[]) {
    for (const t of row.tags || []) tags.add(t);
  }
  return Array.from(tags).sort();
}

// ── Taxonomy logos (stored in media/divisions/ and media/categories/ folders) ──

async function fetchTaxonomyLogos(folder: string): Promise<Record<string, string>> {
  const result = await listStorage(BUCKET, folder, { limit: 500 });
  const map: Record<string, string> = {};
  if (!result.ok) return map;
  for (const file of result.files) {
    if (file.name === ".emptyFolderPlaceholder") continue;
    const slug = file.name.replace(/\.[^.]+$/, "");
    map[slug] = `${result.baseUrl}/${folder}/${file.name}?t=${Date.now()}`;
  }
  return map;
}

async function uploadTaxonomyLogo(folder: string, slug: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const filePath = `${folder}/${slug}.${ext}`;
  const result = await uploadToStorage(BUCKET, filePath, file, { cacheControl: "3600", upsert: true });
  if (!result.ok) { console.error(`[${folder}Logo] Upload:`, result.error); return null; }
  return result.data.publicUrl;
}

async function deleteTaxonomyLogo(folder: string, slug: string): Promise<boolean> {
  const result = await listStorage(BUCKET, folder, { limit: 500 });
  if (!result.ok) return false;
  const match = result.files.find(f => f.name.replace(/\.[^.]+$/, "") === slug);
  if (!match) return true;
  const rm = await removeFromStorage(BUCKET, [`${folder}/${match.name}`]);
  if (!rm.ok) { console.error(`[${folder}Logo] Delete:`, rm.error); return false; }
  return true;
}

export const fetchDivisionLogos = () => fetchTaxonomyLogos("divisions");
export const fetchCategoryLogos = () => fetchTaxonomyLogos("categories");
export const fetchSubcategoryLogos = () => fetchTaxonomyLogos("subcategories");
export const uploadDivisionLogo = (slug: string, file: File) => uploadTaxonomyLogo("divisions", slug, file);
export const uploadCategoryLogo = (slug: string, file: File) => uploadTaxonomyLogo("categories", slug, file);
export const uploadSubcategoryLogo = (slug: string, file: File) => uploadTaxonomyLogo("subcategories", slug, file);
export const deleteDivisionLogo = (slug: string) => deleteTaxonomyLogo("divisions", slug);
export const deleteCategoryLogo = (slug: string) => deleteTaxonomyLogo("categories", slug);
export const deleteSubcategoryLogo = (slug: string) => deleteTaxonomyLogo("subcategories", slug);

// ── Brand logos (stored in media/brands/ folder) ──

export async function fetchBrandLogos(): Promise<Record<string, string>> {
  const result = await listStorage(BUCKET, "brands", { limit: 200 });
  const map: Record<string, string> = {};
  if (!result.ok) return map;
  for (const file of result.files) {
    if (file.name === ".emptyFolderPlaceholder") continue;
    const slug = file.name.replace(/\.[^.]+$/, "");
    map[slug] = `${result.baseUrl}/brands/${file.name}`;
  }
  return map;
}

export async function uploadBrandLogo(brandSlug: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const filePath = `brands/${brandSlug}.${ext}`;
  const result = await uploadToStorage(BUCKET, filePath, file, { cacheControl: "3600", upsert: true });
  if (!result.ok) { console.error("[BrandLogo] Upload:", result.error); return null; }
  return result.data.publicUrl;
}

// ── Brand Management ──
// Brands live in a dedicated `brands` table (created 2026-04-24).
// products.brand is still a text column — the `brands` row is the
// canonical record an admin created, with name / slug / logo_url.
// Creating a brand via the admin modal now POSTs to /api/brands so
// the record persists immediately, independent of product save.

/** Fetch all brands with product counts + logo URLs. Goes through
 *  /api/brands which merges the brands table with a product-count
 *  rollup and returns a storage-public logo_url per brand.
 *  Falls back to the legacy "distinct from products" method if the
 *  API is unavailable, so an older build doesn't break the form. */
export async function fetchBrandsWithDetails(): Promise<{
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
}[]> {
  try {
    const res = await fetch("/api/brands", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as {
        brands: { name: string; slug: string; logo_url: string | null; productCount: number }[];
      };
      return (json.brands ?? []).map((b) => ({
        name: b.name,
        slug: b.slug,
        logoUrl: b.logo_url,
        productCount: b.productCount,
      }));
    }
  } catch (e) {
    console.warn("[Brands] /api/brands unavailable, falling back to product-derived list:", e);
  }

  // Legacy fallback — derive the list from DISTINCT products.brand.
  const { data: products } = await supabase.from("products").select("brand");
  const logos = await fetchBrandLogos();
  const counts: Record<string, number> = {};
  for (const row of (products || []) as { brand: string | null }[]) {
    if (row.brand) counts[row.brand] = (counts[row.brand] || 0) + 1;
  }
  const brands = Object.keys(counts).sort();
  return brands.map(name => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { name, slug, logoUrl: logos[slug] || null, productCount: counts[name] || 0 };
  });
}

/** Create a brand record in the brands table. Called by the
 *  CreateBrandModal so the brand persists the moment the modal
 *  commits — even if the admin navigates away without saving the
 *  product. Returns the canonical brand row. */
export async function createBrand(
  name: string,
  logoUrl: string | null,
): Promise<{ name: string; slug: string; logo_url: string | null } | null> {
  try {
    const res = await fetch("/api/brands", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, logoUrl }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      console.error("[Brands] Create error:", json.error || res.status);
      return null;
    }
    const json = (await res.json()) as { brand: { name: string; slug: string; logo_url: string | null } };
    return json.brand ?? null;
  } catch (e) {
    console.error("[Brands] Create network error:", e);
    return null;
  }
}

/** Rename a brand across all products */
export async function renameBrand(oldName: string, newName: string): Promise<boolean> {
  // Get all products with the old brand name
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("brand", oldName);

  if (!products?.length) return true;

  // Update each product
  const { error } = await supabase
    .from("products")
    .update({ brand: newName })
    .eq("brand", oldName);

  if (error) {
    console.error("[Brand] Rename error:", error.message);
    return false;
  }

  // Also rename the logo file in storage if it exists
  const oldSlug = oldName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (oldSlug !== newSlug) {
    // List files in brands/ to find the old logo
    const list = await listStorage(BUCKET, "brands", { limit: 200 });
    const oldFile = list.ok
      ? list.files.find(f => f.name.replace(/\.[^.]+$/, "") === oldSlug)
      : null;
    if (oldFile) {
      const ext = oldFile.name.split(".").pop() || "png";
      // Fetch old file via public URL, re-upload with new name, delete old
      const oldUrl = publicUrl(BUCKET, `brands/${oldFile.name}`);
      try {
        const resp = await fetch(oldUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          await uploadToStorage(BUCKET, `brands/${newSlug}.${ext}`, blob, {
            cacheControl: "3600",
            upsert: true,
          });
          await removeFromStorage(BUCKET, [`brands/${oldFile.name}`]);
        }
      } catch (e) {
        console.error("[Brand] Rename logo copy failed:", e);
      }
    }
  }

  return true;
}

/** Delete a brand — clear it from all products and remove logo */
export async function deleteBrand(brandName: string): Promise<boolean> {
  // Clear brand from all products
  const { error } = await supabase
    .from("products")
    .update({ brand: null })
    .eq("brand", brandName);

  if (error) {
    console.error("[Brand] Delete error:", error.message);
    return false;
  }

  // Remove logo from storage
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const list = await listStorage(BUCKET, "brands", { limit: 200 });
  const logoFile = list.ok
    ? list.files.find(f => f.name.replace(/\.[^.]+$/, "") === slug)
    : null;
  if (logoFile) {
    await removeFromStorage(BUCKET, [`brands/${logoFile.name}`]);
  }

  return true;
}

/** Delete only the logo for a brand */
export async function deleteBrandLogo(brandSlug: string): Promise<boolean> {
  const list = await listStorage(BUCKET, "brands", { limit: 200 });
  const logoFile = list.ok
    ? list.files.find(f => f.name.replace(/\.[^.]+$/, "") === brandSlug)
    : null;
  if (logoFile) {
    const rm = await removeFromStorage(BUCKET, [`brands/${logoFile.name}`]);
    if (!rm.ok) { console.error("[BrandLogo] Delete:", rm.error); return false; }
  }
  return true;
}

// ── Sewing Machine Specs ──

export async function fetchSewingSpecsByProductId(productId: string): Promise<SewingMachineSpecsRow | null> {
  const { data } = await supabase
    .from("product_sewing_specs")
    .select("*")
    .eq("product_id", productId)
    .single();
  return data as SewingMachineSpecsRow | null;
}

export async function upsertSewingSpecs(specs: {
  product_id: string;
  template_slug: string;
  common_specs: Record<string, unknown>;
  template_specs: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await supabase
    .from("product_sewing_specs")
    .upsert(specs, { onConflict: "product_id" });
  if (error) {
    console.error("[SewingSpecs] Upsert error:", error.message);
    return false;
  }
  return true;
}

export async function deleteSewingSpecs(productId: string): Promise<boolean> {
  const { error } = await supabase
    .from("product_sewing_specs")
    .delete()
    .eq("product_id", productId);
  if (error) {
    console.error("[SewingSpecs] Delete error:", error.message);
    return false;
  }
  return true;
}
