import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/voice/ws-session — open a call on the WebSocket lane.

   THE SECOND LANE (see ai/voice/grok.ts for why it exists). The mainland
   lane is one HTTP POST carrying an SDP offer; this lane is one HTTP POST
   carrying nothing, which returns what the browser needs to open a socket
   to the vendor itself: the socket url, the subprotocol that carries a
   SHORT-LIVED CLIENT SECRET minted here, and the same server-authored
   session configuration the other lane returns. After that the audio and
   the events run browser-to-vendor and this route is not involved again.

   THE SAME THREE PROHIBITIONS AS THE OTHER LANE, and the same tests:
     1. The real key is never returned, in any form. What is returned is a
        secret the vendor issued for one browser session, expiring in
        minutes — the vendor's designed browser flow.
     2. The endpoint, model, voices and sample rate come from the server's
        configuration; the client sends a voice KEY, a conversation id and
        a language hint, all allow-listed, and names nothing else.
     3. The vendor's error bodies stay in the log.

   WHO TAKES THIS LANE is decided by GET /api/ai/voice/session (the lane
   field), from the request's country. This route does not re-decide; a
   client that asks for it from anywhere simply gets a socket it may or
   may not be able to reach, which costs the caller one failed attempt and
   the fallback the button already has.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { authorizeVoice } from "@/lib/server/ai/voice/gate";
import { consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { supabaseServer } from "@/lib/server/supabase-server";
import { loadRecentTurns, parseConversationParam, type RecentTurn } from "@/lib/server/ai/voice/history";
import { detectConversationLang } from "@/lib/voice/script-lang";
import { resolveVoice } from "@/lib/server/ai/voice/config";
import {
  buildVoiceSessionPayload,
  parseSttLanguage,
  TAUGHT_INDEX_BUDGET_BYTES,
  OPENAI_WIRE,
} from "@/lib/server/ai/voice/session-config";
import { taughtQuestionIndex } from "@/lib/server/ai-knowledge";
import {
  parseGrokVoiceConfig,
  readGrokVoiceEnv,
  mintClientSecret,
  grokSocketUrl,
  grokProtocols,
} from "@/lib/server/ai/voice/grok";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const TAUGHT_INDEX_TIMEOUT_MS = 1_500;
const HISTORY_TIMEOUT_MS = 1_500;
const FIELD_MAX_CHARS = 200;

type WsSessionFields = { voice: string | null; conversation: string | null; stt: string | null; probe: boolean; via: "body" | "query" };

/** The three fields a call names, from the JSON body when the client sent
 *  one, else from the query (an older page). THE BODY EXISTS BECAUSE THE
 *  EMPTY POST WAS THE ONE REQUEST THAT NEVER ARRIVED (2026-09-08 05:52,
 *  four handshakes from the owner's phone; session.ts dialWs has the
 *  account). Every value is still allow-listed downstream; this only reads
 *  strings, bounded, and never trusts them. */
async function readFields(req: Request): Promise<WsSessionFields> {
  const url = new URL(req.url);
  const fromQuery: WsSessionFields = {
    voice: url.searchParams.get("voice"),
    conversation: url.searchParams.get("conversation"),
    stt: url.searchParams.get("stt"),
    probe: false,
    via: "query",
  };
  if (!/application\/json/i.test(req.headers.get("content-type") ?? "")) return fromQuery;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fromQuery;
    const o = parsed as Record<string, unknown>;
    const str = (k: string) => (typeof o[k] === "string" && o[k] !== "" && (o[k] as string).length <= FIELD_MAX_CHARS ? (o[k] as string) : null);
    return {
      voice: str("voice") ?? fromQuery.voice,
      conversation: str("conversation") ?? fromQuery.conversation,
      stt: str("stt") ?? fromQuery.stt,
      probe: o.probe === true,
      via: "body",
    };
  } catch {
    /* An unreadable body is an empty one: the query, then the defaults. */
    return fromQuery;
  }
}
/* Shares the mainland lane's counter and ceiling: a call is a call. */
const VOICE_SESSIONS_PER_MIN = Number(process.env.AI_LIMIT_VOICE_SESSIONS_PER_MIN) || 6;

export async function POST(req: Request) {
  const gate = await authorizeVoice(req);
  if (gate instanceof NextResponse) return gate;

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(gate.accountId), {
      bucket: "voice_session",
      windowSec: 60,
      max: VOICE_SESSIONS_PER_MIN,
    });
    if (!hit.allowed) {
      console.warn(`[ai.voice.ws] ratelimit account count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json(
          { error: "Too many voice calls started just now. Give it a moment." },
          { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } },
        );
      }
    }
  }

  const cfg = parseGrokVoiceConfig(readGrokVoiceEnv());
  const apiKey = process.env.AI_VOICE_GROK_API_KEY?.trim() || "";
  if (!cfg || !apiKey) {
    return NextResponse.json({ error: "Voice is not available right now." }, { status: 503 });
  }

  const fields = await readFields(req);

  /* The two database reads overlap the mint, as they overlap the SDP
     exchange on the other lane; each has its own ceiling and fails open. */
  const taughtP: Promise<string[]> = Promise.race([
    taughtQuestionIndex(gate.tenantId, TAUGHT_INDEX_BUDGET_BYTES),
    new Promise<string[]>((resolve) => setTimeout(() => resolve([]), TAUGHT_INDEX_TIMEOUT_MS)),
  ]).catch(() => {
    console.error("[ai.voice.ws] taught index unavailable — continuing without it");
    return [] as string[];
  });
  const conversationId = parseConversationParam(fields.conversation);
  const historyP: Promise<RecentTurn[]> = conversationId
    ? Promise.race([
        loadRecentTurns(supabaseServer, conversationId, gate.tenantId, gate.accountId),
        new Promise<RecentTurn[]>((resolve) => setTimeout(() => resolve([]), HISTORY_TIMEOUT_MS)),
      ]).catch(() => {
        console.error("[ai.voice.ws] conversation history unavailable — continuing without it");
        return [] as RecentTurn[];
      })
    : Promise.resolve([] as RecentTurn[]);

  const secret = await mintClientSecret(cfg, apiKey);
  if (!secret) {
    /* Answered and refused, or not answered: the caller gets the same
       generic sentence either way; the reason is in the log. The button
       maps 502 to "the service refused", which is what it is. */
    return NextResponse.json({ error: "Could not start the call. Try again." }, { status: 502 });
  }

  const requested = fields.voice;
  const voice = resolveVoice(cfg.voices, requested);
  const taughtQuestions = await taughtP;
  const recentTurns = await historyP;
  const clientHint = parseSttLanguage(fields.stt);
  const sttLanguage = detectConversationLang(recentTurns, { hint: clientHint }) ?? clientHint;
  /* No transcriber model on this wire: the vendor picks its own. */
  const payload = buildVoiceSessionPayload(voice, taughtQuestions, recentTurns, gate.viewer, sttLanguage, null, OPENAI_WIRE);
  /* The voice the session will ask for, by key and vendor id, so "it only
     has one voice" can be read from the log rather than guessed. */
  console.log(`[ai.voice.ws] session voice=${requested ?? "default"} vendor=${voice?.vendorId ?? "none"} via=${fields.via} probe=${fields.probe}`);

  return NextResponse.json(
    {
      transport: "ws",
      url: grokSocketUrl(cfg),
      protocols: grokProtocols(cfg, secret.value),
      expires_at: secret.expiresAt,
      audio: { format: "pcm16", sample_rate: cfg.sampleRate },
      session: payload.full,
      session_compact: payload.compact,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
