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
      "discount_cap_percent",
      "has_credit",
      "credit_multiplier",
      "credit_days",
      "market_rights",
      "is_active",
      "sort_order",
    ],
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
    validate: (row) => {
      requirePercent(row.rate_percent, "rate_percent");
    },
  },
  "approval-authority": {
    table: "commercial_approval_authority",
    editableFields: ["role_label", "level", "can_approve", "is_active", "sort_order"],
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

  let body: { row?: Record<string, unknown>; rows?: Record<string, unknown>[] };
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

  if (inboundRows.length === 0) {
    return NextResponse.json({ error: "No rows to update" }, { status: 400 });
  }

  /* Settings upsert keys on tenant_id (unique); other tables match by
     explicit id. Build the payload with ONLY whitelisted fields + the
     audit stamp, so a client can't sneak in e.g. tenant_id changes. */
  const now = new Date().toISOString();
  const sanitized: Record<string, unknown>[] = [];
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
    if (section !== "settings") {
      const id = raw.id;
      if (typeof id !== "string") {
        return NextResponse.json({ error: "Each row needs an id" }, { status: 400 });
      }
      out.id = id;
    }
    try {
      cfg.validate?.(out);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid row" },
        { status: 400 },
      );
    }
    sanitized.push(out);
  }

  /* For settings, the singleton constraint is (tenant_id) — upsert by
     that. For all others, rows already exist; we update one by one
     rather than upsert so the FK (tenant_id) + (id) act as the
     effective guard and we don't accidentally insert a row with a
     different tenant_id. */
  if (section === "settings") {
    const { error } = await supabaseServer
      .from(cfg.table)
      .upsert(sanitized[0], { onConflict: "tenant_id" });
    if (error) {
      console.error(`[cp/${section}]`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    for (const row of sanitized) {
      const { id, tenant_id, ...update } = row;
      const { error } = await supabaseServer
        .from(cfg.table)
        .update(update)
        .eq("tenant_id", tenant_id)
        .eq("id", id);
      if (error) {
        console.error(`[cp/${section}]`, error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
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
