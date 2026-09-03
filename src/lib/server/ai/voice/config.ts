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
  /** The realtime model id, as configured. Vendor identity: it never reaches
   *  a client and is used server-side only to pick companions that belong
   *  to the same family (session-config.ts sttModelFor). */
  model: string;
  /** A neutral label for telemetry. Not a vendor name: this string may reach a
   *  log an operator reads, and §P.4's rule about vendor labels applies to
   *  anything that can travel. */
  regionLabel: string;
  /** The default catalogue unless the owner overrides it; empty when they
   *  set `none` — the vendor's default voice is then used and no picker is
   *  offered. An empty list is a valid state, not a broken one. */
  voices: VoiceOption[];
};

export type VoiceEnv = {
  AI_VOICE_BASE_URL?: string;
  AI_VOICE_API_KEY?: string;
  AI_VOICE_MODEL?: string;
  AI_VOICE_REGION_LABEL?: string;
  /** `vendorId:Label` pairs, comma separated — e.g. `Ethan:Omar,Chelsie:Layla`.
   *  OPTIONAL: unset, DEFAULT_VOICE_CATALOGUE below is offered; the word
   *  `none` offers no picker at all. Set, it REPLACES the default — the
   *  vendor's voice list changes without asking us, and the LABEL is the
   *  owner's product language: §P.4 says vendor names must not appear in
   *  user-facing Koleex AI copy, so whether a voice is called "Chelsie" or
   *  "Layla" is a decision the owner can take without a deploy. A bare id
   *  with no label is allowed and shows as itself. */
  AI_VOICE_VOICES?: string;
};

/* THE VOICES OFFERED WHEN NOTHING IS CONFIGURED.

   The picker shipped as configuration only, and for a release nobody set it:
   the owner asked whether the voice could be changed at all, then asked for
   it to be done for him. So the catalogue has a default, and the variable
   became an override rather than a switch.

   Ids are the vendor's, from its published list for the realtime model this
   deployment runs. Labels are OURS — names, not descriptions, because a
   label is one string in every UI language, and not the vendor's names,
   because the identity rule says the product never wears them. The FIRST
   entry is the voice the vendor uses when none is asked for, so a caller who
   never touches the picker hears exactly what they heard before; the client
   pre-selects it. Positional keys mean reordering this list moves a saved
   preference — append, do not reorder. */
export const DEFAULT_VOICE_CATALOGUE = "Tina:Nour,Serena:Layla,Ethan:Omar,Andre:Adam,Katerina:Sara";

/** The one value of AI_VOICE_VOICES that means "offer nothing". */
export const NO_VOICE_CATALOGUE = "none";

/** The catalogue this deployment offers: the override when set, `none` for
 *  an empty one, the default otherwise. Whitespace is not a configuration. */
export function voiceCatalogue(raw: string | undefined): VoiceOption[] {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return parseVoiceOptions(DEFAULT_VOICE_CATALOGUE);
  if (trimmed.toLowerCase() === NO_VOICE_CATALOGUE) return [];
  return parseVoiceOptions(trimmed);
}

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
    model,
    regionLabel: env.AI_VOICE_REGION_LABEL?.trim() || "default",
    voices: voiceCatalogue(env.AI_VOICE_VOICES),
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
   THE SECOND REGION. The design said the seam for it existed and that a
   second region would be configuration rather than a rewrite; this is that
   seam being used, and the reason is in the log rather than in a plan:

     watchdog, one day:  21 handshakes reached the vendor, 11 did not
     12:04 UTC, a real call: 504, UND_ERR_CONNECT_TIMEOUT, four attempts

   The mainland endpoint answers our Tokyo function about two times in
   three. And a caller on a VPN has a second problem the server never sees:
   the browser's media path leaves the country and may never reach a
   mainland RTC host at all. One region cannot serve both a caller in
   Shenzhen without a VPN and the same caller with one.

   So: the same four variables, prefixed ALT, name a second endpoint — the
   vendor's international region, or a second vendor entirely. It is parsed
   by the SAME parser and refused by the same rules; nothing about it is
   special except that it is tried second (or first, when the browser has
   found the other unreachable). Absent, everything behaves as before.

   THE CLIENT NEVER NAMES A REGION. It may say "the other one", as a hint
   the server allow-lists to two words; which endpoint that is, and whether
   it exists, stays here. */
export type VoiceRegionSlot = "primary" | "alt";

/** The ALT variables, mapped into the ordinary VoiceEnv shape so one
 *  parser and one diagnosis serve both regions. */
export function readAltVoiceEnv(): VoiceEnv {
  return inheritFromPrimary(
    {
      AI_VOICE_BASE_URL: process.env.AI_VOICE_ALT_BASE_URL,
      AI_VOICE_API_KEY: process.env.AI_VOICE_ALT_API_KEY,
      AI_VOICE_MODEL: process.env.AI_VOICE_ALT_MODEL,
      AI_VOICE_REGION_LABEL: process.env.AI_VOICE_ALT_REGION_LABEL,
      /* The catalogue is the owner's product language and belongs to the
         call, not to a region: the same voices are offered whichever
         endpoint serves. A vendor that does not know a voice id uses its
         default, which is the existing behaviour for an unknown key. */
      AI_VOICE_VOICES: process.env.AI_VOICE_VOICES,
    },
    readVoiceEnv(),
  );
}

/** What the second region may borrow from the first, and what it never may.

    The second region is, in practice, the SAME vendor's other host: the
    same realtime path, the same model, a different hostname and a key
    issued for that hostname. Asking the owner to copy the path out of one
    variable into another — on a phone, from a console that shows the host
    and nothing else — produced a base url with no path, which the parser
    would have accepted and the vendor would have answered with 404.

    So, when the ALT base names a host and nothing else, it takes the
    primary's path (and query); when ALT_MODEL is unset it takes the
    primary's model; when ALT_REGION_LABEL is unset it is "alt". An ALT
    base that carries its own path is left alone — a second vendor keeps
    its own shape.

    THE KEY IS NEVER INHERITED. A key belongs to the account and region
    that issued it; the primary's key on the alt host is at best a 401
    and at worst a request signed by the wrong account. No ALT key, no
    second region — the parser refuses it as before.

    Pure: env in, env out, so the suite can drive it without touching
    process.env. */
export function inheritFromPrimary(alt: VoiceEnv, primary: VoiceEnv): VoiceEnv {
  const out: VoiceEnv = { ...alt };
  if (!out.AI_VOICE_MODEL?.trim() && primary.AI_VOICE_MODEL?.trim()) {
    out.AI_VOICE_MODEL = primary.AI_VOICE_MODEL;
  }
  if (!out.AI_VOICE_REGION_LABEL?.trim()) out.AI_VOICE_REGION_LABEL = "alt";
  const altBase = out.AI_VOICE_BASE_URL?.trim();
  const primaryBase = primary.AI_VOICE_BASE_URL?.trim();
  if (altBase && primaryBase) {
    try {
      const a = new URL(altBase);
      const p = new URL(primaryBase);
      const hostOnly = (a.pathname === "/" || a.pathname === "") && !a.search;
      if (hostOnly && p.pathname !== "/") {
        a.pathname = p.pathname;
        a.search = p.search;
        out.AI_VOICE_BASE_URL = a.toString();
      }
    } catch {
      /* Not a url. Left as it is: parseVoiceConfig refuses it and
         diagnoseVoiceConfig says why, both by name and never by value. */
    }
  }
  return out;
}

/** The browser's hint, allow-listed to two words. Anything else is no hint. */
export function parseRegionHint(raw: string | null | undefined): VoiceRegionSlot | null {
  return raw === "alt" || raw === "primary" ? raw : null;
}

/** In which order to try the regions this deployment has.

    THE REGION THAT SERVED LAST GOES FIRST. Every handshake used to start
    with the primary, and while the mainland endpoint was unreachable from
    Tokyo that meant 13 seconds of connect timeouts before the region that
    actually answers was asked — on every call, and on every resume, which
    to a caller is thirteen seconds of silence after "connecting". So the
    route remembers which slot served (per warm instance, see the route) and
    asks it first. The browser's hint — "the other one", sent after a call
    whose media never connected — still wins over memory: it knows something
    about THIS caller's network that the server does not.

    Only slots that exist are returned, in a stable order, so the caller can
    map slots back to configs without a second lookup. */
export function orderRegionSlots(
  hint: VoiceRegionSlot | null,
  remembered: VoiceRegionSlot | null,
  have: { primary: boolean; alt: boolean },
): VoiceRegionSlot[] {
  const base = (["primary", "alt"] as const).filter((s) => have[s]);
  const first = hint && have[hint] ? hint : remembered && have[remembered] ? remembered : null;
  if (!first) return base;
  return [first, ...base.filter((s) => s !== first)];
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
