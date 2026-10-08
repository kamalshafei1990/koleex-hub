import "server-only";

/* ---------------------------------------------------------------------------
   website/leads — a message from the public website (owner, 30/09/2026):
   the contact form, or «Request a quotation» on a product's page, becomes a
   potential customer in Customers, and the people who follow up hear of it.

   · Whose message: the sender's email finds the customer already there and
     the message joins it — never a second customer for the same person.
     Otherwise a new customer is created the way the Customers app creates
     one: INACTIVE until someone vets it (the standing rule for every new
     customer), stage «Lead», source «Website Contact Form», tagged
     "website". Only customers are matched: a supplier or a colleague with
     the same email keeps their own record, and a visitor's words never
     land on it.
   · Every message is kept as it came (website_leads) and shown on the
     customer's page (Activity → Website messages): the notification is not
     the only place it lives.
   · Told (notifyLead, after the site has its answer): the super admins, and
     whoever holds «Website Leads» and may open Customers — the notification
     opens the customer's page, so nobody is told what they could not open.
   · A flood is slowed before anything is written: a few messages an hour
     from one place (the site sends a keyed hash of the sender's address,
     never the address) or from one email, and a ceiling for the whole site.
     The site itself turns the obvious robots away (a hidden field filled, a
     form sent seconds after it opened) before the Hub is asked.
   --------------------------------------------------------------------------- */

import Country from "country-state-city/lib/country";
import { supabaseServer } from "@/lib/server/supabase-server";
import { websiteTenantId } from "@/lib/server/website-bridge";
import { isSlug } from "@/lib/server/website-catalog";
import { cleanString } from "@/lib/website/page-doc";
import { notifyLite } from "@/lib/server/notify-lite";
import { superAdminAccountIds } from "@/lib/server/sa-notify";
import { WEBSITE_LEADS_MODULE } from "@/lib/permission-modules";
import type { Result } from "@/lib/server/website/pages";

export type LeadKind = "contact" | "quote";

/** Per hour: from one place, from one email, and for the whole site. */
export const LEAD_LIMITS = { perPlace: 5, perEmail: 3, perSite: 60 } as const;
export const MESSAGE_MAX = 4000;
const HOUR_MS = 3_600_000;

/** A message as the Hub keeps it — what notifyLead tells. */
export interface ReceivedLead {
  id: string;
  tenantId: string;
  contactId: string;
  /** The sender was already a customer (the message joined them). */
  matched: boolean;
  kind: LeadKind;
  name: string;
  company: string | null;
  message: string;
  product: { slug: string; name: string } | null;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[\d\s().\-/]{5,40}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const LANG_RE = /^[a-z]{2}$/;
const PAGE_RE = /^\/[^\s]{0,299}$/;

/* The site's languages as the Customers app names them (its Language field). */
const LANGUAGE_NAME: Record<string, string> = {
  en: "English", ar: "Arabic", zh: "Chinese (Mandarin)", es: "Spanish", fr: "French", nl: "Dutch",
  pl: "Polish", pt: "Portuguese", hi: "Hindi", ur: "Urdu", fa: "Persian (Farsi)", th: "Thai",
  vi: "Vietnamese", ru: "Russian", id: "Indonesian", tr: "Turkish", ta: "Tamil", bn: "Bengali",
};

const kindOf = (v: unknown): LeadKind => (v === "quote" ? "quote" : "contact");
const oneLine = (v: unknown, max: number) => cleanString(v, max).replace(/\s+/g, " ");
/** A pattern that matches this text exactly, case aside (ilike). */
const exactly = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The country as the Customers app stores it: its name and ISO code. */
function countryOf(v: unknown): { name: string; code: string } | null {
  const code = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const c = Country.getCountryByCode(code);
  return c ? { name: c.name, code } : null;
}

/** Too many messages this hour — from this place, this email, or the site. */
export async function leadFlood(tenantId: string, email: string, ipHash: string | null): Promise<"place" | "email" | "site" | null> {
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const recent = () => supabaseServer.from("website_leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", since);
  const [site, byEmail, byPlace] = await Promise.all([
    recent(),
    recent().eq("email", email),
    ipHash ? recent().eq("ip_hash", ipHash) : Promise.resolve({ count: 0, error: null }),
  ]);
  const failed = site.error ?? byEmail.error ?? byPlace.error;
  if (failed) throw new Error(`website leads: ${failed.message}`);
  if ((byPlace.count ?? 0) >= LEAD_LIMITS.perPlace) return "place";
  if ((byEmail.count ?? 0) >= LEAD_LIMITS.perEmail) return "email";
  if ((site.count ?? 0) >= LEAD_LIMITS.perSite) return "site";
  return null;
}

/** The customer this email already belongs to (the oldest, when several). */
async function customerByEmail(tenantId: string, email: string): Promise<string | null> {
  const primary = await supabaseServer.from("contacts").select("id")
    .eq("tenant_id", tenantId).eq("contact_type", "customer").ilike("email", exactly(email))
    .order("created_at", { ascending: true }).limit(1);
  if (primary.error) throw new Error(`website leads: ${primary.error.message}`);
  const hit = (primary.data as Array<{ id: string }> | null)?.[0]?.id;
  if (hit) return hit;
  /* A second address kept in the customer's email list (jsonb [{ email,
     label }]). As JSON text: .contains() writes an array of objects as a
     Postgres array literal, which the jsonb column rejects. */
  const listed = await supabaseServer.from("contacts").select("id")
    .eq("tenant_id", tenantId).eq("contact_type", "customer").filter("emails", "cs", JSON.stringify([{ email }]))
    .order("created_at", { ascending: true }).limit(1);
  if (listed.error) throw new Error(`website leads: ${listed.error.message}`);
  return (listed.data as Array<{ id: string }> | null)?.[0]?.id ?? null;
}

/** A product the site shows — only those can be asked about. */
async function shownProduct(tenantId: string, slug: unknown): Promise<{ slug: string; name: string } | null> {
  if (typeof slug !== "string" || !isSlug(slug)) return null;
  const { data, error } = await supabaseServer.from("products").select("slug, product_name")
    .eq("tenant_id", tenantId).eq("slug", slug).eq("status", "active").eq("visible", true).maybeSingle();
  if (error) throw new Error(`website leads: ${error.message}`);
  const p = data as { slug: string; product_name: string } | null;
  return p ? { slug: p.slug, name: p.product_name } : null;
}

/** Take a message from the site: check it, slow a flood, find or create the
 *  customer, keep the message. Nobody is told here — the route calls
 *  notifyLead once the site has its answer. */
export async function receiveLead(input: Record<string, unknown>): Promise<Result<ReceivedLead>> {
  const tenantId = await websiteTenantId();
  if (!tenantId) throw new Error("website leads: no host company");

  const kind = kindOf(input.kind);
  const name = oneLine(input.name, 120);
  if (Array.from(name).length < 2) return { error: "Write your name.", status: 400, code: "name" };
  const email = oneLine(input.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Write a valid email address.", status: 400, code: "email" };
  const phone = oneLine(input.phone, 40);
  if (phone && !PHONE_RE.test(phone)) return { error: "Write the phone number with digits only.", status: 400, code: "phone" };
  const message = cleanString(input.message, MESSAGE_MAX);
  if (Array.from(message).length < 2) return { error: "Write your message.", status: 400, code: "message" };
  const company = oneLine(input.company, 160) || null;
  const country = countryOf(input.country);
  const lang = typeof input.lang === "string" && LANG_RE.test(input.lang) ? input.lang : null;
  const page = typeof input.page === "string" && PAGE_RE.test(input.page) ? input.page : null;
  const ipHash = typeof input.ipHash === "string" && HASH_RE.test(input.ipHash) ? input.ipHash : null;

  const flood = await leadFlood(tenantId, email, ipHash);
  if (flood) return { error: "Too many messages — please try again in an hour.", status: 429, code: `flood_${flood}` };

  const product = await shownProduct(tenantId, input.product);
  let contactId = await customerByEmail(tenantId, email);
  const matched = !!contactId;
  if (!contactId) {
    const [first, ...rest] = name.split(" ");
    const { data, error } = await supabaseServer.from("contacts").insert({
      tenant_id: tenantId,
      contact_type: "customer",
      entity_type: "person",
      first_name: first,
      last_name: rest.join(" ") || null,
      full_name: name,
      display_name: name,
      company,
      email,
      phone: phone || null,
      country: country?.name ?? null,
      country_code: country?.code ?? null,
      language: lang ? LANGUAGE_NAME[lang] ?? null : null,
      /* New customers start inactive — the owner's standing rule. */
      is_active: false,
      relationship_stage: "Lead",
      source: "Website Contact Form",
      source_details: kind === "quote" ? (product ? `Quotation request: ${product.name}` : "Quotation request") : "Contact form",
      first_contact_date: new Date().toISOString().slice(0, 10),
      tags: ["website"],
    }).select("id").single();
    if (error) throw new Error(`website leads: new customer: ${error.message}`);
    contactId = (data as { id: string }).id;
  }

  const { data: row, error } = await supabaseServer.from("website_leads").insert({
    tenant_id: tenantId, contact_id: contactId, matched, kind, name, email,
    phone: phone || null, company, country: country?.code ?? null, message,
    product_slug: product?.slug ?? null, lang, page, ip_hash: ipHash,
  }).select("id").single();
  if (error) throw new Error(`website leads: ${error.message}`);
  return { id: (row as { id: string }).id, tenantId, contactId, matched, kind, name, company, message, product };
}

/** Who hears of a site message: the super admins, and active internal
 *  accounts holding «Website Leads» who may also open Customers — each read
 *  the way requireModuleAccess reads it (an account's own override wins
 *  over its role). A failed read of the grants still tells the super
 *  admins. */
export async function websiteLeadRecipients(tenantId: string): Promise<string[]> {
  type Perm = { role_id?: string; account_id?: string; module_name?: string; module_key?: string; can_view?: boolean | null };
  const LEADS = WEBSITE_LEADS_MODULE;
  const CUSTOMERS = "Customers";
  const ids = new Set(await superAdminAccountIds(tenantId));
  const [roleGrants, accountGrants] = await Promise.all([
    supabaseServer.from("koleex_permissions").select("role_id").ilike("module_name", LEADS).eq("can_view", true),
    supabaseServer.from("account_permission_overrides").select("account_id").ilike("module_key", LEADS).eq("can_view", true),
  ]);
  if (roleGrants.error || accountGrants.error) {
    console.error("[website/leads.recipients]", roleGrants.error?.message ?? accountGrants.error?.message);
    return [...ids];
  }
  const roles = [...new Set(((roleGrants.data ?? []) as Perm[]).map((p) => p.role_id!))];
  const granted = [...new Set(((accountGrants.data ?? []) as Perm[]).map((p) => p.account_id!))];
  const or = [roles.length ? `role_id.in.(${roles.join(",")})` : null, granted.length ? `id.in.(${granted.join(",")})` : null].filter(Boolean).join(",");
  if (!or) return [...ids];
  const { data: accts, error } = await supabaseServer.from("accounts").select("id, role_id")
    .eq("tenant_id", tenantId).eq("status", "active").eq("user_type", "internal")
    .not("role_id", "is", null).or(or).limit(200);
  if (error) {
    console.error("[website/leads.recipients]", error.message);
    return [...ids];
  }
  const cands = ((accts ?? []) as Array<{ id: string; role_id: string }>).filter((c) => !ids.has(c.id));
  if (!cands.length) return [...ids];
  const either = (col: string) => `${col}.ilike."${LEADS}",${col}.ilike."${CUSTOMERS}"`;
  const [rolePerms, overrides] = await Promise.all([
    supabaseServer.from("koleex_permissions").select("role_id, module_name, can_view").in("role_id", [...new Set(cands.map((c) => c.role_id))]).or(either("module_name")),
    supabaseServer.from("account_permission_overrides").select("account_id, module_key, can_view").in("account_id", cands.map((c) => c.id)).or(either("module_key")),
  ]);
  if (rolePerms.error || overrides.error) {
    console.error("[website/leads.recipients]", rolePerms.error?.message ?? overrides.error?.message);
    return [...ids];
  }
  const norm = (m?: string) => (m ?? "").toLowerCase();
  const view = (c: { id: string; role_id: string }, module: string) => {
    const o = ((overrides.data ?? []) as Perm[]).find((r) => r.account_id === c.id && norm(r.module_key) === norm(module));
    if (typeof o?.can_view === "boolean") return o.can_view;
    return ((rolePerms.data ?? []) as Perm[]).find((r) => r.role_id === c.role_id && norm(r.module_name) === norm(module))?.can_view === true;
  };
  for (const c of cands) if (view(c, LEADS) && view(c, CUSTOMERS)) ids.add(c.id);
  return [...ids];
}

/** The message's first lines, short enough for a notification. */
function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 159).trimEnd()}…` : flat;
}

/** Tell the people who follow up. Never throws: the message is already
 *  kept, and a failed notification must not fail the visitor's send. */
export async function notifyLead(lead: ReceivedLead): Promise<void> {
  try {
    const who = lead.company ? `${lead.name} (${lead.company})` : lead.name;
    await notifyLite({
      tenantId: lead.tenantId,
      recipients: await websiteLeadRecipients(lead.tenantId),
      tpl: lead.kind === "quote"
        ? { k: "website_lead_quote", p: { who, product: lead.product?.name, text: excerpt(lead.message) } }
        : { k: "website_lead", p: { who, text: excerpt(lead.message) } },
      link: `/customers/${lead.contactId}`,
      type: "website_lead",
      metadata: { source: "website", lead_id: lead.id, contact_id: lead.contactId, lead_kind: lead.kind, matched: lead.matched },
      tag: `website-lead:${lead.id}`,
    });
  } catch (e) {
    console.error("[website/leads.notify]", e instanceof Error ? e.message : e);
  }
}

/** A customer's messages from the site, newest first — the customer page's
 *  Website messages. */
export interface WebsiteMessage {
  id: string;
  quote: boolean;
  message: string;
  product: { id: string | null; slug: string; name: string | null } | null;
  createdAt: string;
}
export async function contactWebsiteMessages(tenantId: string, contactId: string, limit = 5): Promise<{ count: number; recent: WebsiteMessage[] }> {
  const { data, count, error } = await supabaseServer.from("website_leads")
    .select("id, kind, message, product_slug, created_at", { count: "exact" })
    .eq("tenant_id", tenantId).eq("contact_id", contactId)
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`website leads: ${error.message}`);
  const rows = (data ?? []) as Array<{ id: string; kind: string; message: string; product_slug: string | null; created_at: string }>;
  const slugs = [...new Set(rows.map((r) => r.product_slug).filter((s): s is string => !!s))];
  const bySlug = new Map<string, { id: string; name: string }>();
  if (slugs.length) {
    const p = await supabaseServer.from("products").select("id, slug, product_name").eq("tenant_id", tenantId).in("slug", slugs);
    if (p.error) throw new Error(`website leads: ${p.error.message}`);
    for (const r of (p.data ?? []) as Array<{ id: string; slug: string; product_name: string }>) bySlug.set(r.slug, { id: r.id, name: r.product_name });
  }
  return {
    count: count ?? rows.length,
    recent: rows.map((r) => ({
      id: r.id,
      quote: r.kind === "quote",
      message: r.message,
      product: r.product_slug ? { id: bySlug.get(r.product_slug)?.id ?? null, slug: r.product_slug, name: bySlug.get(r.product_slug)?.name ?? null } : null,
      createdAt: r.created_at,
    })),
  };
}
