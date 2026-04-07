/* ---------------------------------------------------------------------------
   Catalogs Admin — Manage supplier/company catalogs.
   Metadata stored as JSON in Supabase Storage (config/catalogs.json).
   Files stored in media/catalogs/{id}.{ext}
   Covers stored in media/catalogs/covers/{id}.{ext}
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import * as tus from "tus-js-client";

const BUCKET = "media";
const CONFIG_PATH = "config/catalogs.json";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface CatalogEntry {
  id: string;
  title: string;
  description: string | null;
  contact_id: string | null;
  contact_name: string | null;
  company_name_en: string | null;
  company_name_cn: string | null;
  contact_type: string | null;
  division_slug: string | null;
  division_name: string | null;
  category_slug: string | null;
  category_name: string | null;
  file_name: string;
  file_path: string;
  file_url: string;
  file_type: string;
  file_size: number;
  cover_url: string | null;
  cover_path: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ── Fetch all catalogs ──

export async function fetchCatalogs(): Promise<CatalogEntry[]> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(CONFIG_PATH);
    if (error || !data) return [];
    const text = await data.text();
    return JSON.parse(text) as CatalogEntry[];
  } catch {
    return [];
  }
}

// ── Save catalogs (overwrite JSON) ──

async function saveCatalogs(entries: CatalogEntry[]): Promise<boolean> {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const { error } = await supabase.storage.from(BUCKET).upload(CONFIG_PATH, blob, {
    cacheControl: "0",
    upsert: true,
  });
  if (error) {
    console.error("[Catalogs] Save:", error.message);
    return false;
  }
  return true;
}

// ── Resumable upload via TUS (bypasses 50MB limit) ──

function uploadResumable(
  filePath: string,
  file: File,
  onProgress?: (pct: number) => void,
  upsert = false,
): Promise<boolean> {
  return new Promise((resolve) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: 6 * 1024 * 1024, // 6MB chunks
      headers: {
        authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
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
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return { url: data.publicUrl, path: filePath, id };
}

// ── Upload cover image ──

export async function uploadCatalogCover(
  catalogId: string,
  file: File,
): Promise<{ url: string; path: string } | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filePath = `catalogs/covers/${catalogId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (error) {
    console.error("[Catalogs] Cover upload:", error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return { url: `${data.publicUrl}?t=${Date.now()}`, path: filePath };
}

// ── Replace catalog file ──

export async function replaceCatalogFile(
  oldPath: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; path: string } | null> {
  // Remove old file
  await supabase.storage.from(BUCKET).remove([oldPath]);
  // Upload new
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const id = crypto.randomUUID();
  const filePath = `catalogs/${id}.${ext}`;
  const ok = await uploadResumable(filePath, file, onProgress);
  if (!ok) {
    console.error("[Catalogs] Replace file failed");
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return { url: data.publicUrl, path: filePath };
}

// ── Delete catalog files from storage ──

async function deleteCatalogFiles(
  filePath: string,
  coverPath?: string | null,
): Promise<void> {
  const paths = [filePath];
  if (coverPath) paths.push(coverPath);
  await supabase.storage.from(BUCKET).remove(paths);
}

// ── Create catalog entry ──

export async function createCatalog(
  entry: Omit<CatalogEntry, "id" | "created_at" | "updated_at">,
): Promise<CatalogEntry | null> {
  const entries = await fetchCatalogs();
  const newEntry: CatalogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  entries.unshift(newEntry); // newest first
  const ok = await saveCatalogs(entries);
  return ok ? newEntry : null;
}

// ── Update catalog entry ──

export async function updateCatalog(
  id: string,
  updates: Partial<CatalogEntry>,
): Promise<boolean> {
  const entries = await fetchCatalogs();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return false;
  entries[idx] = {
    ...entries[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  return saveCatalogs(entries);
}

// ── Delete catalog entry + files ──

export async function deleteCatalog(id: string): Promise<boolean> {
  const entries = await fetchCatalogs();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return false;
  await deleteCatalogFiles(entry.file_path, entry.cover_path);
  const filtered = entries.filter((e) => e.id !== id);
  return saveCatalogs(filtered);
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
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, display_name, full_name, company, company_name_en, company_name_cn, contact_type, division, category, photo_url",
    )
    .in("contact_type", ["supplier", "company"])
    .order("company_name_en", { ascending: true });
  if (error) {
    console.error("[Catalogs] Fetch contacts:", error.message);
    return [];
  }
  return ((data as Record<string, unknown>[]) || []).map((c) => ({
    id: c.id as string,
    display_name:
      (c.company_name_en as string) ||
      (c.display_name as string) ||
      (c.full_name as string) ||
      (c.company as string) ||
      "Unknown",
    company_name_en: (c.company_name_en as string) || null,
    company_name_cn: (c.company_name_cn as string) || null,
    contact_type: (c.contact_type as string) || "supplier",
    division: (c.division as string) || null,
    category: (c.category as string) || null,
    photo_url: (c.photo_url as string) || null,
  }));
}

// ── Sync catalog to contact's catalogues array ──

export async function syncCatalogToContact(
  contactId: string,
  catalog: { name: string; url: string; type: string },
): Promise<void> {
  try {
    const { data } = await supabase
      .from("contacts")
      .select("catalogues")
      .eq("id", contactId)
      .single();
    const existing: { name: string; url: string; type: string; uploaded_at: string }[] =
      Array.isArray(data?.catalogues) ? data.catalogues : [];
    // Remove any entry with same URL (update) then add new
    const filtered = existing.filter((c) => c.url !== catalog.url);
    filtered.push({
      name: catalog.name,
      url: catalog.url,
      type: catalog.type,
      uploaded_at: new Date().toISOString(),
    });
    await supabase
      .from("contacts")
      .update({ catalogues: filtered })
      .eq("id", contactId);
  } catch (err) {
    console.error("[Catalogs] Sync to contact:", err);
  }
}

// ── Remove catalog from contact's catalogues array ──

export async function removeCatalogFromContact(
  contactId: string,
  fileUrl: string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("contacts")
      .select("catalogues")
      .eq("id", contactId)
      .single();
    const existing: { name: string; url: string; type: string; uploaded_at: string }[] =
      Array.isArray(data?.catalogues) ? data.catalogues : [];
    const filtered = existing.filter((c) => c.url !== fileUrl);
    await supabase
      .from("contacts")
      .update({ catalogues: filtered })
      .eq("id", contactId);
  } catch (err) {
    console.error("[Catalogs] Remove from contact:", err);
  }
}
