import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/cron/voice-watch — does the voice endpoint answer RIGHT NOW?

   WHY THIS EXISTS. For several days the only way anyone learned the voice
   handshake was failing was the owner pressing the call button, watching it
   fail, and reporting it. Every diagnosis then waited on him to try again.
   A region change that took the success rate from six-in-ten to zero ran for
   a full day before anyone counted, because nothing was counting.

   THIS COUNTS. Every fifteen minutes it makes the same request a real call
   makes — to the same endpoint, with the same budget — and writes one line
   saying whether the connection opened and how long it took. Over a day that
   is 96 samples of the path's health that cost the owner nothing and spend no
   vendor tokens: the offer is deliberately invalid, so no session ever
   starts (see ai/voice/probe.ts).

   WHAT IT IS NOT. It does not make voice work and does not retry. It is a
   measurement. A watchdog that also tried to fix things would be one more
   place a change could quietly make the path worse — and we have had enough
   of those.

   SAME VOCABULARY AS THE REAL HANDSHAKE, ON PURPOSE. The line it logs uses the
   same fields the session route logs on a real call — from=, region=,
   afterMs=, cause= — so one log query answers "how healthy is the path" across
   both real calls and probes, and a probe result is directly comparable to a
   call result.

   PROTECTED THE SAME WAY EVERY CRON HERE IS: the CRON_SECRET bearer Vercel
   attaches to scheduled invocations. Not user-facing, no session, no tenant.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { readVoiceEnv, readAltVoiceEnv } from "@/lib/server/ai/voice/config";
import { probeVoice } from "@/lib/server/ai/voice/probe";
import { parseGrokVoiceConfig, readGrokVoiceEnv, relaySocketUrl, signRelayTicket, RELAY_TICKET_TTL_SEC } from "@/lib/server/ai/voice/grok";
import { probeGrokSocket, SOCKET_PROBE_TIMEOUT_MS } from "@/lib/server/ai/voice/grok-probe";

export const dynamic = "force-dynamic";
/* One probe at the route's own first-attempt budget, plus headroom. */
export const maxDuration = 25;

/* THE REAL ROUTE'S FIRST-ATTEMPT BUDGET. Kept equal to the longest entry in
   HANDSHAKE_ATTEMPT_BUDGETS_MS in ai/voice/session/route.ts, and asserted
   equal by the suite: a probe that gives up sooner than the route does
   reports failures callers never see, and one that waits longer hides the
   ones they do. */
const WATCH_TIMEOUT_MS = 13_000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authz = req.headers.get("authorization");
    if (authz !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  /* BOTH REGIONS, EACH ON ITS OWN LINE. The second region exists because the
     first answers our function two times in three (see config.ts); a watchdog
     that measured only the first would say nothing about whether the
     fallback a caller lands on is any better. Probed in parallel so the run
     still fits its ceiling; a second region that is not configured is simply
     not a row. */
  const regions = [
    { slot: "primary", env: readVoiceEnv() },
    { slot: "alt", env: readAltVoiceEnv() },
  ] as const;
  /* THE SOCKET LANE, BESIDE THEM (2026-09-08: from two devices through a
     VPN the vendor's socket opened and said nothing; nothing of ours had
     ever opened it from anywhere but a browser). One socket from this
     function, a wait for the far side's first event, one line — so "the
     vendor is silent for everyone" and "that path is a stalled tunnel" stop
     being the same log. Runs in parallel with the region probes; its own
     ceiling fits inside the route's. Absent configuration is simply no row. */
  const grokCfg = parseGrokVoiceConfig(readGrokVoiceEnv());
  const grokKey = process.env.AI_VOICE_GROK_API_KEY?.trim() || "";
  const socketP = grokCfg && grokKey ? probeGrokSocket(grokCfg, grokKey, { timeoutMs: SOCKET_PROBE_TIMEOUT_MS }) : Promise.resolve(null);
  /* AND THROUGH THE RELAY, when there is one: the same probe, dialled at
     the relay's url with a ticket, so the path a browser now takes is
     measured beside the vendor's own. */
  const relaySecret = process.env.AI_VOICE_RELAY_SECRET?.trim() || "";
  const relayP = grokCfg && grokKey && grokCfg.relayUrl && relaySecret
    ? probeGrokSocket(grokCfg, grokKey, {
        timeoutMs: SOCKET_PROBE_TIMEOUT_MS,
        dialUrl: (token) => relaySocketUrl(grokCfg, signRelayTicket(relaySecret, token, Math.floor(Date.now() / 1000) + RELAY_TICKET_TTL_SEC)) ?? "",
      })
    : Promise.resolve(null);
  const [probed, socket, relay] = await Promise.all([
    Promise.all(regions.map(async (r) => ({ ...r, probe: await probeVoice(r.env, fetch, WATCH_TIMEOUT_MS) }))),
    socketP,
    relayP,
  ]);
  const configured = probed.filter((r) => r.probe !== null);

  /* Nothing to watch is not a failure. It is logged once so a deployment that
     LOST its configuration is visible, then answered quietly. */
  if (configured.length === 0) {
    console.warn("[ai.voice.watch] not configured — nothing to probe");
    return NextResponse.json({ configured: false });
  }

  const from = process.env.VERCEL_REGION ?? "local";

  /* ONE LINE PER REGION, ONE VERDICT EACH. `ok` means the endpoint ANSWERED —
     an HTTP status came back, so DNS, routing and TCP all worked. That is the
     thing that has been failing; whether the status was the expected 400 is
     the second, separate question probe.verdict already answers. Never the
     URL, never the key, never the vendor's own words. */
  const rows = configured.map((r) => {
    const probe = r.probe!;
    const region = r.env.AI_VOICE_REGION_LABEL?.trim() || "default";
    /* HEALTHY MEANS IT CAN SERVE A CALL: reachable AND the credential and
       entitlement accepted (audit, 2026-09-07: a 403 "Unpurchased" primary
       was logged "ok" for days because it answered). */
    const healthy = probe.reachable && probe.credential_ok;
    const line =
      `[ai.voice.watch] ${healthy ? "ok" : "fail"} slot=${r.slot} from=${from} region=${region} ` +
      `status=${probe.status ?? "none"} afterMs=${probe.ms} credential=${probe.credential_ok ? "ok" : "refused"} cause=${probe.cause ?? "none"}`;
    if (healthy) console.log(line);
    else console.error(line);
    return {
      slot: r.slot,
      reachable: probe.reachable,
      credential_ok: probe.credential_ok,
      status: probe.status,
      ms: probe.ms,
      cause: probe.cause,
    };
  });
  const anyHealthy = rows.some((r) => r.reachable && r.credential_ok);
  const primary = rows.find((r) => r.slot === "primary") ?? rows[0];

  /* The socket lane's line: the verdict, the times, the first event's type,
     a close code. Never the host, never the secret. `spoke` is the only
     healthy verdict; it is logged at info, the rest at error so the query
     tools surface them. It does not move the status code: the mainland
     lane is the one callers are served on. */
  for (const [name, p] of [["socket", socket], ["relay", relay]] as const) {
    if (!p) continue;
    const line =
      `[ai.voice.watch] ${name} ${p.verdict === "spoke" ? "ok" : "fail"} from=${from} verdict=${p.verdict} ` +
      `afterMs=${p.ms} openMs=${p.openMs ?? "none"} first=${p.first ?? "none"} close=${p.closeCode ?? "none"}`;
    /* Warn even when it spoke: the log query tools surface warn and error
       lines and hide info ones (2026-09-08 07:15: the first run's verdict
       could not be read back), and this line is the one that settles
       "the vendor is silent" against "the path is". */
    if (p.verdict === "spoke") console.warn(line);
    else console.error(line);
  }

  /* THE STATUS CODE IS THE COUNTABLE SIGNAL. The first four runs of this
     watchdog all returned 200 whatever the probe found, and the log query
     tools surface error-level lines far more reliably than info ones — so
     four green requests said nothing about the path. A 503 when NO region is
     reachable makes the verdict visible in the status-code breakdown and in
     the platform's own cron history, where a failed run is a failed run. A
     primary that is down while the alt answers is a 200 with a failing row:
     callers are being served, and the row says by whom. */
  return NextResponse.json(
    {
      configured: true,
      reachable: primary.reachable,
      credential_ok: primary.credential_ok,
      status: primary.status,
      ms: primary.ms,
      cause: primary.cause,
      from,
      regions: rows,
      socket,
      relay,
    },
    { status: anyHealthy ? 200 : 503 },
  );
}
