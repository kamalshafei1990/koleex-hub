import "server-only";

/* ---------------------------------------------------------------------------
   ai/voice/probe — does the voice endpoint actually accept our credential?

   WHY THIS EXISTS. `voiceConfigured()` answers "are the four variables present
   and well-formed", which is the same not-good-enough answer /api/ai/providers
   was built to stop giving for the fallback: a well-formed key can still be
   revoked, belong to another workspace, or name a model this account cannot
   call. Every one of those looks identical to a correct setup until someone
   tries to talk.

   AND HERE IT MATTERS MORE THAN IT DID THERE, because there is no UI yet. A
   text provider can be exercised by sending a turn; voice cannot be exercised
   at all without a browser, a microphone and a peer connection. Without this,
   the only way to learn that the workspace id was wrong is to build the whole
   interface first and watch it fail.

   HOW IT PROBES WITHOUT PLACING A CALL. It POSTs a deliberately INVALID offer.
   The vendor authenticates and routes the request before it parses the SDP, so
   the status code separates the three failures that matter:

     401 / 403  the key is wrong, revoked, or for another account
     404        the workspace id or the model id is wrong
     400 / 422  the credential was ACCEPTED and the endpoint exists — only the
                offer was rejected, which is exactly what we sent

   So 400 is the success case. That reads strangely enough to be worth the
   sentence: we are proving the parts a browser cannot prove for us, and the
   only part we are NOT proving is the one the browser will supply itself.

   NO SESSION IS OPENED AND NO TOKENS ARE SPENT. A realtime session needs a
   full offer with media lines; `v=0` alone cannot start one, and no model runs.

   IT RETURNS JUDGEMENTS, NEVER THE VENDOR'S WORDS. An error body from this
   endpoint can name the host, the workspace and the quota state. The route
   above this is super-admin only, but "the reader is trusted" is not a reason
   to move a workspace identifier somewhere it did not need to go.
   --------------------------------------------------------------------------- */

import { parseVoiceConfig, type VoiceEnv } from "./config";
import { describeFetchFailure } from "./fetch-cause";

/* Long enough for a cold TLS handshake to a distant region, short enough that
   an operator refreshing a status page is not left waiting on a dead host. */
const PROBE_TIMEOUT_MS = 8_000;

/* Well-formed enough to be an SDP and far too incomplete to be an offer. The
   session route requires a `v=` prefix of its callers and this satisfies the
   same shape, so we are exercising the path a real offer takes. */
const DELIBERATELY_INVALID_OFFER = "v=0\r\n";

export type VoiceProbe = {
  /** We got an HTTP response at all — DNS, TLS and routing all worked. */
  reachable: boolean;
  /** The credential was not rejected. False on 401/403, and on no response. */
  credential_ok: boolean;
  status: number | null;
  /** Plain words for an operator. Never the vendor's own error text. */
  verdict: string;
  ms: number;
  /** WHY a fetch failed, as a short machine code — ENOTFOUND, ECONNREFUSED,
   *  UND_ERR_CONNECT_TIMEOUT — or null when there was an HTTP response.
   *
   *  This field did not exist, on the reasoning that a fetch error can carry
   *  the resolved host in its message. That reasoning was right about the
   *  MESSAGE and wrong to throw away the CODE with it: the code is what
   *  separates "DNS does not resolve" from "the TCP connection never opened",
   *  and losing that distinction sent the voice investigation to the wrong
   *  place twice. describeFetchFailure keeps the code and filters everything
   *  else — see fetch-cause.ts for the guarantee. */
  cause: string | null;
};

/** The whole decision table, as a pure function, so the suite can walk every
 *  branch without a network. The route only adds a fetch around it. */
export function verdictForStatus(status: number): {
  credential_ok: boolean;
  verdict: string;
} {
  if (status === 401 || status === 403) {
    return {
      credential_ok: false,
      verdict:
        "The endpoint rejected the credential. AI_VOICE_API_KEY is wrong, revoked, or belongs to a different account or workspace.",
    };
  }
  if (status === 404) {
    return {
      credential_ok: false,
      verdict:
        "The endpoint was not found. The workspace id inside AI_VOICE_BASE_URL, or AI_VOICE_MODEL, does not name something this account can reach.",
    };
  }
  if (status === 400 || status === 422) {
    return {
      credential_ok: true,
      verdict:
        "Credential accepted and the endpoint exists — it rejected the offer, which is what we sent it. Voice is configured correctly; a real browser offer is the remaining unknown.",
    };
  }
  if (status === 429) {
    return {
      credential_ok: true,
      verdict:
        "Credential accepted, but the account is rate limited right now. Retry in a moment.",
    };
  }
  if (status >= 500) {
    return {
      credential_ok: true,
      verdict:
        "The credential was not rejected, but the endpoint returned a server error. This is the vendor's side, not the configuration.",
    };
  }
  if (status >= 200 && status < 300) {
    return {
      credential_ok: true,
      verdict:
        "The endpoint answered successfully to a deliberately invalid offer, which was not expected — treat the configuration as reachable but verify with a real call.",
    };
  }
  return {
    credential_ok: false,
    verdict: `Unexpected status ${status}. The configuration reached something, but not what was expected.`,
  };
}

/** Null when voice is not configured — the caller already reports that, and a
 *  probe with nothing to probe is not a failure worth naming twice. */
export async function probeVoice(
  env: VoiceEnv,
  fetchImpl: typeof fetch = fetch,
  /* THE WATCHDOG PASSES THE REAL ROUTE'S BUDGET HERE, so that what it
     measures every fifteen minutes is the same thing a caller experiences.
     A probe that gives up at 8s against a route that waits 13s would report
     failures the route does not have. The default keeps the admin page's
     behaviour exactly as it was. */
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<VoiceProbe | null> {
  const cfg = parseVoiceConfig(env);
  if (!cfg) return null;

  const startedAt = Date.now();
  try {
    const res = await fetchImpl(cfg.sdpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: DELIBERATELY_INVALID_OFFER,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const { credential_ok, verdict } = verdictForStatus(res.status);
    return {
      reachable: true,
      credential_ok,
      status: res.status,
      verdict,
      ms: Date.now() - startedAt,
      cause: null,
    };
  } catch (e) {
    /* The MESSAGE is deliberately not reported — a fetch failure can carry
       the resolved host in it. The CODE is: it names the kind of failure and
       nothing else, which is precisely the part an operator needs. */
    return {
      reachable: false,
      credential_ok: false,
      status: null,
      verdict:
        "Could not reach the voice endpoint at all — no response within the timeout. Check that AI_VOICE_BASE_URL names a host this deployment's region can resolve.",
      ms: Date.now() - startedAt,
      cause: describeFetchFailure(e),
    };
  }
}
