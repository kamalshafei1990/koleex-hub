import "server-only";

/* ---------------------------------------------------------------------------
   ai/voice/config — where the realtime voice endpoint lives, and its key.

   Phase 15, step 1. Same shape as provider/adapters/openai-compatible.ts, and
   for the same reason: the standing rule is *"do not hard-code one AI provider
   into the architecture"*. The vendor is four environment variables here too,
   so a second voice provider — which §5 of PHASE_15_VOICE_DESIGN says a
   customer outside China will eventually need — is configuration rather than a
   rewrite.

   WHY A SEPARATE MODULE FROM THE ROUTE. The route is the part that cannot be
   tested here: this environment's egress policy refuses to reach the vendor,
   so the SDP exchange itself can only be proved in production. Everything that
   CAN be proved — that the config is well-formed, that a bad one is refused
   rather than half-used, that no value is ever echoed — is pulled into a pure
   module the suite runs directly. The untestable part is deliberately as small
   as it can be made.

   ONE REGION, ON PURPOSE. The design says the SERVER resolves the region and
   the client never chooses. With one region configured that resolution is
   trivial, and the seam exists for the second. Inventing a region map before a
   second region exists would be config nobody sets and code nobody runs.
   --------------------------------------------------------------------------- */

/** One selectable voice, as the SERVER knows it. */
export type VoiceOption = {
  /** What the client sends back. Opaque and ours — never the vendor's id, so a
   *  browser cannot ask for a voice this deployment did not offer. */
  key: string;
  /** What a user reads. The owner's words, set in configuration. */
  label: string;
  /** The vendor's own identifier. Never sent to a client as a menu; it travels
   *  only inside a session configuration the server has authored. */
  vendorId: string;
};

export type VoiceConfig = {
  /** The SDP-exchange URL with the model applied. Built here so the CLIENT
   *  never learns the endpoint or the model id — both are vendor identity, and
   *  the browser needs neither to complete a handshake. */
  sdpUrl: string;
  /** Never logged, never returned, never in an error. */
  apiKey: string;
  /** A neutral label for telemetry. Not a vendor name: this string may reach a
   *  log an operator reads, and §P.4's rule about vendor labels applies to
   *  anything that can travel. */
  regionLabel: string;
  /** Empty when the owner has configured none — the vendor's default voice is
   *  then used and no picker is offered. An empty list is a valid state, not a
   *  broken one. */
  voices: VoiceOption[];
};

export type VoiceEnv = {
  AI_VOICE_BASE_URL?: string;
  AI_VOICE_API_KEY?: string;
  AI_VOICE_MODEL?: string;
  AI_VOICE_REGION_LABEL?: string;
  /** `vendorId:Label` pairs, comma separated — e.g. `Ethan:Omar,Chelsie:Layla`.
   *  CONFIGURATION RATHER THAN CODE for two reasons. The vendor's voice list
   *  changes without asking us, so a hard-coded array is a deploy every time it
   *  does. And the LABEL is the owner's product language: §P.4 says vendor
   *  names must not appear in user-facing Koleex AI copy, so whether a voice is
   *  called "Chelsie" or "Layla" is a decision for the owner, not for this
   *  file. A bare id with no label is allowed and shows as itself. */
  AI_VOICE_VOICES?: string;
};

/* An opaque key the client sends back. Deliberately not the vendor id and not
   the label: ids are vendor identity, and labels change without the stored
   preference having to. Positional, so it is stable for a given configuration
   and meaningless outside it. */
const voiceKeyAt = (index: number) => `v${index + 1}`;

/** Parse the catalogue. Never throws, and never yields a half-formed entry: a
 *  malformed pair is dropped rather than offered as a voice that would be
 *  rejected the moment someone picked it. */
export function parseVoiceOptions(raw: string | undefined): VoiceOption[] {
  if (!raw) return [];
  const out: VoiceOption[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    /* Split on the FIRST colon only: a label may contain one, an id may not. */
    const at = trimmed.indexOf(":");
    const vendorId = (at === -1 ? trimmed : trimmed.slice(0, at)).trim();
    const label = (at === -1 ? trimmed : trimmed.slice(at + 1)).trim() || vendorId;
    if (!vendorId) continue;
    /* A duplicate id would give two keys the same voice and make the picker
       lie about what is on offer. */
    if (out.some((v) => v.vendorId === vendorId)) continue;
    out.push({ key: voiceKeyAt(out.length), label, vendorId });
  }
  return out;
}

/** Resolve a client's choice. Returns null for anything not offered — which is
 *  the whole point: the browser proposes, the server disposes. */
export function resolveVoice(voices: readonly VoiceOption[], key: string | null): VoiceOption | null {
  if (!key) return null;
  return voices.find((v) => v.key === key) ?? null;
}

/** Returns a usable config, or null. Null means "voice is off" — never a
 *  half-configured state, because a handshake that reaches a real endpoint
 *  with a missing model is a request that costs money and cannot succeed. */
export function parseVoiceConfig(env: VoiceEnv): VoiceConfig | null {
  const base = env.AI_VOICE_BASE_URL?.trim();
  const model = env.AI_VOICE_MODEL?.trim();
  const key = env.AI_VOICE_API_KEY?.trim();
  if (!base || !model || !key) return null;

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  /* Plaintext would put the key on the wire. Refused rather than warned about:
     there is no configuration in which sending this key over http is correct. */
  if (url.protocol !== "https:") return null;
  /* The model is applied here. A base that already carries one would produce
     two, and which one wins is the vendor's business rather than ours. */
  if (url.searchParams.has("model")) return null;

  url.searchParams.set("model", model);

  return {
    sdpUrl: url.toString(),
    apiKey: key,
    regionLabel: env.AI_VOICE_REGION_LABEL?.trim() || "default",
    voices: parseVoiceOptions(env.AI_VOICE_VOICES),
  };
}

/** The five variables, read from the process.
 *
 *  Two route files carry a private copy of this because a Next.js route file
 *  may only export handlers. This is the one that can be imported. A third
 *  private copy is how one of them quietly forgets a field — which is exactly
 *  how AI_VOICE_VOICES went unread for a release. */
export function readVoiceEnv(): VoiceEnv {
  return {
    AI_VOICE_BASE_URL: process.env.AI_VOICE_BASE_URL,
    AI_VOICE_API_KEY: process.env.AI_VOICE_API_KEY,
    AI_VOICE_MODEL: process.env.AI_VOICE_MODEL,
    AI_VOICE_REGION_LABEL: process.env.AI_VOICE_REGION_LABEL,
    AI_VOICE_VOICES: process.env.AI_VOICE_VOICES,
  };
}

/** Whether voice would serve, without building anything. */
export function voiceConfigured(env: VoiceEnv): boolean {
  return parseVoiceConfig(env) !== null;
}

/* ---------------------------------------------------------------------------
   WHY WHICH ONE FAILED IS WORTH REPORTING SEPARATELY.

   parseVoiceConfig has five rejection paths and every one of them returns the
   same null. Setting four variables and being told only "voice is off" is the
   position the AI fallback left an operator in for an evening, which is why
   diagnoseFallbackConfig exists. Same problem, same answer.

   IT RETURNS VARIABLE NAMES, NEVER VALUES. A base url can carry a workspace
   identifier, so the url is reported as a judgement — "not https" — rather
   than as a string. This text is for an operator; §4 of the route keeps it
   away from ordinary users regardless.
   --------------------------------------------------------------------------- */
export function diagnoseVoiceConfig(env: VoiceEnv): string[] {
  const problems: string[] = [];
  const base = env.AI_VOICE_BASE_URL?.trim();
  const model = env.AI_VOICE_MODEL?.trim();
  const key = env.AI_VOICE_API_KEY?.trim();

  if (!base) problems.push("AI_VOICE_BASE_URL is not set");
  if (!model) problems.push("AI_VOICE_MODEL is not set");
  if (!key) problems.push("AI_VOICE_API_KEY is not set");

  if (base) {
    let url: URL | null = null;
    try {
      url = new URL(base);
    } catch {
      problems.push("AI_VOICE_BASE_URL is not a valid URL");
    }
    if (url) {
      if (url.protocol !== "https:") problems.push("AI_VOICE_BASE_URL is not https");
      if (url.searchParams.has("model")) {
        problems.push("AI_VOICE_BASE_URL already carries a model query parameter — the server applies AI_VOICE_MODEL itself");
      }
    }
  }

  if (problems.length === 0) {
    problems.push(
      "All four variables look well-formed. If voice is still off, the running process started BEFORE they were set — redeploy.",
    );
  }
  return problems;
}
