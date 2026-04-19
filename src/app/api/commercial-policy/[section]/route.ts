import "server-only";

/* PATCH /api/commercial-policy/[section]
   Batch-upsert editable rows for one section of the Commercial Policy.
   Gated to super_admin / admin / general_manager — same as the read
   endpoint. Each section has its own allowed-field whitelist + basic
   validation; anything unknown is rejected.

   Body shape:
     - section "settings":
         { row: { fx_cny_per_usd, sales_sees_cost, notes } }
     - other sections:
         { rows: [{ id, ...editableFields }] }
       Rows are matched by id and must already exist — we upsert by
       (tenant_id, id) with a strict allowlist so code drift can't
       sneak fields through.

   Returns the fresh section payload so the client can patch its
   local snapshot without a second round-trip. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

type AuthCtx = Awaited<ReturnType<typeof requireAuth>>;

/* ─── Section config ────────────────────────────────────────────── */

interface SectionCfg {
  table: string;
  /** Columns that the admin UI can change. Anything else in the body
   *  is silently dropped. Makes the endpoint safe to expose even if a
   *  future client sends extra fields. */
  editableFields: readonly string[];
  /** Validation — throws to produce a 400 with a readable message. */
  validate?: (row: Record<string, unknown>) => void;
  /** Column that stores the human-derivable unique key (e.g. `code`
   *  for product levels, `role_slug` for approval authority). Used
   *  when INSERTing a new row to auto-generate the key from a
   *  name-like field so the user just types a display name. Settings
   *  has no insert path, so `null`. */
  slugColumn: string | null;
  /** Field the insert path reads to derive the slug. */
  slugSourceField: string | null;
  /** Sensible defaults for columns that are NOT NULL in the schema but
   *  aren't surfaced in the UI when adding a row. Lets a user fire
   *  "add row" → type a name → save, without the server rejecting
   *  because `applies_to` was missing. */
  insertDefaults?: Record<string, unknown>;
}

const POLICY_ADMIN_ROLES = new Set<string>([
  "super_admin",
  "admin",
  "general_manager",
]);

const SECTIONS: Record<string, SectionCfg> = {
  settings: {
    table: "commercial_settings",
    editableFields: ["fx_cny_per_usd", "sales_sees_cost", "notes"],
    slugColumn: null,
    slugSourceField: null,
    validate: (row) => {
      const fx = Number(row.fx_cny_per_usd);
      if (!Number.isFinite(fx) || fx <= 0 || fx > 100) {
        throw new Error("fx_cny_per_usd must be between 0.01 and 100");
      }
    },
  },
  "product-levels": {
    table: "commercial_product_levels",
    editableFields: [
      "name",
      "min_cost_cny",
      "max_cost_cny",
      "margin_percent",
      "min_margin_percent",
      "is_active",
      "sort_order",
    ],
    slugColumn: "code",
    slugSourceField: "name",
    insertDefaults: {
      is_active: true,
      min_cost_cny: 0,
      max_cost_cny: null,
      margin_percent: 0,
      min_margin_percent: 0,
    },
    validate: (row) => {
      requirePercent(row.margin_percent, "margin_percent");
      requirePercent(row.min_margin_percent, "min_margin_percent");
      const min = Number(row.min_cost_cny);
      const max = row.max_cost_cny === null ? null : Number(row.max_cost_cny);
      if (!Number.isFinite(min) || min < 0) throw new Error("min_cost_cny must be >= 0");
      if (max !== null && (!Number.isFinite(max) || max <= min)) {
        throw new Error("max_cost_cny must be > min_cost_cny or null");
      }
    },
  },
  "customer-tiers": {
    table: "commercial_customer_tiers",
    editableFields: [
      "name",
      "real_name",
      "level_number",
      "discount_cap_percent",
      "has_credit",
      "credit_multiplier",
      "credit_days",
      "market_rights",
      "is_active",
      "sort_order",
    ],
    slugColumn: "code",
    slugSourceField: "name",
    insertDefaults: {
      is_active: true,
      has_credit: false,
      level_number: 0,
      discount_cap_percent: 0,
    },
    validate: (row) => {
      requirePercent(row.discount_cap_percent, "discount_cap_percent");
      if (row.credit_days !== null && row.credit_days !== undefined) {
        const n = Number(row.credit_days);
        if (!Number.isFinite(n) || n < 0 || n > 1000) {
          throw new Error("credit_days must be between 0 and 1000 or null");
        }
      }
    },
  },
  "market-bands": {
    table: "commercial_market_bands",
    editableFields: [
      "name",
      "label",
      "adjustment_percent",
      "is_flexible",
      "flex_min_percent",
      "flex_max_percent",
      "description",
      "is_active",
      "sort_order",
    ],
    slugColumn: "code",
    slugSourceField: "name",
    insertDefaults: {
      is_active: true,
      is_flexible: false,
      adjustment_percent: 0,
    },
    validate: (row) => {
      requireSignedPercent(row.adjustment_percent, "adjustment_percent");
      if (row.is_flexible) {
        const lo = row.flex_min_percent;
        const hi = row.flex_max_percent;
        if (lo !== null && lo !== undefined) requireSignedPercent(lo, "flex_min_percent");
        if (hi !== null && hi !== undefined) requireSignedPercent(hi, "flex_max_percent");
      }
    },
  },
  "channel-multipliers": {
    table: "commercial_channel_multipliers",
    editableFields: ["name", "applies_to_tier", "multiplier", "is_active", "sort_order"],
    slugColumn: "code",
    slugSourceField: "name",
    insertDefaults: { is_active: true, multiplier: 1 },
    validate: (row) => {
      const m = Number(row.multiplier);
      if (!Number.isFinite(m) || m <= 0 || m > 10) {
        throw new Error("multiplier must be between 0.0001 and 10");
      }
    },
  },
  "discount-tiers": {
    table: "commercial_discount_tiers",
    editableFields: [
      "label",
      "min_percent",
      "max_percent",
      "approver_role",
      "is_active",
      "sort_order",
    ],
    slugColumn: "code",
    slugSourceField: "label",
    insertDefaults: { is_active: true, min_percent: 0, approver_role: "salesperson" },
    validate: (row) => {
      requirePercent(row.min_percent, "min_percent");
      if (row.max_percent !== null && row.max_percent !== undefined) {
        requirePercent(row.max_percent, "max_percent");
        if (Number(row.max_percent) <= Number(row.min_percent)) {
          throw new Error("max_percent must be greater than min_percent or null");
        }
      }
    },
  },
  "commission-tiers": {
    table: "commercial_commission_tiers",
    editableFields: ["name", "rate_percent", "applies_to", "is_active", "sort_order"],
    slugColumn: "code",
    slugSourceField: "name",
    insertDefaults: { is_active: true, rate_percent: 0, applies_to: "All sales" },
    validate: (row) => {
      requirePercent(row.rate_percent, "rate_percent");
    },
  },
  "approval-authority": {
    table: "commercial_approval_authority",
    editableFields: ["role_label", "level", "can_approve", "is_active", "sort_order"],
    slugColumn: "role_slug",
    slugSourceField: "role_label",
    insertDefaults: { is_active: true, level: 1, can_approve: [] },
    validate: (row) => {
      const n = Number(row.level);
      if (!Number.isInteger(n) || n < 1 || n > 10) {
        throw new Error("level must be an integer between 1 and 10");
      }
      if (row.can_approve !== undefined && !Array.isArray(row.can_approve)) {
        throw new Error("can_approve must be an array of strings");
      }
    },
  },
};

/** Turn a human string into a safe slug. Used when INSERTing a new row
 *  so the user only types a display name; the code/slug column is
 *  derived automatically. Collisions are resolved by the caller. */
function slugify(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  const out = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return out || `row_${Math.random().toString(36).slice(2, 8)}`;
}

/* ─── Handler ───────────────────────────────────────────────────── */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params;
  const cfg = SECTIONS[section];
  if (!cfg) {
    return NextResponse.json({ error: `Unknown section '${section}'` }, { status: 404 });
  }

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const allowed = await callerHasPolicyAccess(auth.role_id, auth.is_super_admin);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorised to edit the commercial policy" }, { status: 403 });
  }

  let body: {
    row?: Record<string, unknown>;
    rows?: Record<string, unknown>[];
    deletedIds?: string[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  /* Settings is a singleton — always at most one row per tenant. Every
     other section is multi-row and ships an array. Branch once here so
     downstream code has a uniform rows[] to iterate. */
  const inboundRows: Record<string, unknown>[] =
    section === "settings"
      ? body.row
        ? [{ ...body.row, id: undefined }]
        : []
      : Array.isArray(body.rows)
        ? body.rows
        : [];
  const deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : [];

  if (inboundRows.length === 0 && deletedIds.length === 0) {
    return NextResponse.json({ error: "No rows to update" }, { status: 400 });
  }

  /* Partition inbound rows into updates (have id) vs inserts (no id).
     Build the payload with ONLY whitelisted fields + the audit stamp,
     so a client can't sneak in e.g. tenant_id changes. */
  const now = new Date().toISOString();
  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];

  for (const raw of inboundRows) {
    const out: Record<string, unknown> = {
      tenant_id: auth.tenant_id,
      updated_at: now,
      updated_by: auth.account_id,
    };
    for (const field of cfg.editableFields) {
      if (Object.prototype.hasOwnProperty.call(raw, field)) {
        out[field] = raw[field];
      }
    }
    const hasId = typeof raw.id === "string" && raw.id.length > 0;
    if (section === "settings" || hasId) {
      if (hasId) out.id = raw.id as string;
      try { cfg.validate?.(out); } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid row" },
          { status: 400 },
        );
      }
      updates.push(out);
    } else {
      // INSERT path: fill NOT-NULL defaults the UI didn't surface.
      for (const [k, v] of Object.entries(cfg.insertDefaults ?? {})) {
        if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = v;
      }
      try { cfg.validate?.(out); } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid row" },
          { status: 400 },
        );
      }
      inserts.push(out);
    }
  }

  /* Apply deletes first so a user can remove a row and add a new one
     with the same name in the same save. Scoped to tenant_id at the
     query level — no accidental cross-tenant deletes. */
  if (deletedIds.length > 0 && section !== "settings") {
    const { error } = await supabaseServer
      .from(cfg.table)
      .delete()
      .eq("tenant_id", auth.tenant_id)
      .in("id", deletedIds);
    if (error) {
      console.error(`[cp/${section} delete]`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  /* Settings — singleton upsert. */
  if (section === "settings") {
    if (updates[0]) {
      const { error } = await supabaseServer
        .from(cfg.table)
        .upsert(updates[0], { onConflict: "tenant_id" });
      if (error) {
        console.error(`[cp/${section}]`, error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  } else {
    /* Apply updates one by one — tenant_id + id act as the guard so
       we never leak rows into a different tenant. */
    for (const row of updates) {
      const { id, tenant_id, ...update } = row;
      const { error } = await supabaseServer
        .from(cfg.table)
        .update(update)
        .eq("tenant_id", tenant_id)
        .eq("id", id);
      if (error) {
        console.error(`[cp/${section} update]`, error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    /* Apply inserts. For each, derive a unique slug from the UI's
       chosen source field (e.g. name → code, role_label → role_slug).
       If the derived slug collides with an existing row in this
       tenant, append -2, -3 … until it's unique. That keeps the
       caller blissfully unaware of the internal identifier while
       still enforcing the unique constraint the schema demands. */
    if (inserts.length > 0 && cfg.slugColumn && cfg.slugSourceField) {
      const { data: existingRows } = await supabaseServer
        .from(cfg.table)
        .select(cfg.slugColumn)
        .eq("tenant_id", auth.tenant_id);
      const taken = new Set<string>(
        ((existingRows ?? []) as unknown as Array<Record<string, unknown>>).map(
          (r) => String(r[cfg.slugColumn!] ?? ""),
        ),
      );
      for (const row of inserts) {
        const base = slugify(row[cfg.slugSourceField]);
        let slug = base;
        let n = 2;
        while (taken.has(slug)) {
          slug = `${base}_${n++}`;
        }
        taken.add(slug);
        row[cfg.slugColumn] = slug;
      }
      const { error } = await supabaseServer.from(cfg.table).insert(inserts);
      if (error) {
        console.error(`[cp/${section} insert]`, error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (inserts.length > 0) {
      // Section doesn't support inserts (settings singleton, or
      // someone extended a section without a slug column). Reject
      // rather than silently dropping rows.
      return NextResponse.json(
        { error: `Section '${section}' doesn't support new rows` },
        { status: 400 },
      );
    }
  }

  /* Return the freshly-read section so the client can patch its local
     snapshot without a second round-trip. Section shape mirrors the
     read endpoint's snapshot keys. */
  const fresh = await readSection(section, auth.tenant_id);
  return NextResponse.json({ ok: true, section, payload: fresh });
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function requirePercent(v: unknown, label: string): void {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`${label} must be between 0 and 100`);
  }
}
function requireSignedPercent(v: unknown, label: string): void {
  const n = Number(v);
  if (!Number.isFinite(n) || n < -100 || n > 100) {
    throw new Error(`${label} must be between -100 and 100`);
  }
}

async function callerHasPolicyAccess(
  roleId: string | null,
  isSuperAdmin: boolean,
): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (!roleId) return false;
  const { data } = await supabaseServer
    .from("roles")
    .select("slug")
    .eq("id", roleId)
    .maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug;
  return !!slug && POLICY_ADMIN_ROLES.has(slug);
}

async function readSection(section: string, tenantId: string): Promise<unknown> {
  const cfg = SECTIONS[section];
  if (!cfg) return null;
  if (section === "settings") {
    const { data } = await supabaseServer
      .from(cfg.table)
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    return data ?? null;
  }
  const { data } = await supabaseServer
    .from(cfg.table)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

// Quiet unused-ctx warning from strict lint (AuthCtx is only used for types).
export type _AuthCtx = AuthCtx;
