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

import type { ScopeContext } from "./scope";
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


/* ════════════════════════════════════════════════════════════════════════
   Contact picker search (Phase 4 Wave 2B.2)
   ════════════════════════════════════════════════════════════════════════ */

/** Slim contact shape returned by the bounded picker endpoint. Mirrors the
 *  server `CrmContactPick` — only the fields the combobox renders. */
export interface CrmContactPick {
  id: string;
  display_name: string;
  full_name: string;
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  entity_type: string;
  contact_type: string;
  photo_url: string | null;
}

/** Bounded, cancellable contact search for the CRM deal modal. Replaces the
 *  old "download the whole directory, filter client-side" pattern. Returns
 *  at most `limit` slim rows; queries shorter than 2 chars resolve to [] on
 *  the server so we never stream the book. Pass an AbortSignal so a newer
 *  keystroke cancels an in-flight request. */
export async function searchCrmContacts(
  q: string,
  opts?: { kind?: "company" | "person"; limit?: number; signal?: AbortSignal; browse?: boolean },
): Promise<CrmContactPick[]> {
  const needle = q.trim();
  /* Empty needle + browse → first page (picker's browse-on-focus list). */
  const browse = needle.length === 0 && opts?.browse === true;
  if (needle.length < 2 && !browse) return [];
  const params = new URLSearchParams({ q: needle });
  if (browse) params.set("browse", "1");
  if (opts?.kind) params.set("kind", opts.kind);
  if (opts?.limit) params.set("limit", String(opts.limit));
  try {
    const res = await fetch(`/api/crm/contacts/search?${params.toString()}`, {
      credentials: "include",
      signal: opts?.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { rows?: CrmContactPick[] };
    return json.rows ?? [];
  } catch (e) {
    // AbortError is expected when a newer keystroke supersedes this one —
    // swallow it silently; anything else is a transient network blip.
    if ((e as { name?: string } | null)?.name !== "AbortError") {
      console.error("[CRM] searchCrmContacts failed:", e);
    }
    return [];
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Stages
   ════════════════════════════════════════════════════════════════════════ */

/** All non-folded stages, ordered for kanban + select rendering.
 *
 *  Tries the server-side /api/crm/stages route first (which uses the
 *  service-role key and enforces auth + permission + tenant scope on
 *  the server). Falls back to the legacy anon-key direct query when the
 *  API returns a network error, so anything calling this without a
 *  session (server-side migrations, tests) still works during the
 *  transition. Will be removed once RLS deny-by-default is enabled
 *  across all tables. */
export async function fetchStages(): Promise<CrmStageRow[]> {
  try {
    const res = await fetch("/api/crm/stages", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { stages: CrmStageRow[] };
      return json.stages;
    }
    if (res.status !== 401 && res.status !== 403) {
      console.error("[CRM] fetchStages:", res.status);
    }
    return [];
  } catch (e) {
    console.error("[CRM] fetchStages failed:", e);
    return [];
  }
}

export async function createStage(
  input: CrmStageInsert,
): Promise<CrmStageRow | null> {
  try {
    const res = await fetch("/api/crm/stages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = (await res.json()) as { stage: CrmStageRow | null };
      return json.stage;
    }
    if (res.status === 401 || res.status === 403) return null;
  } catch (e) {
    console.error("[CRM] createStage failed:", e);
    return null;
  }
  return null;
}

export async function updateStage(
  id: string,
  patch: CrmStageUpdate,
): Promise<boolean> {
  try {
    const res = await fetch("/api/crm/stages/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] updateStage failed:", e);
    return false;
  }
  return false;
}

export async function deleteStage(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/crm/stages/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] deleteStage failed:", e);
    return false;
  }
  return false;
}

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
  /** Scope context for multi-tenant filtering. When provided, the query
   *  is automatically scoped to the viewer's tenant_id — a customer-
   *  tenant account never sees Koleex opportunities and vice versa.
   *  Legacy callers pass nothing and get the old behaviour (which is safe
   *  only while Koleex is the only tenant). */
  ctx?: ScopeContext | null;
  /** Maximum rows. Defaults to 500 (the kanban handles fewer than that
   *  comfortably; the list view paginates client-side). */
  limit?: number;
  /** "board" requests the slim projection (no free-text `description`) for
   *  the resting kanban; the modal hydrates the full row on open. Omit for
   *  the full projection (default, backward-compatible). */
  view?: "board" | "full";
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
    view = null,
  } = options;

  /* The route returns the enriched shape, scoped to the caller's tenant from
     the session cookie. `options.ctx` is accepted for call-site compatibility
     and deliberately ignored — a scope the browser assembled for itself was
     never what decided the answer. */
  try {
    const params = new URLSearchParams();
    if (includeArchived) params.set("includeArchived", "1");
    if (ownerAccountId) params.set("owner", ownerAccountId);
    if (stageId) params.set("stage", stageId);
    if (contactId) params.set("contact", contactId);
    if (search) params.set("search", search);
    if (limit !== 500) params.set("limit", String(limit));
    if (view === "board") params.set("view", "board");
    const qs = params.toString();
    const res = await fetch(
      "/api/crm/opportunities" + (qs ? "?" + qs : ""),
      { credentials: "include" },
    );
    if (res.ok) {
      const json = (await res.json()) as {
        opportunities: CrmOpportunityWithRelations[];
      };
      return json.opportunities;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[CRM] fetchOpportunities failed:", e);
    return [];
  }
  return [];
}

/** Single opportunity with the same enrichment as fetchOpportunities. */
export async function fetchOpportunity(
  id: string,
): Promise<CrmOpportunityWithRelations | null> {
  /* Single-row full fetch (incl. the free-text `description` that the board
     projection omits). Used to hydrate the edit modal on open. Falls back to
     scanning the full list only if the dedicated route is unreachable. */
  try {
    const res = await fetch(`/api/crm/opportunities/${id}`, {
      credentials: "include",
    });
    if (res.ok) {
      const json = (await res.json()) as {
        opportunity?: CrmOpportunityWithRelations;
      };
      if (json.opportunity) return json.opportunity;
    }
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
      console.error("[CRM] fetchOpportunity:", res.status);
    }
    return null;
  } catch (e) {
    console.error("[CRM] fetchOpportunity failed:", e);
    return null;
  }
}

export async function createOpportunity(
  input: CrmOpportunityInsert,
): Promise<
  | { ok: true; opportunity: CrmOpportunityRow }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/crm/opportunities", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = (await res.json()) as { opportunity: CrmOpportunityRow };
      return { ok: true, opportunity: json.opportunity };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Not authorized" };
    }
    const err = await res.json().catch(() => ({ error: "Failed" }));
    return { ok: false, error: (err as { error?: string }).error ?? "Failed" };
  } catch (e) {
    console.error("[CRM] createOpportunity failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateOpportunity(
  id: string,
  patch: CrmOpportunityUpdate,
): Promise<boolean> {
  try {
    const res = await fetch("/api/crm/opportunities/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] updateOpportunity failed:", e);
    return false;
  }
  return false;
}

/** Move an opportunity to a new stage. Updates `won_at` / `lost_at`
 *  bookkeeping when crossing into a Won / Lost stage so the reporting
 *  layer doesn't have to second-guess. */
export async function moveOpportunityToStage(input: {
  opportunityId: string;
  stageId: string;
  isWonStage: boolean;
}): Promise<boolean> {
  try {
    const res = await fetch(
      "/api/crm/opportunities/" + input.opportunityId + "/move",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: input.stageId,
          isWonStage: input.isWonStage,
        }),
      },
    );
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] moveOpportunityToStage failed:", e);
    return false;
  }
  return false;
}

/** Mark an opportunity as lost. Stamps `lost_at`, captures the reason,
 *  drops probability to 0, and archives the row so it disappears from
 *  the live pipeline (filterable from the list view). */
export async function markOpportunityLost(
  id: string,
  reason: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/crm/opportunities/" + id + "/lost", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] markOpportunityLost failed:", e);
    return false;
  }
  return false;
}

export async function archiveOpportunity(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/crm/opportunities/" + id + "/archive", {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] archiveOpportunity failed:", e);
    return false;
  }
  return false;
}

export async function unarchiveOpportunity(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/crm/opportunities/" + id + "/archive", {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] unarchiveOpportunity failed:", e);
    return false;
  }
  return false;
}

export async function deleteOpportunity(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/crm/opportunities/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] deleteOpportunity failed:", e);
    return false;
  }
  return false;
}

/* ════════════════════════════════════════════════════════════════════════
   Activities
   ════════════════════════════════════════════════════════════════════════ */

export async function fetchActivities(
  opportunityId: string,
): Promise<CrmActivityRow[]> {
  try {
    const res = await fetch(
      `/api/crm/activities?opportunityId=${encodeURIComponent(opportunityId)}`,
      { credentials: "include" },
    );
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) {
        console.error("[CRM] fetchActivities:", res.status);
      }
      return [];
    }
    const json = (await res.json()) as { activities: CrmActivityRow[] };
    return json.activities ?? [];
  } catch (e) {
    console.error("[CRM] fetchActivities failed:", e);
    return [];
  }
}

export async function createActivity(
  input: CrmActivityInsert,
): Promise<CrmActivityRow | null> {
  try {
    const res = await fetch("/api/crm/activities", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = (await res.json()) as { activity: CrmActivityRow | null };
      return json.activity;
    }
    if (res.status === 401 || res.status === 403) return null;
  } catch (e) {
    console.error("[CRM] createActivity failed:", e);
    return null;
  }
  return null;
}

export async function updateActivity(
  id: string,
  patch: CrmActivityUpdate,
): Promise<boolean> {
  try {
    const res = await fetch("/api/crm/activities/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] updateActivity failed:", e);
    return false;
  }
  return false;
}

export async function completeActivity(id: string): Promise<boolean> {
  return updateActivity(id, { done_at: new Date().toISOString() });
}

export async function reopenActivity(id: string): Promise<boolean> {
  return updateActivity(id, { done_at: null });
}

export async function deleteActivity(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/crm/activities/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[CRM] deleteActivity failed:", e);
    return false;
  }
  return false;
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

  /* Posted one by one through the same gated route a real deal goes through,
     rather than a bulk insert from the browser: the demo rows then get the
     tenant, the creator and every server-side default that a hand-made
     opportunity gets, instead of whatever the browser happened to send. */
  let created = 0;
  for (const row of rows) {
    try {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (res.ok) created += 1;
      else if (created === 0) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        return { ok: false, error: err?.error ?? `HTTP ${res.status}` };
      }
    } catch (e) {
      if (created === 0) return { ok: false, error: e instanceof Error ? e.message : "Failed" };
    }
  }
  return { ok: true, created };
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
  /* The route joins each activity to its opportunity, so the row renders
     without a second round trip. Tenant scope comes from the session — the
     `ctx` this used to take was assembled in the browser. */
  try {
    const res = await fetch("/api/crm/activities?feed=1", { credentials: "include" });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) {
        console.error("[CRM] fetchActivityFeed:", res.status);
      }
      return [];
    }
    const json = (await res.json()) as { activities: ActivityFeedRow[] };
    return json.activities ?? [];
  } catch (e) {
    console.error("[CRM] fetchActivityFeed failed:", e);
    return [];
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Helpers re-exported for the UI
   ════════════════════════════════════════════════════════════════════════ */

export type { CrmActivityType };
