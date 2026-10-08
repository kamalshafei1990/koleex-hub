import "server-only";

/* GET /api/marketing/connect/meta/callback — where Facebook Login for
   Business returns. In order:
     1. the state must equal the cookie set by /start (anti-forgery), else
        nothing is exchanged;
     2. the caller must still be signed in and allowed to edit the space
        (view-as is refused: requireModuleAction blocks it for "edit");
     3. the code becomes a long-lived user token, which reads the chosen
        Pages with their Page tokens and linked Instagram accounts;
     4. those are saved with the keys ENCRYPTED (lib/server/marketing/accounts);
     5. once the answer has gone, their first refresh starts (after()), so the
        Feed has their posts — the earlier ones too — by the time it opens.
   It always ends back on the accounts page with ?connect=<result>, and the
   state cookie is cleared either way. Tokens are never logged. */

import crypto from "node:crypto";
import { NextResponse, after, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import {
  META_STATE_COOKIE, META_STATE_COOKIE_OPTIONS, MetaError,
  exchangeCode, grantedScopes, longLivedUserToken, managedPages, metaAppConfig,
} from "@/lib/server/marketing/meta";
import { isTokenCryptoConfigured } from "@/lib/server/marketing/token-crypto";
import { saveMetaAccounts } from "@/lib/server/marketing/accounts";
import { instagramAdsGranted } from "@/lib/marketing/ads";
import { syncAccounts } from "@/lib/server/marketing/sync";
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
    res.cookies.set(META_STATE_COOKIE, "", { ...META_STATE_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  };

  const expected = req.cookies.get(META_STATE_COOKIE)?.value ?? "";
  if (!state || !expected || !sameState(state, expected)) return back("expired");

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return back("expired");
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "edit");
  if (denied) return back("denied");

  if (url.searchParams.get("error")) return back("cancelled");
  const code = url.searchParams.get("code");
  if (!code) return back("failed");
  const cfg = metaAppConfig();
  if (!cfg || !isTokenCryptoConfigured()) return back("setup");

  try {
    const short = await exchangeCode(cfg, code);
    const long = await longLivedUserToken(cfg, short);
    const [pages, scopes] = await Promise.all([managedPages(long.token), grantedScopes(long.token)]);
    /* The person's own key is kept only for Instagram's ads (found through
       the ad account), and only when the ads permissions were granted. */
    const userToken = instagramAdsGranted(scopes) ? long : null;
    const saved = await saveMetaAccounts({ tenantId: auth.tenant_id, space, connectedBy: auth.account_id, pages, scopes, userToken });
    const tenantId = auth.tenant_id;
    after(() => syncAccounts(tenantId, saved).then(() => undefined, (e) => {
      console.error(`[marketing/meta callback] first refresh: ${e instanceof Error ? e.message : String(e)}`);
    }));
    return back("ok", `&accounts=${saved.length}`);
  } catch (e) {
    const meta = e instanceof MetaError ? `meta code ${e.code ?? "?"}: ` : "";
    console.error(`[marketing/meta callback] ${meta}${e instanceof Error ? e.message : String(e)}`);
    return back("failed");
  }
}
