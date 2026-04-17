import "server-only";

/* GET /api/crm/opportunities
   Returns the enriched opportunity list (stage, contact, owner, next
   activity) scoped to the caller's tenant.

   Query params (all optional, mirror the client-side fetchOpportunities):
     includeArchived=1    include archived rows (default off)
     owner=<uuid>         restrict to one owner
     stage=<uuid>         restrict to one stage
     contact=<uuid>       restrict to one contact
     search=<string>      free-text across name/company/contact/email
     limit=<n>            cap results (default 500)
*/

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "CRM");
  if (deny) return deny;

  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const owner = url.searchParams.get("owner");
  const stage = url.searchParams.get("stage");
  const contact = url.searchParams.get("contact");
  const search = url.searchParams.get("search");
  const limit = Number(url.searchParams.get("limit") ?? "500");

  // Main opportunity query, tenant-scoped.
  let q = supabaseServer
    .from("crm_opportunities")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!includeArchived) q = q.is("archived_at", null);
  if (owner) q = q.eq("owner_account_id", owner);
  if (stage) q = q.eq("stage_id", stage);
  if (contact) q = q.eq("contact_id", contact);
  if (search?.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(
      `name.ilike.${s},company_name.ilike.${s},contact_name.ilike.${s},email.ilike.${s}`,
    );
  }

  const { data: rows, error } = await q;
  if (error) {
    console.error("[api/crm/opportunities]", error.message);
    return NextResponse.json(
      { error: "Failed to load opportunities" },
      { status: 500 },
    );
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ opportunities: [] });
  }

  // Collect FK IDs for enrichment queries.
  const stageIds = new Set<string>();
  const contactIds = new Set<string>();
  const ownerIds = new Set<string>();
  for (const r of rows as Array<{
    stage_id: string | null;
    contact_id: string | null;
    owner_account_id: string | null;
  }>) {
    if (r.stage_id) stageIds.add(r.stage_id);
    if (r.contact_id) contactIds.add(r.contact_id);
    if (r.owner_account_id) ownerIds.add(r.owner_account_id);
  }

  const [stagesRes, contactsRes, ownersRes, activitiesRes] = await Promise.all([
    stageIds.size > 0
      ? supabaseServer
          .from("crm_stages")
          .select("*")
          .in("id", Array.from(stageIds))
      : Promise.resolve({ data: [] as unknown[] }),
    contactIds.size > 0
      ? supabaseServer
          .from("contacts")
          .select("id, display_name, company, country, country_code")
          .in("id", Array.from(contactIds))
      : Promise.resolve({ data: [] as unknown[] }),
    ownerIds.size > 0
      ? supabaseServer
          .from("accounts")
          .select("id, username, avatar_url, person:people(full_name, avatar_url)")
          .in("id", Array.from(ownerIds))
      : Promise.resolve({ data: [] as unknown[] }),
    supabaseServer
      .from("crm_activities")
      .select("*")
      .in(
        "opportunity_id",
        rows.map((r: { id: string }) => r.id),
      )
      .is("completed_at", null)
      .order("due_at", { ascending: true }),
  ]);

  const stagesById = new Map<string, unknown>(
    ((stagesRes.data ?? []) as Array<{ id: string }>).map((s) => [s.id, s]),
  );

  const contactsById = new Map<
    string,
    {
      id: string;
      display_name: string;
      company: string | null;
      country: string | null;
      country_code: string | null;
    }
  >();
  for (const c of (contactsRes.data ?? []) as Array<{
    id: string;
    display_name: string | null;
    company: string | null;
    country: string | null;
    country_code: string | null;
  }>) {
    contactsById.set(c.id, {
      id: c.id,
      display_name: c.display_name ?? "Untitled",
      company: c.company ?? null,
      country: c.country ?? null,
      country_code: c.country_code ?? null,
    });
  }

  const ownersById = new Map<
    string,
    { id: string; username: string; full_name: string | null; avatar_url: string | null }
  >();
  for (const o of (ownersRes.data ?? []) as Array<{
    id: string;
    username: string;
    avatar_url: string | null;
    person:
      | { full_name: string | null; avatar_url: string | null }
      | Array<{ full_name: string | null; avatar_url: string | null }>
      | null;
  }>) {
    const person = Array.isArray(o.person) ? o.person[0] ?? null : o.person;
    ownersById.set(o.id, {
      id: o.id,
      username: o.username,
      full_name: person?.full_name ?? null,
      avatar_url: person?.avatar_url ?? o.avatar_url,
    });
  }

  // Group activities by opportunity_id for the "next activity" card field.
  const activitiesByOpp = new Map<string, Array<{ due_at: string | null }>>();
  for (const a of (activitiesRes.data ?? []) as Array<{
    opportunity_id: string;
    due_at: string | null;
  }>) {
    const list = activitiesByOpp.get(a.opportunity_id) ?? [];
    list.push(a);
    activitiesByOpp.set(a.opportunity_id, list);
  }

  const now = Date.now();
  const enriched = (rows as Array<Record<string, unknown>>).map((r) => {
    const acts = activitiesByOpp.get(r.id as string) ?? [];
    const overdue = acts.filter(
      (a) => a.due_at && new Date(a.due_at).getTime() < now,
    ).length;
    return {
      ...r,
      stage: (r.stage_id && stagesById.get(r.stage_id as string)) || null,
      contact: (r.contact_id && contactsById.get(r.contact_id as string)) || null,
      owner: (r.owner_account_id && ownersById.get(r.owner_account_id as string)) || null,
      next_activity: acts[0] ?? null,
      activities_overdue: overdue,
      activities_pending: acts.length,
    };
  });

  return NextResponse.json({ opportunities: enriched });
}
