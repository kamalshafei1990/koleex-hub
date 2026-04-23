import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/employees/full

   Runs the multi-step Add Employee wizard flow on the server using the
   service_role Supabase client. Previously the flow ran from the browser
   with the anon key and hit a row-level security block on the `people`
   table:

     "Failed to create person: new row violates row-level security policy
      for table 'people'"

   Moving the chain of inserts here also makes it safer (browser code can
   no longer poke raw inserts at the HR tables) and lets us reuse the
   server's `requireAuth()` guard so only a signed-in internal account
   can create employees.

   The request body is EmployeeWizardData (see src/lib/employees-admin).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* ── Table names ── */
const PEOPLE = "people";
const EMPLOYEES = "koleex_employees";
const ACCOUNTS = "accounts";
const DEPARTMENTS = "koleex_departments";
const POSITIONS = "koleex_positions";
const ASSIGNMENTS = "koleex_assignments";
const HISTORY = "koleex_position_history";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toIntOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function toNumOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Minimal shape lookup; we treat the body as an untyped record because
 *  EmployeeWizardData has ~70 fields and copy-typing them all here
 *  would drift from employees-admin.ts. Fields are read with `String()`
 *  / `Boolean()` coercions as needed. */
type Body = Record<string, unknown>;

function str(b: Body, k: string): string | null {
  const v = b[k];
  if (v == null || v === "") return null;
  return String(v);
}
function bool(b: Body, k: string): boolean {
  return Boolean(b[k]);
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  /* ── Step 0: Pre-flight uniqueness checks ── */
  const employeeNumber = str(body, "employee_number");
  if (employeeNumber) {
    const { data: dup } = await supabaseServer
      .from(EMPLOYEES)
      .select("id")
      .eq("employee_number", employeeNumber)
      .maybeSingle();
    if (dup) {
      return NextResponse.json(
        { success: false, error: `Employee number ${employeeNumber} already exists.` },
        { status: 409 },
      );
    }
  }
  const primaryEmail = str(body, "work_email") ?? str(body, "personal_email");
  if (primaryEmail) {
    const { data: dupP } = await supabaseServer
      .from(PEOPLE)
      .select("id")
      .eq("email", primaryEmail)
      .maybeSingle();
    if (dupP) {
      return NextResponse.json(
        { success: false, error: `A person with email ${primaryEmail} already exists.` },
        { status: 409 },
      );
    }
  }

  /* Account-side pre-checks — only run if the caller is actually
     creating an account. Surfaces friendly 409s for the two most
     common collisions (username / login_email) so the client can
     point the user at the exact field instead of showing a
     generic Postgres unique-violation. */
  if (bool(body, "create_account")) {
    const desiredUsername = str(body, "username");
    if (desiredUsername) {
      const { data: dupU } = await supabaseServer
        .from(ACCOUNTS)
        .select("id")
        .ilike("username", desiredUsername)
        .maybeSingle();
      if (dupU) {
        return NextResponse.json(
          { success: false, error: `Username "${desiredUsername}" is already taken.` },
          { status: 409 },
        );
      }
    }
    const desiredLoginEmail =
      str(body, "login_email") ?? str(body, "work_email") ?? str(body, "personal_email");
    if (desiredLoginEmail) {
      const { data: dupL } = await supabaseServer
        .from(ACCOUNTS)
        .select("id")
        .ilike("login_email", desiredLoginEmail)
        .maybeSingle();
      if (dupL) {
        return NextResponse.json(
          { success: false, error: `Login email "${desiredLoginEmail}" is already in use.` },
          { status: 409 },
        );
      }
    }
  }

  /* ── Step 1: Create Person ── */
  const title = str(body, "title");
  const firstName = str(body, "first_name");
  const middleName = str(body, "middle_name");
  const lastName = str(body, "last_name");
  const fullName = [title, firstName, middleName, lastName].filter(Boolean).join(" ");
  const firstNameAlt = str(body, "first_name_alt");
  const lastNameAlt = str(body, "last_name_alt");
  const nameAlt = [firstNameAlt, lastNameAlt].filter(Boolean).join(" ") || null;

  const { data: person, error: personErr } = await supabaseServer
    .from(PEOPLE)
    .insert({
      full_name: fullName,
      display_name: `${firstName ?? ""} ${lastName ?? ""}`.trim(),
      first_name: firstName,
      last_name: lastName,
      first_name_alt: firstNameAlt,
      last_name_alt: lastNameAlt,
      name_alt: nameAlt,
      email: str(body, "personal_email"),
      phone: str(body, "personal_phone"),
      avatar_url: str(body, "photo_url"),
      language: null,
      notes: null,
      company_id: null,
      job_title: null,
      mobile: null,
      address_line1: null, address_line2: null,
      city: null, state: null, country: null, postal_code: null,
      created_by: auth.account_id,
    })
    .select()
    .single();

  if (personErr || !person) {
    return NextResponse.json(
      { success: false, error: `Failed to create person: ${personErr?.message || "unknown error"}` },
      { status: 500 },
    );
  }

  /* ── Step 2: Create/Get Department & Position ── */
  let departmentId = str(body, "department_id");
  let positionId = str(body, "position_id");

  if (bool(body, "create_new_department") && str(body, "department_name")) {
    const { data: dept, error: deptErr } = await supabaseServer
      .from(DEPARTMENTS)
      .insert({
        name: str(body, "department_name"),
        description: null,
        icon: "building2",
        icon_type: "icon",
        icon_value: null,
        parent_id: null,
        sort_order: 0,
        is_active: true,
      })
      .select()
      .single();
    if (deptErr || !dept) {
      return NextResponse.json(
        { success: false, error: `Failed to create department: ${deptErr?.message}` },
        { status: 500 },
      );
    }
    departmentId = dept.id;
  }

  if (bool(body, "create_new_position") && str(body, "position_title") && departmentId) {
    const { data: pos, error: posErr } = await supabaseServer
      .from(POSITIONS)
      .insert({
        title: str(body, "position_title"),
        department_id: departmentId,
        reports_to_position_id: null,
        level: 4,
        description: null,
        role_id: null,
        responsibilities: null,
        requirements: null,
        is_active: true,
        sort_order: 0,
      })
      .select()
      .single();
    if (posErr || !pos) {
      return NextResponse.json(
        { success: false, error: `Failed to create position: ${posErr?.message}` },
        { status: 500 },
      );
    }
    positionId = pos.id;
  }

  if (!departmentId || !positionId) {
    return NextResponse.json(
      { success: false, error: "Department and position are required." },
      { status: 400 },
    );
  }

  /* ── Step 3: Create Employee Record ── */
  const { data: employee, error: empErr } = await supabaseServer
    .from(EMPLOYEES)
    .insert({
      person_id: person.id,
      account_id: null,
      employee_number: employeeNumber,
      department: null,
      position: null,
      hire_date: str(body, "hire_date"),
      employment_status: "active",
      employment_type: str(body, "employment_type") || "full_time",
      contract_end_date: str(body, "contract_end_date"),
      probation_end_date: str(body, "probation_end_date"),
      work_email: str(body, "work_email"),
      work_phone: str(body, "work_phone"),
      work_location: str(body, "work_location") || "office",
      manager_id: str(body, "manager_id"),
      notes: null,
      private_address_line1: str(body, "private_address_line1"),
      private_address_line2: str(body, "private_address_line2"),
      private_city: str(body, "private_city"),
      private_state: str(body, "private_state"),
      private_country: str(body, "private_country"),
      private_postal_code: str(body, "private_postal_code"),
      emergency_contact_name: str(body, "emergency_contact_name"),
      emergency_contact_phone: str(body, "emergency_contact_phone"),
      emergency_contact_relationship: str(body, "emergency_contact_relationship"),
      birth_date: str(body, "birthday"),
      marital_status: str(body, "marital_status"),
      nationality: str(body, "nationality"),
      gender: str(body, "gender"),
      number_of_children: toIntOrNull(body.number_of_children),
      identification_id: str(body, "identification_id"),
      passport_number: str(body, "passport_number"),
      visa_number: str(body, "visa_number"),
      visa_expiry_date: str(body, "visa_expiry_date"),
      bank_name: str(body, "bank_name"),
      bank_account_holder: str(body, "bank_account_holder"),
      bank_account_number: str(body, "bank_account_number"),
      bank_iban: str(body, "bank_iban"),
      bank_swift: str(body, "bank_swift"),
      bank_currency: str(body, "bank_currency"),
      initial_salary: toNumOrNull(body.initial_salary),
      salary_currency: str(body, "salary_currency"),
      insurance_provider: str(body, "insurance_provider"),
      insurance_policy_number: str(body, "insurance_policy_number"),
      insurance_class: str(body, "insurance_class"),
      insurance_expiry_date: str(body, "insurance_expiry_date"),
      social_security_number: str(body, "social_security_number"),
      tax_id: str(body, "tax_id"),
      education_degree: str(body, "education_degree"),
      education_institution: str(body, "education_institution"),
      education_field: str(body, "education_field"),
      education_graduation_year: toIntOrNull(body.education_graduation_year),
      driving_license_number: str(body, "driving_license_number"),
      driving_license_type: str(body, "driving_license_type"),
      driving_license_expiry: str(body, "driving_license_expiry"),
      blood_type: str(body, "blood_type"),
      religion: str(body, "religion"),
      languages: str(body, "languages"),
      emergency_contact2_name: str(body, "emergency_contact2_name"),
      emergency_contact2_phone: str(body, "emergency_contact2_phone"),
      emergency_contact2_relationship: str(body, "emergency_contact2_relationship"),
    })
    .select()
    .single();

  if (empErr || !employee) {
    return NextResponse.json(
      { success: false, error: `Failed to create employee: ${empErr?.message}`, personId: person.id },
      { status: 500 },
    );
  }

  /* ── Step 4: Create Assignment ── */
  const { error: assignErr } = await supabaseServer
    .from(ASSIGNMENTS)
    .insert({
      person_id: person.id,
      position_id: positionId,
      department_id: departmentId,
      is_primary: true,
      start_date: str(body, "hire_date"),
      end_date: null,
      is_active: true,
    });

  if (assignErr) {
    console.error("[api/employees/full Assignment]", assignErr.message);
    return NextResponse.json(
      {
        success: false,
        error: `Employee created but org assignment failed: ${assignErr.message}. Edit the employee to re-assign.`,
        personId: person.id,
        employeeId: employee.id,
      },
      { status: 500 },
    );
  }

  /* ── Step 5: Position History ── */
  await supabaseServer.from(HISTORY).insert({
    position_id: positionId,
    person_id: person.id,
    department_id: departmentId,
    action: "assigned",
    from_position_id: null,
    to_position_id: positionId,
    notes: "Initial assignment on hire",
  });

  /* ── Step 6 (Optional): Account ── */
  let accountId: string | null = null;
  let accountUsername: string | null = null;
  let accountLoginEmail: string | null = null;
  let tempPasswordOut: string | null = null;
  let partialMsg: string | undefined;

  if (bool(body, "create_account")) {
    const loginEmail =
      str(body, "login_email") ?? str(body, "work_email") ?? str(body, "personal_email");
    if (!loginEmail || !EMAIL_RE.test(loginEmail)) {
      return NextResponse.json(
        {
          success: true,
          personId: person.id,
          employeeId: employee.id,
          error: "Employee created. Account was skipped — a valid login email is required.",
        },
        { status: 200 },
      );
    }

    const usernameRaw = str(body, "username");
    const username =
      usernameRaw && usernameRaw.trim().length > 0
        ? usernameRaw.trim()
        : `${firstName ?? ""}.${lastName ?? ""}`.toLowerCase().replace(/[^a-z0-9._-]/g, "");

    /* Lightweight base64 tag for temp password — MUST use `tmp$` to
       match accounts-admin.ts::hashTempPassword. /api/auth/signin
       compares against exactly that prefix; a mismatch makes the
       freshly-created account unable to log in ("Invalid username or
       password"). Base64 body only, no cryptographic hashing — a
       real hash is set the first time the user changes their
       password. */
    const tempPassword = str(body, "temp_password") || "changeme";
    const hashTag = `tmp$${Buffer.from(tempPassword, "utf8").toString("base64")}`;

    const { data: account, error: accErr } = await supabaseServer
      .from(ACCOUNTS)
      .insert({
        username,
        login_email: loginEmail,
        password_hash: hashTag,
        force_password_change: true,
        two_factor_enabled: false,
        last_login_at: null,
        user_type: "internal",
        /* Must be "active" — /api/auth/signin returns 403 "disabled"
           for anything else, so an "invited" account can't sign in
           even with correct credentials. The force_password_change
           flag below already covers the "user should set their own
           password on first login" intent. */
        status: "active",
        role_id: str(body, "role_id"),
        person_id: person.id,
        company_id: null,
        avatar_url: str(body, "photo_url"),
        internal_notes: null,
        preferences: {},
        auth_user_id: null,
        created_by: auth.account_id,
        tenant_id: auth.tenant_id,
      })
      .select()
      .single();

    if (accErr || !account) {
      console.error("[api/employees/full Account]", accErr?.message);
      partialMsg = `Employee saved, but account creation failed: ${accErr?.message}`;
    } else {
      accountId = account.id;
      accountUsername = username;
      accountLoginEmail = loginEmail;
      /* Echo the plain-text temp password back to the caller so the
         admin can copy + share it in the success modal. This is the
         ONLY moment it's retrievable in plain text — we never store
         or return it again after this response. */
      tempPasswordOut = tempPassword;

      await supabaseServer
        .from(EMPLOYEES)
        .update({ account_id: account.id })
        .eq("id", employee.id);

      /* Audit trail. account_login_history already records
         "password_changed" and actual login events; adding a
         "account_created" row at birth closes the "who provisioned
         this user and when" gap without a DB dig. Fire-and-forget;
         a logging failure shouldn't cascade into a failed create. */
      void supabaseServer.from("account_login_history").insert({
        account_id: account.id,
        event_type: "account_created",
        metadata: {
          by_account_id: auth.account_id,
          via: "add_employee_wizard",
          employee_id: employee.id,
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    personId: person.id,
    employeeId: employee.id,
    accountId: accountId ?? undefined,
    accountUsername: accountUsername ?? undefined,
    accountLoginEmail: accountLoginEmail ?? undefined,
    /* Plain-text credentials for the success modal. Null unless the
       admin actually created an account. */
    tempPassword: tempPasswordOut ?? undefined,
    error: partialMsg,
  });
}
