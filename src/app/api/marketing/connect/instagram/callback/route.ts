import "server-only";

/* GET /api/marketing/connect/instagram/callback — where Business Login for
   Instagram returns. In order:
     1. the state must equal the cookie set by /start (anti-forgery), else
        nothing is exchanged;
     2. the caller must still be signed in and allowed to edit the space
        (view-as is refused: requireModuleAction blocks it for "edit");
     3. the code becomes a short-lived key, then a long-lived one (60 days,
        refreshed by the cron before it ends), which reads the account;
     4. the account is saved with its key ENCRYPTED, and the permissions
        Instagram granted (they route its calls to graph.instagram.com);
     5. once the answer has gone, its first refresh starts (after()), so the
        Feed has its posts by the time it opens.
   It always ends back on the accounts page with ?connect=<result>, and the
   state cookie is cleared either way. Keys are never logged. */

import crypto from "node:crypto";
import { NextResponse, after, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { MetaError, markInstagramLoginKey } from "@/lib/server/marketing/meta";
import {
  INSTAGRAM_STATE_COOKIE, INSTAGRAM_STATE_COOKIE_OPTIONS,
  exchangeInstagramCode, instagramLoginConfig, instagramLoginProfile, longLivedInstagramToken,
} from "@/lib/server/marketing/instagram-login";
import { saveInstagramLoginAccount } from "@/lib/server/marketing/accounts";
import { isTokenCryptoConfigured } from "@/lib/server/marketing/token-crypto";
import { syncAccounts } from "@/lib/server/marketing/sync";
import { isInstagramLogin } from "@/lib/marketing/instagram-login";
import { SPACE_MODULE, SPACE_ROUTE, asSpace, type ConnectResult } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";
/* The first refresh runs after the redirect, inside this function's time. */
export const maxDuration = 60;

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
    const res = NextResponse.redirect(new URL(`${SPACE_ROUTE[space]}?connect=${result}${extra}`, url.origin));
    res.cookies.set(INSTAGRAM_STATE_COOKIE, "", { ...INSTAGRAM_STATE_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  };

  const expected = req.cookies.get(INSTAGRAM_STATE_COOKIE)?.value ?? "";
  if (!state || !expected || !sameState(state, expected)) return back("expired");

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return back("expired");
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "edit");
  if (denied) return back("denied");

  if (url.searchParams.get("error")) return back("cancelled");
  /* Instagram appends "#_" to the code; it is not part of it. */
  const code = (url.searchParams.get("code") ?? "").replace(/#_$/, "");
  if (!code) return back("failed");
  const cfg = instagramLoginConfig();
  if (!cfg || !isTokenCryptoConfigured()) return back("setup");

  try {
    const short = await exchangeInstagramCode(cfg, code);
    if (!isInstagramLogin(short.scopes)) return back("failed");
    const long = await longLivedInstagramToken(cfg, short.token);
    markInstagramLoginKey(long.token);
    const profile = await instagramLoginProfile(long.token);
    const id = await saveInstagramLoginAccount({
      tenantId: auth.tenant_id, space, connectedBy: auth.account_id, profile, token: long.token, expiresAt: long.expiresAt, scopes: short.scopes,
    });
    const tenantId = auth.tenant_id;
    after(() => syncAccounts(tenantId, [id]).then(() => undefined, (e) => {
      console.error(`[marketing/instagram callback] first refresh: ${e instanceof Error ? e.message : String(e)}`);
    }));
    return back("ok", "&accounts=1");
  } catch (e) {
    const meta = e instanceof MetaError ? `code ${e.code ?? "?"}: ` : "";
    console.error(`[marketing/instagram callback] ${meta}${e instanceof Error ? e.message : String(e)}`);
    return back("failed");
  }
}
