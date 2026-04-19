import "server-only";

/* ---------------------------------------------------------------------------
   Koleex AI Agent — shared types.

   The agent is layered intentionally so the LLM can never touch business
   logic directly:

       ┌────────────────────────────────────────────────────────────┐
       │  Chat UI                                                   │
       ├────────────────────────────────────────────────────────────┤
       │  Agent Orchestrator  ←  LLM (Llama 3.3 70B via Groq)       │
       │    · decides which tool to call                            │
       │    · summarises results in natural language                │
       │    · never runs business rules itself                      │
       ├────────────────────────────────────────────────────────────┤
       │  Tool Registry / Permissions Layer                         │
       │    · every tool accepts a UserContext                      │
       │    · every tool checks module + action + field perms       │
       │    · audit log records outcome                             │
       ├────────────────────────────────────────────────────────────┤
       │  Business Rules (pure TS — pricing, margins, approvals)    │
       │    · deterministic, testable, never in LLM context         │
       ├────────────────────────────────────────────────────────────┤
       │  Supabase (tenant-scoped)                                  │
       └────────────────────────────────────────────────────────────┘

   Only the top two layers talk to the model. Everything below enforces
   Koleex's security and business rules in code.
   --------------------------------------------------------------------------- */

import type { ServerAuthContext } from "../auth";

/* ─────────────────────────────────────────────────────────────────────
   User context — everything a tool needs to make an access decision.
   Built once per request (in user-context.ts) from the session, then
   passed to every tool handler.
   ───────────────────────────────────────────────────────────────────── */

export interface UserContext {
  /** Raw auth snapshot from the session cookie. */
  auth: ServerAuthContext;
  /** Pre-computed module view grants ("Products" → true/false). Case-
   *  insensitive lookup; see permissions.ts hasModule(). */
  modulePermissions: Record<string, {
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }>;
  /** Allow-listed sensitive field IDs this user is permitted to see.
   *  Anything not in this set is stripped from tool results regardless
   *  of module access. See SENSITIVE_FIELDS in permissions.ts. */
  allowedSensitiveFields: Set<string>;
  /** Role-derived meta. */
  department: string | null;
  isSuperAdmin: boolean;
  canViewPrivate: boolean;
}

/* ─────────────────────────────────────────────────────────────────────
   Tool definition.

   Each tool is self-contained:
   - name: the id the LLM sees in its tool list
   - description: LLM-facing doc; must describe WHEN to use, not HOW
   - parameters: JSON schema (subset — what Groq's OpenAI-compatible
                 tool-calling expects)
   - requiredModule: guard — user must have can_view on this module
                     before the tool can run
   - requiredAction: "view" | "create" | "edit" | "delete" — checked
                     against modulePermissions
   - handler: server function that actually does the work
   ───────────────────────────────────────────────────────────────────── */

export type ToolAction = "view" | "create" | "edit" | "delete";

export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, {
    type: "string" | "number" | "integer" | "boolean" | "array" | "object";
    description: string;
    enum?: string[];
    items?: { type: string };
  }>;
  required?: string[];
}

export interface ToolDef<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  requiredModule?: string;
  requiredAction?: ToolAction;
  /** Minimum role tier ("any", "internal", "admin", "super_admin"). */
  minRole?: "any" | "internal" | "admin" | "super_admin";
  handler: (ctx: UserContext, args: TArgs) => Promise<ToolResult<TResult>>;
}

/* ─────────────────────────────────────────────────────────────────────
   Tool result envelope.

   permissionStatus explains why data may be missing even on success:
   - "allowed"         — full data returned
   - "limited"         — some fields were filtered out (tool succeeded)
   - "denied"          — user lacks module/action permission
   - "approval_required" — draft or action awaiting human sign-off
   ───────────────────────────────────────────────────────────────────── */

export type PermissionStatus =
  | "allowed"
  | "limited"
  | "denied"
  | "approval_required";

export interface ToolResult<T = unknown> {
  ok: boolean;
  permissionStatus: PermissionStatus;
  /** Data payload — null on denied/error. */
  data: T | null;
  /** Human-readable explanation; always safe to show to the user and
   *  the LLM. Never contains restricted values even indirectly. */
  message?: string;
  /** Ordered list of data sources consulted (for reasoning transparency). */
  sources?: string[];
  /** Fields that were filtered out due to missing field permissions. */
  filteredFields?: string[];
  /** If permissionStatus === "approval_required", echo back what the
   *  caller asked for so a follow-up request can reuse it. */
  pendingAction?: {
    tool: string;
    args: Record<string, unknown>;
    approverRole?: string;
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Agent response — what the orchestrator hands back to the UI.

   Each step is one of:
   - answer       — plain model text, no tool calls
   - tool-call    — model asked for a tool (shows a chip while running)
   - tool-result  — data back from a tool (renders a structured card)
   - recommendation — decision-support output with reason/sources
   - draft        — write action prepared; needs human approval
   - denied       — permission refusal, with a safe alternative message
   ───────────────────────────────────────────────────────────────────── */

export type AgentStepKind =
  | "answer"
  | "tool-call"
  | "tool-result"
  | "recommendation"
  | "draft"
  | "denied";

export interface AgentStep {
  kind: AgentStepKind;
  /** Natural-language text for this step. */
  text?: string;
  /** Only set for tool-call / tool-result / draft / denied. */
  tool?: string;
  /** Tool arguments (for tool-call) or result data (for tool-result). */
  payload?: unknown;
  /** Permission status for this step — drives UI chip colour. */
  permissionStatus?: PermissionStatus;
  /** Sources the step is grounded in (e.g. ["customers.id=123"]). */
  sources?: string[];
  /** Fields stripped by the permission layer. */
  filteredFields?: string[];
}

export interface AgentResponse {
  /** Ordered list of steps — the UI replays these in order. */
  steps: AgentStep[];
  /** Final user-facing reply text (usually the last "answer" step). */
  finalReply: string;
  /** Provider label (e.g. "groq:llama-3.3-70b-versatile"). */
  provider: string;
  /** Conversation id this turn belongs to. */
  conversationId: string;
}
