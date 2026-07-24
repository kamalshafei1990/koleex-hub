/* ---------------------------------------------------------------------------
   Product Admin — client-side product catalog access.

   P0-B: ALL product-table reads/writes now go through the server /api/*
   routes (auth + Product-Data gating + secret stripping happen server-side).
   This file no longer touches Supabase tables directly — only the storage
   PROXY (`./storage-client` → /api/storage) for logo files, which carry no
   secrets. Exported function names + return shapes are unchanged so every
   existing consumer (ProductForm, ProductList, settings, modals) keeps working
   without edits.
   --------------------------------------------------------------------------- */

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

/* ── tiny fetch helpers (credentials always included) ────────────────── */
async function jget<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch (e) {
    console.error("[products-admin GET]", url, e);
    return fallback;
  }
}
async function jsend(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) console.error(`[products-admin ${method}]`, url, json.error || res.status);
    return { ok: res.ok, json };
  } catch (e) {
    console.error(`[products-admin ${method}]`, url, e);
    return { ok: false, json: {} };
  }
}

/* ─── Taxonomy in-flight + session cache (unchanged) ─────────────────── */
const TAXO_TTL_MS = 60_000;
type Cached<T> = { data: T; expiresAt: number };
const inflight = new Map<string, Promise<unknown>>();

function readSessionCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached<T>;
    if (parsed.expiresAt < Date.now()) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch { return null; }
}
function writeSessionCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Cached<T> = { data, expiresAt: Date.now() + TAXO_TTL_MS };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch { /* quota exceeded — fine */ }
}
function clearSessionKey(key: string): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(key); } catch { /* noop */ }
}

/** Call this from every taxonomy mutation so the next read pulls fresh data. */
export function invalidateTaxonomyCache(): void {
  clearSessionKey("kx:taxo:divisions");
  clearSessionKey("kx:taxo:categories");
  clearSessionKey("kx:taxo:subcategories");
  inflight.delete("divisions");
  inflight.delete("categories");
  inflight.delete("subcategories");
}

async function memoFetch<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = readSessionCache<T>(`kx:taxo:${key}`);
  if (cached !== null) return cached;
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = loader().then((data) => {
    writeSessionCache(`kx:taxo:${key}`, data);
    inflight.delete(key);
    return data;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });
  inflight.set(key, p);
  return p;
}

/* ── Taxonomy CRUD → /api/taxonomy/[kind] ─────────────────────────────── */
async function fetchTaxonomy<T>(kind: string): Promise<T[]> {
  const json = await jget<{ rows?: T[] }>(`/api/taxonomy/${kind}`, {});
  return json.rows ?? [];
}

export async function fetchDivisions(): Promise<DivisionRow[]> {
  return memoFetch("divisions", () => fetchTaxonomy<DivisionRow>("divisions"));
}
export async function createDivision(d: Record<string, unknown>): Promise<DivisionRow | null> {
  const { ok, json } = await jsend("/api/taxonomy/divisions", "POST", d);
  if (!ok) return null;
  invalidateTaxonomyCache();
  return (json.row as DivisionRow) ?? null;
}
export async function updateDivision(id: string, d: Record<string, unknown>): Promise<boolean> {
  const { ok } = await jsend(`/api/taxonomy/divisions/${id}`, "PATCH", d);
  if (ok) invalidateTaxonomyCache();
  return ok;
}
export async function deleteDivision(id: string): Promise<boolean> {
  const { ok } = await jsend(`/api/taxonomy/divisions/${id}`, "DELETE");
  if (ok) invalidateTaxonomyCache();
  return ok;
}

export async function fetchCategories(): Promise<CategoryRow[]> {
  return memoFetch("categories", () => fetchTaxonomy<CategoryRow>("categories"));
}
export async function createCategory(c: Record<string, unknown>): Promise<CategoryRow | null> {
  const { ok, json } = await jsend("/api/taxonomy/categories", "POST", c);
  if (!ok) return null;
  invalidateTaxonomyCache();
  return (json.row as CategoryRow) ?? null;
}
export async function updateCategory(id: string, c: Record<string, unknown>): Promise<boolean> {
  const { ok } = await jsend(`/api/taxonomy/categories/${id}`, "PATCH", c);
  if (ok) invalidateTaxonomyCache();
  return ok;
}
export async function deleteCategory(id: string): Promise<boolean> {
  const { ok } = await jsend(`/api/taxonomy/categories/${id}`, "DELETE");
  if (ok) invalidateTaxonomyCache();
  return ok;
}

export async function fetchSubcategories(): Promise<SubcategoryRow[]> {
  return memoFetch("subcategories", () => fetchTaxonomy<SubcategoryRow>("subcategories"));
}
export async function createSubcategory(s: Record<string, unknown>): Promise<SubcategoryRow | null> {
  const { ok, json } = await jsend("/api/taxonomy/subcategories", "POST", s);
  if (!ok) return null;
  invalidateTaxonomyCache();
  return (json.row as SubcategoryRow) ?? null;
}
export async function updateSubcategory(id: string, s: Record<string, unknown>): Promise<boolean> {
  const { ok } = await jsend(`/api/taxonomy/subcategories/${id}`, "PATCH", s);
  if (ok) invalidateTaxonomyCache();
  return ok;
}
export async function deleteSubcategory(id: string): Promise<boolean> {
  const { ok } = await jsend(`/api/taxonomy/subcategories/${id}`, "DELETE");
  if (ok) invalidateTaxonomyCache();
  return ok;
}

// ── Category/Subcategory counts (derived from taxonomy rows) ──
export async function fetchCategoryCounts(): Promise<Record<string, number>> {
  const cats = await fetchTaxonomy<{ division_id: string }>("categories");
  const counts: Record<string, number> = {};
  for (const row of cats) {
    if (row.division_id) counts[row.division_id] = (counts[row.division_id] || 0) + 1;
  }
  return counts;
}
export async function fetchSubcategoryCounts(): Promise<Record<string, number>> {
  const subs = await fetchTaxonomy<{ category_id: string }>("subcategories");
  const counts: Record<string, number> = {};
  for (const row of subs) {
    if (row.category_id) counts[row.category_id] = (counts[row.category_id] || 0) + 1;
  }
  return counts;
}

// ── Products (already API-backed) ──
export async function fetchProducts(): Promise<ProductRow[]> {
  const json = await jget<{ products?: ProductRow[] }>("/api/products", {});
  return json.products ?? [];
}
/** Slim 14-column list projection (?view=list) — for pickers and grids that
 *  only render identity fields. The full fetchProducts() above is a ~1.3 MB
 *  payload (705 models × 80 columns); this is ~250 KB. */
export async function fetchProductsSlim(): Promise<ProductRow[]> {
  const json = await jget<{ products?: ProductRow[] }>("/api/products?view=list", {});
  return json.products ?? [];
}
export async function fetchProductById(id: string): Promise<ProductRow | null> {
  if (!id) return null;
  const json = await jget<{ product?: ProductRow }>(`/api/products/${encodeURIComponent(id)}`, {});
  return json.product ?? null;
}
export async function fetchProductByIdOrSlug(handle: string): Promise<ProductRow | null> {
  return fetchProductById(handle);
}
export async function createProduct(product: Record<string, unknown>): Promise<ProductRow | null> {
  const { ok, json } = await jsend("/api/products", "POST", product);
  return ok ? ((json.product as ProductRow) ?? null) : null;
}
export async function updateProduct(id: string, updates: Record<string, unknown>): Promise<boolean> {
  const { ok } = await jsend(`/api/products/${encodeURIComponent(id)}`, "PATCH", updates);
  return ok;
}
export async function deleteProduct(id: string): Promise<boolean> {
  const { ok } = await jsend(`/api/products/${encodeURIComponent(id)}`, "DELETE");
  return ok;
}

// ── Models → /api/product-models ──
export async function fetchModelsByProductId(productId: string): Promise<ProductModelRow[]> {
  if (!productId) return [];
  const json = await jget<{ models?: ProductModelRow[] }>(
    `/api/product-models?product_id=${encodeURIComponent(productId)}`, {},
  );
  return json.models ?? [];
}
export async function createModel(model: Record<string, unknown>): Promise<ProductModelRow | null> {
  const { ok, json } = await jsend("/api/product-models", "POST", model);
  return ok ? ((json.model as ProductModelRow) ?? null) : null;
}
export async function updateModel(id: string, updates: Record<string, unknown>): Promise<boolean> {
  const { ok } = await jsend(`/api/product-models/${id}`, "PATCH", updates);
  return ok;
}
export async function deleteModel(id: string): Promise<boolean> {
  const { ok } = await jsend(`/api/product-models/${id}`, "DELETE");
  return ok;
}

// ── Media → /api/product-media ──
export async function fetchMediaByProductId(productId: string): Promise<ProductMediaRow[]> {
  if (!productId) return [];
  const json = await jget<{ media?: ProductMediaRow[] }>(
    `/api/product-media?product_id=${encodeURIComponent(productId)}`, {},
  );
  return json.media ?? [];
}
export async function uploadProductFile(file: File): Promise<{ url: string; file_path: string } | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `products/${Date.now()}_${safeName}`;
  const result = await uploadToStorage(BUCKET, filePath, file, { cacheControl: "3600" });
  if (!result.ok) { console.error("[Media] Upload error:", result.error); return null; }
  return { url: result.data.publicUrl, file_path: result.data.path };
}
export async function createProductMedia(media: Record<string, unknown>): Promise<ProductMediaRow | null> {
  const { ok, json } = await jsend("/api/product-media", "POST", media);
  return ok ? ((json.media as ProductMediaRow) ?? null) : null;
}
export async function deleteProductMedia(id: string): Promise<boolean> {
  const { ok } = await jsend(`/api/product-media/${id}`, "DELETE");
  return ok;
}

// ── Translations → /api/product-translations ──
export async function fetchTranslationsByProductId(productId: string): Promise<ProductTranslationRow[]> {
  if (!productId) return [];
  const json = await jget<{ translations?: ProductTranslationRow[] }>(
    `/api/product-translations?product_id=${encodeURIComponent(productId)}`, {},
  );
  return json.translations ?? [];
}
export async function upsertTranslation(t: Record<string, unknown>): Promise<boolean> {
  const { ok } = await jsend("/api/product-translations", "POST", t);
  return ok;
}
export async function deleteTranslation(id: string): Promise<boolean> {
  const { ok } = await jsend(`/api/product-translations/${id}`, "DELETE");
  return ok;
}

// ── Model Translations → /api/model-translations ──
export async function fetchModelTranslations(modelIds: string[]): Promise<ModelTranslationRow[]> {
  if (!modelIds.length) return [];
  const json = await jget<{ translations?: ModelTranslationRow[] }>(
    `/api/model-translations?model_ids=${encodeURIComponent(modelIds.join(","))}`, {},
  );
  return json.translations ?? [];
}
export async function upsertModelTranslation(t: Record<string, unknown>): Promise<boolean> {
  const { ok } = await jsend("/api/model-translations", "POST", t);
  return ok;
}
export async function deleteModelTranslation(id: string): Promise<boolean> {
  const { ok } = await jsend(`/api/model-translations/${id}`, "DELETE");
  return ok;
}

// ── Market Prices → /api/product-market-prices ──
export async function fetchMarketPricesByModelIds(modelIds: string[]): Promise<ProductMarketPriceRow[]> {
  if (!modelIds.length) return [];
  const json = await jget<{ prices?: ProductMarketPriceRow[] }>(
    `/api/product-market-prices?model_ids=${encodeURIComponent(modelIds.join(","))}`, {},
  );
  return json.prices ?? [];
}
export async function upsertMarketPrice(p: Record<string, unknown>): Promise<boolean> {
  const { ok } = await jsend("/api/product-market-prices", "POST", p);
  return ok;
}
export async function deleteMarketPrice(id: string): Promise<boolean> {
  const { ok } = await jsend(`/api/product-market-prices/${id}`, "DELETE");
  return ok;
}

// ── Related Products → /api/products/[id]/related ──
export async function fetchRelatedProducts(productId: string): Promise<(RelatedProductRow & { product_name?: string; relation_type?: string })[]> {
  if (!productId) return [];
  const json = await jget<{ related?: (RelatedProductRow & { product_name?: string; relation_type?: string })[] }>(
    `/api/products/${encodeURIComponent(productId)}/related`, {},
  );
  return json.related ?? [];
}
/* Phase 6 — typed relations. Each entry carries related_id + relation_type;
   the route falls back to 'related' for legacy callers. */
export async function setRelatedProducts(
  productId: string,
  relations: { related_id: string; relation_type: string }[],
): Promise<boolean> {
  const { ok } = await jsend(`/api/products/${encodeURIComponent(productId)}/related`, "PUT", { relations });
  return ok;
}

// ── Product↔Supplier links → /api/product-suppliers ──
export interface ProductSupplierLinkRow {
  id?: string;
  product_id?: string;
  supplier_id: string;
  is_primary?: boolean;
  show_in_catalog?: boolean;
  supplier_product_code?: string | null;
  moq?: number | null;
  lead_time_days?: number | null;
  unit_cost_cny?: number | null;
  currency?: string | null;
  /* What unit_cost_cny already includes (display + warning, no math yet). */
  cost_basis?: "factory_only" | "packing" | "delivered" | null;
  cost_includes_tax?: boolean | null;
  payment_terms?: string | null;
  notes?: string | null;
  /* product-as-supplied facts (pd_supplier_product_facts) */
  supplier_product_name?: string | null;
  supplier_product_photo?: string | null;
  supply_type?: string | null;
  sample_available?: boolean | null;
  sample_cost?: number | null;
  incoterms?: string | null;
  supplier_warranty_months?: number | null;
  /* Tier 1 sourcing intelligence (pd_supplier_quote_tiers) */
  price_tiers?: { min_qty: number | null; price: number | null }[] | null;
  price_quoted_on?: string | null;
  price_valid_until?: string | null;
  quotation_file_url?: string | null;
  quotation_file_name?: string | null;
  /* Tier 2 sourcing intelligence (pd_supplier_sourcing_tier2) */
  sourcing_status?: string | null;
  preferred_reason?: string | null;
  min_order_value?: number | null;
  tooling_owner?: string | null;
  tooling_cost?: number | null;
}
export async function fetchProductSuppliers(productId: string): Promise<ProductSupplierLinkRow[]> {
  if (!productId) return [];
  const json = await jget<{ suppliers?: ProductSupplierLinkRow[] }>(
    `/api/product-suppliers?product_id=${encodeURIComponent(productId)}`, {},
  );
  return json.suppliers ?? [];
}
export async function saveProductSuppliers(productId: string, suppliers: ProductSupplierLinkRow[]): Promise<boolean> {
  const { ok } = await jsend(`/api/product-suppliers`, "PUT", { product_id: productId, suppliers });
  return ok;
}

// ── Product certifications → /api/product-certifications (Phase 4) ──
export interface ProductCertificationRow {
  id?: string; product_id?: string;
  cert_type: string; certified_standard?: string | null; cert_number?: string | null;
  issuer?: string | null; issued_date?: string | null; expiry_date?: string | null;
  reminder_days?: number | null; country_scope?: string | null; model_ids?: string[];
  file_url?: string | null; verification_url?: string | null; status?: string | null; notes?: string | null;
}
export async function fetchProductCertifications(productId: string): Promise<ProductCertificationRow[]> {
  if (!productId) return [];
  const json = await jget<{ certifications?: ProductCertificationRow[] }>(
    `/api/product-certifications?product_id=${encodeURIComponent(productId)}`, {},
  );
  return json.certifications ?? [];
}
export async function saveProductCertifications(productId: string, certifications: ProductCertificationRow[]): Promise<boolean> {
  const { ok } = await jsend(`/api/product-certifications`, "PUT", { product_id: productId, certifications });
  return ok;
}

// ── Product documents → /api/product-documents (Phase 4) ──
export interface ProductDocumentRow {
  id?: string; product_id?: string;
  doc_type: string; title?: string | null; file_url: string; file_name?: string | null;
  file_size_kb?: number | null; language?: string | null; version?: string | null;
  model_ids?: string[]; sort_order?: number;
}
export async function fetchProductDocuments(productId: string): Promise<ProductDocumentRow[]> {
  if (!productId) return [];
  const json = await jget<{ documents?: ProductDocumentRow[] }>(
    `/api/product-documents?product_id=${encodeURIComponent(productId)}`, {},
  );
  return json.documents ?? [];
}
export async function saveProductDocuments(productId: string, documents: ProductDocumentRow[]): Promise<boolean> {
  const { ok } = await jsend(`/api/product-documents`, "PUT", { product_id: productId, documents });
  return ok;
}

// ── Search → /api/products/search ──
export async function searchProducts(query: string, excludeId?: string): Promise<Pick<ProductRow, "id" | "product_name" | "slug">[]> {
  const params = new URLSearchParams({ q: query });
  if (excludeId) params.set("exclude", excludeId);
  const json = await jget<{ results?: Pick<ProductRow, "id" | "product_name" | "slug">[] }>(
    `/api/products/search?${params.toString()}`, {},
  );
  return json.results ?? [];
}

// ── Model counts + supplier mapping (already API-backed) ──
export async function fetchModelSummaries(): Promise<{
  counts: Record<string, number>;
  suppliers: Record<string, string[]>;
  allSuppliers: string[];
  primaryModelNames: Record<string, string>;
}> {
  return jget("/api/product-models?summary=1", {
    counts: {}, suppliers: {}, allSuppliers: [], primaryModelNames: {},
  });
}

// ── Main images for all products → /api/product-media?main_images=1 ──
export async function fetchProductMainImages(): Promise<Record<string, string>> {
  const json = await jget<{ mainImages?: Record<string, string> }>(
    "/api/product-media?main_images=1", {},
  );
  return json.mainImages ?? {};
}

// ── Supplier names + logos (already API-backed) ──
export interface SupplierContactLite {
  name: string | null; role: string | null; email: string | null; mobile: string | null;
}
export interface SupplierLite {
  id: string; name: string; name_cn?: string | null; logo: string | null;
  /* Supplier-level defaults (source of truth for shared fields). */
  supply_type?: string | null; payment_terms?: string | null;
  currency?: string | null; moq?: string | null; lead_time?: string | null;
  /* Contact info (read-only quick-look). */
  email?: string | null; phone?: string | null; website?: string | null;
  wechat?: string | null; location?: string | null;
  primary_contact?: SupplierContactLite | null;
  /* Supplier profile (read-only quick-look). */
  rating?: number | null; sample_status?: string | null; employees?: string | null;
  year_established?: string | null; categories?: string[] | null; certifications?: string[] | null;
}
export async function fetchSupplierNames(): Promise<SupplierLite[]> {
  const json = await jget<{ suppliers?: SupplierLite[] }>("/api/suppliers", {});
  return json.suppliers ?? [];
}

// ── Unique brand names → /api/products/facets ──
export async function fetchUniqueBrands(): Promise<string[]> {
  const json = await jget<{ brands?: string[] }>("/api/products/facets", {});
  return json.brands ?? [];
}

// ── Taxonomy logos (storage proxy — no secrets, unchanged) ──
async function fetchTaxonomyLogos(folder: string): Promise<Record<string, string>> {
  return memoFetch(`logos:${folder}`, async () => {
    const result = await listStorage(BUCKET, folder, { limit: 500 });
    const map: Record<string, string> = {};
    if (!result.ok) return map;
    for (const file of result.files) {
      if (file.name === ".emptyFolderPlaceholder") continue;
      const slug = file.name.replace(/\.[^.]+$/, "");
      map[slug] = `${result.baseUrl}/${folder}/${file.name}`;
    }
    return map;
  });
}
function invalidateTaxonomyLogoCache(folder: string): void {
  clearSessionKey(`kx:taxo:logos:${folder}`);
  inflight.delete(`logos:${folder}`);
}
async function uploadTaxonomyLogo(folder: string, slug: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const filePath = `${folder}/${slug}.${ext}`;
  const result = await uploadToStorage(BUCKET, filePath, file, { cacheControl: "3600", upsert: true });
  if (!result.ok) { console.error(`[${folder}Logo] Upload:`, result.error); return null; }
  invalidateTaxonomyLogoCache(folder);
  return result.data.publicUrl;
}
async function deleteTaxonomyLogo(folder: string, slug: string): Promise<boolean> {
  const result = await listStorage(BUCKET, folder, { limit: 500 });
  if (!result.ok) return false;
  const match = result.files.find(f => f.name.replace(/\.[^.]+$/, "") === slug);
  if (!match) return true;
  const rm = await removeFromStorage(BUCKET, [`${folder}/${match.name}`]);
  if (!rm.ok) { console.error(`[${folder}Logo] Delete:`, rm.error); return false; }
  invalidateTaxonomyLogoCache(folder);
  return true;
}
export const fetchDivisionLogos = () => fetchTaxonomyLogos("divisions");
export const fetchCategoryLogos = () => fetchTaxonomyLogos("categories");
export const fetchSubcategoryLogos = () => fetchTaxonomyLogos("subcategories");

/* Classification icon HUB (Phase 1) — DB icon overrides per (level, slug),
   shaped { division|category|subcategory|kind : { slug: icon_url } }. A present
   entry wins over the built-in code/storage icon everywhere; absent = fallback. */
export async function fetchClassificationIcons(): Promise<Record<string, Record<string, string>>> {
  const json = await jget<{ icons?: Record<string, Record<string, string>> }>("/api/classification-icons", {});
  return json.icons ?? {};
}
export const uploadDivisionLogo = (slug: string, file: File) => uploadTaxonomyLogo("divisions", slug, file);
export const uploadCategoryLogo = (slug: string, file: File) => uploadTaxonomyLogo("categories", slug, file);
export const uploadSubcategoryLogo = (slug: string, file: File) => uploadTaxonomyLogo("subcategories", slug, file);
export const deleteDivisionLogo = (slug: string) => deleteTaxonomyLogo("divisions", slug);
export const deleteCategoryLogo = (slug: string) => deleteTaxonomyLogo("categories", slug);
export const deleteSubcategoryLogo = (slug: string) => deleteTaxonomyLogo("subcategories", slug);

// ── Brand logos (storage proxy — unchanged) ──
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
        name: b.name, slug: b.slug, logoUrl: b.logo_url, productCount: b.productCount,
      }));
    }
  } catch (e) {
    console.warn("[Brands] /api/brands unavailable, falling back to facets:", e);
  }
  // Fallback — derive from facets + product-count rollup (no direct DB).
  const facets = await jget<{ brands?: string[]; counts?: Record<string, number> }>("/api/products/brands", {});
  const logos = await fetchBrandLogos();
  const names = facets.brands ?? [];
  return names.map((name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { name, slug, logoUrl: logos[slug] || null, productCount: facets.counts?.[name] ?? 0 };
  });
}
export async function createBrand(
  name: string,
  logoUrl: string | null,
): Promise<{ name: string; slug: string; logo_url: string | null } | null> {
  const { ok, json } = await jsend("/api/brands", "POST", { name, logoUrl });
  return ok ? ((json.brand as { name: string; slug: string; logo_url: string | null }) ?? null) : null;
}

/** Rename a brand across all products (+ move its logo file). */
export async function renameBrand(oldName: string, newName: string): Promise<boolean> {
  const { ok } = await jsend("/api/products/brands", "PATCH", { from: oldName, to: newName });
  if (!ok) return false;

  // Move the logo file in storage (proxy) if the slug changed.
  const oldSlug = oldName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (oldSlug !== newSlug) {
    const list = await listStorage(BUCKET, "brands", { limit: 200 });
    const oldFile = list.ok ? list.files.find(f => f.name.replace(/\.[^.]+$/, "") === oldSlug) : null;
    if (oldFile) {
      const ext = oldFile.name.split(".").pop() || "png";
      const oldUrl = publicUrl(BUCKET, `brands/${oldFile.name}`);
      try {
        const resp = await fetch(oldUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          await uploadToStorage(BUCKET, `brands/${newSlug}.${ext}`, blob, { cacheControl: "3600", upsert: true });
          await removeFromStorage(BUCKET, [`brands/${oldFile.name}`]);
        }
      } catch (e) {
        console.error("[Brand] Rename logo copy failed:", e);
      }
    }
  }
  return true;
}

/** Delete a brand — clear it from all products + remove logo. */
export async function deleteBrand(brandName: string): Promise<boolean> {
  const { ok } = await jsend("/api/products/brands", "DELETE", { name: brandName });
  if (!ok) return false;
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const list = await listStorage(BUCKET, "brands", { limit: 200 });
  const logoFile = list.ok ? list.files.find(f => f.name.replace(/\.[^.]+$/, "") === slug) : null;
  if (logoFile) await removeFromStorage(BUCKET, [`brands/${logoFile.name}`]);
  return true;
}

/** Delete only the logo for a brand (storage proxy). */
export async function deleteBrandLogo(brandSlug: string): Promise<boolean> {
  const list = await listStorage(BUCKET, "brands", { limit: 200 });
  const logoFile = list.ok ? list.files.find(f => f.name.replace(/\.[^.]+$/, "") === brandSlug) : null;
  if (logoFile) {
    const rm = await removeFromStorage(BUCKET, [`brands/${logoFile.name}`]);
    if (!rm.ok) { console.error("[BrandLogo] Delete:", rm.error); return false; }
  }
  return true;
}

// ── Sewing Machine Specs → /api/products/[id]/sewing-specs ──
export async function fetchSewingSpecsByProductId(productId: string): Promise<SewingMachineSpecsRow | null> {
  if (!productId) return null;
  const json = await jget<{ specs?: SewingMachineSpecsRow | null }>(
    `/api/products/${encodeURIComponent(productId)}/sewing-specs`, {},
  );
  return json.specs ?? null;
}
export async function upsertSewingSpecs(specs: {
  product_id: string;
  template_slug: string;
  common_specs: Record<string, unknown>;
  template_specs: Record<string, unknown>;
}): Promise<boolean> {
  const { ok } = await jsend(
    `/api/products/${encodeURIComponent(specs.product_id)}/sewing-specs`, "PUT", specs,
  );
  return ok;
}
export async function deleteSewingSpecs(productId: string): Promise<boolean> {
  const { ok } = await jsend(`/api/products/${encodeURIComponent(productId)}/sewing-specs`, "DELETE");
  return ok;
}
