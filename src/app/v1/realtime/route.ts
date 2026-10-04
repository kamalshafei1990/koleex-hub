import "server-only";

/* ---------------------------------------------------------------------------
   GET /v1/realtime — the Koleex AI voice relay, as a Vercel Function.

   This is the socket lane carried through our own domain (see relay-core.ts
   for the why and the security model — a line-for-line port of
   services/voice-relay/server.mjs). The route IS the path callers dial:
   2026-10-03, the first version rewrote /v1/realtime to /api/voice-relay in
   vercel.json, and the upgraded socket went silent — admission ran, the 101
   completed, then no frame was ever delivered to the function (a WebSocket
   reached through a vercel.json rewrite freezes after the upgrade; the same
   code on its real route path works). The route lives at its true path; no
   rewrite is involved.

   Every admission check runs BEFORE the upgrade, so a refusal is a plain
   HTTP response with the same codes the process version wrote on the raw
   socket. Only an admitted socket reaches experimental_upgradeWebSocket.

   maxDuration = 800: the Pro plan's ceiling. A call longer than ~13 minutes
   is cut by the platform; the client redials and starts a fresh vendor
   session, as it already does when a resume finds nothing parked.
   --------------------------------------------------------------------------- */

import { experimental_upgradeWebSocket } from "@vercel/functions";
import {
  admitRelay,
  attachRelaySocket,
  relayConfigured,
  MAX_FRAME_BYTES,
} from "@/lib/server/ai/voice/relay-core";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(request: Request) {
  if (!relayConfigured()) return new Response("unconfigured", { status: 503 });
  const url = new URL(request.url);
  const adm = admitRelay({
    protocolHeader: request.headers.get("sec-websocket-protocol"),
    origin: request.headers.get("origin"),
    xForwardedFor: request.headers.get("x-forwarded-for"),
    ticket: url.searchParams.get("t"),
    model: url.searchParams.get("model"),
    resume: url.searchParams.get("resume") === "1",
  });
  if (!adm.ok) return new Response(adm.why, { status: adm.code });
  return experimental_upgradeWebSocket(
    (ws) => {
      attachRelaySocket(ws, adm);
    },
    { maxPayload: MAX_FRAME_BYTES },
  );
}
