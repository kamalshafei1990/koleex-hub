/* ---------------------------------------------------------------------------
   Product Admin — All Supabase CRUD operations for the product catalog.
   Uses the untyped admin client for flexible insert/update.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
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

export async function fetchProducts(): Promise<ProductRow[]> {
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  return (data as ProductRow[]) || [];
}

export async function fetchProductById(id: string): Promise<ProductRow | null> {
  const { data } = await supabase.from("products").select("*").eq("id", id).single();
  return data as ProductRow | null;
}

export async function createProduct(product: Record<string, unknown>): Promise<ProductRow | null> {
  const { data, error } = await supabase.from("products").insert(product).select().single();
  if (error) { console.error("[Products] Create error:", error.message); return null; }
  return data as ProductRow;
}

export async function updateProduct(id: string, updates: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("products").update(updates).eq("id", id);
  if (error) { console.error("[Products] Update error:", error.message); return false; }
  return true;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) { console.error("[Products] Delete error:", error.message); return false; }
  return true;
}

// ── Models ──

export async function fetchModelsByProductId(productId: string): Promise<ProductModelRow[]> {
  const { data } = await supabase.from("product_models").select("*").eq("product_id", productId).order("order");
  return (data as ProductModelRow[]) || [];
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
  const ext = file.name.split(".").pop() || "jpg";
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `products/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, { cacheControl: "3600", upsert: false });
  if (error) { console.error("[Media] Upload error:", error.message); return null; }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return { url: data.publicUrl, file_path: filePath };
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
  const { data } = await supabase.from("product_models").select("product_id,supplier");
  const counts: Record<string, number> = {};
  const suppliers: Record<string, string[]> = {};
  const supplierSet = new Set<string>();
  for (const row of (data || []) as { product_id: string; supplier: string | null }[]) {
    counts[row.product_id] = (counts[row.product_id] || 0) + 1;
    if (row.supplier) {
      if (!suppliers[row.product_id]) suppliers[row.product_id] = [];
      if (!suppliers[row.product_id].includes(row.supplier)) suppliers[row.product_id].push(row.supplier);
      supplierSet.add(row.supplier);
    }
  }
  return { counts, suppliers, allSuppliers: Array.from(supplierSet).sort() };
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
  const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 500 });
  const map: Record<string, string> = {};
  const baseUrl = supabase.storage.from(BUCKET).getPublicUrl("").data.publicUrl.replace(/\/$/, "");
  for (const file of data || []) {
    if (file.name === ".emptyFolderPlaceholder") continue;
    const slug = file.name.replace(/\.[^.]+$/, "");
    map[slug] = `${baseUrl}/${folder}/${file.name}?t=${Date.now()}`;
  }
  return map;
}

async function uploadTaxonomyLogo(folder: string, slug: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const filePath = `${folder}/${slug}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, { cacheControl: "3600", upsert: true });
  if (error) { console.error(`[${folder}Logo] Upload:`, error.message); return null; }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function deleteTaxonomyLogo(folder: string, slug: string): Promise<boolean> {
  // List folder to find exact filename (could be .svg, .png, .jpg)
  const { data: files } = await supabase.storage.from(BUCKET).list(folder, { limit: 500 });
  const match = (files || []).find(f => f.name.replace(/\.[^.]+$/, "") === slug);
  if (!match) return true; // nothing to delete
  const { error } = await supabase.storage.from(BUCKET).remove([`${folder}/${match.name}`]);
  if (error) { console.error(`[${folder}Logo] Delete:`, error.message); return false; }
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
  // List files once, compute all URLs (no per-file network calls)
  const { data } = await supabase.storage.from(BUCKET).list("brands", { limit: 200 });
  const map: Record<string, string> = {};
  const baseUrl = supabase.storage.from(BUCKET).getPublicUrl("").data.publicUrl.replace(/\/$/, "");
  for (const file of data || []) {
    if (file.name === ".emptyFolderPlaceholder") continue;
    const slug = file.name.replace(/\.[^.]+$/, "");
    map[slug] = `${baseUrl}/brands/${file.name}`;
  }
  return map;
}

export async function uploadBrandLogo(brandSlug: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const filePath = `brands/${brandSlug}.${ext}`;
  // Upsert — overwrite if exists
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, { cacheControl: "3600", upsert: true });
  if (error) { console.error("[BrandLogo] Upload:", error.message); return null; }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

// ── Brand Management (brands stored as strings on products, logos in storage) ──

/** Fetch all brands with product counts and logo URLs */
export async function fetchBrandsWithDetails(): Promise<{
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
}[]> {
  // Get all products with their brand
  const { data: products } = await supabase.from("products").select("brand");
  // Get all brand logos from storage
  const logos = await fetchBrandLogos();

  // Count products per brand
  const counts: Record<string, number> = {};
  for (const row of (products || []) as { brand: string | null }[]) {
    if (row.brand) {
      counts[row.brand] = (counts[row.brand] || 0) + 1;
    }
  }

  // Build brand list
  const brands = Object.keys(counts).sort();
  return brands.map(name => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      name,
      slug,
      logoUrl: logos[slug] || null,
      productCount: counts[name] || 0,
    };
  });
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
    const { data: files } = await supabase.storage.from(BUCKET).list("brands", { limit: 200 });
    const oldFile = (files || []).find(f => f.name.replace(/\.[^.]+$/, "") === oldSlug);
    if (oldFile) {
      const ext = oldFile.name.split(".").pop() || "png";
      // Download old file, re-upload with new name, delete old
      const { data: fileData } = await supabase.storage.from(BUCKET).download(`brands/${oldFile.name}`);
      if (fileData) {
        await supabase.storage.from(BUCKET).upload(`brands/${newSlug}.${ext}`, fileData, { cacheControl: "3600", upsert: true });
        await supabase.storage.from(BUCKET).remove([`brands/${oldFile.name}`]);
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
  const { data: files } = await supabase.storage.from(BUCKET).list("brands", { limit: 200 });
  const logoFile = (files || []).find(f => f.name.replace(/\.[^.]+$/, "") === slug);
  if (logoFile) {
    await supabase.storage.from(BUCKET).remove([`brands/${logoFile.name}`]);
  }

  return true;
}

/** Delete only the logo for a brand */
export async function deleteBrandLogo(brandSlug: string): Promise<boolean> {
  const { data: files } = await supabase.storage.from(BUCKET).list("brands", { limit: 200 });
  const logoFile = (files || []).find(f => f.name.replace(/\.[^.]+$/, "") === brandSlug);
  if (logoFile) {
    const { error } = await supabase.storage.from(BUCKET).remove([`brands/${logoFile.name}`]);
    if (error) { console.error("[BrandLogo] Delete:", error.message); return false; }
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
