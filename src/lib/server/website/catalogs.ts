import "server-only";

/* ---------------------------------------------------------------------------
   website/catalogs — Koleex's own catalogs for the public site (owner,
   30/09/2026: "just Koleex catalogs only — don't show any supplier
   catalog"). They live apart from the Catalogs app (whose rows are all
   suppliers'): table website_catalogs, bucket website-files (public, PDF
   only, 100 MB). A supplier catalog cannot reach the site by any switch.

   · The PDF goes straight from the browser to storage through a signed
     upload link this module issues (the platform caps our own request
     bodies at 4.5 MB); the catalog row is written only once the file is
     there and is a PDF.
   · Every change tells the site to refresh its catalogs (tag "catalogs").
   --------------------------------------------------------------------------- */

import crypto from "node:crypto";
import { supabaseServer } from "@/lib/server/supabase-server";
import { revalidateWebsite } from "@/lib/server/website-bridge";
import { cleanString, isHubPhoto, type I18nText } from "@/lib/website/page-doc";
import { mediaOrigin, type Result } from "@/lib/server/website/pages";

export const FILES_BUCKET = "website-files";
export const CATALOG_BYTES_MAX = 100 * 1024 * 1024;
const PATH_RE = /^catalogs\/[0-9a-f-]{36}\.pdf$/;

export interface WebsiteCatalog {
  id: string;
  title: I18nText;
  description: I18nText;
  fileUrl: string;
  fileSize: number | null;
  coverUrl: string | null;
  year: number | null;
  sort: number;
  visible: boolean;
  updatedAt: string;
}

interface Row { id: string; title: unknown; description: unknown; file_path: string; file_size: number | null; cover_url: string | null; year: number | null; sort: number; visible: boolean; updated_at: string }

const text = (v: unknown, max: number): I18nText => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { en: cleanString(o.en, max), ar: cleanString(o.ar, max), zh: cleanString(o.zh, max) };
};
const yearOf = (v: unknown): number | null => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1950 && n <= 2100 ? n : null;
};
const publicFileUrl = (path: string) => supabaseServer.storage.from(FILES_BUCKET).getPublicUrl(path).data.publicUrl;

function toCatalog(r: Row): WebsiteCatalog {
  return {
    id: r.id, title: text(r.title, 160), description: text(r.description, 600),
    fileUrl: publicFileUrl(r.file_path), fileSize: r.file_size, coverUrl: r.cover_url,
    year: r.year, sort: r.sort, visible: r.visible, updatedAt: r.updated_at,
  };
}

/** Every catalog (the Website app) — or only those shown (the site). */
export async function listCatalogs(onlyVisible = false): Promise<WebsiteCatalog[]> {
  let q = supabaseServer.from("website_catalogs").select("id, title, description, file_path, file_size, cover_url, year, sort, visible, updated_at");
  if (onlyVisible) q = q.eq("visible", true);
  const { data, error } = await q.order("sort", { ascending: true }).order("year", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) throw new Error(`website catalogs: ${error.message}`);
  return ((data ?? []) as Row[]).map(toCatalog);
}

/** A signed link the browser uploads the PDF to, straight into the bucket. */
export async function catalogUploadLink(size: unknown): Promise<Result<{ path: string; signedUrl: string }>> {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return { error: "Choose a PDF.", status: 400, code: "empty" };
  if (n > CATALOG_BYTES_MAX) return { error: "A catalog may be 100 MB at most.", status: 400, code: "too_big" };
  const path = `catalogs/${crypto.randomUUID()}.pdf`;
  const { data, error } = await supabaseServer.storage.from(FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`website files: ${error?.message ?? "no link"}`);
  return { path, signedUrl: data.signedUrl };
}

/** The file at `path` is in the bucket, as a PDF; its size. null when not. */
async function uploadedPdf(path: string): Promise<{ size: number } | null> {
  if (!PATH_RE.test(path)) return null;
  const name = path.slice("catalogs/".length);
  const { data, error } = await supabaseServer.storage.from(FILES_BUCKET).list("catalogs", { search: name, limit: 5 });
  if (error) throw new Error(`website files: ${error.message}`);
  const f = (data ?? []).find((x) => x.name === name) as { metadata?: { mimetype?: string; size?: number } } | undefined;
  if (!f || (f.metadata?.mimetype && f.metadata.mimetype !== "application/pdf")) return null;
  return { size: Number(f.metadata?.size ?? 0) };
}

export async function createCatalog(input: { title: unknown; description: unknown; year: unknown; path: unknown; coverUrl: unknown }, accountId: string): Promise<Result<{ catalog: WebsiteCatalog }>> {
  const title = text(input.title, 160);
  if (!title.en) return { error: "Write the title in English.", status: 400, code: "title" };
  const path = typeof input.path === "string" ? input.path : "";
  const file = await uploadedPdf(path);
  if (!file) return { error: "The PDF is not uploaded yet.", status: 400, code: "file" };
  const cover = typeof input.coverUrl === "string" && isHubPhoto(input.coverUrl, mediaOrigin()) ? input.coverUrl : null;
  const { data, error } = await supabaseServer.from("website_catalogs").insert({
    title, description: text(input.description, 600), file_path: path, file_size: file.size || null,
    cover_url: cover, year: yearOf(input.year), created_by: accountId,
  }).select("id, title, description, file_path, file_size, cover_url, year, sort, visible, updated_at").single();
  if (error) throw new Error(`website catalogs: ${error.message}`);
  revalidateWebsite(["catalogs"]);
  return { catalog: toCatalog(data as Row) };
}

export async function updateCatalog(id: string, patch: Record<string, unknown>): Promise<Result<{ catalog: WebsiteCatalog }>> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "No such catalog.", status: 404 };
  const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in patch) {
    const t = text(patch.title, 160);
    if (!t.en) return { error: "Write the title in English.", status: 400, code: "title" };
    set.title = t;
  }
  if ("description" in patch) set.description = text(patch.description, 600);
  if ("year" in patch) set.year = yearOf(patch.year);
  if ("visible" in patch) set.visible = patch.visible === true;
  if ("sort" in patch) set.sort = Math.max(-1000, Math.min(1000, Math.round(Number(patch.sort)) || 0));
  if ("coverUrl" in patch) set.cover_url = typeof patch.coverUrl === "string" && isHubPhoto(patch.coverUrl, mediaOrigin()) ? patch.coverUrl : null;
  const { data, error } = await supabaseServer.from("website_catalogs").update(set).eq("id", id)
    .select("id, title, description, file_path, file_size, cover_url, year, sort, visible, updated_at").maybeSingle();
  if (error) throw new Error(`website catalogs: ${error.message}`);
  if (!data) return { error: "No such catalog.", status: 404 };
  revalidateWebsite(["catalogs"]);
  return { catalog: toCatalog(data as Row) };
}

export async function deleteCatalog(id: string): Promise<Result<{ ok: true }>> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "No such catalog.", status: 404 };
  const { data, error } = await supabaseServer.from("website_catalogs").delete().eq("id", id).select("file_path").maybeSingle();
  if (error) throw new Error(`website catalogs: ${error.message}`);
  if (!data) return { error: "No such catalog.", status: 404 };
  const path = (data as { file_path: string }).file_path;
  if (PATH_RE.test(path)) await supabaseServer.storage.from(FILES_BUCKET).remove([path]);
  revalidateWebsite(["catalogs"]);
  return { ok: true };
}
