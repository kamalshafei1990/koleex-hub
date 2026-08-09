import "server-only";

/* POST /api/support/sign-in-help

   The "Having trouble?" form on the sign-in screen. The person filling it in
   is BY DEFINITION not signed in, so this route is public — and everything
   that follows from that is deliberate:

     · it is rate-limited per IP, because a public write endpoint on a login
       screen is an invitation to flood the admins' inbox;
     · every field is length-capped and the category is an allow-list, so the
       request cannot be used to post arbitrary content into an inbox;
     · the row in `support_requests` is the durable record. The inbox messages
       are copies — an admin archiving theirs must not erase the request.

   Delivery is the Hub's own Mail app (`inbox_messages`), not external email:
   the Hub has no mail transport configured, and adding one would mean a
   provider, a domain and an API key. Every Super Admin and every Admin-role
   account gets a copy, so a request never waits on one person. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";

const CATEGORIES: Record<string, string> = {
  forgot_password: "Forgot password",
  account_locked: "Account is locked",
  no_account: "No account yet",
  code_not_received: "Cannot receive the code",
  other: "Something else",
};

const MAX = { name: 120, email: 160, phone: 32, message: 2000 } as const;

/* Three requests per IP per hour. In-memory on purpose: this is a speed bump
   against a flood, not an auth boundary, and a per-instance counter is enough
   to keep one browser from filling the inbox. */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;
type Hits = { count: number; resetAt: number };
const g = globalThis as unknown as { __kxSupportRate?: Map<string, Hits> };
/* globalThis-anchored: Turbopack duplicates small modules across chunks and a
   per-copy Map silently stops limiting anything (SYS-4). */
const rate: Map<string, Hits> = (g.__kxSupportRate ??= new Map());

/* Read-only check. Counting is separate and happens only on a request that
   actually filed something — otherwise someone who mistypes their email three
   times is locked out for an hour and can never ask for help, which is the
   opposite of what this form is for. */
function overLimit(ip: string): boolean {
  const hit = rate.get(ip);
  return hit != null && Date.now() <= hit.resetAt && hit.count >= MAX_PER_WINDOW;
}

function recordSend(ip: string): void {
  const now = Date.now();
  const hit = rate.get(ip);
  if (!hit || now > hit.resetAt) {
    rate.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    hit.count += 1;
  }
  if (rate.size > 5_000) {
    for (const [k, v] of rate) if (now > v.resetAt) rate.delete(k);
  }
}

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (overLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  const category = typeof body.category === "string" && body.category in CATEGORIES
    ? body.category
    : null;
  const full_name = clean(body.full_name, MAX.name);
  const email = clean(body.email, MAX.email);
  const phone = clean(body.phone, MAX.phone);
  const phone_code = clean(body.phone_code, 8);
  const country_code = clean(body.country_code, 4);
  const message = clean(body.message, MAX.message);

  if (!category) return NextResponse.json({ error: "Please choose a problem." }, { status: 400 });
  if (!full_name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!phone) return NextResponse.json({ error: "A phone number is required." }, { status: 400 });
  /* "Something else" with no words is not a request anyone can act on. */
  if (category === "other" && message.length < 5) {
    return NextResponse.json({ error: "Please describe the problem." }, { status: 400 });
  }

  /* SR-<year>-<counter>, allocated by the database from a sequence — a
     count(*)+1 here would hand the same number to two requests submitted in
     the same second. */
  const { data: refData, error: refErr } = await supabaseServer.rpc("next_support_ref");
  if (refErr || typeof refData !== "string") {
    console.error("[api/support/sign-in-help] ref", refErr?.message ?? "no ref returned");
    return NextResponse.json({ error: "Could not send the request." }, { status: 500 });
  }
  const ref = refData;

  const userAgent = req.headers.get("user-agent")?.slice(0, 400) ?? null;

  const { data: row, error } = await supabaseServer
    .from("support_requests")
    .insert({
      ref, category, message: message || null,
      full_name, email,
      phone_code: phone_code || null, phone, country_code: country_code || null,
      user_agent: userAgent,
    })
    .select("id, ref")
    .single();

  if (error) {
    console.error("[api/support/sign-in-help] insert", error.message);
    return NextResponse.json({ error: "Could not send the request." }, { status: 500 });
  }

  /* ── Fan out to Super Admins and Admin-role accounts ──────────────────── */
  const recipients = await adminRecipients();
  if (recipients.length === 0) {
    console.error("[api/support/sign-in-help] no admin recipients — request", ref, "is only in the table");
  } else {
    const label = CATEGORIES[category];
    const lines = [
      `Problem     ${label}`,
      `Name        ${full_name}`,
      `Email       ${email}`,
      `Phone       ${phone_code ? phone_code + " " : ""}${phone}`,
      message ? `Message     ${message}` : null,
      "",
      `Reference   ${ref}`,
    ].filter(Boolean) as string[];

    const { error: mailErr } = await supabaseServer.from("inbox_messages").insert(
      recipients.map((rid) => ({
        recipient_account_id: rid,
        sender_account_id: null,
        category: "alert",
        subject: `Sign-in help · ${full_name}`,
        body: lines.join("\n"),
        link: "/accounts",
        metadata: {
          type: "support_request",
          support_request_id: row.id,
          ref,
          problem: category,
          problem_label: label,
          full_name, email,
          phone: `${phone_code ? phone_code + " " : ""}${phone}`,
          country_code: country_code || null,
        },
      })),
    );
    if (mailErr) {
      /* The request IS saved. Say so, loudly, rather than telling the visitor
         it failed and having them send it again. */
      console.error("[api/support/sign-in-help] inbox fan-out", mailErr.message);
    } else {
      await emitPings(recipients.map((rid) => ({ topic: rtTopic.inbox(rid) })));
    }
  }

  recordSend(ip);
  return NextResponse.json({ ok: true, ref });
}

/** Every active INTERNAL Super Admin, plus every active internal account
 *  holding an internal admin role. Deduped — one person holding both must not
 *  get two copies.
 *
 *  The role names are an explicit allow-list, not a wildcard. A `%admin%`
 *  match also catches "Customer Admin", which is a CUSTOMER-side role: a
 *  sign-in help request carries a name, an email and a phone number, and a
 *  customer's admin has no business receiving one. `user_type = internal` is
 *  the second guard on the same idea. */
const INTERNAL_ADMIN_ROLES = ["Admin", "Super Admin"];

async function adminRecipients(): Promise<string[]> {
  const ids = new Set<string>();

  const { data: sa, error: saErr } = await supabaseServer
    .from("accounts")
    .select("id")
    .eq("is_super_admin", true)
    .eq("user_type", "internal")
    .eq("status", "active");
  if (saErr) console.error("[api/support/sign-in-help] super admins", saErr.message);
  for (const r of (sa ?? []) as { id: string }[]) ids.add(r.id);

  const { data: roles, error: rErr } = await supabaseServer
    .from("roles")
    .select("id")
    .in("name", INTERNAL_ADMIN_ROLES);
  if (rErr) console.error("[api/support/sign-in-help] roles", rErr.message);
  const roleIds = ((roles ?? []) as { id: string }[]).map((r) => r.id);

  if (roleIds.length > 0) {
    const { data: admins, error: aErr } = await supabaseServer
      .from("accounts")
      .select("id")
      .in("role_id", roleIds)
      .eq("user_type", "internal")
      .eq("status", "active");
    if (aErr) console.error("[api/support/sign-in-help] admin accounts", aErr.message);
    for (const r of (admins ?? []) as { id: string }[]) ids.add(r.id);
  }

  return [...ids];
}
