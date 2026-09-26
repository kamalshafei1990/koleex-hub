import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { isUuid } from "@/lib/server/calendar-access";
import { feedWindow, loadBusyBlocks } from "@/lib/server/calendar-feed";
import { internalAccountIds } from "@/lib/server/internal-accounts";
import type { BusyBlock } from "@/lib/calendar-types";

/* GET /api/calendar/freebusy?accounts=<id,id,…>&from=<ISO>&to=<ISO>
   → { busy: { [accountId]: BusyBlock[] } }

   When is each of these colleagues busy — for the event editor's guest
   timeline. Built from the same feed as the calendar
   (lib/server/calendar-feed loadBusyBlocks): own events and series with
   their exceptions, invitations not declined, and leave.

   ONLY busy intervals: an event's title rides along only when the caller
   could open that event anyway (not private, and the caller organizes it,
   is invited to it, or is a Super Admin). Nothing else about an event —
   place, description, guests — leaves the server.

   Accounts must be ACTIVE INTERNAL accounts of the caller's tenant (the same
   people the editor can invite); others are left out of the answer. At most
   20 accounts and an 8-day window. */

const MAX_ACCOUNTS = 20;
const MAX_WINDOW_MS = 8 * 86_400_000;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? "");
  const to = new Date(url.searchParams.get("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: "from/to must be ISO timestamps with from < to" }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_WINDOW_MS) {
    return NextResponse.json({ error: "window too large" }, { status: 400 });
  }
  const requested = Array.from(new Set(
    (url.searchParams.get("accounts") ?? "").split(",").map((s) => s.trim()).filter((s) => s && isUuid(s)),
  ));
  if (requested.length === 0) return NextResponse.json({ busy: {} });
  if (requested.length > MAX_ACCOUNTS) {
    return NextResponse.json({ error: `at most ${MAX_ACCOUNTS} accounts` }, { status: 400 });
  }

  const allowed = await internalAccountIds(requested, auth.tenant_id);
  const w = feedWindow(from, to);
  try {
    const entries = await Promise.all(
      allowed.map(async (id) => [id, await loadBusyBlocks(auth, id, w)] as const),
    );
    const busy: Record<string, BusyBlock[]> = {};
    for (const [id, blocks] of entries) busy[id] = blocks;
    return NextResponse.json({ busy }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/calendar/freebusy]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
  }
}
