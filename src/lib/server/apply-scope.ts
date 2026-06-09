/* ---------------------------------------------------------------------------
   apply-scope — DS1a adoption layer for data_scope (SHADOW / OFF only).

   This is the thin, SAFE wrapper around the existing scope engine. In DS1a it
   has NO enforcement path: applyScope NEVER modifies the query and the
   `enforce` mode THROWS. Hiding a row is therefore physically impossible in
   this file — the `.or()` attachment that DS1d will add does not exist here.

   PURE by design: no "server-only", no Supabase client import, no scope.ts
   runtime import (only a type import). The DB client is INJECTED into
   resolveEffectiveScope so this module stays unit-testable in plain Node
   (scripts/validate-apply-scope.ts).

   Scope semantics (mirrors src/lib/scope.ts; DS1a only needs Quotations):
     all/bypass → no clause (everything in tenant)
     own/private → owner = me  (+ null-owner if policy='tenant')
     department  → DEGRADES to own when the table has no department column
   --------------------------------------------------------------------------- */

import type { ScopeContext, DataScope } from "../scope";

export type ScopeMode = "off" | "shadow" | "enforce";
export type EffectiveScope = DataScope | "bypass";
export type NullOwnerPolicy = "tenant" | "hidden";

/** Per-module DS1a scope policy. Kept here (not in MODULE_CONFIGS) so this
 *  adoption layer carries no runtime dependency on scope.ts. `owner_field`
 *  mirrors MODULE_CONFIGS[module].owner_field. */
export interface ScopePolicy {
  owner_field: string;
  null_owner_policy: NullOwnerPolicy;
  has_department: boolean;
}

export const SCOPE_POLICY: Record<string, ScopePolicy> = {
  // 1 existing quotation currently has created_by = NULL (seed artifact).
  // null_owner_policy:'tenant' keeps null-owner rows visible so nothing
  // vanishes when (later) enforce is enabled. Quotations has no department
  // column, so department scope degrades to own.
  Quotations: { owner_field: "created_by", null_owner_policy: "tenant", has_department: false },
};

/** Personal (Type-C) modules are forced to `own` regardless of the role
 *  matrix. Re-declared here (small, documented) to avoid importing the
 *  runtime const from scope.ts. Quotations is NOT in this set. */
const TYPE_C_MODULES = new Set(["To-do", "Calendar", "Koleex Mail", "Inbox", "Notes"]);

export interface ScopeMeta {
  module: string;
  effectiveScope: EffectiveScope;
  mode: ScopeMode;
  /** DS1a: ALWAYS false — the query is never modified here. */
  applied: boolean;
  ownerColumn: string | null;
  nullOwnerPolicy: NullOwnerPolicy | null;
  degraded?: "dept_to_own" | "no_owner" | "no_config";
  /** The OR clause that ENFORCE would attach (shadow only). Never used to
   *  filter in DS1a — logged for the shadow soak. */
  wouldApplyClause: string | null;
}

/** Structural subset of the route's auth (ServerAuthContext) → ScopeContext.
 *  Avoids importing the ServerAuthContext type so this stays dependency-light. */
export interface AuthLike {
  account_id: string;
  tenant_id: string;
  role_id?: string | null;
  department?: string | null;
  is_super_admin: boolean;
  can_view_private?: boolean;
}

export function toScopeContext(auth: AuthLike): ScopeContext {
  return {
    account_id: auth.account_id,
    tenant_id: auth.tenant_id,
    role_id: auth.role_id ?? null,
    department: auth.department ?? null,
    is_super_admin: auth.is_super_admin,
    can_view_private: auth.can_view_private ?? false,
  };
}

/** Minimal injected DB shape (the real Supabase service client satisfies it). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScopeDb = { from: (table: string) => any };

/** Resolve the role's effective data_scope for a module, server-side, via the
 *  INJECTED service-role client (so it can read koleex_permissions, which is
 *  service-role-only). SA → 'bypass'. Type-C → 'own'. No role → 'private'. */
export async function resolveEffectiveScope(
  ctx: ScopeContext,
  module: string,
  db: ScopeDb,
): Promise<EffectiveScope> {
  if (ctx.is_super_admin) return "bypass";
  if (TYPE_C_MODULES.has(module)) return "own";
  if (!ctx.role_id) return "private";
  try {
    const { data } = await db
      .from("koleex_permissions")
      .select("data_scope")
      .eq("role_id", ctx.role_id)
      .eq("module_name", module)
      .maybeSingle();
    return ((data?.data_scope as DataScope) ?? "private") as EffectiveScope;
  } catch {
    // Fail safe for SHADOW logging: assume the most permissive read scope so
    // we never under-report. (DS1a never hides anything regardless.)
    return "all";
  }
}

/** The OR clause ENFORCE would attach. Pure. Null when no clause is needed. */
export function computeWouldApplyClause(
  effectiveScope: EffectiveScope,
  ctx: ScopeContext,
  policy: ScopePolicy,
): string | null {
  if (effectiveScope === "bypass" || effectiveScope === "all") return null;
  // own | private | department(→own): records I own, plus null-owner if policy=tenant.
  const parts = [`${policy.owner_field}.eq.${ctx.account_id}`];
  if (policy.null_owner_policy === "tenant") parts.push(`${policy.owner_field}.is.null`);
  return parts.join(",");
}

/**
 * DS1a applyScope — returns the query UNCHANGED plus meta describing what
 * enforce WOULD do. It never attaches a clause. `enforce` mode throws so a
 * mis-set flag can never hide rows.
 */
export async function applyScope<Q>(
  query: Q,
  ctx: ScopeContext,
  module: string,
  opts: { mode: ScopeMode; effectiveScope: EffectiveScope },
): Promise<{ query: Q; meta: ScopeMeta }> {
  if (opts.mode === "enforce") {
    throw new Error("[applyScope] enforce not enabled (DS1a is shadow/off only)");
  }

  const policy = SCOPE_POLICY[module];
  const base: ScopeMeta = {
    module,
    effectiveScope: opts.effectiveScope,
    mode: opts.mode,
    applied: false,
    ownerColumn: policy?.owner_field ?? null,
    nullOwnerPolicy: policy?.null_owner_policy ?? null,
    wouldApplyClause: null,
  };

  if (!policy) return { query, meta: { ...base, degraded: "no_config" } };

  let degraded: ScopeMeta["degraded"];
  let eff = opts.effectiveScope;
  if (eff === "department" && !policy.has_department) {
    eff = "own";
    degraded = "dept_to_own";
  }

  const wouldApplyClause =
    opts.mode === "shadow" ? computeWouldApplyClause(eff, ctx, policy) : null;

  // DS1a invariant: the query is returned EXACTLY as received.
  return { query, meta: { ...base, effectiveScope: eff, degraded, wouldApplyClause } };
}

export interface ScopeEvalResult {
  kept: number;
  dropped: number;
  would_zero: boolean;
  null_owner_kept: number;
}

/** Pure: what enforce WOULD keep/drop over an already-fetched page. No DB. */
export function evaluateScopeOverRows(
  rows: ReadonlyArray<Record<string, unknown>>,
  ctx: ScopeContext,
  policy: ScopePolicy,
  effectiveScope: EffectiveScope,
): ScopeEvalResult {
  const total = rows.length;
  const nullOwner = rows.filter((r) => r[policy.owner_field] == null).length;

  if (effectiveScope === "bypass" || effectiveScope === "all") {
    return { kept: total, dropped: 0, would_zero: false, null_owner_kept: nullOwner };
  }
  // own | private | department(→own)
  const kept = rows.filter((r) => {
    const owner = r[policy.owner_field];
    if (owner === ctx.account_id) return true;
    if (owner == null && policy.null_owner_policy === "tenant") return true;
    return false;
  }).length;

  return {
    kept,
    dropped: total - kept,
    would_zero: total > 0 && kept === 0,
    null_owner_kept: nullOwner,
  };
}

/**
 * Shadow logger. Counts-only structured log (captured by runtime logs). Logs
 * NO row content — only scope + counts + account_id (a UUID). Safe + cheap.
 */
export function recordScopeShadow(params: {
  module: string;
  endpoint: string;
  ctx: ScopeContext;
  rows: ReadonlyArray<Record<string, unknown>>;
  effectiveScope: EffectiveScope;
  source?: "ui" | "ai";
}): void {
  const policy = SCOPE_POLICY[params.module];
  if (!policy) return;
  const ev = evaluateScopeOverRows(params.rows, params.ctx, policy, params.effectiveScope);
  const record = {
    ts: new Date().toISOString(),
    module: params.module,
    endpoint: params.endpoint,
    source: params.source ?? "ui",
    account_id: params.ctx.account_id,
    effective_scope: params.effectiveScope,
    rows_current: params.rows.length,
    would_keep: ev.kept,
    would_drop: ev.dropped,
    would_zero: ev.would_zero,
    null_owner_kept: ev.null_owner_kept,
  };
  // eslint-disable-next-line no-console
  console.info("[scope-shadow]", JSON.stringify(record));
}

/* ===========================================================================
   DS1b-1 — single-row shadow (detail / PDF). Same semantics as the list
   evaluator, for routes that fetch ONE quotation. Pure; logs counts only;
   NEVER changes a response. enforce throws (no hide-path).
   ========================================================================== */

export interface SingleRowVerdict {
  would_allow: boolean;
  row_owner: string | null;
  null_owner: boolean;
  effectiveScope: EffectiveScope;
  degraded?: "dept_to_own" | "no_owner" | "no_config";
}

/** Pure: would ENFORCE allow this single row? n=1 analogue of
 *  evaluateScopeOverRows (allow ⇔ the row would be kept). */
export function evaluateSingleRowScope(
  row: Record<string, unknown> | null | undefined,
  ctx: ScopeContext,
  policy: ScopePolicy,
  effectiveScope: EffectiveScope,
): SingleRowVerdict {
  const owner = (row?.[policy.owner_field] ?? null) as string | null;
  const nullOwner = owner == null;

  let eff = effectiveScope;
  let degraded: SingleRowVerdict["degraded"];
  if (eff === "department" && !policy.has_department) {
    eff = "own";
    degraded = "dept_to_own";
  }

  let would_allow: boolean;
  if (eff === "bypass" || eff === "all") {
    would_allow = true;
  } else {
    // own | private | department(→own)
    would_allow =
      owner === ctx.account_id ||
      (nullOwner && policy.null_owner_policy === "tenant");
  }

  return { would_allow, row_owner: owner, null_owner: nullOwner, effectiveScope: eff, degraded };
}

/** Counts-only structured log for a single-row read. No quote content.
 *  `extra` lets a caller attach route-specific, NON-sensitive metadata
 *  (e.g. source_route, permission-present flags). Additive — callers that
 *  omit it are unaffected. */
export function recordScopeShadowForSingleRow(params: {
  module: string;
  endpoint: string;
  ctx: ScopeContext;
  row: Record<string, unknown> | null | undefined;
  effectiveScope: EffectiveScope;
  source?: "ui" | "ai";
  extra?: Record<string, unknown>;
}): void {
  const policy = SCOPE_POLICY[params.module];
  if (!policy) return;
  const v = evaluateSingleRowScope(params.row, params.ctx, policy, params.effectiveScope);
  const record = {
    ts: new Date().toISOString(),
    module: params.module,
    endpoint: params.endpoint,
    source: params.source ?? "ui",
    account_id: params.ctx.account_id,
    effective_scope: v.effectiveScope,
    row_current: 1,
    would_allow: v.would_allow,
    row_owner: v.row_owner,
    null_owner: v.null_owner,
    degraded: v.degraded ?? null,
    ...(params.extra ?? {}),
  };
  // eslint-disable-next-line no-console
  console.info("[scope-shadow]", JSON.stringify(record));
}

/**
 * Resolve effective scope, log the single-row shadow verdict, and return it.
 * DS1b-1 invariant: the CALLER ignores the verdict for control flow (log-only)
 * — it NEVER throws, blocks, or changes the response. `off` is a true no-op
 * (no scope resolution, no DB read); `enforce` throws (no hide-path exists).
 */
export async function assertScopeShadowForRow(params: {
  row: Record<string, unknown> | null | undefined;
  ctx: ScopeContext;
  module: string;
  endpoint: string;
  db: ScopeDb;
  mode: ScopeMode;
  source?: "ui" | "ai";
  extra?: Record<string, unknown>;
}): Promise<SingleRowVerdict | null> {
  if (params.mode === "enforce") {
    throw new Error("[assertScopeShadowForRow] enforce not enabled (DS1b-1 is shadow/off only)");
  }
  if (params.mode !== "shadow") return null; // off → no-op, no scope resolution
  const policy = SCOPE_POLICY[params.module];
  if (!policy) return null;
  const effectiveScope = await resolveEffectiveScope(params.ctx, params.module, params.db);
  recordScopeShadowForSingleRow({
    module: params.module,
    endpoint: params.endpoint,
    ctx: params.ctx,
    row: params.row,
    effectiveScope,
    source: params.source,
    extra: params.extra,
  });
  return evaluateSingleRowScope(params.row, params.ctx, policy, effectiveScope);
}
