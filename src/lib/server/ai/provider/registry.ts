import "server-only";

/* ---------------------------------------------------------------------------
   ai/provider/registry — which provider serves this turn.

   Phase 3B. One function, chatWithTools(), is the ONLY way the core reaches a
   model. That is the Phase 3 acceptance criterion, and it is what makes
   adding a second provider a change to this file rather than to the loop.

   The registry is ordered by preference and selection is by configuration:
   the first adapter with a key wins. DeepSeek is first deliberately and for a
   reason that is not preference — it is the China-accessible provider, and
   mainland China working without a VPN is a stated architectural requirement.
   A future adapter added ABOVE it would silently change that; the order is a
   decision, not an accident.

   Phase 4 replaces this with health-aware, class-based routing (FAST /
   REASONING / VISION …) plus a circuit breaker. This file is deliberately the
   simplest thing that removes the vendor from the loop, so that Phase 4 has
   one place to become clever in.
   --------------------------------------------------------------------------- */

import { deepseekAdapter } from "./adapters/deepseek";
import type { ProviderAdapter, TurnOutcome } from "./types";
import type { TurnRequest } from "./turn-ir";

/* Ordered by preference. See the header on why DeepSeek is first. */
const REGISTRY: ProviderAdapter[] = [deepseekAdapter];

/** The adapter that will serve a turn right now, or null if none is
 *  configured. Exported so the degraded lane can ask before committing. */
export function selectAdapter(): ProviderAdapter | null {
  return REGISTRY.find((a) => a.configured()) ?? null;
}

export function providerConfigured(): boolean {
  return selectAdapter() !== null;
}

/** The one door to a model. */
export async function chatWithTools(
  req: TurnRequest,
  opts?: { onDelta?: (t: string) => void },
): Promise<TurnOutcome> {
  const adapter = selectAdapter();
  if (!adapter) return { ok: false, status: 503, bodyText: "no AI provider configured" };
  return adapter.chat(req, opts);
}

/** The `provider` string reported on an AgentResponse, e.g. "deepseek:deepseek-chat". */
export function activeProviderLabel(): string {
  const a = selectAdapter();
  return a ? `${a.name}:${a.model()}` : "none";
}
