import "server-only";

/* ---------------------------------------------------------------------------
   QA Claude Debug Workspace (Phase 6) — deterministic aggregation engine.

   Builds a complete, copy-paste-ready debugging package from a QA issue by
   aggregating the issue, its comments (public + internal), activity timeline,
   watchers, inspector/deep-tagging metadata, environment, and
   deterministically-detected related issues — then renders a structured
   prompt. NO AI: pure aggregation + string assembly, reproducible every run.

   Signed attachment URLs are NOT stored (they expire). The cache holds storage
   paths; the API re-signs and re-renders the prompt on read.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import {
  ISSUE_TYPE_LABEL, SEVERITY_LABEL, STATUS_LABEL, PRIORITY_LABEL, ACTIVITY_LABEL,
  type IssueType, type Severity, type IssueStatus, type Priority, type ActivityType,
} from "@/lib/qa/types";

export const GENERATION_VERSION = "1.0";
const BUCKET = "qa-screenshots";
const RELATED_LOOKBACK_DAYS = 180;
const RELATED_CANDIDATE_LIMIT = 300;
const RELATED_RESULT_LIMIT = 6;

/* ── Shapes (mirror the table columns) ──────────────────────────────────── */
export interface WsAttachment { path: string; name: string; type: string; size: number; url?: string | null }
export interface WsComment {
  author: string | null; role: string | null; internal: boolean;
  message: string; created_at: string; attachments: WsAttachment[];
}
export interface WsActivity { actor: string | null; type: ActivityType; old_value: string | null; new_value: string | null; created_at: string }
export interface RelatedIssue { id: string; title: string; status: IssueStatus; reasons: string[] }
export interface WorkspaceData {
  issue_snapshot: Record<string, unknown>;
  environment_snapshot: Record<string, unknown>;
  related_components: Array<{ name: string | null; module: string | null; section: string | null; record_id: string | null }>;
  related_routes: string[];
  related_issues: RelatedIssue[];
  reproduction_summary: string;
  debug_context: { assignee_name: string | null; watchers_count: number; comments: WsComment[]; activity: WsActivity[] };
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "have", "when", "where", "which",
  "into", "your", "you", "are", "was", "but", "not", "all", "any", "can", "issue", "bug",
  "page", "click", "button", "show", "shows", "showing", "after", "before", "should",
]);

/** Title/description → significant lowercase keywords (len ≥ 4, minus stopwords). */
function keywords(text: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 4 && !STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

/* ── Related-issue engine (deterministic; scoped by module + timeframe) ──── */
async function findRelatedIssues(tenantId: string, issue: Record<string, unknown>): Promise<RelatedIssue[]> {
  const since = new Date(Date.now() - RELATED_LOOKBACK_DAYS * 86_400_000).toISOString();
  let q = supabaseServer
    .from("qa_issue_reports")
    .select("id, title, status, app_module, route, component_name, component_record_id, description")
    .eq("tenant_id", tenantId)
    .neq("id", issue.id as string)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(RELATED_CANDIDATE_LIMIT);
  // Scope to the same module when known (keeps the candidate set small + safe).
  if (issue.app_module) q = q.eq("app_module", issue.app_module as string);

  const { data, error } = await q;
  if (error) { console.error("[debug-workspace related]", error.message); return []; }

  const baseKw = keywords(`${issue.title ?? ""} ${issue.description ?? ""}`);
  const scored: Array<{ r: RelatedIssue; score: number }> = [];
  for (const c of (data ?? []) as Array<Record<string, unknown>>) {
    const reasons: string[] = [];
    let score = 0;
    if (issue.route && c.route === issue.route) { reasons.push("Same route"); score += 4; }
    if (issue.component_name && c.component_name === issue.component_name) { reasons.push("Same component"); score += 4; }
    if (issue.component_record_id && c.component_record_id === issue.component_record_id) { reasons.push("Same record"); score += 5; }
    if (issue.app_module && c.app_module === issue.app_module) { reasons.push("Same module"); score += 1; }
    const overlap = [...keywords(`${c.title ?? ""} ${c.description ?? ""}`)].filter((k) => baseKw.has(k));
    if (overlap.length >= 2) { reasons.push(`Shared keywords: ${overlap.slice(0, 4).join(", ")}`); score += Math.min(overlap.length, 4); }
    if (score > 0) {
      scored.push({ r: { id: c.id as string, title: c.title as string, status: c.status as IssueStatus, reasons }, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, RELATED_RESULT_LIMIT).map((s) => s.r);
}

/* ── Aggregation ─────────────────────────────────────────────────────────── */
export async function aggregateWorkspace(tenantId: string, issueId: string): Promise<WorkspaceData | null> {
  const { data: issueRow } = await supabaseServer
    .from("qa_issue_reports").select("*").eq("tenant_id", tenantId).eq("id", issueId).maybeSingle();
  if (!issueRow) return null;
  const issue = issueRow as Record<string, unknown>;

  const [{ data: cmts }, { data: acts }, { count: watcherCount }] = await Promise.all([
    supabaseServer.from("qa_issue_comments")
      .select("user_name, user_role, is_internal_note, message, attachments, created_at")
      .eq("tenant_id", tenantId).eq("issue_id", issueId).order("created_at", { ascending: true }).limit(500),
    supabaseServer.from("qa_issue_activity")
      .select("actor_name, activity_type, old_value, new_value, created_at")
      .eq("tenant_id", tenantId).eq("issue_id", issueId).order("created_at", { ascending: true }).limit(500),
    supabaseServer.from("qa_issue_watchers")
      .select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("issue_id", issueId),
  ]);

  let assigneeName: string | null = null;
  if (issue.assigned_to) {
    const { data: a } = await supabaseServer.from("accounts")
      .select("username, login_email").eq("tenant_id", tenantId).eq("id", issue.assigned_to as string).maybeSingle();
    if (a) assigneeName = (a as { username: string | null; login_email: string | null }).username
      || (a as { login_email: string | null }).login_email || null;
  }

  const related = await findRelatedIssues(tenantId, issue);

  const comments: WsComment[] = (cmts ?? []).map((c) => {
    const r = c as Record<string, unknown>;
    const atts = Array.isArray(r.attachments) ? (r.attachments as Array<Record<string, unknown>>) : [];
    return {
      author: (r.user_name as string) ?? null,
      role: (r.user_role as string) ?? null,
      internal: r.is_internal_note === true,
      message: (r.message as string) ?? "",
      created_at: r.created_at as string,
      attachments: atts.map((a) => ({
        path: typeof a.path === "string" ? a.path : "",
        name: typeof a.name === "string" ? a.name : "image",
        type: typeof a.type === "string" ? a.type : "",
        size: typeof a.size === "number" ? a.size : 0,
      })),
    };
  });

  const activity: WsActivity[] = (acts ?? []).map((a) => {
    const r = a as Record<string, unknown>;
    return {
      actor: (r.actor_name as string) ?? null,
      type: r.activity_type as ActivityType,
      old_value: (r.old_value as string) ?? null,
      new_value: (r.new_value as string) ?? null,
      created_at: r.created_at as string,
    };
  });

  const issue_snapshot = {
    id: issue.id, title: issue.title, description: issue.description,
    expected_result: issue.expected_result, suggested_solution: issue.suggested_solution,
    issue_type: issue.issue_type, severity: issue.severity, priority: issue.priority, status: issue.status,
    app_module: issue.app_module, route: issue.route, page_title: issue.page_title,
    component_name: issue.component_name, component_module: issue.component_module,
    component_section: issue.component_section, component_record_id: issue.component_record_id,
    component_path: issue.component_path, component_rect: issue.component_rect,
    component_styles: issue.component_styles, // computed CSS at file time
    components: issue.components,             // full multi-pick array
    repro_steps: issue.repro_steps, reopen_count: issue.reopen_count,
    duplicate_of_issue_id: issue.duplicate_of_issue_id, fixed_commit: issue.fixed_commit,
    resolution_summary: issue.resolution_summary, reporter_name: issue.reporter_name,
    created_at: issue.created_at, resolved_at: issue.resolved_at,
    screenshot_path: issue.screenshot_url,  // stored path; signed on read
    screenshot_paths: issue.screenshot_urls, // multi-shot array; signed on read
  };

  return {
    issue_snapshot,
    environment_snapshot: {
      browser_info: issue.browser_info, device_info: issue.device_info,
      screen_size: issue.screen_size, language: issue.language, timezone: issue.timezone,
    },
    related_components: [{
      name: (issue.component_name as string) ?? null,
      module: (issue.component_module as string) ?? null,
      section: (issue.component_section as string) ?? null,
      record_id: (issue.component_record_id as string) ?? null,
    }].filter((c) => c.name),
    related_routes: issue.route ? [issue.route as string] : [],
    related_issues: related,
    reproduction_summary: (issue.repro_steps as string) || (issue.description as string) || "",
    debug_context: { assignee_name: assigneeName, watchers_count: watcherCount ?? 0, comments, activity },
  };
}

/** Reconstruct WorkspaceData from a cached qa_debug_workspaces row. */
export function dataFromRow(row: Record<string, unknown>): WorkspaceData {
  const dc = (row.debug_context as WorkspaceData["debug_context"]) ?? { assignee_name: null, watchers_count: 0, comments: [], activity: [] };
  return {
    issue_snapshot: (row.issue_snapshot as Record<string, unknown>) ?? {},
    environment_snapshot: (row.environment_snapshot as Record<string, unknown>) ?? {},
    related_components: (row.related_components as WorkspaceData["related_components"]) ?? [],
    related_routes: (row.related_routes as string[]) ?? [],
    related_issues: (row.related_issues as RelatedIssue[]) ?? [],
    reproduction_summary: (row.reproduction_summary as string) ?? "",
    debug_context: dc,
  };
}

/* ── Attachment signing (paths → short-lived signed URLs) ────────────────── */
async function signPath(tenantId: string, path: unknown): Promise<string | null> {
  if (typeof path !== "string" || !path.startsWith(`${tenantId}/`)) return null;
  const { data } = await supabaseServer.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export interface SignedWorkspace { screenshotUrl: string | null; screenshotUrls: string[]; comments: WsComment[] }
export async function signWorkspace(tenantId: string, data: WorkspaceData): Promise<SignedWorkspace> {
  const screenshotUrl = await signPath(tenantId, data.issue_snapshot.screenshot_path);
  const rawPaths = Array.isArray(data.issue_snapshot.screenshot_paths)
    ? (data.issue_snapshot.screenshot_paths as unknown[])
    : [];
  const signedAll = await Promise.all(rawPaths.map((p) => signPath(tenantId, p)));
  const screenshotUrls = signedAll.filter((u): u is string => !!u);
  const comments = await Promise.all(data.debug_context.comments.map(async (c) => ({
    ...c,
    attachments: await Promise.all(c.attachments.map(async (a) => ({ ...a, url: await signPath(tenantId, a.path) }))),
  })));
  return { screenshotUrl, screenshotUrls, comments };
}

/* ── Prompt rendering (deterministic, copy-paste ready) ──────────────────── */
function fmt(iso: unknown): string {
  if (typeof iso !== "string") return "—";
  try { return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}

/* ── Phase X reliability heuristics (all deterministic, no AI) ───────────── */

// Words that signal a visual / UI / layout / theme issue in free text.
const VISUAL_HINT_WORDS = [
  "color", "colour", "contrast", "font", "text", "typography", "layout",
  "spacing", "padding", "margin", "align", "alignment", "button", "icon",
  "size", "small", "big", "large", "width", "height", "overflow", "scroll",
  "theme", "dark", "light", "rtl", "arabic", "design", "ui", "ux", "style",
  "styles", "css", "readable", "readability", "visible", "hidden", "border",
  "shadow", "hover", "focus", "dropdown", "modal", "tooltip", "responsive",
  "mobile", "خط", "خطوط", "لون", "الوان", "ألوان", "حجم", "تصميم", "واجهة",
];

/** Is this a visual/UI-class issue? True when issue_type is "ui" OR the
 *  title/description contains visual-domain words. Deterministic. */
function looksVisual(s: Record<string, unknown>): boolean {
  if (s.issue_type === "ui" || s.issue_type === "ux") return true;
  const blob = `${s.title ?? ""} ${s.description ?? ""} ${s.expected_result ?? ""}`.toLowerCase();
  return VISUAL_HINT_WORDS.some((w) => blob.includes(w));
}

/** A real component reference is a code identifier (ASCII, short, not a
 *  sentence). When the inspector falls back to visible text it produces
 *  garbage like "Inventory OperationsWhat needs doing today — rec" or the
 *  glyph "⌘K". Flag those as approximate so we never present them as a
 *  trusted component or derive a fake filename from them. */
function nameLooksApproximate(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  if (!n) return false;
  if (n.length > 44) return true;                       // far longer than any identifier
  if (/[^\x00-\x7F]/.test(n)) return true;              // non-ASCII = text content or glyph, not code
  if (/[—…:•·]/.test(n)) return true;                   // sentence punctuation
  if ((n.match(/[a-z][A-Z]/g) ?? []).length >= 3) return true; // many concatenated words
  if (n.split(/\s+/).length >= 5) return true;          // sentence-like
  return false;
}

/** A component pick (from components[]) is approximate if the inspector
 *  flagged it as a fallback OR its label looks like text content. */
function componentIsApproximate(c: { fallback?: unknown; component?: unknown } | null): boolean {
  if (!c) return false;
  if (c.fallback === true) return true;
  return nameLooksApproximate(typeof c.component === "string" ? c.component : null);
}

/** True identifier safe to turn into a filename suggestion: ASCII PascalCase-ish,
 *  ≤40 chars, no spaces, not approximate. */
export function isTrustedComponentName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  if (!n) return false;
  if (nameLooksApproximate(n)) return false;
  return /^[A-Za-z][A-Za-z0-9_]{1,39}$/.test(n);
}

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

/** Deterministic confidence classification with human-readable reasons.
 *  Mirrors the rules in the Phase X spec. */
function computeConfidence(
  data: WorkspaceData,
  hasScreenshot: boolean,
): { level: Confidence; reasons: string[] } {
  const s = data.issue_snapshot;
  const reasons: string[] = [];

  const visual = looksVisual(s);

  // Component trust: prefer the components[] array (carries the fallback flag);
  // fall back to the scalar name heuristic.
  const compList = Array.isArray(s.components) ? (s.components as Array<Record<string, unknown>>) : [];
  let componentApprox: boolean;
  let componentPresent: boolean;
  if (compList.length > 0) {
    componentPresent = true;
    componentApprox = compList.every((c) => componentIsApproximate(c));
  } else if (typeof s.component_name === "string" && s.component_name.trim()) {
    componentPresent = true;
    componentApprox = nameLooksApproximate(s.component_name as string);
  } else {
    componentPresent = false;
    componentApprox = false;
  }
  const componentTagged = componentPresent && !componentApprox;

  const routeKnown = typeof s.route === "string" && (s.route as string).length > 0;
  const repro = typeof data.reproduction_summary === "string" ? data.reproduction_summary.trim() : "";
  // "Specific" repro = more than a one-liner that just echoes the title.
  const reproSpecific = repro.length >= 40;
  const descVague = (typeof s.description === "string" ? s.description.trim().length : 0) < 24;

  // Build reasons (both positive and negative signals).
  if (hasScreenshot) reasons.push("A screenshot is attached"); else reasons.push("No screenshot attached");
  if (componentTagged) reasons.push("A specific component was identified");
  else if (componentApprox) reasons.push("Component selection is an approximate fallback (treat as unreliable)");
  else reasons.push("No specific component was pinned");
  if (routeKnown) reasons.push(`Route is known (${s.route})`);
  else reasons.push("Route is unknown");
  if (visual) reasons.push("This is a visual/UI-class issue — needs visual verification");
  if (descVague) reasons.push("The description is brief/general rather than a specific broken interaction");
  if (!reproSpecific) reasons.push("Reproduction steps are limited");

  // Decide the level.
  let level: Confidence;
  if (visual && !hasScreenshot) {
    level = "LOW";
  } else if (componentApprox && !hasScreenshot) {
    level = "LOW";
  } else if (!componentPresent && !routeKnown) {
    level = "LOW";
  } else if (hasScreenshot && componentTagged && routeKnown && reproSpecific && !visual) {
    level = "HIGH";
  } else if (componentTagged && routeKnown && (hasScreenshot || reproSpecific)) {
    // Solid signal, but visual issues never reach HIGH without visual confirmation.
    level = visual ? "MEDIUM" : "HIGH";
  } else {
    level = "MEDIUM";
  }
  return { level, reasons };
}

/** Deterministic screenshot observations from metadata only (NO vision/AI):
 *  count, multi-shot, computed styles of the picked element, picked rect. */
function screenshotObservations(s: Record<string, unknown>, shotCount: number): string[] {
  const out: string[] = [];
  out.push(`${shotCount} screenshot${shotCount === 1 ? "" : "s"} attached (open each link below to inspect).`);

  // Surface computed styles captured at pick time — these are factual.
  const styleSources: Array<Record<string, unknown>> = [];
  const compList = Array.isArray(s.components) ? (s.components as Array<Record<string, unknown>>) : [];
  for (const c of compList) {
    if (c.styles && typeof c.styles === "object" && !Array.isArray(c.styles)) styleSources.push(c.styles as Record<string, unknown>);
  }
  if (styleSources.length === 0 && s.component_styles && typeof s.component_styles === "object" && !Array.isArray(s.component_styles)) {
    styleSources.push(s.component_styles as Record<string, unknown>);
  }
  const first = styleSources[0];
  if (first) {
    const pick = (k: string) => (typeof first[k] === "string" ? (first[k] as string) : null);
    const color = pick("color"); const bg = pick("backgroundColor");
    const fs = pick("fontSize"); const fw = pick("fontWeight"); const dir = pick("direction");
    if (color || bg) out.push(`Picked element colors — text: ${color ?? "?"}, background: ${bg ?? "?"} (check contrast).`);
    if (fs || fw) out.push(`Picked element type — size: ${fs ?? "?"}, weight: ${fw ?? "?"}.`);
    if (dir === "rtl") out.push("Picked element renders right-to-left (RTL) — verify Arabic alignment + glyph weight.");
  }
  return out;
}

/** Visual investigation AREAS (not files) — used when component confidence is
 *  LOW so we never emit a hallucinated filename. Tailored a little by the
 *  visual words present in the issue text. */
function visualInvestigationAreas(s: Record<string, unknown>): string[] {
  const blob = `${s.title ?? ""} ${s.description ?? ""} ${s.expected_result ?? ""}`.toLowerCase();
  const areas: string[] = [];
  const add = (a: string) => { if (!areas.includes(a)) areas.push(a); };
  if (/(color|colour|contrast|لون|الوان|ألوان|readable|readability|مريح)/.test(blob)) {
    add("Light/dark theme contrast tokens (--text-*, --bg-* variables)");
    add("Shared muted/dim foreground color usage");
  }
  if (/(font|text|typography|خط|خطوط)/.test(blob)) {
    add("Typography scale + font-weight tokens");
    add("Arabic / RTL font stack + line-height");
  }
  if (/(rtl|arabic|عرب)/.test(blob)) add("RTL layout + alignment rendering");
  if (/(spacing|padding|margin|dense|تباعد)/.test(blob)) add("Spacing / density system");
  if (/(size|small|big|large|width|height|حجم)/.test(blob)) add("Container sizing + responsive breakpoints");
  if (/(button|icon|hover|focus|tooltip|زر)/.test(blob)) add("Interactive element states (hover/focus) + affordance");
  if (/(table|row|column|جدول)/.test(blob)) add("Table density + column layout");
  if (/(sidebar|nav|navigation|tab|بار)/.test(blob)) add("Navigation / sidebar readability + overflow");
  // Always-useful baseline areas for any visual issue.
  add("Theme foreground/background contrast variables");
  add(`${s.app_module ?? "Owning"} module's shared layout + typography styles`);
  return areas.slice(0, 8);
}

/** Build the live API payload (fresh signed URLs + re-rendered prompt). */
export async function buildWorkspacePayload(
  tenantId: string,
  data: WorkspaceData,
  meta: { created_at?: string | null; updated_at?: string | null; generation_version?: string | null } = {},
) {
  const signed = await signWorkspace(tenantId, data);
  return {
    issue_snapshot: data.issue_snapshot,
    environment_snapshot: data.environment_snapshot,
    related_components: data.related_components,
    related_routes: data.related_routes,
    related_issues: data.related_issues,
    reproduction_summary: data.reproduction_summary,
    debug_context: { ...data.debug_context, comments: signed.comments },
    screenshot_url: signed.screenshotUrl,
    generated_prompt: renderPrompt(data, signed),
    ai_ready: true,
    generation_version: meta.generation_version ?? GENERATION_VERSION,
    created_at: meta.created_at ?? null,
    updated_at: meta.updated_at ?? null,
  };
}

/** Upsert the cache row (stable: stored prompt carries no expiring signed URLs). */
export async function persistWorkspace(tenantId: string, issueId: string, actorId: string | null, data: WorkspaceData): Promise<void> {
  const storedPrompt = renderPrompt(data, { screenshotUrl: null, screenshotUrls: [], comments: data.debug_context.comments });
  const { error } = await supabaseServer.from("qa_debug_workspaces").upsert({
    issue_id: issueId,
    tenant_id: tenantId,
    created_by: actorId,
    updated_at: new Date().toISOString(),
    workspace_status: "ready",
    generated_prompt: storedPrompt,
    issue_snapshot: data.issue_snapshot,
    related_components: data.related_components,
    related_routes: data.related_routes,
    related_issues: data.related_issues,
    reproduction_summary: data.reproduction_summary,
    environment_snapshot: data.environment_snapshot,
    debug_context: data.debug_context,
    ai_ready: true,
    generation_version: GENERATION_VERSION,
  }, { onConflict: "issue_id" });
  if (error) console.error("[debug-workspace persist]", error.message);
}

export function renderPrompt(data: WorkspaceData, signed: SignedWorkspace): string {
  const s = data.issue_snapshot;
  const e = data.environment_snapshot;
  const L: string[] = [];
  const h = (t: string) => L.push("", `## ${t}`);

  // Screenshot presence (issue-level shots OR any comment image).
  const shotCount =
    (signed.screenshotUrls?.length ?? 0) ||
    (signed.screenshotUrl ? 1 : 0);
  const commentShot = signed.comments.some((c) => c.attachments.some((a) => a.url));
  const hasScreenshot = shotCount > 0 || commentShot;
  const visual = looksVisual(s);
  const conf = computeConfidence(data, hasScreenshot);

  L.push(`# KOLEEX Hub — Debug Workspace`);
  L.push(`Generated deterministically from issue ${s.id} · v${GENERATION_VERSION}`);

  h("Issue Summary");
  L.push(`- Title: ${s.title ?? "—"}`);
  L.push(`- Type: ${ISSUE_TYPE_LABEL[s.issue_type as IssueType] ?? s.issue_type} · Severity: ${SEVERITY_LABEL[s.severity as Severity] ?? s.severity} · Priority: ${PRIORITY_LABEL[s.priority as Priority] ?? s.priority}`);
  L.push(`- Status: ${STATUS_LABEL[s.status as IssueStatus] ?? s.status}${(s.reopen_count as number) > 0 ? ` · reopened ×${s.reopen_count}` : ""}${s.duplicate_of_issue_id ? ` · duplicate of ${s.duplicate_of_issue_id}` : ""}`);
  L.push(`- Module: ${s.app_module ?? "—"} · Route: ${s.route ?? "—"}${s.page_title ? ` · Page: ${s.page_title}` : ""}`);
  L.push(`- Reporter: ${s.reporter_name ?? "—"} · Filed: ${fmt(s.created_at)}`);
  if (data.debug_context.assignee_name) L.push(`- Assignee: ${data.debug_context.assignee_name}`);
  if (data.debug_context.watchers_count > 0) L.push(`- Watchers: ${data.debug_context.watchers_count}`);

  // ── Problem 1: high-visibility warning for a visual issue with no shot ──
  if (visual && !hasScreenshot) {
    L.push("");
    L.push("> ⚠️ **WARNING — visual/UI issue with NO screenshot attached.**");
    L.push("> Do NOT claim this issue is fixed without visual verification.");
    L.push("> It likely needs manual reproduction and UI inspection in the browser.");
    L.push("> Keep confidence LOW until the change is confirmed visually by a human.");
  }

  // ── Problem 4: confidence classification (always present) ──
  h("Investigation Confidence");
  L.push(`**${conf.level}**`);
  L.push("");
  L.push("Reasons:");
  for (const r of conf.reasons) L.push(`- ${r}`);
  if (conf.level === "LOW") {
    L.push("");
    L.push("_Root cause cannot be isolated deterministically from this metadata alone. Treat any fix as a proposal pending visual/behavioral verification._");
  }

  h("Current Behavior");
  L.push(String(s.description || "—"));

  h("Expected Behavior");
  L.push(String(s.expected_result || "—"));
  if (s.suggested_solution) { L.push("", "Reporter's suggestion:", String(s.suggested_solution)); }

  h("Environment");
  L.push(`- Device: ${e.device_info ?? "—"}`);
  L.push(`- Browser: ${e.browser_info ?? "—"}`);
  L.push(`- Screen: ${e.screen_size ?? "—"} · Locale: ${e.language ?? "—"} · Timezone: ${e.timezone ?? "—"}`);

  h("Component Information");
  // Multi-pick aware: if components[] is populated, list each pick stacked.
  const compList = Array.isArray(s.components) ? (s.components as Array<Record<string, unknown>>) : [];
  // Problem 2: detect whether the component reference is an approximate
  // fallback so we can warn instead of presenting it as trusted.
  const componentApproximate =
    compList.length > 0
      ? compList.every((c) => componentIsApproximate(c))
      : nameLooksApproximate(typeof s.component_name === "string" ? (s.component_name as string) : null);
  if (compList.length > 0) {
    L.push(`- Inspected ${compList.length} component(s):`);
    compList.forEach((c, idx) => {
      const crumb = [c.module, c.section, c.component].filter(Boolean).join(" → ");
      L.push(`  ${idx + 1}. ${crumb}${c.recordId ? ` (record ${c.recordId})` : ""}${c.fallback ? " [untagged fallback]" : ""}`);
      if (c.rect) L.push(`     rect: ${JSON.stringify(c.rect)}`);
      if (c.styles && typeof c.styles === "object" && !Array.isArray(c.styles)) {
        const lines = Object.entries(c.styles as Record<string, unknown>)
          .filter(([, v]) => typeof v === "string" && (v as string).trim().length > 0)
          .map(([k, v]) => `${k}: ${v}`);
        if (lines.length > 0) L.push(`     computed styles: ${lines.join("; ")}`);
      }
    });
  } else if (s.component_name) {
    const crumb = [s.component_module, s.component_section, s.component_name].filter(Boolean).join(" → ");
    L.push(`- Inspected component: ${crumb}`);
    if (s.component_record_id) L.push(`- Record id: ${s.component_record_id}`);
    if (s.component_path) L.push(`- Tagged path: ${s.component_path}`);
    if (s.component_rect) L.push(`- On-screen rect: ${JSON.stringify(s.component_rect)}`);
  } else {
    L.push("- No specific component was pinned (whole-page report).");
  }
  // Scalar component_styles (first-pick mirror) — printed even when components[]
  // isn't populated (legacy rows or single-pick reports).
  if (compList.length === 0 && s.component_styles && typeof s.component_styles === "object" && !Array.isArray(s.component_styles)) {
    const lines = Object.entries(s.component_styles as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" && (v as string).trim().length > 0)
      .map(([k, v]) => `  - ${k}: ${v}`);
    if (lines.length > 0) {
      L.push("- Computed styles (at file time):");
      L.push(...lines);
    }
  }
  // Problem 2: explicit approximate-component warning.
  if (componentApproximate && (compList.length > 0 || s.component_name)) {
    L.push("");
    L.push("> ⚠️ The selected component appears to be an approximate fallback container generated from visible text content (no `data-kx-component` tag).");
    L.push("> Treat this component reference as **LOW confidence**. Do NOT assume a real component or file with this exact name exists. Use the route + screenshots + investigation areas below instead.");
  }

  h("Related Issues");
  if (data.related_issues.length === 0) L.push("- None found in the recent timeframe.");
  else for (const r of data.related_issues) L.push(`- ${r.id} — "${r.title}" (${STATUS_LABEL[r.status] ?? r.status}) · ${r.reasons.join("; ")}`);

  h("Timeline");
  if (data.debug_context.activity.length === 0) L.push("- (no recorded activity)");
  else for (const a of data.debug_context.activity) {
    const verb = ACTIVITY_LABEL[a.type] ?? a.type;
    const detail = a.type === "status_changed" && a.new_value ? ` → ${STATUS_LABEL[a.new_value as IssueStatus] ?? a.new_value}` : "";
    L.push(`- ${fmt(a.created_at)} — ${a.actor ?? "Someone"} ${verb}${detail}`);
  }

  h("Reproduction Context");
  L.push(String(data.reproduction_summary || "—"));
  if (data.debug_context.comments.length > 0) {
    L.push("", "Discussion (newest last):");
    for (const c of data.debug_context.comments) {
      const tag = c.internal ? " [INTERNAL]" : "";
      L.push(`- ${fmt(c.created_at)} — ${c.author ?? "—"}${c.role ? ` (${c.role})` : ""}${tag}: ${c.message || "(image only)"}`);
    }
  }

  h("Attachments");
  // Multi-shot first; the scalar screenshotUrl is the first entry's signed
  // URL, but the user can attach up to 6 — print all of them so the AI can
  // open each in turn.
  let any = false;
  const multi = signed.screenshotUrls ?? [];
  if (multi.length > 1) {
    multi.forEach((u, i) => { L.push(`- Issue screenshot ${i + 1}/${multi.length}: ${u}`); any = true; });
  } else if (signed.screenshotUrl) {
    L.push(`- Issue screenshot: ${signed.screenshotUrl}`);
    any = true;
  } else if (multi.length === 1) {
    L.push(`- Issue screenshot: ${multi[0]}`);
    any = true;
  }
  for (const c of signed.comments) {
    for (const a of c.attachments) {
      if (a.url) { L.push(`- Comment image (${a.name})${c.internal ? " [internal]" : ""}: ${a.url}`); any = true; }
    }
  }
  if (!any) L.push("- (none)");
  L.push("", "_Attachment links are signed and expire ~1h after generation._");

  // ── Problem 8: deterministic screenshot observations (metadata only) ──
  if (hasScreenshot) {
    h("Screenshot Observations");
    L.push("_Derived from metadata + captured computed styles — NOT vision analysis. Open the images above to confirm._");
    for (const o of screenshotObservations(s, shotCount || 1)) L.push(`- ${o}`);
  }

  // ── Problems 3 + 6 + 7: confidence-gated, issue-type-aware suggestions ──
  h("Suggested Investigation Areas");
  const sugg: string[] = [];

  // Issue-type-specific priorities first (Problem 6).
  if (s.issue_type === "translation") {
    sugg.push("Check the i18n translation dictionaries (src/lib/translations/*, en/zh/ar) for the affected strings.");
    sugg.push("Verify RTL rendering + the :lang(ar) / [dir=rtl] styling for Arabic.");
  } else if (s.issue_type === "performance") {
    sugg.push("Profile render + network on the route; look for N+1 fetches, unmemoized renders, or large client bundles.");
  } else if (visual || s.issue_type === "ui" || s.issue_type === "ux") {
    // Problem 7: for visual issues, suggest AREAS not files, and avoid backend assumptions.
    for (const a of visualInvestigationAreas(s)) sugg.push(a);
  }

  // Component-specific guidance ONLY when the component is trusted (Problem 3:
  // never derive a target from an approximate/fallback label).
  if (!componentApproximate && typeof s.component_name === "string" && s.component_name.trim()) {
    sugg.push(`Inspect the \`${s.component_name}\` component${s.component_module ? ` in the ${s.component_module} module` : ""}${s.component_path ? ` (tagged path ${s.component_path})` : ""}.`);
    if (s.component_record_id) sugg.push(`Check the specific record \`${s.component_record_id}\` referenced by the component.`);
  } else if (componentApproximate) {
    sugg.push("Component reference is an approximate fallback — do NOT search for a file by that name. Locate the element via the route + screenshots instead.");
  }

  if (s.route) sugg.push(`Reproduce on route \`${s.route}\` and check its render path with the reporter's environment.`);
  if (data.related_issues.length > 0) sugg.push(`Review the ${data.related_issues.length} related issue(s) above — they may share a root cause.`);
  if ((s.reopen_count as number) > 0) sugg.push(`This issue was reopened ${s.reopen_count}× — verify the prior fix (${s.fixed_commit ?? "no commit recorded"}) didn't regress.`);
  if (sugg.length === 0) sugg.push("Start from the route + module and reproduce with the environment above.");
  for (const x of sugg) L.push(`- ${x}`);

  // ── Problem 5 + 9: mandatory verification requirements + honest wording ──
  h("Verification Requirements");
  L.push("Build/type/lint success is NOT proof the issue is fixed. Before claiming this issue is resolved:");
  L.push("- Verify the UI visually in the browser on the affected route.");
  L.push("- Confirm the reported behavior actually changed.");
  L.push("- Confirm the reported interaction now behaves correctly.");
  L.push("- Confirm no visual or behavioral regressions were introduced.");
  L.push("- Do NOT rely only on: `tsc` success · `build` success · `lint` success · code assumptions.");
  L.push("");
  if (conf.level === "LOW" || (visual && !hasScreenshot)) {
    L.push("**This is a LOW-confidence / unverifiable-from-metadata issue.** Do NOT mark it solved without human verification.");
    L.push('Use: _"Proposed fix applied — please verify visually."_ — never "fixed", "solved", or "done".');
  } else {
    L.push("Prefer honest language: _\"proposed fix\"_, _\"likely root cause\"_, _\"please verify\"_ over _\"solved\"_ / _\"fixed successfully\"_, especially for UI issues.");
  }

  return L.join("\n");
}
