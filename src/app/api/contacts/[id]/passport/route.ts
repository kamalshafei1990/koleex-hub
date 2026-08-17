import "server-only";

/* ---------------------------------------------------------------------------
   /api/contacts/[id]/passport — passport data for one contact.

   GET  — the passport fields plus a short-lived signed URL for the scan.
   PUT  — save the fields back onto the contact (JSON body).
   POST — multipart, field `file`: upload/replace the scan.
   DELETE — remove the scan (the typed fields stay).

   ── Access ────────────────────────────────────────────────────────────────
   Gated on the Customers module, the same gate that already exposes
   contacts.passport_no through the directory API. The scan is held to
   EXACTLY that level, following the rule this codebase already states for
   employees (src/lib/server/sensitive-columns.ts): "the number is private,
   so the image of the document carrying it cannot be less so." Here the
   converse applies — the number is visible to the Customers module because
   the invitation letter prints it, so gating the image higher would be
   theatre, not security: anyone blocked from the image can read the number
   from the field beside it.

   The real protection is that `passport-scans` is a PRIVATE bucket. Nothing
   is publicly addressable; every read is a signed URL minted here, for this
   caller, expiring in minutes.

   ── Weight ────────────────────────────────────────────────────────────────
   The scan itself never enters a contacts row (~3 MB each; 6000 contacts
   would be ~18 GB of row data). The row holds the object path only, and the
   five passport columns stay OUT of SLIM_LIST_COLUMNS so the directory list
   is unchanged.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const BUCKET = "passport-scans";
/** Long enough to open and read the image, short enough that a copied URL
 *  is useless by the time it is shared. */
const SIGNED_URL_TTL_SECONDS = 300;

const COLUMNS =
  "id, full_name, legal_name, gender, birthday, place_of_birth, nationality, " +
  "nationality_code, country, country_code, company_name, company, position, " +
  "passport_no, passport_issue_date, passport_expiry_date, " +
  "passport_issuing_authority, passport_doc_path, passport_mrz";

type Ctx = { params: Promise<{ id: string }> };

function extFor(mime: string): string | null {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  if (mime === "application/pdf") return "pdf";
  return null;
}

/** Load the row and confirm it belongs to the caller's tenant. Returns the
 *  row, or a response to bail out with. */
async function loadScoped(
  tenantId: string,
  id: string,
): Promise<{ row: Record<string, unknown> } | { deny: NextResponse }> {
  const { data, error } = await supabaseServer
    .from("contacts")
    .select(COLUMNS as "*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) {
    console.error("[api/contacts/passport] fetch:", error.message);
    return { deny: NextResponse.json({ error: "Failed to load contact" }, { status: 500 }) };
  }
  if (!data) {
    return { deny: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { row: data as Record<string, unknown> };
}

async function signScan(path: unknown): Promise<string | null> {
  if (typeof path !== "string" || !path) return null;
  const { data, error } = await supabaseServer.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    /* A missing object is normal after a manual Storage cleanup — the row
       still points at it. Don't fail the whole read for that. */
    console.warn("[api/contacts/passport] sign:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

function toApi(row: Record<string, unknown>, scanUrl: string | null) {
  const s = (k: string) => (typeof row[k] === "string" && row[k] ? (row[k] as string) : null);
  return {
    id: row.id as string,
    /* The invitation prints the passport spelling. legal_name is where that
       belongs; full_name is the friendly directory name and is only a
       fallback so the form is never blank. */
    name: s("legal_name") ?? s("full_name"),
    fullName: s("full_name"),
    gender: s("gender"),
    dob: s("birthday"),
    placeOfBirth: s("place_of_birth"),
    nationality: s("nationality"),
    nationalityCode: s("nationality_code"),
    country: s("country"),
    countryCode: s("country_code"),
    company: s("company_name") ?? s("company"),
    position: s("position"),
    passportNo: s("passport_no"),
    passportIssue: s("passport_issue_date"),
    passportExpiry: s("passport_expiry_date"),
    issuingAuthority: s("passport_issuing_authority"),
    mrz: s("passport_mrz"),
    hasScan: typeof row.passport_doc_path === "string" && !!row.passport_doc_path,
    scanUrl,
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const found = await loadScoped(auth.tenant_id, id);
  if ("deny" in found) return found.deny;

  const scanUrl = await signScan(found.row.passport_doc_path);
  return NextResponse.json(toApi(found.row, scanUrl), {
    /* Never cache: the body carries a signed URL with a 5-minute life, and
       a cached copy would hand out an already-dead link. */
    headers: { "Cache-Control": "no-store" },
  });
}

/** API key → contacts column. Anything else in the body is ignored. */
const WRITABLE: Record<string, string> = {
  name:             "legal_name",
  gender:           "gender",
  dob:              "birthday",
  placeOfBirth:     "place_of_birth",
  nationality:      "nationality",
  nationalityCode:  "nationality_code",
  passportNo:       "passport_no",
  passportIssue:    "passport_issue_date",
  passportExpiry:   "passport_expiry_date",
  issuingAuthority: "passport_issuing_authority",
  mrz:              "passport_mrz",
};

const DATE_COLUMNS = new Set(["birthday", "passport_issue_date", "passport_expiry_date"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(req: Request, ctx: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const found = await loadScoped(auth.tenant_id, id);
  if ("deny" in found) return found.deny;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const [apiKey, column] of Object.entries(WRITABLE)) {
    if (!(apiKey in body)) continue;
    const v = body[apiKey];
    if (v === null || v === "") {
      patch[column] = null;
      continue;
    }
    if (typeof v !== "string") {
      return NextResponse.json({ error: `${apiKey} must be a string.` }, { status: 400 });
    }
    const value = v.trim();
    /* Postgres would reject a malformed date with a 500-shaped error; catch
       it here so the form gets a field-level message instead. */
    if (DATE_COLUMNS.has(column) && !ISO_DATE.test(value)) {
      return NextResponse.json(
        { error: `${apiKey} must be a date in YYYY-MM-DD form.` },
        { status: 400 },
      );
    }
    if (column === "gender" && value !== "male" && value !== "female") {
      return NextResponse.json({ error: "gender must be male or female." }, { status: 400 });
    }
    patch[column] = value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select(COLUMNS as "*")
    .single();

  if (error) {
    console.error("[api/contacts/passport] save:", error.message);
    return NextResponse.json({ error: "Failed to save passport data" }, { status: 500 });
  }

  const row = data as Record<string, unknown>;
  return NextResponse.json(toApi(row, await signScan(row.passport_doc_path)), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const found = await loadScoped(auth.tenant_id, id);
  if ("deny" in found) return found.deny;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form body." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Scan must be under 10 MB." }, { status: 413 });
  }

  const mime = (file as File).type || "image/jpeg";
  const ext = extFor(mime);
  if (!ext) {
    return NextResponse.json({ error: `Unsupported file type: ${mime}` }, { status: 415 });
  }

  /* Tenant-scoped folder so a signed URL can never be minted across tenants
     even if an id leaked. */
  const folder = `${auth.tenant_id}/${id}`;
  const path = `${folder}/passport.${ext}`;

  const { data: existing } = await supabaseServer.storage.from(BUCKET).list(folder, { limit: 50 });
  const stale = (existing ?? [])
    .filter((o) => o.name.startsWith("passport.") && o.name !== `passport.${ext}`)
    .map((o) => `${folder}/${o.name}`);
  if (stale.length > 0) await supabaseServer.storage.from(BUCKET).remove(stale);

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upErr) {
    console.error("[api/contacts/passport] upload:", upErr.message);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  const { data, error } = await supabaseServer
    .from("contacts")
    .update({ passport_doc_path: path })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select(COLUMNS as "*")
    .single();

  if (error) {
    console.error("[api/contacts/passport] save path:", error.message);
    return NextResponse.json({ error: "Uploaded, but failed to save." }, { status: 500 });
  }

  const row = data as Record<string, unknown>;
  return NextResponse.json(toApi(row, await signScan(row.passport_doc_path)), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const found = await loadScoped(auth.tenant_id, id);
  if ("deny" in found) return found.deny;

  const path = found.row.passport_doc_path;
  if (typeof path === "string" && path) {
    await supabaseServer.storage.from(BUCKET).remove([path]);
  }

  await supabaseServer
    .from("contacts")
    .update({ passport_doc_path: null })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);

  return NextResponse.json({ ok: true });
}
