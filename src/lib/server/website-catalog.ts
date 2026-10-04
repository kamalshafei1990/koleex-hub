import "server-only";

/* ---------------------------------------------------------------------------
   Website catalog — what the Hub hands the public website through the bridge
   (lib/server/website-bridge.ts). Reads only.

   The website shows what a visitor may see, nothing more:
     · products that are ACTIVE and VISIBLE (owner rule, 05/08/2026), of the
       host company only;
     · no price of any kind, no cost, no supplier, no MOQ, no HS code — the
       columns are never selected here, and a product page passes through
       scrubForWebsite() on top of the loader's own "public" audience;
     · site pages and their sections as the Website app left them (visible
       ones only);
     · open job postings, without the salary.
   validate:website-bridge pins every one of these.
   --------------------------------------------------------------------------- */

import { allRowsOrThrow } from "@/lib/server/all-rows";
import { inChunks } from "@/lib/server/in-chunks";
import { supabaseServer } from "@/lib/server/supabase-server";
import { websiteTenantId } from "@/lib/server/website-bridge";
import { cleanPageDoc, type PageDoc } from "@/lib/website/page-doc";

/* ── Guards ─────────────────────────────────────────────────────────────── */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;
export const isSlug = (v: string | null | undefined): v is string => !!v && SLUG_RE.test(v);

/* A key the website never receives, at any depth. The loaders already leave
   these out; this is the last line, so a column added to a loader later
   cannot reach a visitor by accident. */
const INTERNAL_KEY = /(price|cost|supplier|moq|margin|hs_?code|fob|tenant)/i;
export function scrubForWebsite<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => scrubForWebsite(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (INTERNAL_KEY.test(k)) continue;
      out[k] = scrubForWebsite(v);
    }
    return out as T;
  }
  return value;
}

/* ── Products ───────────────────────────────────────────────────────────── */

const LIST_COLUMNS = "id, product_name, slug, brand, division_slug, category_slug, subcategory_slug, excerpt, featured, updated_at";

export interface WebsiteProductCard {
  slug: string;
  name: string;
  modelCode: string | null;
  tagline: string | null;
  excerpt: string | null;
  /** zh / ar (and any other locale on file): name, tagline, excerpt. */
  translations: Record<string, { name: string | null; tagline: string | null; excerpt: string | null }>;
  brand: string | null;
  division: string | null;
  category: string | null;
  subcategory: string | null;
  featured: boolean;
  image: string | null;
  updatedAt: string | null;
}

export interface WebsiteProductQuery {
  division?: string | null;
  category?: string | null;
  subcategory?: string | null;
  featured?: boolean;
  q?: string | null;
  /** These products, in this order (a page's hand-picked products). */
  slugs?: string[] | null;
  page?: number;
  pageSize?: number;
}

/** Letters, digits, spaces and dashes in any script — nothing PostgREST
 *  reads as a wildcard or a separator. */
const searchTerm = (q: string | null | undefined): string =>
  (q ?? "").normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);

/* Words, not a phrase: "12/15 heat press" finds "12/15 in 1 Heat Press
   Machine". As one phrase the slash became a space and "12 15" was nowhere
   in the text (the bridge's own test caught it, 27/09/2026). Every word must
   match; five words is plenty for a product search. */
const searchWords = (q: string | null | undefined): string[] =>
  Array.from(new Set(searchTerm(q).toLowerCase().split(" ").filter(Boolean))).slice(0, 5);

/* The list filters as column/value pairs, so every read applies the same ones. */
function filterPairs(query: WebsiteProductQuery): Array<[string, string | boolean]> {
  const pairs: Array<[string, string | boolean]> = [];
  if (isSlug(query.division)) pairs.push(["division_slug", query.division]);
  if (isSlug(query.category)) pairs.push(["category_slug", query.category]);
  if (isSlug(query.subcategory)) pairs.push(["subcategory_slug", query.subcategory]);
  if (query.featured) pairs.push(["featured", true]);
  return pairs;
}

type Hit = { id: string; product_name: string; featured: boolean | null };

/* Where a visitor's words may match: the product's own text, a model's code,
   SKU or name in any language, and the translated name, tagline and
   description. Never the supplier tables — a visitor who types a supplier's
   name or code finds nothing. Returns this company's active, visible
   products that match, inside the filters, in list order. */
async function searchHits(tenantId: string, words: string[], query: WebsiteProductQuery): Promise<Hit[]> {
  const filters = filterPairs(query);
  let own = supabaseServer.from("products").select("id, product_name, featured")
    .eq("tenant_id", tenantId).eq("status", "active").eq("visible", true);
  for (const [c, v] of filters) own = own.eq(c, v);
  let models = supabaseServer.from("product_models").select("product_id")
    .eq("visible", true).or("status.is.null,status.neq.discontinued");
  let texts = supabaseServer.from("product_translations").select("product_id");
  for (const w of words) {
    own = own.ilike("search_text", `%${w}%`);
    models = models.ilike("search_text", `%${w}%`);
    texts = texts.ilike("search_text", `%${w}%`);
  }
  const [direct, viaModels, viaTexts] = await Promise.all([
    allRowsOrThrow<Hit>("website search", own.order("id")),
    allRowsOrThrow<{ product_id: string }>("website search models", models.order("id")),
    allRowsOrThrow<{ product_id: string }>("website search translations", texts.order("id")),
  ]);
  /* A model or translation match must still be this company's, active,
     visible and inside the filters. Checked in chunks, so a broad search
     never puts thousands of ids in one URL (lib/server/in-chunks). */
  const seen = new Set(direct.map((h) => h.id));
  const extra = Array.from(new Set([...viaModels, ...viaTexts].map((r) => r.product_id))).filter((id) => !seen.has(id));
  const checked = await inChunks<Hit>(extra, (chunk) => {
    let q = supabaseServer.from("products").select("id, product_name, featured")
      .in("id", chunk).eq("tenant_id", tenantId).eq("status", "active").eq("visible", true);
    for (const [c, v] of filters) q = q.eq(c, v);
    return q;
  });
  if (checked.error) throw new Error(`website search: ${checked.error.message}`);
  /* The list's own order: featured first, then by name. */
  return direct.concat(checked.data ?? []).sort((a, b) =>
    Number(!!b.featured) - Number(!!a.featured) || a.product_name.localeCompare(b.product_name));
}

type ProductRow = { id: string; product_name: string; slug: string; brand: string | null; division_slug: string | null; category_slug: string | null; subcategory_slug: string | null; excerpt: string | null; featured: boolean | null; updated_at: string | null };

export async function listWebsiteProducts(query: WebsiteProductQuery): Promise<{ items: WebsiteProductCard[]; total: number; page: number; pageSize: number }> {
  const tenantId = await websiteTenantId();
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 24)));
  if (!tenantId) return { items: [], total: 0, page, pageSize };
  const from = (page - 1) * pageSize;
  const words = searchWords(query.q);

  /* Hand-picked products (a page's products section): the ones still shown,
     in the order picked. */
  const picked = Array.from(new Set((query.slugs ?? []).filter(isSlug))).slice(0, 24);
  if (picked.length) {
    const { data, error } = await supabaseServer.from("products").select(LIST_COLUMNS)
      .eq("tenant_id", tenantId).eq("status", "active").eq("visible", true).in("slug", picked);
    if (error) throw new Error(`website products: ${error.message}`);
    const bySlug = new Map(((data as ProductRow[] | null) ?? []).map((r) => [r.slug, r]));
    const rows = picked.map((sl) => bySlug.get(sl)).filter((r): r is ProductRow => !!r);
    return { items: await productCards(rows), total: rows.length, page: 1, pageSize: rows.length };
  }

  let rows: ProductRow[];
  let total: number;
  if (words.length === 0) {
    let q = supabaseServer
      .from("products")
      .select(LIST_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .eq("visible", true);
    for (const [c, v] of filterPairs(query)) q = q.eq(c, v);
    const { data, count, error } = await q
      .order("featured", { ascending: false })
      .order("product_name", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`website products: ${error.message}`);
    rows = (data as ProductRow[] | null) ?? [];
    total = count ?? rows.length;
  } else {
    const hits = await searchHits(tenantId, words, query);
    const pageIds = hits.slice(from, from + pageSize).map((h) => h.id);
    const { data, error } = pageIds.length
      ? await supabaseServer.from("products").select(LIST_COLUMNS).in("id", pageIds)
      : { data: [], error: null };
    if (error) throw new Error(`website products: ${error.message}`);
    const byId = new Map(((data as ProductRow[] | null) ?? []).map((r) => [r.id, r]));
    rows = pageIds.map((id) => byId.get(id)).filter((r): r is ProductRow => !!r);
    total = hits.length;
  }
  return { items: await productCards(rows), total, page, pageSize };
}

/* The cards for one page: the main image (the first gallery shot when there
   is none), the translated texts, and the primary model's code. A failed
   read throws — the website then keeps the copy it has rather than caching
   cards with the images missing. */
async function productCards(rows: ProductRow[]): Promise<WebsiteProductCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  type MediaRow = { product_id: string; url: string | null; type: string };
  type TextRow = { product_id: string; locale: string; product_name: string | null; tagline: string | null; excerpt: string | null };
  type ModelRow = { product_id: string; primary_model: string | null; model_name: string | null; tagline: string | null; visible: boolean | null; status: string | null };
  const [media, texts, models] = await Promise.all([
    allRowsOrThrow<MediaRow>("website media", supabaseServer.from("product_media").select('product_id, url, type, "order"').in("product_id", ids).in("type", ["main_image", "gallery"]).order("order", { ascending: true }).order("id")),
    allRowsOrThrow<TextRow>("website translations", supabaseServer.from("product_translations").select("product_id, locale, product_name, tagline, excerpt").in("product_id", ids).order("id")),
    allRowsOrThrow<ModelRow>("website models", supabaseServer.from("product_models").select('product_id, primary_model, model_name, tagline, visible, status, "order"').in("product_id", ids).order("order", { ascending: true }).order("id")),
  ]);

  const imageOf = new Map<string, string>();
  for (const m of media) {
    if (!m.url) continue;
    if (m.type === "main_image" || !imageOf.has(m.product_id)) imageOf.set(m.product_id, m.url);
  }
  const textsOf = new Map<string, WebsiteProductCard["translations"]>();
  for (const t of texts) {
    const map = textsOf.get(t.product_id) ?? {};
    map[t.locale] = { name: t.product_name, tagline: t.tagline, excerpt: t.excerpt };
    textsOf.set(t.product_id, map);
  }
  const modelsOf = new Map<string, ModelRow[]>();
  for (const m of models) {
    if (m.visible === false || m.status === "discontinued") continue;
    const list = modelsOf.get(m.product_id) ?? [];
    list.push(m);
    modelsOf.set(m.product_id, list);
  }

  return rows.map((r): WebsiteProductCard => {
    const list = modelsOf.get(r.id) ?? [];
    const primary = list.find((m) => !!m.primary_model) ?? list[0] ?? null;
    return {
      slug: r.slug,
      name: r.product_name,
      modelCode: primary ? (primary.primary_model || primary.model_name) : null,
      tagline: primary?.tagline ?? null,
      excerpt: r.excerpt,
      translations: textsOf.get(r.id) ?? {},
      brand: r.brand,
      division: r.division_slug,
      category: r.category_slug,
      subcategory: r.subcategory_slug,
      featured: !!r.featured,
      image: imageOf.get(r.id) ?? null,
      updatedAt: r.updated_at,
    };
  });
}

/** The id of a product the website may show: this company's, active and
 *  visible. null for anything else — the same "not found" either way. A
 *  failed read throws: read as "not found", the website would drop a live
 *  product's page for the hour it keeps an answer. */
export async function websiteProductId(slug: string): Promise<string | null> {
  const tenantId = await websiteTenantId();
  if (!tenantId || !isSlug(slug)) return null;
  const { data, error } = await supabaseServer
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .eq("status", "active")
    .eq("visible", true)
    .maybeSingle();
  if (error) throw new Error(`website product: ${error.message}`);
  return (data as { id?: string } | null)?.id ?? null;
}

/* ── Taxonomy ───────────────────────────────────────────────────────────── */

interface Names { name: string; zh: string | null; ar: string | null }
export interface WebsiteSubcategory extends Names { slug: string; code: string | null; description: string | null; order: number | null; productCount: number }
export interface WebsiteCategory extends Names { slug: string; description: string | null; order: number | null; productCount: number; subcategories: WebsiteSubcategory[] }
export interface WebsiteDivision extends Names { slug: string; tagline: string | null; description: string | null; order: number | null; productCount: number; categories: WebsiteCategory[] }

/** Divisions › categories › subcategories, each with how many products the
 *  website shows under it — the website hides the empty ones if it wants. */
export async function websiteTaxonomy(): Promise<WebsiteDivision[]> {
  const tenantId = await websiteTenantId();
  type TallyRow = { division_slug: string | null; category_slug: string | null; subcategory_slug: string | null };
  const [divs, cats, subs, prods] = await Promise.all([
    supabaseServer.from("divisions").select('id, slug, name, name_zh, name_ar, tagline, description, "order"').order("order", { ascending: true }),
    supabaseServer.from("categories").select('id, division_id, slug, name, name_zh, name_ar, description, "order"').order("order", { ascending: true }),
    allRowsOrThrow<SubRow>("website subcategories", supabaseServer.from("subcategories").select('id, category_id, slug, code, name, name_zh, name_ar, description, "order"').order("order", { ascending: true }).order("id")),
    /* Every product the website shows, counted — paged, so the counts stay
       right past the API's 1000-row read. */
    tenantId
      ? allRowsOrThrow<TallyRow>("website taxonomy", supabaseServer.from("products").select("id, division_slug, category_slug, subcategory_slug").eq("tenant_id", tenantId).eq("status", "active").eq("visible", true).order("id"))
      : Promise.resolve([] as TallyRow[]),
  ]);
  if (divs.error || cats.error) throw new Error(`website taxonomy: ${(divs.error ?? cats.error)?.message}`);

  const tally = new Map<string, number>();
  const bump = (k: string | null) => { if (k) tally.set(k, (tally.get(k) ?? 0) + 1); };
  for (const p of prods) {
    bump(p.division_slug ? `d:${p.division_slug}` : null);
    bump(p.category_slug ? `c:${p.category_slug}` : null);
    bump(p.subcategory_slug ? `s:${p.subcategory_slug}` : null);
  }

  type SubRow = { id: string; category_id: string; slug: string; code: string | null; name: string; name_zh: string | null; name_ar: string | null; description: string | null; order: number | null };
  type CatRow = { id: string; division_id: string; slug: string; name: string; name_zh: string | null; name_ar: string | null; description: string | null; order: number | null };
  type DivRow = { id: string; slug: string; name: string; name_zh: string | null; name_ar: string | null; tagline: string | null; description: string | null; order: number | null };

  const subsOf = new Map<string, WebsiteSubcategory[]>();
  for (const s of subs) {
    const list = subsOf.get(s.category_id) ?? [];
    list.push({ slug: s.slug, code: s.code, name: s.name, zh: s.name_zh, ar: s.name_ar, description: s.description, order: s.order, productCount: tally.get(`s:${s.slug}`) ?? 0 });
    subsOf.set(s.category_id, list);
  }
  const catsOf = new Map<string, WebsiteCategory[]>();
  for (const c of (cats.data as CatRow[] | null) ?? []) {
    const list = catsOf.get(c.division_id) ?? [];
    list.push({ slug: c.slug, name: c.name, zh: c.name_zh, ar: c.name_ar, description: c.description, order: c.order, productCount: tally.get(`c:${c.slug}`) ?? 0, subcategories: subsOf.get(c.id) ?? [] });
    catsOf.set(c.division_id, list);
  }
  return ((divs.data as DivRow[] | null) ?? []).map((d) => ({
    slug: d.slug, name: d.name, zh: d.name_zh, ar: d.name_ar, tagline: d.tagline, description: d.description, order: d.order,
    productCount: tally.get(`d:${d.slug}`) ?? 0,
    categories: catsOf.get(d.id) ?? [],
  }));
}

/* ── Site pages ─────────────────────────────────────────────────────────── */

export interface WebsitePageSummary { slug: string; name: string; title: string | null; description: string | null; updatedAt: string | null; version: number }

/** Every page, and its published version (0 = the site keeps its built-in page). */
export async function listWebsitePages(): Promise<WebsitePageSummary[]> {
  const { data, error } = await supabaseServer.from("pages").select("slug, name, title, description, updated_at, version, published_at").order("name", { ascending: true });
  if (error) throw new Error(`website pages: ${error.message}`);
  return ((data as Array<{ slug: string; name: string; title: string | null; description: string | null; updated_at: string | null; version: number | null; published_at: string | null }> | null) ?? [])
    .map((p) => ({ slug: p.slug, name: p.name, title: p.title, description: p.description, updatedAt: p.published_at ?? p.updated_at, version: p.version ?? 0 }));
}

/** One page: its published document (the Page Builder's, lib/website/
 *  page-doc) — or, with `draft`, the draft, for the site's own signed
 *  preview. A page never published comes with the old editor's visible
 *  sections, each with its visible elements, in their order (the site shows
 *  those, else its built-in page). null when there is no such page; a
 *  failed read throws, so the website keeps the page it has rather than a
 *  part. */
export async function websitePage(slug: string, opts: { draft?: boolean } = {}): Promise<{ page: WebsitePageSummary; doc: PageDoc | null; sections: Array<Record<string, unknown> & { elements: Array<Record<string, unknown>> }> } | null> {
  if (!isSlug(slug)) return null;
  const { data: page, error: pageError } = await supabaseServer.from("pages").select("id, slug, name, title, description, updated_at, version, published_at, draft, published").eq("slug", slug).maybeSingle();
  if (pageError) throw new Error(`website page: ${pageError.message}`);
  const p = page as { id: string; slug: string; name: string; title: string | null; description: string | null; updated_at: string | null; version: number | null; published_at: string | null; draft: unknown; published: unknown } | null;
  if (!p) return null;
  const summary: WebsitePageSummary = { slug: p.slug, name: p.name, title: p.title, description: p.description, updatedAt: p.published_at ?? p.updated_at, version: p.version ?? 0 };
  const origin = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const source = opts.draft ? (p.draft ?? p.published) : (summary.version > 0 ? p.published : null);
  if (source) return { page: summary, doc: cleanPageDoc(source, origin), sections: [] };
  const { data: sectionRows, error: sectionError } = await supabaseServer
    .from("sections")
    .select('id, section_key, layout, title, subtitle, content, image_url, image_alt, video_url, button_text, button_link, button2_text, button2_link, background, items, "order", updated_at')
    .eq("page_id", p.id)
    .eq("visible", true)
    .order("order", { ascending: true });
  if (sectionError) throw new Error(`website sections: ${sectionError.message}`);
  const sections = (sectionRows as Array<Record<string, unknown> & { id: string }> | null) ?? [];
  const { data: elementRows, error: elementError } = sections.length
    ? await supabaseServer
        .from("elements")
        .select('id, section_id, type, content, style, settings, "order"')
        .in("section_id", sections.map((s) => s.id))
        .eq("visible", true)
        .order("order", { ascending: true })
    : { data: [], error: null };
  if (elementError) throw new Error(`website elements: ${elementError.message}`);
  const elementsOf = new Map<string, Array<Record<string, unknown>>>();
  for (const e of (elementRows as Array<Record<string, unknown> & { section_id: string }> | null) ?? []) {
    const list = elementsOf.get(e.section_id) ?? [];
    list.push(e);
    elementsOf.set(e.section_id, list);
  }
  return {
    page: summary,
    doc: null,
    sections: sections.map((s) => ({ ...s, elements: elementsOf.get(s.id) ?? [] })),
  };
}

/* ── Careers ────────────────────────────────────────────────────────────── */

export interface WebsiteJob {
  id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  employmentType: string | null;
  department: string | null;
  publishedAt: string | null;
  closesAt: string | null;
}

/** Open postings, newest first — never the salary. */
export async function listWebsiteJobs(today: string): Promise<WebsiteJob[]> {
  const { data, error } = await supabaseServer
    .from("hr_job_postings")
    .select("id, title, description, requirements, location, employment_type, department_id, published_at, closes_at")
    .in("status", ["open", "published"])
    .or(`closes_at.is.null,closes_at.gte.${today}`)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(`website jobs: ${error.message}`);
  type Row = { id: string; title: string; description: string | null; requirements: string | null; location: string | null; employment_type: string | null; department_id: string | null; published_at: string | null; closes_at: string | null };
  const rows = (data as Row[] | null) ?? [];
  const deptIds = Array.from(new Set(rows.map((r) => r.department_id).filter((x): x is string => !!x)));
  const { data: depts, error: deptError } = deptIds.length
    ? await supabaseServer.from("koleex_departments").select("id, name").in("id", deptIds)
    : { data: [], error: null };
  if (deptError) throw new Error(`website jobs departments: ${deptError.message}`);
  const deptName = new Map(((depts as Array<{ id: string; name: string }> | null) ?? []).map((d) => [d.id, d.name]));
  return rows.map((r) => ({
    id: r.id, title: r.title, description: r.description, requirements: r.requirements, location: r.location,
    employmentType: r.employment_type, department: r.department_id ? deptName.get(r.department_id) ?? null : null,
    publishedAt: r.published_at, closesAt: r.closes_at,
  }));
}
