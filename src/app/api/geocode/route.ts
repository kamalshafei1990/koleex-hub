import "server-only";

/* ---------------------------------------------------------------------------
   /api/geocode  —  AMap (高德) address proxy

   China-friendly address autocomplete + structured geocoding for the supplier
   address fields (report D). Works in China without a VPN. The AMap Web-Service
   key lives ONLY on the server (env AMAP_WEB_KEY) — never shipped to the client.

   Modes:
     GET ?q=<keywords>        → Input Tips (输入提示): live suggestions
     GET ?address=<full text> → Geocode (地理编码): structured province/city/district

   When AMAP_WEB_KEY is not configured the route responds 200 { disabled: true }
   so the UI hides the search box gracefully and manual entry still works.

   Auth: any authenticated user with Suppliers module access.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const AMAP_BASE = "https://restapi.amap.com/v3";

/** AMap returns "" as [] for empty string fields — normalise to a string. */
function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

interface Tip {
  id: string;
  name: string;
  district: string;
  adcode: string;
  address: string;
  location: string;
}
interface Geo {
  formatted_address: string;
  country: string;
  province: string;
  city: string;
  district: string;
  adcode: string;
  location: string;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const key = process.env.AMAP_WEB_KEY;
  if (!key) return NextResponse.json({ disabled: true, tips: [], geocode: null });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const address = (url.searchParams.get("address") ?? "").trim();

  try {
    // ── Input Tips (autocomplete) ──
    if (q) {
      const r = await fetch(
        `${AMAP_BASE}/assistant/inputtips?key=${key}&datatype=all&keywords=${encodeURIComponent(q)}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as { status?: string; tips?: Record<string, unknown>[] };
      if (j.status !== "1") return NextResponse.json({ tips: [] });
      const tips: Tip[] = (j.tips ?? [])
        .map((t) => ({
          id: s(t.id),
          name: s(t.name),
          district: s(t.district),
          adcode: s(t.adcode),
          address: s(t.address),
          location: s(t.location),
        }))
        .filter((t) => t.name);
      return NextResponse.json(
        { tips },
        { headers: { "Cache-Control": "private, max-age=30" } },
      );
    }

    // ── Geocode (structured fill for a chosen address) ──
    if (address) {
      const r = await fetch(
        `${AMAP_BASE}/geocode/geo?key=${key}&address=${encodeURIComponent(address)}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as { status?: string; geocodes?: Record<string, unknown>[] };
      const g = (j.geocodes ?? [])[0];
      if (j.status !== "1" || !g) return NextResponse.json({ geocode: null });
      const geocode: Geo = {
        formatted_address: s(g.formatted_address),
        country: s(g.country),
        province: s(g.province),
        city: s(g.city),
        district: s(g.district),
        adcode: s(g.adcode),
        location: s(g.location),
      };
      return NextResponse.json(
        { geocode },
        { headers: { "Cache-Control": "private, max-age=60" } },
      );
    }

    return NextResponse.json({ error: "Provide ?q= or ?address=" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "geocode lookup failed" }, { status: 502 });
  }
}
