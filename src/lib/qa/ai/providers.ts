import "server-only";

/* ---------------------------------------------------------------------------
   providers — the modular AI provider registry for QA investigation.

   Routes never call a specific model. They call runAnalysis(system, user) and
   this layer selects a provider. Claude is the primary/documented provider;
   the generic Hub provider chain (Groq/Gemini, already used elsewhere) is a
   graceful fallback so analysis still works wherever a key is configured.

   Adding OpenAI / Gemini / Qwen / DeepSeek later = register one adapter here.
   No provider logic lives in the routes.
   --------------------------------------------------------------------------- */

import { ProviderError, type AiProviderName, type ProviderResult } from "./types";
import { callClaude, claudeConfigured } from "./claude";
import { callDeepseek, deepseekConfigured } from "./deepseek";
import { aiChat } from "@/lib/server/ai-provider";

interface ProviderAdapter {
  name: AiProviderName;
  configured: () => boolean;
  run: (system: string, user: string) => Promise<ProviderResult>;
}

/* Generic fallback adapter — reuses the Hub's existing provider chain
   (Groq → Gemini). Returns null token usage (those APIs differ); the route
   stores what it can. Wraps a null/failed result as a typed error. */
const fallbackAdapter: ProviderAdapter = {
  name: "groq",
  configured: () => Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY),
  run: async (system, user) => {
    const startedAt = Date.now();
    const result = await aiChat([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    if (!result || !result.reply.trim()) {
      throw new ProviderError("provider_error", "Fallback AI provider returned no response.");
    }
    const providerName: AiProviderName = result.provider.startsWith("gemini") ? "gemini" : "groq";
    return {
      text: result.reply.trim(),
      provider: result.provider,
      providerName,
      model: result.provider.split(":")[1] ?? result.provider,
      tokensInput: null,
      tokensOutput: null,
      latencyMs: Date.now() - startedAt,
    };
  },
};

/* Registry — ordered by preference. DeepSeek is the PRIMARY analysis
   provider (activated by DEEPSEEK_API_KEY alone); Claude is kept as a
   secondary, and the Hub's Groq/Gemini chain is the final graceful
   fallback so analysis still works wherever a key is configured. */
const REGISTRY: ProviderAdapter[] = [
  { name: "deepseek", configured: deepseekConfigured, run: callDeepseek },
  { name: "claude", configured: claudeConfigured, run: callClaude },
  fallbackAdapter,
];

/** Is at least one provider usable in this environment? */
export function anyProviderConfigured(): boolean {
  return REGISTRY.some((p) => p.configured());
}

/** Name of the provider that would be used (for UI hints / diagnostics). */
export function activeProviderName(): AiProviderName | null {
  return REGISTRY.find((p) => p.configured())?.name ?? null;
}

/**
 * Run the analysis on the first configured provider. Throws ProviderError
 * ("not_configured") if none is available — the route maps that to 503.
 * Does NOT loop across providers on success; one explicit call, one result.
 */
export async function runAnalysis(system: string, user: string): Promise<ProviderResult> {
  const adapter = REGISTRY.find((p) => p.configured());
  if (!adapter) {
    throw new ProviderError("not_configured", "No AI provider is configured. Set DEEPSEEK_API_KEY (primary), ANTHROPIC_API_KEY, or a fallback provider key.");
  }
  return adapter.run(system, user);
}
