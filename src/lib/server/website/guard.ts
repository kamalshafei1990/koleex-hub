import "server-only";

/* Every Page Builder route opens here: signed in, the Website module (view
   to read, the action to change — refused under view-as), and an account
   of the company the site is for. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction, type ModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { requireHostTenant } from "@/lib/server/website/pages";

export async function guardWebsite(action: ModuleAction): Promise<ServerAuthContext | NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = action === "view" ? await requireModuleAccess(auth, "Website") : await requireModuleAction(auth, "Website", action);
  if (deny) return deny;
  const host = await requireHostTenant(auth);
  if (host) return NextResponse.json({ error: host.error }, { status: host.status });
  return auth;
}

export const builderJson = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
