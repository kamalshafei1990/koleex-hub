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

/* Ids match RELATIONSHIPS in AdminAuth — changing one without the other
   silently files every request as "Other". */
const RELATIONSHIPS: Record<string, string> = {
  new_prospect: "New to Koleex",
  existing_customer: "Existing customer",
  supplier: "Supplier",
  partner: "Partner",
  other: "Other",
};

const MAX = {
  name: 120, email: 160, phone: 32, company: 160,
  jobTitle: 120, message: 2000, code: 60,
} as const;

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

  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

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
    return NextResponse.json({ error: "Could not send the request." }, { status: 500 });
  }

  /* Super Admins only. A membership request is a decision about who gets into
     the Hub at all, which is not an Admin's call. */
  const { data: sa, error: saErr } = await supabaseServer
    .from("accounts").select("id")
    .eq("is_super_admin", true).eq("user_type", "internal").eq("status", "active");
  if (saErr) console.error("[api/support/membership-request] super admins", saErr.message);
  const recipients = ((sa ?? []) as { id: string }[]).map((r) => r.id);

  if (recipients.length === 0) {
    console.error("[api/support/membership-request] no Super Admin — request", ref, "is only in the table");
  } else {
    const lines = [
      `Relationship  ${RELATIONSHIPS[relationship]}`,
      `Name          ${full_name}`,
      company ? `Company       ${company}` : null,
      job_title ? `Job title     ${job_title}` : null,
      customer_code ? `Customer code ${customer_code}` : null,
      `Email         ${email}`,
      phone ? `Phone         ${phone_code ? phone_code + " " : ""}${phone}` : null,
      country_code ? `Country       ${country_code}` : null,
      heard_from ? `Heard from    ${heard_from}` : null,
      language ? `Language      ${language}` : null,
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
