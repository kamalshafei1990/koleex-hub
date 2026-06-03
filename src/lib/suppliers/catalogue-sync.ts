import "server-only";

/* ---------------------------------------------------------------------------
   Supplier ⇄ Catalogs sync.

   The supplier form stores uploaded catalogues inline on the contact row
   (contacts.catalogues jsonb: [{ name, url, type, uploaded_at, storage_path? }]).
   The standalone Catalogs app reads a separate `catalogs` table. They were
   never linked, so a catalogue uploaded while adding a supplier never showed
   up in the Catalogs app.

   This helper mirrors a supplier's Storage-backed catalogues into the
   `catalogs` table whenever the contact is created or its catalogues change.
   It is ADDITIVE and idempotent: it only inserts catalogues that don't yet
   have a matching `catalogs` row (keyed by tenant + contact_id + file_url),
   so re-saving a supplier never creates duplicates. Removing a catalogue from
   the supplier does not delete the Catalogs-app entry (the catalog may have
   been curated there independently).

   Only http(s) URLs (files that live in Storage) are synced — legacy inline
   base64 data: URLs are skipped so we never copy multi-MB blobs into catalogs.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* Match the Catalogs app's getFileType(): lowercase extension, jpeg→jpg.
   The grid keys FILE_TYPE_CONFIG and the inline preview ("isPdf") off this
   lowercase value — an uppercase "PDF" broke the PDF preview + cover tile. */
function fileTypeFromName(name: string | undefined, url: string): string {
  const src = name && name.includes(".") ? name : url.split("?")[0];
  const ext = src.split(".").pop()?.toLowerCase() || "";
  if (ext === "jpeg") return "jpg";
  return ext || "pdf";
}

/* Resolve the real canonical division/category slug by name so the catalog
   editor's dropdowns pre-select correctly. Falls back to a slugified name
   when the supplier's free-text value isn't a known division/category. */
async function resolveSlugs(
  divisionName: string | null,
  categoryName: string | null,
): Promise<{ divisionSlug: string | null; categorySlug: string | null }> {
  let divisionSlug = divisionName ? slugify(divisionName) : null;
  let categorySlug = categoryName ? slugify(categoryName) : null;
  try {
    if (divisionName) {
      const { data } = await supabaseServer
        .from("divisions").select("slug").ilike("name", divisionName).maybeSingle();
      if (data?.slug) divisionSlug = data.slug as string;
    }
    if (categoryName) {
      const { data } = await supabaseServer
        .from("categories").select("slug").ilike("name", categoryName).maybeSingle();
      if (data?.slug) categorySlug = data.slug as string;
    }
  } catch { /* best-effort — keep slugified fallback */ }
  return { divisionSlug, categorySlug };
}

/* Best-effort size of a Storage object (so the card shows a real size, not 0 B). */
async function storageSize(path: string | null): Promise<number | null> {
  if (!path) return null;
  try {
    const slash = path.lastIndexOf("/");
    const dir = slash >= 0 ? path.slice(0, slash) : "";
    const name = slash >= 0 ? path.slice(slash + 1) : path;
    const { data } = await supabaseServer.storage.from("media").list(dir, { search: name, limit: 1 });
    const meta = data?.[0]?.metadata as { size?: number } | undefined;
    return typeof meta?.size === "number" ? meta.size : null;
  } catch { return null; }
}

type CatalogueItem = {
  name?: string;
  url?: string;
  type?: string;
  uploaded_at?: string;
  storage_path?: string;
};

type ContactLike = {
  id: string;
  contact_type?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  company_name_en?: string | null;
  company_name_cn?: string | null;
  division?: string | null;
  category?: string | null;
  catalogues?: unknown;
};

export async function syncContactCatalogues(
  tenantId: string | null,
  contact: ContactLike | null | undefined,
): Promise<void> {
  if (!tenantId || !contact || contact.contact_type !== "supplier") return;

  const cats = Array.isArray(contact.catalogues)
    ? (contact.catalogues as CatalogueItem[])
    : [];
  const items = cats.filter(
    (c) => c && typeof c.url === "string" && /^https?:\/\//i.test(c.url),
  );
  if (items.length === 0) return;

  const { data: existing, error: exErr } = await supabaseServer
    .from("catalogs")
    .select("file_url")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contact.id);
  if (exErr) {
    console.error("[catalogue-sync] read existing:", exErr.message);
    return;
  }
  const have = new Set((existing ?? []).map((r) => (r as { file_url: string }).file_url));

  const companyEn =
    contact.company_name_en || contact.company_name || contact.display_name || null;
  const companyCn = contact.company_name_cn || null;
  const contactName =
    contact.display_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    companyEn ||
    null;
  const divisionName = contact.division || null;
  const categoryName = contact.category || null;
  const { divisionSlug, categorySlug } = await resolveSlugs(divisionName, categoryName);

  const rows: Record<string, unknown>[] = [];
  for (const it of items) {
    if (!it.url || have.has(it.url)) continue;
    const m = it.url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    const filePath = it.storage_path || (m ? decodeURIComponent(m[1]) : null);
    const fileType = fileTypeFromName(it.name, it.url);
    const fileSize = await storageSize(filePath);
    rows.push({
      tenant_id: tenantId,
      title: (it.name || "Catalogue").replace(/\.[^.]+$/, "").trim() || "Catalogue",
      contact_id: contact.id,
      contact_name: contactName,
      company_name_en: companyEn,
      company_name_cn: companyCn,
      contact_type: "supplier",
      division_slug: divisionSlug,
      division_name: divisionName,
      category_slug: categorySlug,
      category_name: categoryName,
      file_name: it.name || null,
      file_path: filePath,
      file_url: it.url,
      file_type: fileType,
      file_size: fileSize,
      created_by_name: "Supplier sync",
    });
  }

  if (rows.length === 0) return;
  const { error } = await supabaseServer.from("catalogs").insert(rows);
  if (error) console.error("[catalogue-sync] insert:", error.message);
}
