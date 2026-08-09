import "server-only";

/* POST /api/support/membership-request

   The "Request an Account" tab on the sign-in screen.

   WHY THIS ROUTE HAD TO BE BUILT. The form wrote to `membership_requests`
   straight from the browser. That table is service_role-only, so every submit
   since the RLS lockdown has been rejected — and the client caught the
   failure, stashed the request in the visitor's OWN localStorage, and showed
   the success panel anyway. The person was told "a Super Admin will review
   your request shortly" and nobody ever saw it. The newest row in the table is
   from April.

   Public, because an applicant has no account by definition — so the same
   guards as the sign-in help route: per-IP rate limit counted on SUCCESS only,
   every field length-capped, the relationship an allow-list. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { adminRecipients } from "@/lib/server/admin-recipients";

/* Ids match RELATIONSHIPS in AdminAuth — changing one without the other
   silently files every request as "Other". */
const RELATIONSHIPS: Record<string, string> = {
  new_prospect: "New to Koleex",
  existing_customer: "Existing customer",
  supplier: "Supplier",
  partner: "Partner",
  other: "Other",
};

/* Kept in step with PARTNER_TYPES in AdminAuth — anything outside the list is
   filed as "other" rather than trusted. */
const PARTNER_TYPES = new Set(["distributor", "agent", "service", "other"]);

const MAX = {
  name: 120, email: 160, phone: 32, company: 160,
  jobTitle: 120, message: 2000, code: 60,
  contact: 120, territory: 120, supplies: 200, website: 200,
} as const;

/* Proof documents. The bucket is private, has no anon policy, and is read
   only through short-lived signed URLs minted for a reviewer.

   The type is decided by the first bytes of the file, never by its name or by
   the Content-Type the browser volunteered — both are attacker-controlled on a
   public endpoint. Storage enforces the same list a second time via the
   bucket's allowed_mime_types. */
const DOCS_BUCKET = "membership-docs";
const MAX_DOCS = 2;
const MAX_DOC_BYTES = 4 * 1024 * 1024;

const MAGIC: Array<{ ext: string; mime: string; test: (b: Uint8Array) => boolean }> = [
  { ext: "jpg",  mime: "image/jpeg",       test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png",  mime: "image/png",        test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "pdf",  mime: "application/pdf",  test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  { ext: "webp", mime: "image/webp",       test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
];

function sniff(bytes: Uint8Array): { ext: string; mime: string } | null {
  return MAGIC.find((m) => m.test(bytes)) ?? null;
}

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;
type Hits = { count: number; resetAt: number };
const g = globalThis as unknown as { __kxJoinRate?: Map<string, Hits> };
const rate: Map<string, Hits> = (g.__kxJoinRate ??= new Map());

function overLimit(ip: string): boolean {
  const hit = rate.get(ip);
  return hit != null && Date.now() <= hit.resetAt && hit.count >= MAX_PER_WINDOW;
}
function recordSend(ip: string): void {
  const now = Date.now();
  const hit = rate.get(ip);
  if (!hit || now > hit.resetAt) rate.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else hit.count += 1;
  if (rate.size > 5_000) for (const [k, v] of rate) if (now > v.resetAt) rate.delete(k);
}

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || "unknown";
  if (overLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  /* Multipart when documents are attached, JSON when they are not. Keeping
     both means the form is one request either way: no upload endpoint that
     can leave orphan files behind if the visitor closes the tab before
     submitting, and one rate-limit bucket rather than two. */
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  let files: File[] = [];
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Could not read the form." }, { status: 400 });
    }
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") body[k] = v;
      else if (k === "documents") files.push(v);
    }
    if (files.length > MAX_DOCS) files = files.slice(0, MAX_DOCS);
  } else {
    body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  }

  const relationship = typeof body.relationship === "string" && body.relationship in RELATIONSHIPS
    ? body.relationship
    : "other";
  const full_name = clean(body.full_name, MAX.name);
  const email = clean(body.email, MAX.email);
  const phone = clean(body.phone, MAX.phone);
  const phone_code = clean(body.phone_code, 8);
  const country_code = clean(body.country_code, 4);
  const company = clean(body.company, MAX.company);
  const job_title = clean(body.job_title, MAX.jobTitle);
  const heard_from = clean(body.heard_from, 60);
  const customer_code = clean(body.customer_code, MAX.code);
  const koleex_contact = clean(body.koleex_contact, MAX.contact);
  const partner_type_raw = clean(body.partner_type, 20);
  const partner_type = PARTNER_TYPES.has(partner_type_raw) ? partner_type_raw : "other";
  const territory = clean(body.territory, MAX.territory);
  const supplies = clean(body.supplies, MAX.supplies);
  const website = clean(body.website, MAX.website);
  const message = clean(body.message, MAX.message);
  const language = ["en", "zh", "ar"].includes(clean(body.language, 4))
    ? clean(body.language, 4) : null;

  if (!full_name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const { data: refData, error: refErr } = await supabaseServer.rpc("next_membership_ref");
  if (refErr || typeof refData !== "string") {
    console.error("[api/support/membership-request] ref", refErr?.message ?? "no ref");
    return NextResponse.json({ error: "Could not send the request." }, { status: 500 });
  }
  const ref = refData;

  /* Uploaded under the reference, after it exists and before the row does.
     A file that fails validation must not leave behind a request that reads
     as complete — the applicant is told to fix it and nothing is stored. */
  const documents: Array<{ path: string; name: string; mime: string; bytes: number }> = [];
  for (const [i, file] of files.entries()) {
    if (file.size === 0) continue;
    if (file.size > MAX_DOC_BYTES) {
      return NextResponse.json(
        { error: `"${file.name}" is larger than 4 MB. Please attach a smaller file.` },
        { status: 413 },
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(bytes.subarray(0, 16));
    if (!kind) {
      return NextResponse.json(
        { error: `"${file.name}" is not a PDF or an image. Please attach a PDF, JPG or PNG.` },
        { status: 415 },
      );
    }
    /* Our own name, not theirs: the original is kept as a label in metadata,
       but the path is built from the reference and the sniffed extension, so
       nothing a visitor types ever becomes part of a storage key. */
    const path = `${ref}/${i + 1}.${kind.ext}`;
    const { error: upErr } = await supabaseServer.storage
      .from(DOCS_BUCKET)
      .upload(path, bytes, { contentType: kind.mime, upsert: true });
    if (upErr) {
      console.error("[api/support/membership-request] upload", upErr.message);
      return NextResponse.json({ error: "Could not upload the document." }, { status: 500 });
    }
    documents.push({
      path,
      name: file.name.slice(0, 120),
      mime: kind.mime,
      bytes: file.size,
    });
  }

  /* Everything beyond the four first-class columns lives in metadata — the
     shape differs by relationship, and a column per question would be a
     migration every time the form is edited. */
  const metadata: Record<string, unknown> = {
    relationship,
    relationship_label: RELATIONSHIPS[relationship],
    phone: phone ? `${phone_code ? phone_code + " " : ""}${phone}` : null,
    phone_code: phone_code || null,
    country: country_code || null,
    job_title: job_title || null,
    heard_from: heard_from || null,
    customer_code: customer_code || null,
    koleex_contact: koleex_contact || null,
    /* Only meaningful for the relationship that asked the question — storing
       "distributor" against a supplier request would mislead the reviewer. */
    partner_type: relationship === "partner" ? partner_type : null,
    territory: relationship === "partner" ? territory || null : null,
    supplies: relationship === "supplier" ? supplies || null : null,
    website: relationship === "new_prospect" ? website || null : null,
    documents: documents.length > 0 ? documents : null,
    language,
  };
  for (const k of Object.keys(metadata)) if (metadata[k] == null) delete metadata[k];

  const { data: row, error } = await supabaseServer
    .from("membership_requests")
    .insert({
      ref, full_name, email,
      company: company || null,
      message: message || null,
      source: "login_gate",
      metadata,
    })
    .select("id, ref")
    .single();

  if (error) {
    console.error("[api/support/membership-request] insert", error.message);
    if (documents.length > 0) {
      /* Best effort: the row is what makes a document findable, so files
         without one are unreachable rubbish sitting in a private bucket. */
      await supabaseServer.storage
        .from(DOCS_BUCKET)
        .remove(documents.map((d) => d.path))
        .catch(() => {});
    }
    return NextResponse.json({ error: "Could not send the request." }, { status: 500 });
  }

  /* Super Admins AND Admins — the owner's call, 2026-08-10. Widening the
     rota does not widen what an Admin can do: approval provisions nothing by
     itself, and whoever reviews still creates the account by hand through
     /api/accounts, which gates on the Accounts:create permission. */
  const recipients = await adminRecipients("api/support/membership-request");

  if (recipients.length === 0) {
    console.error("[api/support/membership-request] no reviewer — request", ref, "is only in the table");
  } else {
    const lines = [
      `Relationship  ${RELATIONSHIPS[relationship]}`,
      `Name          ${full_name}`,
      company ? `Company       ${company}` : null,
      job_title ? `Job title     ${job_title}` : null,
      customer_code ? `Customer code ${customer_code}` : null,
      koleex_contact ? `Koleex contact ${koleex_contact}` : null,
      relationship === "partner" ? `Partnership   ${partner_type}` : null,
      relationship === "partner" && territory ? `Territory     ${territory}` : null,
      relationship === "supplier" && supplies ? `Supplies      ${supplies}` : null,
      relationship === "new_prospect" && website ? `Website       ${website}` : null,
      `Email         ${email}`,
      phone ? `Phone         ${phone_code ? phone_code + " " : ""}${phone}` : null,
      country_code ? `Country       ${country_code}` : null,
      heard_from ? `Heard from    ${heard_from}` : null,
      language ? `Language      ${language}` : null,
      documents.length > 0
        ? `Documents     ${documents.map((d) => d.name).join(", ")}`
        : "Documents     none attached",
      message ? `\nMessage\n${message}` : null,
      "",
      `Reference     ${ref}`,
    ].filter(Boolean) as string[];

    const { error: mailErr } = await supabaseServer.from("inbox_messages").insert(
      recipients.map((rid) => ({
        recipient_account_id: rid,
        sender_account_id: null,
        category: "membership_request",
        subject: `Account request · ${full_name}`,
        body: lines.join("\n"),
        link: "/inbox",
        metadata: {
          type: "membership_request",
          membership_request_id: row.id,
          ref, relationship,
          relationship_label: RELATIONSHIPS[relationship],
          full_name, email,
          company: company || null,
        },
      })),
    );
    if (mailErr) console.error("[api/support/membership-request] fan-out", mailErr.message);
    else await emitPings(recipients.map((rid) => ({ topic: rtTopic.inbox(rid) })));
  }

  recordSend(ip);
  return NextResponse.json({ ok: true, ref });
}
