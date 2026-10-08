import "server-only";

/* Brand Center rights (owner, 28/09/2026): every employee reads (openAccess
   "view" in the registry); creating, editing and deleting are granted in
   Roles & Permissions under this module name. Super admins, as everywhere. */

import type { NextResponse } from "next/server";
import { requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";

export const BRAND_CENTER_MODULE = "Brand Center";

export function brandCenterGate(
  auth: ServerAuthContext,
  action: "view" | "create" | "edit" | "delete",
): Promise<NextResponse | null> {
  return requireModuleAction(auth, BRAND_CENTER_MODULE, action);
}
