import "server-only";

/* ---------------------------------------------------------------------------
   connectors/koleex-hub — the ONE door between the AI Core and Hub data.

   Phase 2H, Amendment 1 (§P.5). The boundary already existed in practice:
   every Hub read and write goes through dispatchTool(), which applies the
   permission guard, the confirmation ledger and the audit trail. What it did
   not have was a NAME. A boundary held together by convention is one an
   honest mistake can walk around; this file makes it a type.

   ── A deliberate departure from §P.5, stated rather than quietly made ──
   The plan sketched eight domain methods — products(), customers(),
   quotations(), tasks(), calendar(), projects(), knowledge(). This does not
   implement that shape, and the reason matters:

     · All 45 tools ALREADY have the signature (ctx, args) -> ToolResult.
       Eight methods that re-dispatch to them would add a second surface with
       no new guarantee — and one that has to be kept in sync with the tools
       by hand. That "keep in sync" instruction is the exact failure mode this
       refactor has been removing all along.
     · Worse, a domain method is a plausible place for someone to eventually
       "optimise" by calling a tool handler directly. That would bypass the
       permission guard, the ledger and the audit log in one step. A door is
       only a door while there is one of it.

   So the interface below names the boundary that exists rather than adding a
   parallel one: one invoke(), the tool list the caller may actually use, and
   the connectedness signal §P.5 asked for. If a future domain method earns
   its place, it belongs HERE, behind invoke(), not beside it.

   SECURITY CONTRACT — unchanged by this file, and restated because it is the
   whole point of having a boundary:
     · No client, on any platform, ever holds a privileged credential.
     · Permissions resolve server-side from the authenticated session. A
       client cannot claim them; isConnected() reads the server's context,
       never a request body.
     · invoke() is a delegation to dispatchTool, not a replacement for it:
       every guard, the ledger and the audit row still run inside.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult, UserContext } from "@/lib/server/ai-agent/types";
import { dispatchTool, toolsFor, openAiToolSchemas } from "@/lib/server/ai-agent/tool-registry";
import type { OpenAiTool } from "@/lib/server/ai/provider/turn-ir";

export interface HubInvokeOptions {
  conversationId?: string | null;
}

export interface KoleexHubConnector {
  /** The single route from the AI Core to Hub data. Delegates to
   *  dispatchTool, which owns the permission guard, the confirmation ledger
   *  and the audit trail. Nothing in the core may reach a tool handler by
   *  any other path. */
  invoke(
    ctx: UserContext,
    toolName: string,
    args: Record<string, unknown>,
    opts?: HubInvokeOptions,
  ): Promise<ToolResult>;

  /** The tools THIS caller may actually run (Phase 2F). */
  availableTools(ctx: UserContext): ReadonlyArray<ToolDef>;

  /** The same set as OpenAI-compatible schemas, ready for a model call. */
  toolSchemas(ctx: UserContext): OpenAiTool[];

  /** Does this caller have a Koleex Hub identity at all?
   *
   *  False means "general-purpose assistant only": Hub tools are NOT OFFERED
   *  rather than merely denied, so the model is never tempted to try one and
   *  the user never reads an apology for a capability they were shown.
   *
   *  Read from the server-resolved context — never from anything a client
   *  sent. This is a NARROWING signal only: it can hide tools, it can never
   *  reveal one, because dispatchTool re-checks every call regardless. */
  isConnected(ctx: UserContext): boolean;
}

class KoleexHubConnectorImpl implements KoleexHubConnector {
  invoke(
    ctx: UserContext,
    toolName: string,
    args: Record<string, unknown>,
    opts: HubInvokeOptions = {},
  ): Promise<ToolResult> {
    return dispatchTool(ctx, toolName, args, opts);
  }

  availableTools(ctx: UserContext): ReadonlyArray<ToolDef> {
    return toolsFor(ctx);
  }

  toolSchemas(ctx: UserContext): OpenAiTool[] {
    return openAiToolSchemas(ctx);
  }

  isConnected(ctx: UserContext): boolean {
    /* Derived from what the server already resolved at authentication time:
       an internal Koleex account inside a tenant. Deliberately NOT a new
       flag and NOT a new table — a second source of truth for "is this a Hub
       user" is a second thing to get wrong.

       This mirrors, and does not replace, requireInternalUser() at the route
       door. Replacing that gate with capability entitlements is Phase 2G and
       is not decided here; nothing in this function loosens it. */
    return (
      (ctx.auth.user_type ?? "").toLowerCase() === "internal" &&
      typeof ctx.auth.tenant_id === "string" &&
      ctx.auth.tenant_id.length > 0
    );
  }
}

export const koleexHub: KoleexHubConnector = new KoleexHubConnectorImpl();
