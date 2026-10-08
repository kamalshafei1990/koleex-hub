import "server-only";

/* ---------------------------------------------------------------------------
   GET /health — the relay's own health line, same body the process version
   answered on /health: counts and configuration, never a secret. A real
   route at its true path (see the note in v1/realtime/route.ts about why no
   vercel.json rewrite is involved).
   --------------------------------------------------------------------------- */

import { relayConfigured, relayConnections } from "@/lib/server/ai/voice/relay-core";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ok: true, connections: relayConnections(), configured: relayConfigured() },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
