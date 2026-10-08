import "server-only";

/* GET /api/marketing/posts/setup?space= — what the composer needs before
   anything is written: the accounts it can post to (never their keys), where
   uploads go, whether the caller may approve and create, and whether Koleex
   AI is available to them. Needs "view". */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/marketing/accounts";
import { uploadPrefix } from "@/lib/server/marketing/posts";
import { canApprovePosts } from "@/lib/server/marketing/approvals";
import { aiProviderConfigured } from "@/lib/server/ai-provider";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const space = asSpace(req.nextUrl.searchParams.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  try {
    const [accounts, canApprove, cannotCreate] = await Promise.all([
      listAccounts(auth.tenant_id, space),
      canApprovePosts(auth, space),
      requireModuleAction(auth, SPACE_MODULE[space], "create"),
    ]);
    return NextResponse.json({
      accounts,
      uploadPrefix: uploadPrefix(auth.tenant_id),
      canApprove,
      canCreate: cannotCreate === null,
      ai: auth.user_type === "internal" && aiProviderConfigured(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/posts/setup]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the composer." }, { status: 500 });
  }
}
