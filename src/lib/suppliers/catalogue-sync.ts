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

  const rows: Record<string, unknown>[] = [];
  for (const it of items) {
    if (!it.url || have.has(it.url)) continue;
    const isPdf =
      (it.type || "").toUpperCase() === "PDF" ||
      it.url.toLowerCase().split("?")[0].endsWith(".pdf");
    const m = it.url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    const filePath = it.storage_path || (m ? decodeURIComponent(m[1]) : null);
    rows.push({
      tenant_id: tenantId,
      title: (it.name || "Catalogue").replace(/\.[^.]+$/, "").trim() || "Catalogue",
      contact_id: contact.id,
      contact_name: contactName,
      company_name_en: companyEn,
      company_name_cn: companyCn,
      contact_type: "supplier",
      division_slug: divisionName ? slugify(divisionName) : null,
      division_name: divisionName,
      category_slug: categoryName ? slugify(categoryName) : null,
      category_name: categoryName,
      file_name: it.name || null,
      file_path: filePath,
      file_url: it.url,
      file_type: isPdf ? "PDF" : (it.type || "IMAGE").toUpperCase(),
      created_by_name: "Supplier sync",
    });
  }

  if (rows.length === 0) return;
  const { error } = await supabaseServer.from("catalogs").insert(rows);
  if (error) console.error("[catalogue-sync] insert:", error.message);
}
