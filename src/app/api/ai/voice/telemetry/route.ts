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

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const REASONS = new Set([
  "connection-lost", "handshake-failed", "config-rejected", "service-unreachable", "service-refused",
  "unavailable", "no-microphone", "not-allowed", "signed-out", "resumed", "resume-failed",
]);
const short = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[^\w.:-]/g, "").slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
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
      `slot=${short(body.region, 8) || "none"} iceEverConnected=${body.ice_ever_connected === true} resumes=${num(body.resumes)}`,
  );
  return new NextResponse(null, { status: 204 });
}
