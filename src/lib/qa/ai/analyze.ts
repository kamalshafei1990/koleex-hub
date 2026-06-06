import "server-only";

/* ---------------------------------------------------------------------------
   analyze — orchestrates one explicit AI investigation run.

   Pipeline (all user-triggered, no loops, no autonomous action):
     load issue → build/reuse deterministic workspace + investigation
     → append investigation section → SANITIZE → build analysis prompt
     → run provider → persist a qa_ai_sessions row → return the session.

   The provider only ever receives sanitized, deterministic context. It cannot
   reach the repo, the DB, or the shell. This module just records its answer.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import {
  aggregateWorkspace, dataFromRow, persistWorkspace, buildWorkspacePayload,
} from "@/lib/qa/debug-workspace";
import { loadOrGenerateInvestigation, renderInvestigationPromptSection } from "@/lib/qa/investigation-engine";
import { sanitizeWorkspaceForAI } from "./sanitize";
import { buildAnalysisPrompt, extractConfidence, SYSTEM_PROMPT } from "./prompts";
import { runAnalysis } from "./providers";
import { ProviderError, type AiSession } from "./types";

const RATE_MIN_INTERVAL_MS = 6_000;   // min gap between runs for the same issue
const RATE_MAX_PER_HOUR = 20;         // per issue, per tenant

export class AiBusyError extends Error {
  constructor(message: string) { super(message); this.name = "AiBusyError"; }
}
export class IssueNotFoundError extends Error {
  constructor() { super("Issue not found."); this.name = "IssueNotFoundError"; }
}

/** Build the sanitized workspace prompt (workspace + deterministic investigation). */
async function buildSanitizedContext(tenantId: string, issueId: string): Promise<
  { prompt: string; workspaceId: string | null; redactions: number; issue: Record<string, unknown> } | null
> {
  const { data: issue } = await supabaseServer
    .from("qa_issue_reports").select("*").eq("tenant_id", tenantId).eq("id", issueId).maybeSingle();
  if (!issue) return null;

  // Reuse the cached workspace if present; otherwise build + cache it once.
  const { data: wsRow } = await supabaseServer
    .from("qa_debug_workspaces").select("*").eq("tenant_id", tenantId).eq("issue_id", issueId).maybeSingle();

  let payload: Awaited<ReturnType<typeof buildWorkspacePayload>>;
  let workspaceId: string | null = null;
  if (wsRow) {
    const row = wsRow as Record<string, unknown>;
    workspaceId = row.id as string;
    payload = await buildWorkspacePayload(tenantId, dataFromRow(row), {
      created_at: row.created_at as string, updated_at: row.updated_at as string, generation_version: row.generation_version as string,
    });
  } else {
    const data = await aggregateWorkspace(tenantId, issueId);
    if (!data) return null;
    await persistWorkspace(tenantId, issueId, null, data);
    const { data: fresh } = await supabaseServer
      .from("qa_debug_workspaces").select("id").eq("tenant_id", tenantId).eq("issue_id", issueId).maybeSingle();
    workspaceId = (fresh as { id: string } | null)?.id ?? null;
    payload = await buildWorkspacePayload(tenantId, data);
  }

  // Append the deterministic investigation section (same as the workspace route).
  let promptText = payload.generated_prompt;
  const investigation = await loadOrGenerateInvestigation(tenantId, issueId, { workspaceId });
  if (investigation) promptText = `${promptText}\n\n${renderInvestigationPromptSection(investigation)}`;

  const { clean, redactions } = sanitizeWorkspaceForAI(promptText);
  return { prompt: clean, workspaceId, redactions, issue: issue as Record<string, unknown> };
}

/** Deterministic rate-limit guard (DB-based, instance-independent). */
async function assertRateOk(tenantId: string, issueId: string): Promise<void> {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { data: recent } = await supabaseServer
    .from("qa_ai_sessions")
    .select("created_at")
    .eq("tenant_id", tenantId).eq("issue_id", issueId)
    .gte("created_at", hourAgo)
    .order("created_at", { ascending: false })
    .limit(RATE_MAX_PER_HOUR);
  const rows = (recent ?? []) as Array<{ created_at: string }>;
  if (rows.length >= RATE_MAX_PER_HOUR) {
    throw new AiBusyError("Hourly AI analysis limit reached for this issue. Try again later.");
  }
  if (rows[0] && Date.now() - Date.parse(rows[0].created_at) < RATE_MIN_INTERVAL_MS) {
    throw new AiBusyError("An analysis was just requested — please wait a few seconds before retrying.");
  }
}

function toSession(row: Record<string, unknown>): AiSession {
  return {
    id: row.id as string,
    issue_id: row.issue_id as string,
    workspace_id: (row.workspace_id as string) ?? null,
    provider: (row.provider as string) ?? null,
    model: (row.model as string) ?? null,
    status: (row.status as AiSession["status"]) ?? "pending",
    response_markdown: (row.response_markdown as string) ?? null,
    error: (row.error as string) ?? null,
    tokens_input: (row.tokens_input as number) ?? null,
    tokens_output: (row.tokens_output as number) ?? null,
    latency_ms: (row.latency_ms as number) ?? null,
    created_at: row.created_at as string,
    confidence: row.response_markdown ? extractConfidence(row.response_markdown as string) : null,
  };
}

/**
 * Run one AI analysis for an issue and persist the session.
 * Throws: IssueNotFoundError, AiBusyError (rate limit), ProviderError.
 * On provider failure, a 'failed' session is still recorded for the audit trail.
 */
export async function runAiAnalysis(tenantId: string, issueId: string, accountId: string | null): Promise<AiSession> {
  await assertRateOk(tenantId, issueId);

  const ctx = await buildSanitizedContext(tenantId, issueId);
  if (!ctx) throw new IssueNotFoundError();

  const userPrompt = buildAnalysisPrompt(ctx.prompt, ctx.issue);

  try {
    const result = await runAnalysis(SYSTEM_PROMPT, userPrompt);
    const { data: inserted, error } = await supabaseServer
      .from("qa_ai_sessions")
      .insert({
        tenant_id: tenantId,
        issue_id: issueId,
        workspace_id: ctx.workspaceId,
        account_id: accountId,
        provider: result.provider,
        model: result.model,
        prompt: userPrompt,
        response: result.text,
        response_markdown: result.text,
        status: "completed",
        tokens_input: result.tokensInput,
        tokens_output: result.tokensOutput,
        latency_ms: result.latencyMs,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toSession(inserted as Record<string, unknown>);
  } catch (e) {
    // Record the failure so the workspace shows an honest audit trail.
    const message = e instanceof Error ? e.message : "AI analysis failed.";
    const { data: failed } = await supabaseServer
      .from("qa_ai_sessions")
      .insert({
        tenant_id: tenantId,
        issue_id: issueId,
        workspace_id: ctx.workspaceId,
        account_id: accountId,
        prompt: userPrompt,
        status: "failed",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    // Re-throw so the route can map ProviderError → HTTP status, but the
    // session row already exists for history either way.
    if (e instanceof ProviderError) throw e;
    if (failed) return toSession(failed as Record<string, unknown>);
    throw e;
  }
}

/** List sessions for an issue (newest first), client-safe shape. */
export async function listAiSessions(tenantId: string, issueId: string): Promise<AiSession[]> {
  const { data } = await supabaseServer
    .from("qa_ai_sessions")
    .select("id, issue_id, workspace_id, provider, model, status, response_markdown, error, tokens_input, tokens_output, latency_ms, created_at")
    .eq("tenant_id", tenantId).eq("issue_id", issueId)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as Array<Record<string, unknown>>).map(toSession);
}

/** Fetch a single session by id, tenant-scoped. */
export async function getAiSession(tenantId: string, sessionId: string): Promise<AiSession | null> {
  const { data } = await supabaseServer
    .from("qa_ai_sessions")
    .select("id, issue_id, workspace_id, provider, model, status, response_markdown, error, tokens_input, tokens_output, latency_ms, created_at")
    .eq("tenant_id", tenantId).eq("id", sessionId)
    .maybeSingle();
  return data ? toSession(data as Record<string, unknown>) : null;
}
