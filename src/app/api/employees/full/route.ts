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
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { hashForWrite } from "@/lib/server/password";

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

/* social_accounts arrives as a JSON string from the wizard (whose state is a
   flat string map). Anything that isn't a well-formed array of {platform,
   value} degrades to [] rather than throwing — a malformed social handle is
   not a reason to lose an entire employee record. */
function parseSocials(raw: unknown): { platform: string; value: string }[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      platform: String(x.platform ?? "").slice(0, 40),
      value: String(x.value ?? "").slice(0, 500),
    }))
    .filter((x) => x.platform && x.value)
    .slice(0, 20);
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Creating an employee also mints a login account with an arbitrary
     role_id — gate it to roles that can create Employees (Admin/HR/SA),
     not just any signed-in internal user. */
  const deny = await requireModuleAction(auth, "Employees", "create");
  if (deny) return deny;

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
      /* Identity consolidation P1: the home address is part of the shared
         person record, not a separate HR "private address". */
      address_line1: str(body, "private_address_line1"),
      address_line2: str(body, "private_address_line2"),
      city: str(body, "private_city"),
      state: str(body, "private_state"),
      country: str(body, "private_country"),
      postal_code: str(body, "private_postal_code"),
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
      /* Identity consolidation: home address lives on the person record
         (people.address_*, set above) — the private_address_* columns are gone. */
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
      /* WeChat + socials + ID scans. The three *_doc_url values are PATHS in
         the private hr-documents bucket, never public URLs — they are rendered
         through a signed link, and sanitizeEmployeeRow strips them from anyone
         without can_view_private. */
      wechat_id: str(body, "wechat_id"),
      wechat_qr_url: str(body, "wechat_qr_url"),
      social_accounts: parseSocials(body.social_accounts),
      national_id_doc_url: str(body, "national_id_doc_url"),
      passport_doc_url: str(body, "passport_doc_url"),
      visa_doc_url: str(body, "visa_doc_url"),
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

    /* Temp password is hashed server-side with Argon2id (hashForWrite). The
       server is the only writer of password_algo. */
    const tempPassword = str(body, "temp_password") || "changeme";
    const hashed = await hashForWrite(tempPassword);

    const { data: account, error: accErr } = await supabaseServer
      .from(ACCOUNTS)
      .insert({
        username,
        login_email: loginEmail,
        password_hash: hashed.hash,
        password_algo: hashed.algo,
        password_changed_at: new Date().toISOString(),
        /* Default OFF — whatever password the admin sets is the
           employee's real password. No forced change on first
           login. Admins who DO want a forced reset can flip the
           toggle manually from the Accounts app. */
        force_password_change: false,
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

/* ═══════════════════════════════════════════════════════════════════════
   PUT /api/employees/full — update an existing employee from the SAME
   EmployeeWizardData shape the create form posts.

   Why it exists: the edit screen used to be its own smaller form writing a
   different subset of columns, so "edit" and "add" disagreed about what an
   employee record even contains. Both now drive one form, and this is the
   write side of it — the field mapping below is deliberately the mirror of
   the POST above. Keep the two in step.

   Not handled here (on purpose): account creation and passwords. Editing a
   person must never mint or reset a login — that lives in the Account tab
   and has its own audit trail.
   ══════════════════════════════════════════════════════════════════════ */
export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Employees", "edit");
  if (deny) return deny;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const employeeId = str(body, "employee_id");
  if (!employeeId) {
    return NextResponse.json({ success: false, error: "employee_id is required." }, { status: 400 });
  }

  /* ── Resolve the record we're editing ── */
  const { data: existing, error: exErr } = await supabaseServer
    .from(EMPLOYEES)
    .select("id, person_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (exErr || !existing?.person_id) {
    return NextResponse.json({ success: false, error: "Employee not found." }, { status: 404 });
  }
  const personId = existing.person_id as string;

  /* ── Uniqueness, excluding self ── */
  const employeeNumber = str(body, "employee_number");
  if (employeeNumber) {
    const { data: dup } = await supabaseServer
      .from(EMPLOYEES)
      .select("id")
      .eq("employee_number", employeeNumber)
      .neq("id", employeeId)
      .maybeSingle();
    if (dup) {
      return NextResponse.json(
        { success: false, error: `Employee number ${employeeNumber} already exists.` },
        { status: 409 },
      );
    }
  }
  const primaryEmail = str(body, "personal_email");
  if (primaryEmail) {
    const { data: dupP } = await supabaseServer
      .from(PEOPLE)
      .select("id")
      .eq("email", primaryEmail)
      .neq("id", personId)
      .maybeSingle();
    if (dupP) {
      return NextResponse.json(
        { success: false, error: `A person with email ${primaryEmail} already exists.` },
        { status: 409 },
      );
    }
  }

  /* ── Person ── */
  const title = str(body, "title");
  const firstName = str(body, "first_name");
  const middleName = str(body, "middle_name");
  const lastName = str(body, "last_name");
  const fullName = [title, firstName, middleName, lastName].filter(Boolean).join(" ");
  const firstNameAlt = str(body, "first_name_alt");
  const lastNameAlt = str(body, "last_name_alt");

  const { error: personErr } = await supabaseServer
    .from(PEOPLE)
    .update({
      full_name: fullName,
      display_name: `${firstName ?? ""} ${lastName ?? ""}`.trim(),
      first_name: firstName,
      last_name: lastName,
      first_name_alt: firstNameAlt,
      last_name_alt: lastNameAlt,
      name_alt: [firstNameAlt, lastNameAlt].filter(Boolean).join(" ") || null,
      email: str(body, "personal_email"),
      phone: str(body, "personal_phone"),
      avatar_url: str(body, "photo_url"),
      address_line1: str(body, "private_address_line1"),
      address_line2: str(body, "private_address_line2"),
      city: str(body, "private_city"),
      state: str(body, "private_state"),
      country: str(body, "private_country"),
      postal_code: str(body, "private_postal_code"),
    })
    .eq("id", personId);
  if (personErr) {
    return NextResponse.json(
      { success: false, error: `Failed to update person: ${personErr.message}` },
      { status: 500 },
    );
  }

  /* ── Department / position, incl. inline creation (same as POST) ── */
  let departmentId = str(body, "department_id");
  let positionId = str(body, "position_id");

  if (bool(body, "create_new_department") && str(body, "department_name")) {
    const { data: dept, error: deptErr } = await supabaseServer
      .from(DEPARTMENTS)
      .insert({
        name: str(body, "department_name"),
        description: null, icon: "building2", icon_type: "icon", icon_value: null,
        parent_id: null, sort_order: 0, is_active: true,
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
        title: str(body, "position_title"), department_id: departmentId,
        reports_to_position_id: null, level: 4, description: null, role_id: null,
        responsibilities: null, requirements: null, is_active: true, sort_order: 0,
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

  /* ── Employee record — mirror of the POST field list ── */
  const { error: empErr } = await supabaseServer
    .from(EMPLOYEES)
    .update({
      employee_number: employeeNumber,
      hire_date: str(body, "hire_date"),
      /* Editable here (unlike create, where a new hire is always active). */
      employment_status: str(body, "employment_status") || "active",
      employment_type: str(body, "employment_type") || "full_time",
      contract_end_date: str(body, "contract_end_date"),
      probation_end_date: str(body, "probation_end_date"),
      work_email: str(body, "work_email"),
      work_phone: str(body, "work_phone"),
      work_location: str(body, "work_location") || "office",
      manager_id: str(body, "manager_id"),
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
      /* WeChat + socials + ID scans. The three *_doc_url values are PATHS in
         the private hr-documents bucket, never public URLs — they are rendered
         through a signed link, and sanitizeEmployeeRow strips them from anyone
         without can_view_private. */
      wechat_id: str(body, "wechat_id"),
      wechat_qr_url: str(body, "wechat_qr_url"),
      social_accounts: parseSocials(body.social_accounts),
      national_id_doc_url: str(body, "national_id_doc_url"),
      passport_doc_url: str(body, "passport_doc_url"),
      visa_doc_url: str(body, "visa_doc_url"),
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
    .eq("id", employeeId);
  if (empErr) {
    return NextResponse.json(
      { success: false, error: `Failed to update employee: ${empErr.message}` },
      { status: 500 },
    );
  }

  /* ── Org assignment — only touched when it actually changed, so an
        unrelated edit doesn't write a spurious "transferred" history row. ── */
  if (departmentId && positionId) {
    const { data: current } = await supabaseServer
      .from(ASSIGNMENTS)
      .select("id, department_id, position_id")
      .eq("person_id", personId)
      .eq("is_active", true)
      .eq("is_primary", true)
      .maybeSingle();

    const changed =
      !current || current.department_id !== departmentId || current.position_id !== positionId;

    if (changed) {
      if (current) {
        await supabaseServer
          .from(ASSIGNMENTS)
          .update({ is_active: false, end_date: new Date().toISOString().split("T")[0] })
          .eq("id", current.id);
      }
      const { error: assignErr } = await supabaseServer.from(ASSIGNMENTS).insert({
        person_id: personId,
        position_id: positionId,
        department_id: departmentId,
        is_primary: true,
        start_date: new Date().toISOString().split("T")[0],
        end_date: null,
        is_active: true,
      });
      if (assignErr) {
        return NextResponse.json(
          { success: false, error: `Saved, but re-assignment failed: ${assignErr.message}` },
          { status: 500 },
        );
      }
      await supabaseServer.from(HISTORY).insert({
        position_id: positionId,
        person_id: personId,
        department_id: departmentId,
        action: current ? "transferred" : "assigned",
        from_position_id: current?.position_id ?? null,
        to_position_id: positionId,
        effective_date: new Date().toISOString().split("T")[0],
        notes: "Updated via employee form",
      });
    }
  }

  return NextResponse.json({ success: true, employeeId, personId });
}
