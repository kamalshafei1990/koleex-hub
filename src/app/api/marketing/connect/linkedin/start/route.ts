import "server-only";

/* GET /api/marketing/connect/linkedin/start?space=ceo — the "Sign in with
   LinkedIn" button (Share on LinkedIn: the CEO's own profile, publishing
   only). Checks the caller may edit that space's accounts (view-as is
   refused there too), that the LinkedIn app keys and the token key are
   configured, then sends the browser to LinkedIn's sign-in with a fresh
   anti-forgery state. Every refusal returns with ?connect=<reason> and
   &via=linkedin (the banner then speaks of LinkedIn, not Meta). */

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { LINKEDIN_STATE_COOKIE, LINKEDIN_STATE_COOKIE_OPTIONS, linkedinConfig, linkedinLoginUrl } from "@/lib/server/marketing/linkedin";
import { isTokenCryptoConfigured } from "@/lib/server/marketing/token-crypto";
import { SPACE_MODULE, SPACE_ROUTE, asSpace, platformFlow, type ConnectResult } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const space = asSpace(req.nextUrl.searchParams.get("space"));
  const back = (result: ConnectResult) => NextResponse.redirect(new URL(`${SPACE_ROUTE[space]}?connect=${result}&via=linkedin`, req.nextUrl.origin));

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "edit");
  if (denied) return back("denied");
  /* Only where LinkedIn signs in (CEO Brand). */
  if (platformFlow(space, "linkedin") !== "linkedin") return back("denied");

  const cfg = linkedinConfig();
  if (!cfg || !isTokenCryptoConfigured()) return back("setup");

  const state = `${space}.${crypto.randomBytes(24).toString("base64url")}`;
  const res = NextResponse.redirect(linkedinLoginUrl(cfg, state));
  res.cookies.set(LINKEDIN_STATE_COOKIE, state, LINKEDIN_STATE_COOKIE_OPTIONS);
  return res;
}
