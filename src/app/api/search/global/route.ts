import "server-only";

/* ---------------------------------------------------------------------------
   /api/search/global — one smart search across the Hub.

   GET ?q=<term> → { q, groups: [{ key, items: [{ id, title, subtitle, href }] }] }

   Born from the owner's report that the Reports search bar "does not work":
   he did not want a better REPORT search, he wanted ONE box that searches
   everything and suggests as he types. This endpoint fans out to the
   high-value resources in parallel and returns up to PER_GROUP hits each,
   already shaped for a suggestions dropdown (title + subtitle + deep link).

   Scoping mirrors each app's own rules — never wider:
     reports  → mine (author, drafts included) + addressed to me
     products → tenant catalogue, active only (no cost/secret columns)
     contacts → tenant address book, active only
     todos    → the shared todo scope (own + assigned + shared-with-me)
     notes    → my own notes (shared-note search is a later wave)
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { applyTodoScope, sharedTodoIds, type TodoViewer } from "@/lib/server/todo-scope";
import { REPORT_TEMPLATES } from "@/lib/reports/catalog";
import { reportsT } from "@/lib/translations/reports";

export const dynamic = "force-dynamic";

const PER_GROUP = 5;
const MAX_Q = 60;

/* Speed (owner: "the response of the search bar is too slow"): a keystroke
   costs ~250ms of Postgres round-trips, and typing/backspacing revisits the
   SAME term constantly. A tiny per-account in-memory cache turns every
   repeat into ~0ms. 45s TTL keeps it fresh; a hard cap keeps memory flat. */
const CACHE = new Map<string, { at: number; payload: { q: string; groups: SuggestGroup[] } }>();
const CACHE_TTL_MS = 45_000;
function cacheGet(key: string) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { CACHE.delete(key); return null; }
  return hit.payload;
}
function cacheSet(key: string, payload: { q: string; groups: SuggestGroup[] }) {
  if (CACHE.size > 300) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(key, { at: Date.now(), payload });
}

export type SuggestItem = { id: string; title: string; subtitle: string | null; href: string; icon?: string };
export type SuggestGroup = { key: "reports" | "templates" | "products" | "contacts" | "todos" | "notes"; items: SuggestItem[] };

/* A typed term is USER INPUT landing in PostgREST logic strings and ILIKE
   patterns: strip the characters that would break an or() tree or act as
   pattern metacharacters beyond the intended substring match. */
function sanitize(raw: string): string {
  return raw.replace(/[%,()"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_Q);
}
const like = (term: string) => `%${term}%`;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const q = sanitize(url.searchParams.get("q") ?? "");
  if (q.length < 2) return NextResponse.json({ q, groups: [] });

  const me = auth.account_id;
  const tenant = auth.tenant_id;

  const cacheKey = `${me}:${q}`;
  const cached = cacheGet(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { "Cache-Control": "private, no-store" } });

  const viewer: TodoViewer = {
    accountId: me,
    tenantId: tenant,
    department: auth.department,
    isSuperAdmin: auth.is_super_admin,
    canViewPrivate: auth.can_view_private,
  };
  const todoSharedP = sharedTodoIds(viewer);

  /* ── Report templates: the "Write a report" cards on the Reports home are
     the one thing the owner expected in results and did NOT find ("it can't
     search reports templates which have in the home page"). Local catalogue,
     matched across key + family + every translated name; the link starts the
     draft exactly like the card (?write=<key> is handled by ReportsApp). */
  const templatesP = (async (): Promise<SuggestGroup> => {
    const ql = q.toLowerCase();
    const items: SuggestItem[] = [];
    for (const tpl of REPORT_TEMPLATES) {
      const tr = reportsT[`tpl.${tpl.key}.name`] as { en?: string; zh?: string; ar?: string } | undefined;
      const names = [tr?.en, tr?.zh, tr?.ar].filter((n): n is string => !!n);
      const haystack = [tpl.key.replace(/_/g, " "), tpl.family, ...names].join(" ").toLowerCase();
      if (!haystack.includes(ql)) continue;
      items.push({
        id: tpl.key,
        title: names[0] ?? tpl.key,
        subtitle: tpl.cadence ?? tpl.family,
        href: `/reports?write=${encodeURIComponent(tpl.key)}`,
        icon: tpl.icon,
      });
      if (items.length >= PER_GROUP) break;
    }
    return { key: "templates", items };
  })();

  /* ── Reports: mine (any status) + addressed to me, content search ── */
  const reportsP = (async (): Promise<SuggestGroup> => {
    let mineQ = supabaseServer.from("work_reports")
      .select("id, template_key, title, status, period_key, updated_at")
      .eq("author_account_id", me).eq("superseded", false)
      .ilike("search_text", like(q)).order("updated_at", { ascending: false }).limit(PER_GROUP);
    let inboxQ = supabaseServer.from("work_reports")
      .select("id, template_key, title, status, period_key, updated_at, work_report_recipients!inner(account_id)")
      .eq("work_report_recipients.account_id", me).neq("status", "draft")
      .ilike("search_text", like(q)).order("updated_at", { ascending: false }).limit(PER_GROUP);
    if (tenant) { mineQ = mineQ.eq("tenant_id", tenant); inboxQ = inboxQ.eq("tenant_id", tenant); }
    const [a, b] = await Promise.all([mineQ, inboxQ]);
    if (a.error) console.error("[search/global reports]", a.error.message);
    if (b.error) console.error("[search/global reports]", b.error.message);
    const byId = new Map<string, SuggestItem>();
    for (const r of [...(a.data ?? []), ...(b.data ?? [])]) {
      byId.set(r.id as string, {
        id: r.id as string,
        title: (r.title as string) || `${r.template_key} · ${r.period_key ?? ""}`.trim(),
        subtitle: r.status as string,
        href: `/reports/${r.id}`,
      });
    }
    return { key: "reports", items: [...byId.values()].slice(0, PER_GROUP) };
  })();

  /* ── Products: tenant catalogue, active only, generated search_text ── */
  const productsP = (async (): Promise<SuggestGroup> => {
    let pq = supabaseServer.from("products")
      .select("id, product_name, slug, brand")
      .eq("status", "active")
      .ilike("search_text", like(q)).order("updated_at", { ascending: false }).limit(PER_GROUP);
    if (tenant) pq = pq.eq("tenant_id", tenant);
    const { data, error } = await pq;
    if (error) console.error("[search/global products]", error.message);
    return {
      key: "products",
      items: (data ?? []).map((p) => ({
        id: p.id as string,
        title: (p.product_name as string) || (p.slug as string),
        subtitle: (p.brand as string) || null,
        href: `/products/${p.id}`,
      })),
    };
  })();

  /* ── Contacts: tenant address book, the non-sensitive name columns ── */
  const contactsP = (async (): Promise<SuggestGroup> => {
    let cq = supabaseServer.from("contacts")
      .select("id, full_name, display_name, company_name, contact_type, country")
      .eq("is_active", true)
      .or(`full_name.ilike."${like(q)}",display_name.ilike."${like(q)}",company_name.ilike."${like(q)}"`)
      .order("updated_at", { ascending: false }).limit(PER_GROUP);
    if (tenant) cq = cq.eq("tenant_id", tenant);
    const { data, error } = await cq;
    if (error) console.error("[search/global contacts]", error.message);
    return {
      key: "contacts",
      items: (data ?? []).map((c) => ({
        id: c.id as string,
        title: (c.full_name as string) || (c.display_name as string) || (c.company_name as string) || "—",
        subtitle: [c.contact_type as string, c.country as string].filter(Boolean).join(" · ") || null,
        href: "/contacts",
      })),
    };
  })();

  /* ── Todos: the shared scope rule, title search ── */
  const todosP = (async (): Promise<SuggestGroup> => {
    const sharedIds = await todoSharedP;
    let tq = supabaseServer.from("koleex_todos")
      .select("id, title, completed, due_date")
      .ilike("title", like(q))
      .order("created_at", { ascending: false }).limit(PER_GROUP);
    if (tenant) tq = tq.eq("tenant_id", tenant);
    tq = applyTodoScope(tq, viewer, sharedIds);
    const { data, error } = await tq;
    if (error) console.error("[search/global todos]", error.message);
    return {
      key: "todos",
      items: (data ?? []).map((t) => ({
        id: t.id as string,
        title: t.title as string,
        subtitle: t.completed ? "done" : ((t.due_date as string) || null),
        href: "/todo",
      })),
    };
  })();

  /* ── Notes: my own, title + body search ── */
  const notesP = (async (): Promise<SuggestGroup> => {
    const { data, error } = await supabaseServer.from("notes")
      .select("id, title, updated_at")
      .eq("account_id", me).is("deleted_at", null)
      .or(`title.ilike."${like(q)}",body_plain.ilike."${like(q)}"`)
      .order("updated_at", { ascending: false }).limit(PER_GROUP);
    if (error) console.error("[search/global notes]", error.message);
    return {
      key: "notes",
      items: (data ?? []).map((n) => ({
        id: n.id as string,
        title: (n.title as string) || "—",
        subtitle: null,
        href: "/notes",
      })),
    };
  })();

  const groups = (await Promise.all([templatesP, reportsP, productsP, contactsP, todosP, notesP]))
    .filter((g) => g.items.length > 0);

  const payload = { q, groups };
  cacheSet(cacheKey, payload);
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
