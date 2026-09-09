import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/voice/telemetry — why a call ended, from the only place that
   knows.

   The audio of a call never touches this server: it runs browser-to-vendor.
   So when the owner says "the voice stopped and closed by itself", the server
   logs show a handshake that succeeded and nothing after it. This route is
   the browser telling us what it saw at the moment a call failed: the reason
   it computed, how long the call had been up, the ICE and DataChannel states,
   the last event type it received, how many tools it had called, and which
   region served. States and counts — no transcript, no audio, no content.

   ONE LOG LINE, NOTHING STORED. Vercel's logs are where the investigation
   happens; a table for this would be a table nobody reads. Every field is
   allow-listed and bounded so the line cannot carry anything but the facts.
   Authenticated, because an unauthenticated log sink is a way to write into
   our logs.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const REASONS = new Set([
  "connection-lost", "handshake-failed", "config-rejected", "service-unreachable", "service-refused",
  "unavailable", "no-microphone", "not-allowed", "signed-out", "resumed", "resume-failed",
  /* THE EXITS THAT ARE NOT FAILURES. A call that ended with no failure
     beacon was invisible here — and the owner met exactly that: five
     handshakes in four minutes, a transcript that kept going, and not one
     line saying why. These name the three ways a live call ends without
     fail(): the caller switched voice (the call is rebuilt), the screen was
     unmounted under it, or the page itself went away (a reload, a killed
     tab). One warn line each, states and counts only, like the rest. */
  "voice-switched", "unmounted", "page-hidden",
  /* The ordinary end: the caller hung up. Carries the event histogram, so
     a call that connected and said nothing names the protocol it heard. */
  "hung-up",
  /* THE PAGE DIED UNDER THE CALL and the next load found its pulse
     (lib/voice/call-memory.ts). Sent by the page that came back. */
  "page-killed",
  /* The caller tapped "Try again" on a slow handshake: the call is rebuilt,
     on the other lane when the first one never came up. */
  "retried",
]);
const short = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[^\w.:-]/g, "").slice(0, max) : "");
/* The cause of a failure: a browser's own error name and message. Words,
   spaces and a little punctuation; bounded; never a body or a token. */
const cause = (v: unknown) => (typeof v === "string" ? v.replace(/[^\w .:()/-]/g, "").slice(0, 100) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  /* Calls are internal-only (the voice gate); a beacon about one is too. */
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const reason = short(body.reason, 24);
  if (!REASONS.has(reason)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  console.warn(
    `[ai.voice.client] ${reason} elapsedMs=${num(body.elapsed_ms)} ice=${short(body.ice, 16) || "none"} ` +
      `dc=${short(body.dc, 16) || "none"} lastEvent=${short(body.last_event, 60) || "none"} toolCalls=${num(body.tool_calls)} ` +
      `slot=${short(body.region, 8) || "none"} lane=${short(body.lane, 4) || "rtc"} fellBack=${body.fell_back === true} iceEverConnected=${body.ice_ever_connected === true} resumes=${num(body.resumes)}` +
      (cause(body.err) ? ` err="${cause(body.err)}"` : "") +
      (num(body.ws_reconnects) ? ` wsReconnects=${num(body.ws_reconnects)}` : "") +
      (short(body.ws_close, 6) ? ` wsClose=${short(body.ws_close, 6)}` : "") +
      (num(body.queued_at) ? ` queuedAt=${new Date(num(body.queued_at)).toISOString()}` : "") +
      (short(body.canary, 24) ? ` canary=${short(body.canary, 24)}` : "") +
      (cause(body.resp_err) ? ` respErr="${cause(body.resp_err)}"` : "") +
      (num(body.tool_wait_ms) ? ` toolWaitMs=${num(body.tool_wait_ms)}` : "") +
      (short(body.capture, 32) ? ` upFrames=${num(body.up_frames)} capture=${short(body.capture, 32)} micPeak=${typeof body.mic_peak === "number" && Number.isFinite(body.mic_peak) ? Math.round(body.mic_peak * 100) / 100 : 0} mic=${short(body.mic, 24) || "none"}` : "") +
      (typeof body.events === "string" && body.events ? ` events=${body.events.replace(/[^\w.:,…-]/g, "").slice(0, 600)}` : ""),
  );
  return new NextResponse(null, { status: 204 });
}
