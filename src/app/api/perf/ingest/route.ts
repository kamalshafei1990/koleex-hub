import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/perf/ingest — sink for the kx-perf client metrics batches.

   Turns validated metric batches into ONE structured log line per batch
   (`[kx-metric] {json}`) which lands in Vercel's function logs, where it can
   be filtered and exported for percentile analysis (P50/75/95/99). No
   database, no third-party vendor, no new attack surface.

   Privacy enforcement is double-layered: the client only sends whitelisted
   shapes, and this route INDEPENDENTLY re-validates every field against the
   same strict patterns, dropping anything else. Metric names must match the
   dictionary pattern; tag values are short, pattern-checked strings/numbers.
   Message bodies, URLs with params, tokens, or free text can never pass.

   Auth: session required (signed-in employees only) so the endpoint cannot
   be used by the public to spam logs. The account id is NOT logged — batches
   carry an anonymous per-session id (`sid`) instead.

   NOTE: emitted via console.warn because next.config removeConsole strips
   console.log/info from production builds (only error/warn survive).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

const NAME_RE = /^[a-z0-9._-]{1,48}$/;
const TAG_KEY_RE = /^[a-z0-9_]{1,24}$/;
const TAG_VAL_RE = /^[A-Za-z0-9 ._:/\-]{0,64}$/;
const MAX_BODY = 32_768;
const MAX_ITEMS = 50;

type In = { sid?: unknown; m?: unknown };

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const raw = await req.text();
  if (raw.length > MAX_BODY) return new NextResponse(null, { status: 413 });

  let body: In;
  try { body = JSON.parse(raw) as In; } catch { return new NextResponse(null, { status: 400 }); }

  const sid = typeof body.sid === "string" && /^[a-z0-9-]{1,16}$/i.test(body.sid) ? body.sid : "anon";
  const items = Array.isArray(body.m) ? body.m.slice(0, MAX_ITEMS) : [];

  const clean: Array<{ n: string; v: number; t: number; tags?: Record<string, string | number | boolean> }> = [];
  for (const it of items) {
    if (typeof it !== "object" || it === null) continue;
    const { n, v, t, tags } = it as { n?: unknown; v?: unknown; t?: unknown; tags?: unknown };
    if (typeof n !== "string" || !NAME_RE.test(n)) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    let outTags: Record<string, string | number | boolean> | undefined;
    if (typeof tags === "object" && tags !== null) {
      outTags = {};
      let k = 0;
      for (const [key, val] of Object.entries(tags as Record<string, unknown>)) {
        if (k >= 8) break;
        if (!TAG_KEY_RE.test(key)) continue;
        if (typeof val === "number" && Number.isFinite(val)) { outTags[key] = val; k++; }
        else if (typeof val === "boolean") { outTags[key] = val; k++; }
        else if (typeof val === "string" && TAG_VAL_RE.test(val)) { outTags[key] = val; k++; }
      }
      if (!k) outTags = undefined;
    }
    clean.push({ n, v: Math.round(v * 10) / 10, t: Math.round(t), tags: outTags });
  }

  if (clean.length) {
    console.warn(
      `[kx-metric] ${JSON.stringify({ sid, env: process.env.VERCEL_ENV ?? "dev", ts: Date.now(), m: clean })}`,
    );
  }
  return new NextResponse(null, { status: 204 });
}
