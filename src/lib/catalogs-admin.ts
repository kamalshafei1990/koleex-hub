/* ---------------------------------------------------------------------------
   Catalogs Admin — Manage supplier/company catalogs.
   Metadata lives in the tenant-scoped `catalogs` table via /api/catalogs
   (RLS-locked, service-role server access — no race conditions, per-tenant).
   File bytes stored in media/catalogs/{id}.{ext}
   Covers stored in media/catalogs/covers/{id}.{ext}
   --------------------------------------------------------------------------- */

import {
  uploadToStorage,
  removeFromStorage,
  publicUrl,
} from "./storage-client";
import * as tus from "tus-js-client";

const BUCKET = "media";

/* Env reads are INSIDE uploadResumable (see below) rather than at
   module load, so importing this file never triggers a crash when
   NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY aren't present in the build
   environment (e.g. prerender of /accounts/new). */

export interface CatalogEntry {
  id: string;
  title: string;
  title_cn: string | null;
  description: string | null;
  contact_id: string | null;
  contact_name: string | null;
  company_name_en: string | null;
  company_name_cn: string | null;
  contact_type: string | null;
  // Supplier logo/photo, denormalised at save so the card can show it beside
  // the supplier name without a separate contacts lookup.
  contact_photo_url?: string | null;
  division_slug: string | null;
  division_name: string | null;
  category_slug: string | null;
  category_name: string | null;
  // Multi-category: a catalog can belong to several categories. category_slug /
  // category_name stay as the PRIMARY (first) for back-compat with filters,
  // search and card display; these arrays carry the full set.
  category_slugs?: string[] | null;
  category_names?: string[] | null;
  file_name: string;
  file_path: string;
  file_url: string;
  file_type: string;
  file_size: number;
  cover_url: string | null;
  cover_path: string | null;
  tags: string[];
  year?: number | null;
  valid_until?: string | null;
  page_count?: number | null;
  view_count?: number | null;
  download_count?: number | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Fetch all catalogs (tenant-scoped, via server API) ──

export async function fetchCatalogs(): Promise<CatalogEntry[]> {
  try {
    const resp = await fetch("/api/catalogs", { credentials: "include", cache: "no-store" });
    if (!resp.ok) return [];
    const j = (await resp.json()) as { catalogs?: CatalogEntry[] };
    return j.catalogs ?? [];
  } catch (err) {
    console.error("[Catalogs] Fetch:", err);
    return [];
  }
}

// ── Resumable upload via TUS (bypasses 50MB limit) ──

function uploadResumable(
  filePath: string,
  file: File,
  onProgress?: (pct: number) => void,
  upsert = false,
): Promise<boolean> {
  /* Runtime env access — fails clearly at the first upload call if
     vars are absent, never at module import time. */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Promise.reject(
      new Error(
        "[catalogs-admin] Supabase env variables are missing " +
          "(NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      ),
    );
  }
  return new Promise((resolve) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: 6 * 1024 * 1024, // 6MB chunks
      headers: {
        authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        "x-upsert": upsert ? "true" : "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET,
        objectName: filePath,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (err) => {
        console.error("[Catalogs] TUS upload error:", err);
        resolve(false);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (onProgress) onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve(true),
    });
    upload.findPreviousUploads().then((prev) => {
      if (prev.length) (upload as unknown as { resumeUpload(u: unknown): void }).resumeUpload(prev[0]);
      else upload.start();
    });
  });
}

// ── Upload catalog file ──

export async function uploadCatalogFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{
  url: string;
  path: string;
  id: string;
} | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const id = crypto.randomUUID();
  const filePath = `catalogs/${id}.${ext}`;
  const ok = await uploadResumable(filePath, file, onProgress);
  if (!ok) {
    console.error("[Catalogs] File upload failed");
    return null;
  }
  return { url: publicUrl(BUCKET, filePath), path: filePath, id };
}

// ── Upload cover image ──

export async function uploadCatalogCover(
  catalogId: string,
  file: File,
): Promise<{ url: string; path: string } | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filePath = `catalogs/covers/${catalogId}.${ext}`;
  const result = await uploadToStorage(BUCKET, filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (!result.ok) {
    console.error("[Catalogs] Cover upload:", result.error);
    return null;
  }
  return { url: `${result.data.publicUrl}?t=${Date.now()}`, path: result.data.path };
}

// ── Replace catalog file ──

export async function replaceCatalogFile(
  oldPath: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; path: string } | null> {
  // Remove old file via API (service_role)
  await removeFromStorage(BUCKET, [oldPath]);
  // Upload new (TUS resumable — still uses anon, INSERT-only to a unique
  // UUID path, so it works even with anon UPDATE/DELETE closed).
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const id = crypto.randomUUID();
  const filePath = `catalogs/${id}.${ext}`;
  const ok = await uploadResumable(filePath, file, onProgress);
  if (!ok) {
    console.error("[Catalogs] Replace file failed");
    return null;
  }
  return { url: publicUrl(BUCKET, filePath), path: filePath };
}

// ── Create catalog entry (server API → catalogs table) ──

export async function createCatalog(
  entry: Omit<CatalogEntry, "id" | "created_at" | "updated_at">,
): Promise<CatalogEntry | null> {
  try {
    const res = await fetch("/api/catalogs", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      console.error("[Catalogs] Create:", (await res.json().catch(() => ({}))) as unknown);
      return null;
    }
    const j = (await res.json()) as { catalog?: CatalogEntry };
    return j.catalog ?? null;
  } catch (err) {
    console.error("[Catalogs] Create:", err);
    return null;
  }
}

// ── Update catalog entry ──

export async function updateCatalog(
  id: string,
  updates: Partial<CatalogEntry>,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/catalogs/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch (err) {
    console.error("[Catalogs] Update:", err);
    return false;
  }
}

// ── Delete catalog entry + files (server removes storage objects) ──

export async function deleteCatalog(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/catalogs/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch (err) {
    console.error("[Catalogs] Delete:", err);
    return false;
  }
}

// ── Track a usage metric (view / download) — fire-and-forget ──

export async function trackCatalog(
  id: string,
  metric: "view" | "download",
): Promise<void> {
  try {
    await fetch(`/api/catalogs/${id}/track`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric }),
      keepalive: true,
    });
  } catch {
    /* non-critical — never block the UI on a counter */
  }
}

// ── Fetch suppliers & companies for picker ──

export async function fetchCatalogContacts(): Promise<
  {
    id: string;
    display_name: string;
    company_name_en: string | null;
    company_name_cn: string | null;
    contact_type: string;
    division: string | null;
    category: string | null;
    photo_url: string | null;
  }[]
> {
  // Read through the server API (service-role, tenant-scoped) — the contacts
  // table is RLS-locked, so a direct client query returns nothing. Fetch
  // suppliers + companies in parallel (each respects its own module gate).
  const fetchType = async (type: string): Promise<Record<string, unknown>[]> => {
    try {
      const res = await fetch(`/api/contacts?type=${type}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) return [];
      const j = (await res.json()) as { contacts?: Record<string, unknown>[] };
      return j.contacts ?? [];
    } catch (err) {
      console.error("[Catalogs] Fetch contacts:", err);
      return [];
    }
  };

  const [suppliers, companies] = await Promise.all([fetchType("supplier"), fetchType("company")]);
  const rows = [...suppliers, ...companies];

  return rows
    .map((c) => ({
      id: c.id as string,
      display_name:
        (c.company_name_en as string) ||
        (c.display_name as string) ||
        (c.full_name as string) ||
        (c.company as string) ||
        (c.first_name as string) ||
        "Unknown",
      company_name_en: (c.company_name_en as string) || null,
      company_name_cn: (c.company_name_cn as string) || null,
      contact_type: (c.contact_type as string) || "supplier",
      division: (c.division as string) || null,
      category: (c.category as string) || null,
      // Prefer the company logo; fall back to the contact photo. Suppliers
      // store their brand logo in logo_url, so the picker list + the saved
      // catalog card logo both come through here.
      photo_url: (c.logo_url as string) || (c.photo_url as string) || null,
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

// ── Sync catalog to contact's catalogues array ──

type CatalogueEntry = { name: string; url: string; type: string; uploaded_at: string };

/* Read a contact's current catalogues via the server API (RLS-safe). */
async function fetchContactCatalogues(contactId: string): Promise<CatalogueEntry[]> {
  try {
    const res = await fetch(`/api/contacts/${contactId}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const j = (await res.json()) as { contact?: { catalogues?: CatalogueEntry[] } };
    return Array.isArray(j.contact?.catalogues) ? (j.contact!.catalogues as CatalogueEntry[]) : [];
  } catch (err) {
    console.error("[Catalogs] Read contact catalogues:", err);
    return [];
  }
}

async function patchContactCatalogues(contactId: string, catalogues: CatalogueEntry[]): Promise<void> {
  try {
    await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogues }),
    });
  } catch (err) {
    console.error("[Catalogs] Write contact catalogues:", err);
  }
}

export async function syncCatalogToContact(
  contactId: string,
  catalog: { name: string; url: string; type: string },
): Promise<void> {
  const existing = await fetchContactCatalogues(contactId);
  const filtered = existing.filter((c) => c.url !== catalog.url);
  filtered.push({ name: catalog.name, url: catalog.url, type: catalog.type, uploaded_at: new Date().toISOString() });
  await patchContactCatalogues(contactId, filtered);
}

// ── Remove catalog from contact's catalogues array ──

export async function removeCatalogFromContact(
  contactId: string,
  fileUrl: string,
): Promise<void> {
  const existing = await fetchContactCatalogues(contactId);
  const filtered = existing.filter((c) => c.url !== fileUrl);
  await patchContactCatalogues(contactId, filtered);
}
