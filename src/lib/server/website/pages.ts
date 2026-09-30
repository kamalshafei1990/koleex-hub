import "server-only";

/* ---------------------------------------------------------------------------
   website/pages — the Page Builder on the server (Phase 3 step 3, owner
   30/09/2026). The public site's pages are page documents (lib/website/
   page-doc): edited as a draft, published as a copy the bridge serves.

   · Only the host company's people build its site (websiteTenantId): an
     account of any other tenant gets 403 whatever its role says.
   · Saving the draft is refused (409) when it moved under the editor since
     they loaded it (pages.draft_updated_at), so two people never overwrite
     each other silently.
   · Publishing (owner's pick): the super admins and whoever is given
     «Website Publish». Every publish is kept in page_versions; the site is
     told to refresh the page (revalidateWebsite page:<slug>).
   · Photos go to the PUBLIC bucket website-media through here only: jpeg,
     png, webp or avif, checked by their first bytes, 4 MB at most.
   --------------------------------------------------------------------------- */

import crypto from "node:crypto";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAccess, type ServerAuthContext } from "@/lib/server/auth";
import { revalidateWebsite, websiteTenantId } from "@/lib/server/website-bridge";
import { WEBSITE_PUBLISH_MODULE } from "@/lib/permission-modules";
import { cleanPageDoc, emptyDoc, publishProblems, type PageDoc, type PublishProblem } from "@/lib/website/page-doc";

export const MEDIA_BUCKET = "website-media";
/* 4 MB: a photo goes through our own function, whose request body the
   platform caps at 4.5 MB (a bigger one would fail before reaching us). */
export const MEDIA_BYTES_MAX = 4 * 1024 * 1024;

export type Result<T> = T | { error: string; status: number; code?: string; problems?: PublishProblem[] };
export const isError = <T,>(r: Result<T>): r is { error: string; status: number; code?: string; problems?: PublishProblem[] } =>
  !!r && typeof r === "object" && "error" in r && "status" in r;

/** Where the Hub's photos live (the only photos a page may show). */
export const mediaOrigin = (): string => (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/* Addresses the site already uses for its own screens — a built page there
   would never be seen, or would hide the screen. */
export const RESERVED_SLUGS = new Set([
  "api", "product", "products", "search", "choose-region", "admin", "_next", "static", "public",
  "sitemap", "robots", "favicon", "en", "ar", "zh",
]);

/** 403 unless the account belongs to the company the site is for. */
export async function requireHostTenant(auth: ServerAuthContext): Promise<{ error: string; status: number } | null> {
  const host = await websiteTenantId();
  if (!host || auth.tenant_id !== host) return { error: "Only the company's own people build its website.", status: 403 };
  return null;
}

/** The super admins, and whoever is given «Website Publish» (owner's pick). */
export async function canPublish(auth: ServerAuthContext): Promise<boolean> {
  if (auth.viewing_as) return false;
  if (auth.is_super_admin) return true;
  return (await requireModuleAccess(auth, WEBSITE_PUBLISH_MODULE)) === null;
}

interface PageRow {
  id: string; slug: string; name: string; title: string | null; description: string | null;
  draft: unknown; published: unknown; version: number; published_at: string | null; published_by: string | null;
  draft_updated_at: string | null; draft_updated_by: string | null; updated_at: string | null;
}
const PAGE_COLUMNS = "id, slug, name, title, description, draft, published, version, published_at, published_by, draft_updated_at, draft_updated_by, updated_at";

export interface BuilderPage {
  slug: string; name: string; title: string | null;
  /** The draft to edit: the saved draft, else the published copy, else empty. */
  draft: PageDoc;
  /** The draft differs from what the site shows (or was never published). */
  changed: boolean;
  version: number;
  publishedAt: string | null;
  draftUpdatedAt: string | null;
  /** Sections built by the old editor (shown until this page is published). */
  legacySections: number;
}

async function pageRow(slug: string): Promise<PageRow | null> {
  if (!SLUG_RE.test(slug)) return null;
  const { data, error } = await supabaseServer.from("pages").select(PAGE_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`website page: ${error.message}`);
  return (data as PageRow | null) ?? null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function getBuilderPage(slug: string): Promise<BuilderPage | null> {
  const row = await pageRow(slug);
  if (!row) return null;
  const origin = mediaOrigin();
  const published = row.published ? cleanPageDoc(row.published, origin) : null;
  const draft = row.draft ? cleanPageDoc(row.draft, origin) : published ?? emptyDoc();
  const { count, error } = await supabaseServer.from("sections").select("id", { count: "exact", head: true }).eq("page_id", row.id).eq("visible", true);
  if (error) throw new Error(`website sections: ${error.message}`);
  return {
    slug: row.slug, name: row.name, title: row.title,
    draft,
    changed: !published || !same(draft, published),
    version: row.version ?? 0,
    publishedAt: row.published_at,
    draftUpdatedAt: row.draft_updated_at,
    legacySections: count ?? 0,
  };
}

/** Save the draft. `expected` is the draftUpdatedAt the editor loaded; a
 *  different one in the database means someone saved in between → 409. */
export async function saveDraft(slug: string, raw: unknown, expected: string | null, accountId: string | null): Promise<Result<{ draftUpdatedAt: string; draft: PageDoc }>> {
  const row = await pageRow(slug);
  if (!row) return { error: "No such page.", status: 404 };
  const draft = cleanPageDoc(raw, mediaOrigin());
  const now = new Date().toISOString();
  let q = supabaseServer.from("pages").update({ draft, draft_updated_at: now, draft_updated_by: accountId }).eq("id", row.id);
  q = expected ? q.eq("draft_updated_at", expected) : q.is("draft_updated_at", null);
  const { data, error } = await q.select("draft_updated_at");
  if (error) throw new Error(`website page: ${error.message}`);
  if (!data || data.length === 0) return { error: "Someone else changed this page. Reload it to see their changes.", status: 409, code: "conflict" };
  return { draftUpdatedAt: now, draft };
}

/** Publish the draft: it becomes what the site shows, as the next version. */
export async function publishPage(slug: string, accountId: string): Promise<Result<{ version: number; publishedAt: string }>> {
  const row = await pageRow(slug);
  if (!row) return { error: "No such page.", status: 404 };
  const origin = mediaOrigin();
  const doc = cleanPageDoc(row.draft ?? row.published ?? emptyDoc(), origin);
  const problems = publishProblems(doc);
  if (problems.length) return { error: "Some sections are not ready to publish.", status: 400, code: "not_ready", problems };
  const version = (row.version ?? 0) + 1;
  const publishedAt = new Date().toISOString();
  /* The version row first: (page_id, version) is unique, so two people
     publishing at once cannot both take the same number. */
  const { error: vErr } = await supabaseServer.from("page_versions").insert({ page_id: row.id, version, doc, published_by: accountId, published_at: publishedAt });
  if (vErr) {
    if (vErr.code === "23505") return { error: "Someone else published this page just now. Reload it.", status: 409, code: "conflict" };
    throw new Error(`website versions: ${vErr.message}`);
  }
  const { data, error } = await supabaseServer.from("pages")
    .update({ published: doc, version, published_at: publishedAt, published_by: accountId, draft: doc })
    .eq("id", row.id).eq("version", row.version ?? 0).select("id");
  if (error || !data || data.length === 0) {
    await supabaseServer.from("page_versions").delete().eq("page_id", row.id).eq("version", version);
    if (error) throw new Error(`website page: ${error.message}`);
    return { error: "Someone else published this page just now. Reload it.", status: 409, code: "conflict" };
  }
  revalidateWebsite([`page:${row.slug}`]);
  return { version, publishedAt };
}

export interface PageVersion { version: number; publishedAt: string; publishedBy: string | null }

export async function listVersions(slug: string): Promise<PageVersion[] | null> {
  const row = await pageRow(slug);
  if (!row) return null;
  const { data, error } = await supabaseServer.from("page_versions").select("version, published_at, published_by")
    .eq("page_id", row.id).order("version", { ascending: false }).limit(50);
  if (error) throw new Error(`website versions: ${error.message}`);
  const rows = (data ?? []) as Array<{ version: number; published_at: string; published_by: string | null }>;
  const ids = [...new Set(rows.map((r) => r.published_by).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: accs, error: aErr } = await supabaseServer.from("accounts").select("id, username").in("id", ids);
    if (aErr) throw new Error(`accounts: ${aErr.message}`);
    for (const a of (accs ?? []) as Array<{ id: string; username: string | null }>) names.set(a.id, a.username ?? "");
  }
  return rows.map((r) => ({ version: r.version, publishedAt: r.published_at, publishedBy: r.published_by ? names.get(r.published_by) || null : null }));
}

/** Put an old version back into the draft (it goes live only when published). */
export async function restoreVersion(slug: string, version: number, expected: string | null, accountId: string): Promise<Result<{ draftUpdatedAt: string; draft: PageDoc }>> {
  const row = await pageRow(slug);
  if (!row) return { error: "No such page.", status: 404 };
  const { data, error } = await supabaseServer.from("page_versions").select("doc").eq("page_id", row.id).eq("version", version).maybeSingle();
  if (error) throw new Error(`website versions: ${error.message}`);
  if (!data) return { error: "No such version.", status: 404 };
  return saveDraft(slug, (data as { doc: unknown }).doc, expected, accountId);
}

/** A new page (not yet on the site until it is published). */
export async function createPage(input: { name: unknown; slug: unknown }): Promise<Result<{ slug: string }>> {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  if (!name) return { error: "Give the page a name.", status: 400, code: "name" };
  if (!SLUG_RE.test(slug) || slug.length > 60) return { error: "The address may use small letters, digits and dashes only.", status: 400, code: "slug" };
  if (RESERVED_SLUGS.has(slug)) return { error: "The site already uses this address.", status: 400, code: "reserved" };
  const { error } = await supabaseServer.from("pages").insert({ name, slug, title: name, draft: emptyDoc() });
  if (error) {
    if (error.code === "23505") return { error: "A page with this address exists.", status: 409, code: "exists" };
    throw new Error(`website page: ${error.message}`);
  }
  return { slug };
}

/* ── Photos ─────────────────────────────────────────────────────────────── */

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

/** The photo type its first bytes say, or null (a renamed file is refused). */
export function sniffPhoto(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (b.length >= 12 && ascii(4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(8, 12))) return "image/avif";
  return null;
}

export async function uploadPhoto(bytes: Uint8Array, declared: string): Promise<Result<{ url: string }>> {
  if (!bytes.length) return { error: "The file is empty.", status: 400, code: "empty" };
  if (bytes.length > MEDIA_BYTES_MAX) return { error: "Photos may be 4 MB at most.", status: 400, code: "too_big" };
  const type = sniffPhoto(bytes);
  if (!type || (declared && declared.split(";")[0].trim().toLowerCase() !== type && !(declared === "image/jpg" && type === "image/jpeg"))) {
    return { error: "Only JPEG, PNG, WebP or AVIF photos.", status: 400, code: "type" };
  }
  const d = new Date();
  const path = `pages/${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${PHOTO_TYPES[type]}`;
  const { error } = await supabaseServer.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: type, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`website media: ${error.message}`);
  const { data } = supabaseServer.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/* ── Draft preview on the site ──────────────────────────────────────────── */

/** A link that opens the page's DRAFT on the site for 10 minutes: signed
 *  with the bridge key, which the site checks before it shows a draft. null
 *  while the bridge is not configured. */
export function previewLink(slug: string, now = Date.now(), lang = "en"): string | null {
  const key = (process.env.WEBSITE_BRIDGE_KEY ?? "").trim();
  const refresh = (process.env.WEBSITE_REVALIDATE_URL ?? "").trim();
  if (!key || !refresh || !SLUG_RE.test(slug)) return null;
  let origin: string;
  try {
    origin = new URL(refresh).origin;
  } catch {
    return null;
  }
  const exp = Math.floor(now / 1000) + 600;
  const sig = crypto.createHmac("sha256", key).update(`preview:${slug}:${exp}`).digest("hex");
  /* The language only picks which language of the same draft opens. */
  const l = /^[a-z]{2}$/.test(lang) ? lang : "en";
  return `${origin}/api/preview?slug=${encodeURIComponent(slug)}&exp=${exp}&sig=${sig}&lang=${l}`;
}
