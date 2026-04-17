import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/me/permissions
   Returns the full koleex_permissions rows for the caller's role plus
   the department_ids the caller is assigned to. Used by the richer
   permissions.ts hook (can/view/edit granular checks + data_scope +
   sensitive_fields). */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [{ data: perms }, { data: assignments }] = await Promise.all([
    auth.role_id
      ? supabaseServer
          .from("koleex_permissions")
          .select("*")
          .eq("role_id", auth.role_id)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    // Department assignments from koleex_employees (department string).
    supabaseServer
      .from("koleex_employees")
      .select("department")
      .eq("account_id", auth.account_id),
  ]);

  const departments = Array.from(
    new Set(
      ((assignments ?? []) as Array<{ department: string | null }>)
        .map((a) => a.department)
        .filter(Boolean) as string[],
    ),
  );

  return NextResponse.json({
    permissions: perms ?? [],
    departments,
    is_super_admin: auth.is_super_admin,
  });
}
