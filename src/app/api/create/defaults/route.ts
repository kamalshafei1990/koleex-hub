import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { resolveSmartDefaults } from "@/lib/create/defaults";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const defaults = await resolveSmartDefaults(auth.tenant_id);
  return NextResponse.json({ defaults });
}
