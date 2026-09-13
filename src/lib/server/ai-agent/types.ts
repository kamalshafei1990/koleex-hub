import "server-only";
import type { AiPersonalization } from "@/lib/ai-personalization";

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
  /** IANA timezone from the user's calendar preferences (default
   *  "Asia/Dubai"). Used so the agent resolves "today"/"tomorrow" and
   *  event times in the user's local time, not the model's stale idea of
   *  "now" or naive UTC. */
  timezone: string;
  /* ── Who the agent is talking to ────────────────────────────────────
     The session always knew this; the model never did, so "do you know
     who I am?" got an honest but absurd "I have no access to your
     identity" from an agent running inside the user's own authenticated
     session. Telling the model the SIGNED-IN user's own identity is not
     a disclosure — it is the one person whose data they already own. */
  viewer: {
    name: string | null;
    username: string;
    role: string | null;
    department: string | null;
    isSuperAdmin: boolean;
  };
  /* Facts the user asked the agent to remember, stored per account in
     accounts.preferences.ai_memory (no new table). Key → value, e.g.
     { birthday: "3 March", prefers: "short answers" }. */
  memory: Record<string, string>;
  /* How this user asked to be spoken to — accounts.preferences.ai, read by
     buildUserContext and rendered by prompts/blocks.ts. Optional so older
     fixtures still type; the builder always sets it. */
  personalization?: AiPersonalization | null;
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

/* A JSON-schema subset. `items` carries its own properties so a tool can take
   an ARRAY OF OBJECTS — askUser needs {label, detail, recommended} per option,
   and the alternative was three parallel string arrays the model would have to
   keep aligned by hand, which is exactly the kind of thing it gets wrong. */
export interface ToolParameterProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: {
    type: string;
    description?: string;
    properties?: Record<string, ToolParameterProperty>;
    required?: string[];
  };
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, ToolParameterProperty>;
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

   "DENIED" MEANS A PERMISSION, NOT A FAILURE. For a long time tools answered
   every failure with it — a product that did not exist, a calendar that did
   not load, a missing query — and the model, reading `status: denied`, told
   a super admin he was not allowed to see things. A tool's own failure is
   `ok: false` with permissionStatus "allowed" (nothing was withheld by
   permission) and a message that says what happened. "denied" is written
   only when the answer really is "you may not": the permission gates, an
   ownership rule (someone else's task or calendar), or view-as. The suite
   validate:ai-tool-exposure reads every tool and holds this line.
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
  /** A clarifying question with options — the turn ENDS here and the user
   *  answers next. payload is { question, options[] }. */
  | "question"
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
