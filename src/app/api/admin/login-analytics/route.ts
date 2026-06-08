import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/admin/login-analytics — Phase 2A · S3b.

   Read-only login-security analytics over the observe-mode login_attempts data.
   SUPER-ADMIN ONLY. Never blocks/affects auth; never enables enforcement; no
   schema changes. Service-role reads only (via the S3a engine). Returns the
   full report for a bounded time window.

   Query params (validated + capped):
     · window = 24h | 7d | 30d   (default 24h; anything else → 24h)
     · limit  = 1..100           (top-N size; default 20; clamped)

   Privacy: the response carries no password/hash/session data (none exist on
   login_attempts). Identifiers are returned only here, to an authenticated
   super-admin — the public signin path is unchanged and still enumeration-safe.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import {
  buildReport,
  recentRateLimitEvents,
  type LoginAnalyticsReport,
  type RateLimitAuditEvent,
} from "@/lib/server/login-analytics";
import type { AnalyticsWindow } from "@/lib/server/login-analytics-compute";

const VALID_WINDOWS = new Set<AnalyticsWindow>(["24h", "7d", "30d"]);
const LIMIT_MIN = 1;
const LIMIT_MAX = 100;
const LIMIT_DEFAULT = 20;
const EVENTS_CAP = 50;

function parseWindow(raw: string | null): AnalyticsWindow {
  return raw && VALID_WINDOWS.has(raw as AnalyticsWindow) ? (raw as AnalyticsWindow) : "24h";
}

function parseLimit(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : LIMIT_DEFAULT;
  if (!Number.isFinite(n)) return LIMIT_DEFAULT;
  return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, n));
}

export interface LoginAnalyticsResponse extends LoginAnalyticsReport {
  recentRateLimitEvents: RateLimitAuditEvent[];
}

export async function GET(req: Request) {
  try {
    // 1) Authentication.
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    // 2) Authorization — super-admin only. Generic 403 (no detail leak).
    if (!auth.is_super_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Validate + cap query params.
    const params = new URL(req.url).searchParams;
    const window = parseWindow(params.get("window"));
    const limit = parseLimit(params.get("limit"));

    // 4) One bounded service-role fetch → full report (+ recent audit events).
    const report = await buildReport(window, { topN: limit });
    const events = await recentRateLimitEvents(window, EVENTS_CAP);

    const body: LoginAnalyticsResponse = { ...report, recentRateLimitEvents: events };
    return NextResponse.json(body, {
      // No caching layer yet (S3b): always fresh, never stored by intermediaries.
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("[api/admin/login-analytics]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
