import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/employees/next-number

   Returns the next available EMP-### slot using the service_role client
   so it can see every existing row. The old client-side version used
   the anon key, which RLS blocks from SELECTing koleex_employees — so
   it always saw 0 rows and always returned "EMP-001", causing the
   duplicate-number error ("Employee number EMP-001 already exists.")
   on the Add Employee page.

   Fetches up to 1000 recent employee_numbers, extracts the integer
   suffix with a regex, and returns the next unused sequence.

   Response:  { employeeNumber: "EMP-042" }
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* Pull enough rows to be safe for any realistic company size. We
     only need the `employee_number` column — no joins, cheap query.
     Not capped at 100 like the old client version because we don't
     want a 101-employee company to start new hires at EMP-002 just
     because the 100 most-recent list happens to be a renumbered batch. */
  const { data, error } = await supabaseServer
    .from("koleex_employees")
    .select("employee_number")
    .not("employee_number", "is", null)
    .limit(1000);

  if (error) {
    console.error("[api/employees/next-number]", error.message);
    return NextResponse.json({ employeeNumber: "EMP-001" });
  }

  let maxNum = 0;
  for (const row of data ?? []) {
    const m = (row as { employee_number: string | null }).employee_number?.match(/EMP-(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }

  return NextResponse.json({
    employeeNumber: `EMP-${String(maxNum + 1).padStart(3, "0")}`,
  });
}
