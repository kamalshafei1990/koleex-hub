"use client";

/* ---------------------------------------------------------------------------
   crm — Supabase data layer for the CRM pipeline app.

   Mirrors Odoo CRM's two core concepts:
     · Stages — pipeline columns (New / Qualified / Won …)
     · Opportunities — deals moving through stages, linked to a contact

   Plus a thin Activities helper for to-dos pinned to an opportunity.

   The helpers in this file are resilient: if the migration in
   supabase/migrations/create_crm_pipeline.sql hasn't been applied yet,
   every fetch returns an empty array / a stub success so the UI still
   renders an "empty pipeline" instead of throwing. Mutations log a
   console error and surface `{ ok: false, error }` so the form can
   show the failure message.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type {
  CrmActivityInsert,
  CrmActivityRow,
  CrmActivityType,
  CrmActivityUpdate,
  CrmOpportunityInsert,
  CrmOpportunityRow,
  CrmOpportunityUpdate,
  CrmOpportunityWithRelations,
  CrmStageInsert,
  CrmStageRow,
  CrmStageUpdate,
} from "@/types/supabase";

const STAGES = "crm_stages";
const OPPS = "crm_opportunities";
const ACTS = "crm_activities";

/** Fallback returned when the table doesn't exist yet. We sniff for
 *  the typical PostgREST messages so the UI degrades to "empty
 *  pipeline" rather than throwing. */
function isMissingTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("not found") ||
    m.includes("schema cache") ||
    m.includes("404")
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Stages
   ════════════════════════════════════════════════════════════════════════ */

/** All non-folded stages, ordered for kanban + select rendering. */
export async function fetchStages(): Promise<CrmStageRow[]> {
  const { data, error } = await supabase
    .from(STAGES)
    .select("*")
    .order("sequence", { ascending: true });
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[CRM] Fetch stages:", error.message);
    }
    return [];
  }
  return (data as CrmStageRow[]) ?? [];
}

export async function createStage(
  input: CrmStageInsert,
): Promise<CrmStageRow | null> {
  const { data, error } = await supabase
    .from(STAGES)
    .insert(input)
    .select("*")
    .single();
  if (error) {
    console.error("[CRM] Create stage:", error.message);
    return null;
  }
  return data as CrmStageRow;
}

export async function updateStage(
  id: string,
  patch: CrmStageUpdate,
): Promise<boolean> {
  const { error } = await supabase.from(STAGES).update(patch).eq("id", id);
  if (error) {
    console.error("[CRM] Update stage:", error.message);
    return false;
  }
  return true;
}

export async function deleteStage(id: string): Promise<boolean> {
  const { error } = await supabase.from(STAGES).delete().eq("id", id);
  if (error) {
    console.error("[CRM] Delete stage:", error.message);
    return false;
  }
  return true;
}

/* ════════════════════════════════════════════════════════════════════════
   Opportunities
   ════════════════════════════════════════════════════════════════════════ */

interface FetchOpportunitiesOptions {
  /** When true, archived rows are included. Defaults to false so the
   *  pipeline only shows live deals. */
  includeArchived?: boolean;
  /** Restrict to a single owner — used by the "My pipeline" filter. */
  ownerAccountId?: string | null;
  /** Restrict to a single stage. */
  stageId?: string | null;
  /** Restrict to a single contact — used by the Customer detail
   *  pipeline block to show all deals for one customer. */
  contactId?: string | null;
  /** Free-text search across name / company / contact / email. */
  search?: string | null;
  /** Maximum rows. Defaults to 500 (the kanban handles fewer than that
   *  comfortably; the list view paginates client-side). */
  limit?: number;
}

/** Fetch all opportunities with the joined data the kanban needs.
 *
 *  We do the joins client-side after fetching:
 *    1) the opportunity rows
 *    2) the stage rows (already cached separately)
 *    3) the contact rows for the linked contact_ids
 *    4) the owner accounts
 *    5) one batch of activities so each card can show "next activity"
 *
 *  This is faster than five embedded selects in PostgREST and easier
 *  to keep type-safe. The trade-off is N+1 queries — but with at most
 *  5 round-trips total, it's still well under 500ms. */
export async function fetchOpportunities(
  options: FetchOpportunitiesOptions = {},
): Promise<CrmOpportunityWithRelations[]> {
  const {
    includeArchived = false,
    ownerAccountId = null,
    stageId = null,
    contactId = null,
    search = null,
    limit = 500,
  } = options;

  let q = supabase
    .from(OPPS)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!includeArchived) q = q.is("archived_at", null);
  if (ownerAccountId) q = q.eq("owner_account_id", ownerAccountId);
  if (stageId) q = q.eq("stage_id", stageId);
  if (contactId) q = q.eq("contact_id", contactId);
  if (search && search.trim().length > 0) {
    const s = `%${search.trim()}%`;
    q = q.or(
      `name.ilike.${s},company_name.ilike.${s},contact_name.ilike.${s},email.ilike.${s}`,
    );
  }

  const { data, error } = await q;
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[CRM] Fetch opportunities:", error.message);
    }
    return [];
  }
  const rows = (data as CrmOpportunityRow[]) ?? [];
  if (rows.length === 0) return [];

  /* Collect FK ids in one pass so the follow-up fetches stay batched. */
  const stageIds = new Set<string>();
  const contactIds = new Set<string>();
  const ownerIds = new Set<string>();
  for (const r of rows) {
    if (r.stage_id) stageIds.add(r.stage_id);
    if (r.contact_id) contactIds.add(r.contact_id);
    if (r.owner_account_id) ownerIds.add(r.owner_account_id);
  }

  /* Stages — usually a handful, fetch all and key by id. */
  const stagesById = new Map<string, CrmStageRow>();
  if (stageIds.size > 0) {
    const { data: stages } = await supabase
      .from(STAGES)
      .select("*")
      .in("id", Array.from(stageIds));
    for (const s of (stages as CrmStageRow[]) ?? []) {
      stagesById.set(s.id, s);
    }
  }

  /* Contacts — display columns + country (used by Map view). */
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
  if (contactIds.size > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, display_name, company, country, country_code")
      .in("id", Array.from(contactIds));
    for (const c of (contacts as Array<{
      id: string;
      display_name: string | null;
      company: string | null;
      country: string | null;
      country_code: string | null;
    }>) ?? []) {
      contactsById.set(c.id, {
        id: c.id,
        display_name: c.display_name ?? "Untitled",
        company: c.company ?? null,
        country: c.country ?? null,
        country_code: c.country_code ?? null,
      });
    }
  }

  /* Owners — account + person join for the avatar + display name. */
  const ownersById = new Map<
    string,
    {
      id: string;
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    }
  >();
  if (ownerIds.size > 0) {
    const { data: owners } = await supabase
      .from("accounts")
      .select(
        "id, username, avatar_url, person:people ( full_name, avatar_url )",
      )
      .in("id", Array.from(ownerIds));
    type OwnerRow = {
      id: string;
      username: string;
      avatar_url: string | null;
      person:
        | { full_name: string | null; avatar_url: string | null }
        | Array<{ full_name: string | null; avatar_url: string | null }>
        | null;
    };
    for (const o of (owners as OwnerRow[]) ?? []) {
      const person = Array.isArray(o.person) ? o.person[0] ?? null : o.person;
      ownersById.set(o.id, {
        id: o.id,
        username: o.username,
        full_name: person?.full_name ?? null,
        avatar_url: o.avatar_url ?? person?.avatar_url ?? null,
      });
    }
  }

  /* Activities — batch fetch all activities for these opportunities, then
     bucket per opportunity. The card needs the next pending activity, the
     overdue count and the pending count. */
  const oppIds = rows.map((r) => r.id);
  const activitiesByOpp = new Map<string, CrmActivityRow[]>();
  if (oppIds.length > 0) {
    const { data: acts } = await supabase
      .from(ACTS)
      .select("*")
      .in("opportunity_id", oppIds)
      .is("done_at", null)
      .order("due_at", { ascending: true });
    for (const a of (acts as CrmActivityRow[]) ?? []) {
      const list = activitiesByOpp.get(a.opportunity_id) ?? [];
      list.push(a);
      activitiesByOpp.set(a.opportunity_id, list);
    }
  }

  const now = Date.now();
  return rows.map((r) => {
    const acts = activitiesByOpp.get(r.id) ?? [];
    const overdue = acts.filter(
      (a) => a.due_at && new Date(a.due_at).getTime() < now,
    ).length;
    return {
      ...r,
      stage: r.stage_id ? stagesById.get(r.stage_id) ?? null : null,
      contact: r.contact_id ? contactsById.get(r.contact_id) ?? null : null,
      owner: r.owner_account_id
        ? ownersById.get(r.owner_account_id) ?? null
        : null,
      next_activity: acts[0] ?? null,
      activities_overdue: overdue,
      activities_pending: acts.length,
    };
  });
}

/** Single opportunity with the same enrichment as fetchOpportunities. */
export async function fetchOpportunity(
  id: string,
): Promise<CrmOpportunityWithRelations | null> {
  const list = await fetchOpportunities({ includeArchived: true });
  return list.find((o) => o.id === id) ?? null;
}

/* ────────────────────────────────────────────────────────────────────
   Lifecycle sync: CRM → Contacts
   --------------------------------------------------------------------
   When a deal closes Won, reflect that on the linked customer record
   so the Customers app doesn't drift out of sync with reality. We:
     · promote `contact_type` from "company" (prospect) → "customer",
       idempotent for already-flagged customers
     · stamp `last_order_date` = today so the customer profile shows
       recency without another query
   Suppliers and employees are never promoted — those paths are
   deliberate. Failures are logged but never thrown: this one-way
   sync must not block the primary CRM write.
   ──────────────────────────────────────────────────────────────────── */

async function reflectWinOnContact(
  contactId: string | null | undefined,
): Promise<void> {
  if (!contactId) return;
  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .select("id, contact_type")
    .eq("id", contactId)
    .single();
  if (cErr || !contact) return;
  if (
    contact.contact_type === "employee" ||
    contact.contact_type === "supplier"
  ) {
    return;
  }
  const patch: Record<string, unknown> = {
    last_order_date: new Date().toISOString().slice(0, 10),
  };
  if (contact.contact_type !== "customer") {
    patch.contact_type = "customer";
  }
  const { error: uErr } = await supabase
    .from("contacts")
    .update(patch)
    .eq("id", contactId);
  if (uErr) {
    console.error("[CRM→Contacts] Lifecycle sync:", uErr.message);
  }
}

/** True when the given stage id is flagged `is_won`. Used by the
 *  opportunity mutation helpers to decide whether to fan out a
 *  lifecycle sync. */
async function isWonStageId(stageId: string | null | undefined): Promise<boolean> {
  if (!stageId) return false;
  const { data, error } = await supabase
    .from(STAGES)
    .select("is_won")
    .eq("id", stageId)
    .single();
  if (error) return false;
  return Boolean(data?.is_won);
}

export async function createOpportunity(
  input: CrmOpportunityInsert,
): Promise<
  | { ok: true; opportunity: CrmOpportunityRow }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase
    .from(OPPS)
    .insert(input)
    .select("*")
    .single();
  if (error) {
    console.error("[CRM] Create opportunity:", error.message);
    return { ok: false, error: error.message };
  }
  const opp = data as CrmOpportunityRow;
  // Rare but possible: a deal is created directly in a Won stage
  // (backfill, import, etc). Sync so we don't leak a prospect that's
  // actually a customer.
  if (await isWonStageId(opp.stage_id)) {
    await reflectWinOnContact(opp.contact_id);
  }
  return { ok: true, opportunity: opp };
}

export async function updateOpportunity(
  id: string,
  patch: CrmOpportunityUpdate,
): Promise<boolean> {
  const { error } = await supabase.from(OPPS).update(patch).eq("id", id);
  if (error) {
    console.error("[CRM] Update opportunity:", error.message);
    return false;
  }
  // If the edit touched the stage and landed in Won, mirror onto the
  // contact. Reads the row fresh so we pick up the *current* contact
  // even if the patch reassigned it in the same call.
  if (patch.stage_id && (await isWonStageId(patch.stage_id))) {
    const { data: opp } = await supabase
      .from(OPPS)
      .select("contact_id")
      .eq("id", id)
      .single();
    await reflectWinOnContact(opp?.contact_id);
  }
  return true;
}

/** Move an opportunity to a new stage. Updates `won_at` / `lost_at`
 *  bookkeeping when crossing into a Won / Lost stage so the reporting
 *  layer doesn't have to second-guess. */
export async function moveOpportunityToStage(input: {
  opportunityId: string;
  stageId: string;
  isWonStage: boolean;
}): Promise<boolean> {
  const patch: CrmOpportunityUpdate = {
    stage_id: input.stageId,
  };
  if (input.isWonStage) {
    patch.won_at = new Date().toISOString();
    patch.probability = 100;
  }
  const { error } = await supabase
    .from(OPPS)
    .update(patch)
    .eq("id", input.opportunityId);
  if (error) {
    console.error("[CRM] Move opportunity:", error.message);
    return false;
  }
  // Primary kanban / detail-view write path for moving into Won.
  if (input.isWonStage) {
    const { data: opp } = await supabase
      .from(OPPS)
      .select("contact_id")
      .eq("id", input.opportunityId)
      .single();
    await reflectWinOnContact(opp?.contact_id);
  }
  return true;
}

/** Mark an opportunity as lost. Stamps `lost_at`, captures the reason,
 *  drops probability to 0, and archives the row so it disappears from
 *  the live pipeline (filterable from the list view). */
export async function markOpportunityLost(
  id: string,
  reason: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(OPPS)
    .update({
      lost_reason: reason,
      lost_at: now,
      probability: 0,
      archived_at: now,
    })
    .eq("id", id);
  if (error) {
    console.error("[CRM] Mark lost:", error.message);
    return false;
  }
  return true;
}

export async function archiveOpportunity(id: string): Promise<boolean> {
  const { error } = await supabase
    .from(OPPS)
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[CRM] Archive opportunity:", error.message);
    return false;
  }
  return true;
}

export async function unarchiveOpportunity(id: string): Promise<boolean> {
  const { error } = await supabase
    .from(OPPS)
    .update({ archived_at: null })
    .eq("id", id);
  if (error) {
    console.error("[CRM] Unarchive opportunity:", error.message);
    return false;
  }
  return true;
}

export async function deleteOpportunity(id: string): Promise<boolean> {
  const { error } = await supabase.from(OPPS).delete().eq("id", id);
  if (error) {
    console.error("[CRM] Delete opportunity:", error.message);
    return false;
  }
  return true;
}

/* ════════════════════════════════════════════════════════════════════════
   Activities
   ════════════════════════════════════════════════════════════════════════ */

export async function fetchActivities(
  opportunityId: string,
): Promise<CrmActivityRow[]> {
  const { data, error } = await supabase
    .from(ACTS)
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[CRM] Fetch activities:", error.message);
    }
    return [];
  }
  return (data as CrmActivityRow[]) ?? [];
}

export async function createActivity(
  input: CrmActivityInsert,
): Promise<CrmActivityRow | null> {
  const { data, error } = await supabase
    .from(ACTS)
    .insert(input)
    .select("*")
    .single();
  if (error) {
    console.error("[CRM] Create activity:", error.message);
    return null;
  }
  return data as CrmActivityRow;
}

export async function updateActivity(
  id: string,
  patch: CrmActivityUpdate,
): Promise<boolean> {
  const { error } = await supabase.from(ACTS).update(patch).eq("id", id);
  if (error) {
    console.error("[CRM] Update activity:", error.message);
    return false;
  }
  return true;
}

export async function completeActivity(id: string): Promise<boolean> {
  return updateActivity(id, { done_at: new Date().toISOString() });
}

export async function reopenActivity(id: string): Promise<boolean> {
  return updateActivity(id, { done_at: null });
}

export async function deleteActivity(id: string): Promise<boolean> {
  const { error } = await supabase.from(ACTS).delete().eq("id", id);
  if (error) {
    console.error("[CRM] Delete activity:", error.message);
    return false;
  }
  return true;
}

/* ════════════════════════════════════════════════════════════════════════
   Pipeline aggregate metrics
   ════════════════════════════════════════════════════════════════════════ */

/** Pipeline summary used by the CRM dashboard strip:
 *    · total active opportunities
 *    · weighted forecast (sum of expected_revenue * probability/100)
 *    · won this month value
 *    · lost this month count
 */
export interface PipelineSummary {
  totalActive: number;
  weightedForecast: number;
  totalRevenue: number;
  wonThisMonthValue: number;
  wonThisMonthCount: number;
  lostThisMonthCount: number;
}

export function summarizePipeline(
  opps: CrmOpportunityWithRelations[],
): PipelineSummary {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let totalActive = 0;
  let totalRevenue = 0;
  let weighted = 0;
  let wonValue = 0;
  let wonCount = 0;
  let lostCount = 0;

  for (const o of opps) {
    if (!o.archived_at && !o.lost_at) {
      totalActive += 1;
      totalRevenue += Number(o.expected_revenue) || 0;
      weighted +=
        ((Number(o.expected_revenue) || 0) * (Number(o.probability) || 0)) /
        100;
    }
    if (o.won_at && new Date(o.won_at).getTime() >= monthStart) {
      wonCount += 1;
      wonValue += Number(o.expected_revenue) || 0;
    }
    if (o.lost_at && new Date(o.lost_at).getTime() >= monthStart) {
      lostCount += 1;
    }
  }

  return {
    totalActive,
    totalRevenue,
    weightedForecast: weighted,
    wonThisMonthValue: wonValue,
    wonThisMonthCount: wonCount,
    lostThisMonthCount: lostCount,
  };
}

/* ════════════════════════════════════════════════════════════════════════
   Generate sample leads — equivalent of Odoo's "Generate Leads" wizard,
   but instead of pulling from a paid lead database, we seed N realistic
   sample opportunities so the user has something to play with. Useful
   for new installs and demos. The pool below is deliberately broad so
   pipelines look populated rather than templated.
   ════════════════════════════════════════════════════════════════════════ */

const SAMPLE_COMPANIES: ReadonlyArray<{
  name: string;
  contact: string;
  email: string;
  phone: string;
  source: string;
  tags: string[];
}> = [
  { name: "Sinopec Engineering Group", contact: "Wei Zhang",       email: "wei.zhang@sinopec.cn",    phone: "+86 10 5996 0114", source: "Referral",  tags: ["Energy", "Strategic"] },
  { name: "Petrobras Refining",        contact: "Lucas Almeida",   email: "lucas@petrobras.com.br",  phone: "+55 21 3224 1500", source: "Inbound",   tags: ["LATAM", "Refinery"] },
  { name: "Aramco Trading",            contact: "Khalid Al-Saud",  email: "k.alsaud@aramco.com",     phone: "+966 13 872 0000", source: "Referral",  tags: ["GCC", "Trading"] },
  { name: "Reliance Petrochemicals",   contact: "Priya Iyer",      email: "priya.iyer@ril.com",      phone: "+91 22 3555 5000", source: "Website",   tags: ["APAC", "Chemicals"] },
  { name: "Shell Exploration UK",      contact: "James Whitfield", email: "j.whitfield@shell.com",   phone: "+44 20 7934 1234", source: "Trade Show",tags: ["Upstream"] },
  { name: "TotalEnergies LNG",         contact: "Camille Bernard", email: "camille.b@totalenergies.com", phone: "+33 1 47 44 45 46", source: "Partner",   tags: ["LNG", "EMEA"] },
  { name: "ADNOC Distribution",        contact: "Aisha Al-Hashmi", email: "a.alhashmi@adnoc.ae",     phone: "+971 2 606 0000",  source: "Inbound",   tags: ["GCC", "Retail"] },
  { name: "Equinor North Sea",         contact: "Henrik Larsen",   email: "henrik@equinor.com",      phone: "+47 51 99 00 00",  source: "Referral",  tags: ["Offshore"] },
  { name: "Pemex Logistics",           contact: "Sofia Ramirez",   email: "sofia@pemex.mx",          phone: "+52 55 1944 9700", source: "Cold call", tags: ["LATAM"] },
  { name: "Chevron Upstream",          contact: "Robert Pierce",   email: "rpierce@chevron.com",     phone: "+1 925 842 1000",  source: "Website",   tags: ["Upstream", "USA"] },
  { name: "Eni Refining",              contact: "Marco Rossi",     email: "marco.rossi@eni.com",     phone: "+39 06 5982 1",    source: "Trade Show",tags: ["Refinery", "EMEA"] },
  { name: "BP Castrol Lubricants",     contact: "Olivia Hughes",   email: "o.hughes@bp.com",         phone: "+44 20 7496 4000", source: "Inbound",   tags: ["Lubricants"] },
  { name: "QatarEnergy LNG",           contact: "Mohammed Al-Thani", email: "m.althani@qatarenergy.qa", phone: "+974 4013 1111", source: "Partner",   tags: ["LNG", "GCC"] },
  { name: "Lukoil Trading",            contact: "Alexei Petrov",   email: "petrov@lukoil-trading.ch",phone: "+41 22 906 8888",  source: "Cold call", tags: ["Trading"] },
  { name: "Gazprom Neft",              contact: "Yana Sokolova",   email: "y.sokolova@gazprom-neft.ru", phone: "+7 812 363 3152",  source: "Referral",  tags: ["Upstream"] },
  { name: "Repsol Industrial",         contact: "Diego Martín",    email: "d.martin@repsol.com",     phone: "+34 91 753 8000",  source: "Inbound",   tags: ["EMEA"] },
];

interface GenerateLeadsOptions {
  /** Number of leads to create. Capped at the size of the sample pool. */
  count: number;
  /** Stage to drop the new leads in. Defaults to the lowest-sequence stage. */
  stageId?: string | null;
  /** Owner account assigned to every generated lead. */
  ownerAccountId?: string | null;
  /** Sales team / source override (free text on the opportunity row). */
  source?: string | null;
}

export async function generateLeads(
  options: GenerateLeadsOptions,
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const { count, stageId, ownerAccountId, source } = options;
  const safeCount = Math.max(1, Math.min(SAMPLE_COMPANIES.length, count));

  /* Shuffle a copy so each call gives a different sample. */
  const pool = [...SAMPLE_COMPANIES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, safeCount);

  const now = Date.now();
  const rows: CrmOpportunityInsert[] = picks.map((p, i) => {
    const revenue = 25_000 + Math.floor(Math.random() * 475_000);
    const probability = 10 + Math.floor(Math.random() * 4) * 10; // 10/20/30/40
    const dueOffset = (7 + Math.floor(Math.random() * 60)) * 86_400_000;
    return {
      name: `${p.name} — ${["KX-9000 reorder", "Pilot quote", "Annual contract", "RFQ response", "Site survey"][i % 5]}`,
      description: null,
      stage_id: stageId ?? null,
      contact_id: null,
      company_name: p.name,
      contact_name: p.contact,
      email: p.email,
      phone: p.phone,
      expected_revenue: revenue,
      probability,
      expected_close_date: new Date(now + dueOffset).toISOString().slice(0, 10),
      priority: Math.floor(Math.random() * 4),
      source: source ?? p.source,
      tags: p.tags,
      color: i % 12,
      owner_account_id: ownerAccountId ?? null,
      lost_reason: null,
      won_at: null,
      lost_at: null,
      archived_at: null,
    };
  });

  const { error } = await supabase.from(OPPS).insert(rows);
  if (error) {
    console.error("[CRM] Generate leads:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, created: rows.length };
}

/* ════════════════════════════════════════════════════════════════════════
   Activity view feed — every pending activity across every opportunity,
   used to populate the Activity view's matrix. We bring back the parent
   opportunity name + stage so the row can be rendered without an extra
   round-trip.
   ════════════════════════════════════════════════════════════════════════ */

export interface ActivityFeedRow extends CrmActivityRow {
  opportunity: {
    id: string;
    name: string;
    company_name: string | null;
    stage_id: string | null;
  } | null;
}

export async function fetchActivityFeed(): Promise<ActivityFeedRow[]> {
  const { data: acts, error } = await supabase
    .from(ACTS)
    .select("*")
    .order("due_at", { ascending: true });
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[CRM] Fetch activity feed:", error.message);
    }
    return [];
  }
  const rows = (acts as CrmActivityRow[]) ?? [];
  if (rows.length === 0) return [];

  const oppIds = Array.from(new Set(rows.map((r) => r.opportunity_id)));
  const { data: opps } = await supabase
    .from(OPPS)
    .select("id, name, company_name, stage_id")
    .in("id", oppIds);
  const byId = new Map(
    ((opps as Array<{
      id: string;
      name: string;
      company_name: string | null;
      stage_id: string | null;
    }>) ?? []).map((o) => [o.id, o]),
  );

  return rows.map((r) => ({
    ...r,
    opportunity: byId.get(r.opportunity_id) ?? null,
  }));
}

/* ════════════════════════════════════════════════════════════════════════
   Helpers re-exported for the UI
   ════════════════════════════════════════════════════════════════════════ */

export type { CrmActivityType };
