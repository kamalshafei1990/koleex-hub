import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import {
  EMPLOYEE_PRIVATE_COLUMNS,
  canViewPrivate,
  sanitizeAccountRow,
  sanitizeEmployeeRow,
} from "@/lib/server/sensitive-columns";
import { logAudit } from "@/lib/server/audit";

/* Person columns an Employees-module editor may write through this route.
   Whitelist, not blacklist — people is the shared identity SoT (accounts,
   Discuss, HR all read it), so only plain profile fields are writable here. */
const PERSON_EDITABLE_COLUMNS: readonly string[] = [
  "full_name", "name_alt", "display_name", "job_title", "email", "phone",
  "mobile", "language", "address_line1", "address_line2", "city", "state",
  "country", "postal_code", "avatar_url",
];

/* GET /api/employees/[id] — full profile joined across tables.
 *
 * Returns the EmployeeWithLinks shape the /employees/[id] profile
 * page expects: { person, employee, account, assignment, department,
 * position }. Reads via service_role so RLS on koleex_employees
 * doesn't hide the row from the signed-in viewer. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* Employee profiles are company data — require the Employees module.
     Without this, ANY signed-in account (including customer logins) could
     pull full HR rows by id. Fail-closed like every other module gate. */
  const deny = await requireModuleAccess(auth, "Employees");
  if (deny) return deny;

  const { data: emp, error: empErr } = await supabaseServer
    .from("koleex_employees")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (empErr) {
    console.error("[api/employees/[id] GET]", empErr.message);
    return NextResponse.json({ error: empErr.message }, { status: 500 });
  }
  if (!emp || !emp.person_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  /* Parallelise everything we can. The assignment lookup scopes to
     the most recent active+primary record — rare to have more than
     one, but `.maybeSingle()` protects us from bad data. */
  const [{ data: person }, accountRes, { data: assignment }] = await Promise.all([
    supabaseServer.from("people").select("*").eq("id", emp.person_id).maybeSingle(),
    /* Resolve by account_id when it's set, otherwise fall back to the PERSON
       link. `accounts.person_id` and `koleex_employees.account_id` are two
       records of the same fact and they drift: an account created outside the
       add-employee flow sets person_id but never back-fills account_id, and
       the profile then told the user "no login account linked" about someone
       who could sign in perfectly well. people is the identity SoT, so the
       person link is the authority and account_id is the shortcut. */
    emp.account_id
      ? supabaseServer.from("accounts").select("*").eq("id", emp.account_id).maybeSingle()
      : supabaseServer.from("accounts").select("*").eq("person_id", emp.person_id).maybeSingle(),
    supabaseServer
      .from("koleex_assignments")
      .select("*")
      .eq("person_id", emp.person_id)
      .eq("is_active", true)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  if (!person) {
    return NextResponse.json({ error: "Person record missing" }, { status: 404 });
  }

  let department = null, position = null;
  if (assignment) {
    const [{ data: dept }, { data: pos }] = await Promise.all([
      supabaseServer.from("koleex_departments").select("*").eq("id", assignment.department_id).maybeSingle(),
      supabaseServer.from("koleex_positions").select("*").eq("id", assignment.position_id).maybeSingle(),
    ]);
    department = dept;
    position = pos;
  }

  /* Column-level policy (shared registry, same rules as Koleex AI):
     · salary / banking / legal-ID columns need can_view_private (or SA)
     · account login secrets (password_hash etc.) never leave the server */
  /* Skill assessments — needed by the edit form and the profile. Small set,
     fetched alongside rather than in a second round-trip from the client. */
  const { data: skillRows } = await supabaseServer
    .from("employee_skill_assessments")
    .select("skill_id, source, employee_score, years_of_experience, notes, is_verified, last_assessed_at")
    .eq("employee_id", id);

  return NextResponse.json({
    person,
    skills: skillRows ?? [],
    employee: sanitizeEmployeeRow(auth, emp as Record<string, unknown>),
    account: sanitizeAccountRow(
      ((accountRes as { data: unknown }).data ?? null) as Record<string, unknown> | null,
    ),
    assignment,
    department,
    position,
  });
}

/* PATCH /api/employees/[id]
 *
 * Two body shapes are accepted:
 *   · Flat (legacy): { work_email: "...", ... }        → koleex_employees only
 *   · Structured:    { employee?, person?, assignment? } → updates the employee
 *     row, the shared people row (whitelisted profile columns), and the
 *     active+primary koleex_assignments row (department/position) in one call.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "Employees", "edit");
  if (denied) return denied;

  /* Tenant scope: legacy rows predate the tenant column and carry NULL —
     treat those as in-tenant rather than 404ing every edit. */
  const { data: existing } = await supabaseServer
    .from("koleex_employees").select("*").eq("id", id).maybeSingle();
  if (!existing || (auth.tenant_id && existing.tenant_id && existing.tenant_id !== auth.tenant_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const structured =
    body && (typeof body.employee === "object" || typeof body.person === "object" || typeof body.assignment === "object");

  const patch = (structured ? (body.employee as Record<string, unknown>) ?? {} : body) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;
  delete patch.person_id;
  delete patch.account_id;

  /* Can't-read → can't-write: without can_view_private the GET never sent
     salary/bank/legal-ID columns, so drop them from the patch rather than
     let a blanked form field overwrite real HR data. */
  if (!canViewPrivate(auth)) {
    for (const c of EMPLOYEE_PRIVATE_COLUMNS) delete patch[c];
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseServer
      .from("koleex_employees")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[api/employees/[id] PATCH employee]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  /* ── Shared person profile (identity SoT) ── */
  if (structured && body.person && typeof body.person === "object" && existing.person_id) {
    const raw = body.person as Record<string, unknown>;
    const personPatch: Record<string, unknown> = {};
    for (const c of PERSON_EDITABLE_COLUMNS) {
      if (c in raw) personPatch[c] = raw[c];
    }
    if (typeof personPatch.full_name === "string" && !personPatch.full_name.trim()) {
      return NextResponse.json({ error: "Full name cannot be empty" }, { status: 400 });
    }
    if (Object.keys(personPatch).length > 0) {
      const { error } = await supabaseServer
        .from("people")
        .update(personPatch)
        .eq("id", existing.person_id);
      if (error) {
        console.error("[api/employees/[id] PATCH person]", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  /* ── Department / position via the assignment row ── */
  if (structured && body.assignment && typeof body.assignment === "object" && existing.person_id) {
    const { department_id, position_id } = body.assignment as {
      department_id?: string | null;
      position_id?: string | null;
    };
    if (department_id && position_id) {
      const { data: current } = await supabaseServer
        .from("koleex_assignments")
        .select("id, department_id, position_id")
        .eq("person_id", existing.person_id)
        .eq("is_active", true)
        .eq("is_primary", true)
        .maybeSingle();
      if (current) {
        if (current.department_id !== department_id || current.position_id !== position_id) {
          const { error } = await supabaseServer
            .from("koleex_assignments")
            .update({ department_id, position_id })
            .eq("id", current.id);
          if (error) {
            console.error("[api/employees/[id] PATCH assignment]", error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
          }
        }
      } else {
        const { error } = await supabaseServer.from("koleex_assignments").insert({
          person_id: existing.person_id,
          department_id,
          position_id,
          is_active: true,
          is_primary: true,
          start_date: new Date().toISOString().split("T")[0],
        });
        if (error) {
          console.error("[api/employees/[id] PATCH assignment insert]", error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }
  }

  await logAudit({
    auth,
    action_type: "update",
    module: "Employees",
    entity_type: "employee",
    entity_id: id,
    entity_label: (existing.employee_number as string | null) ?? null,
    old_values: existing as Record<string, unknown>,
    new_values: { ...existing, ...patch },
    route: `/api/employees/${id}`,
    req,
  });

  return NextResponse.json({ ok: true });
}

/* DELETE /api/employees/[id]
 *
 * Hard-deletes the HR record. Owned HR data (leave, payslips, appraisals,
 * attendance, documents…) cascades in the database. The shared identity is
 * preserved: the people row stays (Discuss history, audit trails), and any
 * login account is SUSPENDED — never silently left active for a person who
 * no longer exists as an employee. If the employee is referenced as a
 * reviewer/interviewer elsewhere, the FK blocks the delete and we return a
 * clear 409 advising termination instead.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "Employees", "delete");
  if (denied) return denied;

  const { data: emp } = await supabaseServer
    .from("koleex_employees").select("*").eq("id", id).maybeSingle();
  if (!emp || (auth.tenant_id && emp.tenant_id && emp.tenant_id !== auth.tenant_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: person } = emp.person_id
    ? await supabaseServer.from("people").select("full_name").eq("id", emp.person_id).maybeSingle()
    : { data: null };

  /* End assignments + suspend the login BEFORE deleting the HR row, so a
     failed delete still leaves the org chart consistent with intent. */
  if (emp.person_id) {
    await supabaseServer
      .from("koleex_assignments")
      .update({ is_active: false, end_date: new Date().toISOString().split("T")[0] })
      .eq("person_id", emp.person_id)
      .eq("is_active", true);
  }
  if (emp.account_id) {
    await supabaseServer.from("accounts").update({ status: "suspended" }).eq("id", emp.account_id);
  }

  const { error } = await supabaseServer.from("koleex_employees").delete().eq("id", id);
  if (error) {
    console.error("[api/employees/[id] DELETE]", error.message);
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "This employee is referenced in other HR records (as a reviewer, interviewer or uploader) and cannot be hard-deleted. Set their status to Terminated instead.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    auth,
    action_type: "delete",
    module: "Employees",
    entity_type: "employee",
    entity_id: id,
    entity_label: (person?.full_name as string | null) ?? (emp.employee_number as string | null) ?? null,
    old_values: emp as Record<string, unknown>,
    severity: "critical",
    route: `/api/employees/${id}`,
    req,
  });

  return NextResponse.json({ ok: true, accountSuspended: Boolean(emp.account_id) });
}
