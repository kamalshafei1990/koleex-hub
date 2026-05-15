import "server-only";

/* ---------------------------------------------------------------------------
   /api/quotations/saved-assets

   Per-tenant "saved" stamp + signature for the Quotation editor.

   GET   — returns { stampUrl, signatureUrl } | null per slot. Any
           authenticated user with Quotations module access can READ
           (the assets are baked into every quote anyway).

   POST  — multipart upload. body: kind=stamp|signature, file=<image>.
           Super-admin only. Replaces the existing asset for this
           tenant at a fixed path so subsequent reads return the new
           URL automatically.

   DELETE — body: { kind: "stamp" | "signature" }. Super-admin only.

   Storage layout:
     media/quotation-assets/{tenant_id}/stamp.{ext}
     media/quotation-assets/{tenant_id}/signature.{ext}

   The bucket's public-read policy already lets the printed PDF and
   the editor render the image without a signed URL. The endpoint is
   the only write path so the bucket policy can stay read-only for
   anon users.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const BUCKET = "media";
type Kind = "stamp" | "signature";

function pathFor(tenantId: string, kind: Kind, ext: string): string {
  return `quotation-assets/${tenantId}/${kind}.${ext.replace(/^\./, "")}`;
}

function publicUrlFor(path: string): string {
  return supabaseServer.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Look up the most-recent saved asset of either kind by listing the
 *  tenant's folder and finding the file whose name starts with the
 *  kind (handles png/jpg/jpeg/webp extensions transparently). */
async function resolveSaved(
  tenantId: string,
): Promise<{ stampUrl: string | null; signatureUrl: string | null }> {
  const { data, error } = await supabaseServer.storage
    .from(BUCKET)
    .list(`quotation-assets/${tenantId}`, { limit: 100 });
  if (error || !data) return { stampUrl: null, signatureUrl: null };
  const find = (kind: Kind): string | null => {
    const match = data
      .filter((o) => o.name.startsWith(`${kind}.`))
      /* Most-recent first — Supabase Storage sometimes leaves stale
         siblings around when the extension changes between upserts.
         Listing is alphabetical, so resort by updated_at when present. */
      .sort((a, b) => {
        const ad = (a as { updated_at?: string }).updated_at ?? "";
        const bd = (b as { updated_at?: string }).updated_at ?? "";
        return bd.localeCompare(ad);
      })[0];
    if (!match) return null;
    return publicUrlFor(`quotation-assets/${tenantId}/${match.name}`);
  };
  return { stampUrl: find("stamp"), signatureUrl: find("signature") };
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;

  const result = await resolveSaved(auth.tenant_id);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Gate to super-admin only — these assets are tenant-wide and a
     regular sales rep should not be able to replace the CEO's
     signature on every future quote. */
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super-admins can manage saved stamp / signature." },
      { status: 403 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form body." }, { status: 400 });
  }
  const kind = form.get("kind");
  const file = form.get("file");
  if (kind !== "stamp" && kind !== "signature") {
    return NextResponse.json(
      { error: 'kind must be "stamp" or "signature".' },
      { status: 400 },
    );
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  /* Sniff a safe extension. File names can be anything (Safari sends
     "image.jpg" for a screenshot pasted from clipboard), so we map
     the MIME type to one of png / jpg / webp and reject the rest. */
  const mime = (file as File).type || "image/png";
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/jpeg" || mime === "image/jpg"
        ? "jpg"
        : mime === "image/webp"
          ? "webp"
          : null;
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported image type: ${mime}` },
      { status: 415 },
    );
  }

  /* Clean up any stale siblings (different extensions) — `list()`
     would otherwise return both and force resolveSaved to pick one. */
  const folder = `quotation-assets/${auth.tenant_id}`;
  const { data: existing } = await supabaseServer.storage
    .from(BUCKET)
    .list(folder, { limit: 100 });
  const stale = (existing ?? [])
    .filter((o) => o.name.startsWith(`${kind}.`) && o.name !== `${kind}.${ext}`)
    .map((o) => `${folder}/${o.name}`);
  if (stale.length > 0) {
    await supabaseServer.storage.from(BUCKET).remove(stale);
  }

  const path = pathFor(auth.tenant_id, kind, ext);
  const bytes = new Uint8Array(await (file as Blob).arrayBuffer());
  const { error: upErr } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: mime,
      upsert: true,
      cacheControl: "3600",
    });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  /* Append a cache-buster query-string so the editor immediately
     shows the new asset rather than a cached older copy. */
  const url = `${publicUrlFor(path)}?v=${Date.now()}`;
  return NextResponse.json({ kind, url });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super-admins can manage saved stamp / signature." },
      { status: 403 },
    );
  }
  const body = (await req.json().catch(() => null)) as
    | { kind?: Kind }
    | null;
  if (!body || (body.kind !== "stamp" && body.kind !== "signature")) {
    return NextResponse.json(
      { error: 'Missing "kind" — "stamp" or "signature".' },
      { status: 400 },
    );
  }
  const folder = `quotation-assets/${auth.tenant_id}`;
  const { data: existing } = await supabaseServer.storage
    .from(BUCKET)
    .list(folder, { limit: 100 });
  const targets = (existing ?? [])
    .filter((o) => o.name.startsWith(`${body.kind}.`))
    .map((o) => `${folder}/${o.name}`);
  if (targets.length > 0) {
    await supabaseServer.storage.from(BUCKET).remove(targets);
  }
  return NextResponse.json({ ok: true });
}
