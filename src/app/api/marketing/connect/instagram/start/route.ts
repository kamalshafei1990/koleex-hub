import "server-only";

/* GET /api/marketing/connect/instagram/start?space=ceo — the "Sign in with
   Instagram" button (Business Login for Instagram: the CEO's own Creator
   account, no Facebook Page). Checks the caller may edit that space's
   accounts (view-as is refused there too), that the Instagram app keys and
   the token key are configured, then sends the browser to Instagram's
   sign-in with a fresh anti-forgery state. Every refusal returns to the
   accounts page with ?connect=<reason>. */

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { INSTAGRAM_STATE_COOKIE, INSTAGRAM_STATE_COOKIE_OPTIONS, instagramLoginConfig, instagramLoginUrl } from "@/lib/server/marketing/instagram-login";
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

  const cfg = instagramLoginConfig();
  if (!cfg || !isTokenCryptoConfigured()) return back("setup");

  const state = `${space}.${crypto.randomBytes(24).toString("base64url")}`;
  const res = NextResponse.redirect(instagramLoginUrl(cfg, state));
  res.cookies.set(INSTAGRAM_STATE_COOKIE, state, INSTAGRAM_STATE_COOKIE_OPTIONS);
  return res;
}
