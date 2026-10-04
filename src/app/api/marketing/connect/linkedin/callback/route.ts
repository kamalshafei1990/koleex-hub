import "server-only";

/* GET /api/marketing/connect/linkedin/callback — where LinkedIn's sign-in
   returns. In order:
     1. the state must equal the cookie set by /start (anti-forgery), else
        nothing is exchanged;
     2. the caller must still be signed in and allowed to edit the space
        (view-as is refused: requireModuleAction blocks it for "edit");
     3. the code becomes the member's key (60 days, no refresh for a
        self-serve app), which reads the member (userinfo);
     4. the account is saved with its key ENCRYPTED (only by
        lib/server/marketing/accounts) — publishing only: LinkedIn shares no
        member's posts or numbers with this kind of app.
   It always ends back on the accounts page with ?connect=<result>, and the
   state cookie is cleared either way. Keys are never logged. */

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { MetaError } from "@/lib/server/marketing/meta";
import { LINKEDIN_STATE_COOKIE, LINKEDIN_STATE_COOKIE_OPTIONS, exchangeLinkedInCode, linkedinConfig, linkedinProfile } from "@/lib/server/marketing/linkedin";
import { saveLinkedInAccount } from "@/lib/server/marketing/accounts";
import { isTokenCryptoConfigured } from "@/lib/server/marketing/token-crypto";
import { SPACE_MODULE, SPACE_ROUTE, asSpace, type ConnectResult } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const state = url.searchParams.get("state") ?? "";
  const space = asSpace(state.split(".")[0]);
  const back = (result: ConnectResult, extra = "") => {
    const res = NextResponse.redirect(new URL(`${SPACE_ROUTE[space]}?connect=${result}${extra}&via=linkedin`, url.origin));
    res.cookies.set(LINKEDIN_STATE_COOKIE, "", { ...LINKEDIN_STATE_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  };

  const expected = req.cookies.get(LINKEDIN_STATE_COOKIE)?.value ?? "";
  if (!state || !expected || !sameState(state, expected)) return back("expired");

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return back("expired");
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "edit");
  if (denied) return back("denied");

  if (url.searchParams.get("error")) return back("cancelled");
  const code = url.searchParams.get("code");
  if (!code) return back("failed");
  const cfg = linkedinConfig();
  if (!cfg || !isTokenCryptoConfigured()) return back("setup");

  try {
    const key = await exchangeLinkedInCode(cfg, code);
    if (!key.scopes.includes("w_member_social")) return back("failed");
    const profile = await linkedinProfile(key.token);
    await saveLinkedInAccount({ tenantId: auth.tenant_id, space, connectedBy: auth.account_id, profile, token: key.token, expiresAt: key.expiresAt, scopes: key.scopes });
    return back("ok", "&accounts=1");
  } catch (e) {
    const meta = e instanceof MetaError ? `code ${e.code ?? "?"}: ` : "";
    console.error(`[marketing/linkedin callback] ${meta}${e instanceof Error ? e.message : String(e)}`);
    return back("failed");
  }
}
