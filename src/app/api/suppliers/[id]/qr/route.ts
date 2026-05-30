import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/suppliers/[id]/qr — register a communication QR code.

   QR codes are governed media (supplier_media rows, media_class='qr_code').
   The image is uploaded first via /api/storage/upload; this route records the
   governed metadata: category, label, visibility tier, optional linked
   contact, uploaded_by. Whitelisted, tenant + supplier scoped, Suppliers-module
   gated, blocked while viewing-as.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const QR_CATEGORIES = new Set([
  "sales", "support", "finance", "boss", "logistics", "group", "showroom", "factory",
]);
const VISIBILITY_TIERS = new Set([
  "public", "internal", "procurement", "finance", "management",
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const fileUrl = typeof body.file_url === "string" ? body.file_url.trim() : "";
  if (!fileUrl) return NextResponse.json({ error: "file_url is required" }, { status: 400 });

  const category = typeof body.category === "string" ? body.category : "";
  if (!QR_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid QR category" }, { status: 400 });
  }
  const visibility = typeof body.visibility === "string" ? body.visibility : "internal";
  if (!VISIBILITY_TIERS.has(visibility)) {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  // Verify the supplier belongs to this tenant.
  const { data: sup } = await supabaseServer
    .from("contacts")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tid)
    .eq("contact_type", "supplier")
    .maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  // If a contact is linked, verify it belongs to this supplier + tenant.
  let contactId: string | null = null;
  if (typeof body.contact_id === "string" && body.contact_id) {
    const { data: cp } = await supabaseServer
      .from("supplier_contact_persons")
      .select("id")
      .eq("id", body.contact_id)
      .eq("tenant_id", tid)
      .eq("supplier_id", id)
      .maybeSingle();
    if (!cp) return NextResponse.json({ error: "Linked contact not found" }, { status: 400 });
    contactId = body.contact_id;
  }

  const { data, error } = await supabaseServer
    .from("supplier_media")
    .insert({
      tenant_id: tid,
      supplier_id: id,
      contact_id: contactId,
      media_class: "qr_code",
      category,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : null,
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      visibility,
      storage_bucket: typeof body.storage_bucket === "string" ? body.storage_bucket : null,
      storage_path: typeof body.storage_path === "string" ? body.storage_path : null,
      file_url: fileUrl,
      preview_url: typeof body.preview_url === "string" ? body.preview_url : fileUrl,
      is_downloadable: body.is_downloadable === false ? false : true,
      lifecycle_status: "active",
      uploaded_by: auth.account_id ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
