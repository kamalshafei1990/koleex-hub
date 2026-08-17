import "server-only";

/* ---------------------------------------------------------------------------
   /api/invitations/licence — the business licence scan, page 3 of every letter.

   POST   — multipart, field `file`. Super-admin only. Uploaded once and
            replaced only when the licence itself changes (new address, new
            capital, renewal).
   DELETE — super-admin only.

   Storage: media/invitation-assets/{tenant_id}/licence.{ext}

   The `media` bucket is public-read, matching the stamp/signature. That is
   deliberate: the licence is a public registration document, it is handed to
   consulates as part of the letter, and the printed PDF has to render it
   without a signed URL round-trip inside headless Chromium.

   The resulting URL is written straight onto invitation_settings.licence_doc_url
   so a letter never has to list a Storage folder while rendering.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const BUCKET = "media";

/** Map a MIME type to a safe extension. File names are attacker-controlled
 *  (and Safari sends "image.jpg" for clipboard pastes), so the type decides. */
function extFor(mime: string): string | null {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  return null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super-admins can replace the business licence." },
      { status: 403 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form body." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Licence file must be under 10 MB." }, { status: 413 });
  }

  const mime = (file as File).type || "image/png";
  const ext = extFor(mime);
  if (!ext) {
    return NextResponse.json({ error: `Unsupported file type: ${mime}` }, { status: 415 });
  }

  const folder = `invitation-assets/${auth.tenant_id}`;
  const path = `${folder}/licence.${ext}`;

  /* Remove siblings with a different extension first. Otherwise a JPG
     replacing a PNG leaves both in the folder and the stale one can win a
     later listing. */
  const { data: existing } = await supabaseServer.storage.from(BUCKET).list(folder, { limit: 50 });
  const stale = (existing ?? [])
    .filter((o) => o.name.startsWith("licence.") && o.name !== `licence.${ext}`)
    .map((o) => `${folder}/${o.name}`);
  if (stale.length > 0) {
    await supabaseServer.storage.from(BUCKET).remove(stale);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upErr) {
    console.error("[api/invitations/licence] upload:", upErr.message);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  /* Cache-bust: the path is fixed, so a replacement would otherwise keep
     serving the old image from the CDN and every future letter would carry
     the superseded licence. */
  const base = supabaseServer.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const url = `${base}?v=${Date.now()}`;

  const { error: saveErr } = await supabaseServer
    .from("invitation_settings")
    .upsert(
      { tenant_id: auth.tenant_id, licence_doc_url: url, updated_by: auth.account_id },
      { onConflict: "tenant_id" },
    );
  if (saveErr) {
    console.error("[api/invitations/licence] save url:", saveErr.message);
    return NextResponse.json({ error: "Uploaded, but failed to save." }, { status: 500 });
  }

  return NextResponse.json({ licenceDocUrl: url });
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super-admins can remove the business licence." },
      { status: 403 },
    );
  }

  const folder = `invitation-assets/${auth.tenant_id}`;
  const { data: existing } = await supabaseServer.storage.from(BUCKET).list(folder, { limit: 50 });
  const paths = (existing ?? [])
    .filter((o) => o.name.startsWith("licence."))
    .map((o) => `${folder}/${o.name}`);
  if (paths.length > 0) {
    await supabaseServer.storage.from(BUCKET).remove(paths);
  }

  await supabaseServer
    .from("invitation_settings")
    .upsert(
      { tenant_id: auth.tenant_id, licence_doc_url: null, updated_by: auth.account_id },
      { onConflict: "tenant_id" },
    );

  return NextResponse.json({ ok: true });
}
