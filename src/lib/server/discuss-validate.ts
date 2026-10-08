import "server-only";

import { supabaseServer } from "./supabase-server";

/* ---------------------------------------------------------------------------
   discuss-validate — server-side input rules for Discuss writes.

   /api/discuss/mutate used to persist whatever the browser sent: any message
   kind (including "system"), any body length, and a free-form metadata blob
   whose `attachments[].file_path` / `voice.path` the media resolver would
   later fetch on the sender's behalf. Everything below is an ALLOWLIST — an
   unknown key or shape is dropped, never passed through — for the same
   reason discuss-serialize builds its client projection from an allowlist.
   --------------------------------------------------------------------------- */

export const DISCUSS_BODY_MAX = 10_000;

/** Kinds a client may send. `system` is server-authored only. */
export const DISCUSS_CLIENT_KINDS = ["text", "image", "file", "voice"] as const;
export type DiscussClientKind = (typeof DISCUSS_CLIENT_KINDS)[number];

export function isClientKind(v: unknown): v is DiscussClientKind {
  return typeof v === "string" && (DISCUSS_CLIENT_KINDS as readonly string[]).includes(v);
}

/* Object names written by uploadDiscussAttachment / uploadDiscussVoice:
   `<epoch-ms>_<random>.<ext>`, optionally under the caller's `<tenant>/`
   prefix (the upload route prepends one on tenant-scoped buckets; the two
   Discuss buckets are not tenant-scoped today, so both shapes are accepted).
   Anything else — another tenant's prefix, a nested path, traversal, a
   legacy public URL — is refused, so a crafted message cannot point the
   media resolver at an object the sender did not upload through Discuss. */
const OBJECT_NAME = /^\d{10,16}_[a-z0-9]{1,16}\.[a-z0-9]{1,8}$/;

export function isOwnDiscussUploadPath(path: unknown, tenantId: string | null | undefined): path is string {
  if (typeof path !== "string" || path.length > 200) return false;
  const slash = path.indexOf("/");
  if (slash === -1) return OBJECT_NAME.test(path);
  if (!tenantId) return false;
  const prefix = path.slice(0, slash);
  const rest = path.slice(slash + 1);
  return prefix === tenantId && OBJECT_NAME.test(rest);
}

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" ? v.slice(0, max) : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

export type MetadataVerdict =
  | { ok: true; metadata: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Validate + rebuild client-supplied message metadata for storage.
 * Keeps only: attachments (≤10, own upload paths in discuss-media),
 * voice (own upload path in discuss-voice), mentions, products,
 * link_preview. Returns an error (rather than silently dropping) when a
 * media reference is present but invalid, so a broken send is visible.
 */
export function sanitizeMessageMetadataForStorage(
  raw: unknown,
  tenantId: string | null | undefined,
): MetadataVerdict {
  if (raw == null) return { ok: true, metadata: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid metadata" };
  const m = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (m.attachments !== undefined) {
    if (!Array.isArray(m.attachments) || m.attachments.length > 10) {
      return { ok: false, error: "Invalid attachments" };
    }
    const list: Array<Record<string, unknown>> = [];
    for (const a of m.attachments as unknown[]) {
      if (!a || typeof a !== "object") return { ok: false, error: "Invalid attachment" };
      const r = a as Record<string, unknown>;
      if (!isOwnDiscussUploadPath(r.file_path, tenantId)) {
        return { ok: false, error: "Invalid attachment path" };
      }
      list.push({
        name: str(r.name, 255) || "attachment",
        file_path: r.file_path,
        size: num(r.size) ?? 0,
        type: str(r.type, 120) || "application/octet-stream",
      });
    }
    if (list.length) out.attachments = list;
  }

  if (m.voice !== undefined && m.voice !== null) {
    if (typeof m.voice !== "object" || Array.isArray(m.voice)) return { ok: false, error: "Invalid voice" };
    const v = m.voice as Record<string, unknown>;
    if (v.bucket !== undefined && v.bucket !== "discuss-voice") return { ok: false, error: "Invalid voice bucket" };
    if (!isOwnDiscussUploadPath(v.path, tenantId)) return { ok: false, error: "Invalid voice path" };
    const waveform = Array.isArray(v.waveform)
      ? (v.waveform as unknown[])
          .slice(0, 128)
          .map((n) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0))
      : [];
    out.voice = {
      bucket: "discuss-voice",
      path: v.path,
      type: str(v.type, 120) || "audio/webm",
      size: num(v.size) ?? 0,
      duration_ms: Math.min(num(v.duration_ms) ?? 0, 60 * 60 * 1000),
      waveform,
    };
  }

  if (Array.isArray(m.mentions)) {
    const mentions = (m.mentions as unknown[])
      .slice(0, 50)
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        account_id: str(x.account_id, 64) ?? "",
        username: str(x.username, 120) ?? "",
        offset: num(x.offset) ?? 0,
        length: num(x.length) ?? 0,
      }))
      .filter((x) => x.account_id);
    if (mentions.length) out.mentions = mentions;
  }

  if (Array.isArray(m.products)) {
    const products = (m.products as unknown[])
      .slice(0, 20)
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        id: str(x.id, 64) ?? "",
        name: str(x.name, 500) ?? "",
        slug: str(x.slug, 200) ?? "",
        image: str(x.image, 2048),
      }))
      .filter((x) => x.id);
    if (products.length) out.products = products;
  }

  if (m.link_preview && typeof m.link_preview === "object" && !Array.isArray(m.link_preview)) {
    const l = m.link_preview as Record<string, unknown>;
    const url = str(l.url, 2048);
    if (url && /^https?:\/\//i.test(url)) {
      out.link_preview = {
        url,
        title: str(l.title, 300),
        description: str(l.description, 1000),
        image: str(l.image, 2048),
        site_name: str(l.site_name, 200),
      };
    }
  }

  return { ok: true, metadata: out };
}

/**
 * Of `ids`, the accounts a caller in `tenantId` may add to a conversation:
 * active, internal accounts in the SAME tenant — exactly the population the
 * /api/discuss/recipients picker offers. Anything else is dropped.
 */
export async function filterTenantAccounts(
  ids: unknown,
  tenantId: string | null | undefined,
): Promise<string[]> {
  if (!Array.isArray(ids)) return [];
  const clean = Array.from(
    new Set(ids.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x))),
  ).slice(0, 500);
  if (clean.length === 0) return [];
  let q = supabaseServer
    .from("accounts")
    .select("id")
    .in("id", clean)
    .eq("status", "active")
    .eq("user_type", "internal");
  /* Same scope as the recipients picker: a tenant-less session (platform
     Super Admin) is not narrowed; everyone else only reaches their tenant. */
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}
