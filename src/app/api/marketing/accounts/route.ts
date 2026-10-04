import "server-only";

/* GET  /api/marketing/accounts?space=company|ceo — the space's accounts (the
        removed ones left out), which server settings are in place
        (booleans only), and whether the caller may remove an account
        ("delete"). Never an access key: lib/server/marketing/accounts
        selects the columns a screen may see. Needs "view".
   POST /api/marketing/accounts — add an account by hand on a platform with
        no posting API (WeChat, WhatsApp, Douyin): { space, platform, name,
        handle?, profile_url? }. Needs "edit". */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { addManualAccount, adsStates, linkedinStates, listAccounts, marketingSetup, messagesStates } from "@/lib/server/marketing/accounts";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const space = asSpace(req.nextUrl.searchParams.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  try {
    const [accounts, ads, messages, linkedin, cannotRemove] = await Promise.all([
      listAccounts(auth.tenant_id, space), adsStates(auth.tenant_id, space), messagesStates(auth.tenant_id, space), linkedinStates(auth.tenant_id, space),
      requireModuleAction(auth, SPACE_MODULE[space], "delete"),
    ]);
    return NextResponse.json({ accounts, ads, messages, linkedin, setup: marketingSetup(), canRemove: cannotRemove === null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/accounts]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the connected accounts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const space = asSpace(typeof body.space === "string" ? body.space : null);
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "edit");
  if (denied) return denied;
  try {
    const out = await addManualAccount({
      tenantId: auth.tenant_id,
      space,
      platform: typeof body.platform === "string" ? body.platform : "",
      name: body.name,
      handle: body.handle,
      profileUrl: body.profile_url,
      createdBy: auth.account_id,
    });
    if ("error" in out) return NextResponse.json({ error: out.error }, { status: 400 });
    return NextResponse.json({ account: out.account }, { status: 201 });
  } catch (e) {
    console.error("[api/marketing/accounts POST]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not add the account." }, { status: 500 });
  }
}
