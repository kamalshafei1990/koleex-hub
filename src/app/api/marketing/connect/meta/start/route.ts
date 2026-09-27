import "server-only";

/* GET /api/marketing/connect/meta/start?space=company|ceo — the "Connect
   Facebook & Instagram" button. Checks the caller may edit that space's
   accounts (view-as is refused there too), that the Meta app and the token
   key are configured, then sends the browser to Facebook Login for Business
   with a fresh anti-forgery state. Every refusal returns to the app page
   with ?connect=<reason> so the screen can say what to do. */

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { META_STATE_COOKIE, META_STATE_COOKIE_OPTIONS, metaAppConfig, metaLoginUrl } from "@/lib/server/marketing/meta";
import { isTokenCryptoConfigured } from "@/lib/server/marketing/token-crypto";
import { SPACE_MODULE, SPACE_ROUTE, asSpace, type ConnectResult } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const space = asSpace(req.nextUrl.searchParams.get("space"));
  const back = (result: ConnectResult) => NextResponse.redirect(new URL(`${SPACE_ROUTE[space]}?connect=${result}`, req.nextUrl.origin));

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "edit");
  if (denied) return back("denied");

  const cfg = metaAppConfig();
  if (!cfg || !isTokenCryptoConfigured()) return back("setup");

  const state = `${space}.${crypto.randomBytes(24).toString("base64url")}`;
  const res = NextResponse.redirect(metaLoginUrl(cfg, state));
  res.cookies.set(META_STATE_COOKIE, state, META_STATE_COOKIE_OPTIONS);
  return res;
}
