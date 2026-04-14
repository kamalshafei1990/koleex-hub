"use client";

/* ---------------------------------------------------------------------------
   Employees Admin — Unified CRUD for the employee system.

   Orchestrates across 4 tables in one flow:
     1. people              — Person identity (name, photo, contact)
     2. koleex_employees    — HR record (hire date, contract, bank, visa)
     3. koleex_assignments  — Org placement (department + position)
     4. accounts            — Login identity (optional)

   Also queries:
     - koleex_departments   — For department picker
     - koleex_positions     — For position picker
     - koleex_roles         — For role assignment
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import {
  generateTemporaryPassword,
  suggestUsername,
} from "./accounts-admin";
import type {
  PersonRow,
  EmployeeRow,
  AccountRow,
  AssignmentRow,
  DepartmentRow,
  PositionRow,
  EmployeeWithLinks,
} from "@/types/supabase";

/* ── Table names ── */
const PEOPLE = "people";
const EMPLOYEES = "koleex_employees";
const ACCOUNTS = "accounts";
const DEPARTMENTS = "koleex_departments";
const POSITIONS = "koleex_positions";
const ASSIGNMENTS = "koleex_assignments";
const HISTORY = "koleex_position_history";

/* ── Employee list item (joined data) ── */
export interface EmployeeListItem {
  id: string;                   // koleex_employees.id
  person_id: string;
  person: {
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    avatar_url: string | null;
  };
  employee_number: string | null;
  hire_date: string | null;
  employment_status: string;
  employment_type: string;
  work_email: string | null;
  work_phone: string | null;
  work_location: string;
  department_name: string | null;
  position_title: string | null;
  department_id: string | null;
  position_id: string | null;
  has_account: boolean;
  account_id: string | null;
}

/* ── Wizard / form state ── */
export interface EmployeeWizardData {
  // Personal Info
  photo_url: string | null;
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  birthday: string;
  nationality: string;
  marital_status: string;
  number_of_children: string;
  personal_phone: string;
  personal_email: string;

  // Employment
  employee_number: string;
  hire_date: string;
  employment_type: string;
  contract_end_date: string;
  probation_end_date: string;
  work_email: string;
  work_phone: string;
  work_location: string;

  // Department & Position
  department_id: string;
  department_name: string;       // for inline creation
  position_id: string;
  position_title: string;        // for inline creation
  create_new_department: boolean;
  create_new_position: boolean;

  // Private Address
  private_address_line1: string;
  private_address_line2: string;
  private_city: string;
  private_state: string;
  private_country: string;
  private_postal_code: string;

  // Emergency Contact
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;

  // Documents / Visa
  identification_id: string;
  passport_number: string;
  visa_number: string;
  visa_expiry_date: string;

  // Bank Details
  bank_name: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_iban: string;
  bank_swift: string;
  bank_currency: string;

  // Account (optional)
  create_account: boolean;
  username: string;
  login_email: string;
  temp_password: string;
  role_id: string;
}

export function emptyWizardData(): EmployeeWizardData {
  return {
    photo_url: null,
    title: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "",
    birthday: "",
    nationality: "",
    marital_status: "",
    number_of_children: "",
    personal_phone: "",
    personal_email: "",
    employee_number: "",
    hire_date: new Date().toISOString().split("T")[0],
    employment_type: "full_time",
    contract_end_date: "",
    probation_end_date: "",
    work_email: "",
    work_phone: "",
    work_location: "office",
    department_id: "",
    department_name: "",
    position_id: "",
    position_title: "",
    create_new_department: false,
    create_new_position: false,
    private_address_line1: "",
    private_address_line2: "",
    private_city: "",
    private_state: "",
    private_country: "",
    private_postal_code: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
    identification_id: "",
    passport_number: "",
    visa_number: "",
    visa_expiry_date: "",
    bank_name: "",
    bank_account_holder: "",
    bank_account_number: "",
    bank_iban: "",
    bank_swift: "",
    bank_currency: "",
    create_account: false,
    username: "",
    login_email: "",
    temp_password: generateTemporaryPassword(),
    role_id: "",
  };
}

/* ═══════════════════════════════════════════════════
   FETCH HELPERS
   ═══════════════════════════════════════════════════ */

/** Generate next employee number (EMP-001, EMP-002, ...) */
export async function generateEmployeeNumber(): Promise<string> {
  const { data } = await supabase
    .from(EMPLOYEES)
    .select("employee_number")
    .not("employee_number", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  let maxNum = 0;
  if (data) {
    for (const row of data) {
      const match = row.employee_number?.match(/EMP-(\d+)/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }
  return `EMP-${String(maxNum + 1).padStart(3, "0")}`;
}

/** Fetch all departments for picker */
export async function fetchDepartments(): Promise<DepartmentRow[]> {
  const { data, error } = await supabase
    .from(DEPARTMENTS)
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) { console.error("[Departments]", error.message); return []; }
  return (data as DepartmentRow[]) || [];
}

/** Fetch positions for a given department */
export async function fetchPositionsByDepartment(departmentId: string): Promise<PositionRow[]> {
  const { data, error } = await supabase
    .from(POSITIONS)
    .select("*")
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .order("title");
  if (error) { console.error("[Positions]", error.message); return []; }
  return (data as PositionRow[]) || [];
}

/** Fetch all employees as list items (joined across tables) */
export async function fetchEmployeeList(): Promise<EmployeeListItem[]> {
  // Fetch all employees with their person data
  const { data: employees, error: empErr } = await supabase
    .from(EMPLOYEES)
    .select("*")
    .order("created_at", { ascending: false });

  if (empErr || !employees) {
    console.error("[Employees] Fetch:", empErr?.message);
    return [];
  }

  // Gather person IDs
  const personIds = employees
    .map((e: EmployeeRow) => e.person_id)
    .filter(Boolean) as string[];

  if (personIds.length === 0) return [];

  // Fetch linked people
  const { data: people } = await supabase
    .from(PEOPLE)
    .select("*")
    .in("id", personIds);

  // Fetch active assignments
  const { data: assignments } = await supabase
    .from(ASSIGNMENTS)
    .select("*")
    .in("person_id", personIds)
    .eq("is_active", true)
    .eq("is_primary", true);

  // Fetch departments and positions for labels
  const deptIds = [...new Set((assignments || []).map((a: AssignmentRow) => a.department_id))];
  const posIds = [...new Set((assignments || []).map((a: AssignmentRow) => a.position_id))];

  const { data: departments } = deptIds.length
    ? await supabase.from(DEPARTMENTS).select("id, name").in("id", deptIds)
    : { data: [] };

  const { data: positions } = posIds.length
    ? await supabase.from(POSITIONS).select("id, title").in("id", posIds)
    : { data: [] };

  // Build maps
  const personMap = new Map((people || []).map((p: PersonRow) => [p.id, p]));
  const assignMap = new Map((assignments || []).map((a: AssignmentRow) => [a.person_id, a]));
  const deptMap = new Map((departments || []).map((d: any) => [d.id, d.name]));
  const posMap = new Map((positions || []).map((p: any) => [p.id, p.title]));

  return employees
    .filter((e: EmployeeRow) => e.person_id && personMap.has(e.person_id))
    .map((e: EmployeeRow) => {
      const person = personMap.get(e.person_id!)!;
      const assignment = assignMap.get(e.person_id!) as AssignmentRow | undefined;

      return {
        id: e.id,
        person_id: e.person_id!,
        person: {
          full_name: person.full_name,
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email,
          phone: person.phone,
          mobile: person.mobile,
          avatar_url: person.avatar_url,
        },
        employee_number: e.employee_number,
        hire_date: e.hire_date,
        employment_status: e.employment_status,
        employment_type: (e as any).employment_type || "full_time",
        work_email: e.work_email,
        work_phone: e.work_phone,
        work_location: (e as any).work_location || "office",
        department_name: assignment ? deptMap.get(assignment.department_id) || null : null,
        position_title: assignment ? posMap.get(assignment.position_id) || null : null,
        department_id: assignment?.department_id || null,
        position_id: assignment?.position_id || null,
        has_account: !!e.account_id,
        account_id: e.account_id,
      } as EmployeeListItem;
    });
}

/** Fetch a single employee with all linked data */
export async function fetchEmployeeProfile(employeeId: string): Promise<EmployeeWithLinks | null> {
  const { data: emp } = await supabase
    .from(EMPLOYEES)
    .select("*")
    .eq("id", employeeId)
    .maybeSingle();

  if (!emp || !emp.person_id) return null;

  const [
    { data: person },
    { data: account },
    { data: assignment },
  ] = await Promise.all([
    supabase.from(PEOPLE).select("*").eq("id", emp.person_id).maybeSingle(),
    emp.account_id
      ? supabase.from(ACCOUNTS).select("*").eq("id", emp.account_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from(ASSIGNMENTS).select("*")
      .eq("person_id", emp.person_id)
      .eq("is_active", true)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  if (!person) return null;

  let department: DepartmentRow | null = null;
  let position: PositionRow | null = null;

  if (assignment) {
    const [{ data: dept }, { data: pos }] = await Promise.all([
      supabase.from(DEPARTMENTS).select("*").eq("id", assignment.department_id).maybeSingle(),
      supabase.from(POSITIONS).select("*").eq("id", assignment.position_id).maybeSingle(),
    ]);
    department = dept as DepartmentRow | null;
    position = pos as PositionRow | null;
  }

  return {
    person: person as PersonRow,
    employee: emp as EmployeeRow,
    account: account as AccountRow | null,
    assignment: assignment as AssignmentRow | null,
    department,
    position,
  };
}

/* ═══════════════════════════════════════════════════
   CREATE EMPLOYEE (full wizard flow)
   ═══════════════════════════════════════════════════ */

interface CreateEmployeeResult {
  success: boolean;
  error?: string;
  personId?: string;
  employeeId?: string;
  accountId?: string;
}

export async function createFullEmployee(data: EmployeeWizardData): Promise<CreateEmployeeResult> {
  try {
    /* ── Step 1: Create Person ── */
    const fullName = [data.title, data.first_name, data.middle_name, data.last_name]
      .filter(Boolean)
      .join(" ");

    const { data: person, error: personErr } = await supabase
      .from(PEOPLE)
      .insert({
        full_name: fullName,
        display_name: `${data.first_name} ${data.last_name}`.trim(),
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        email: data.personal_email || null,
        phone: data.personal_phone || null,
        avatar_url: data.photo_url || null,
        language: null,
        notes: null,
        company_id: null,
        job_title: null,
        mobile: null,
        address_line1: null, address_line2: null,
        city: null, state: null, country: null, postal_code: null,
        created_by: null,
      })
      .select()
      .single();

    if (personErr || !person) {
      return { success: false, error: `Failed to create person: ${personErr?.message}` };
    }

    /* ── Step 2: Create/Get Department & Position ── */
    let departmentId = data.department_id;
    let positionId = data.position_id;

    // Create new department if requested
    if (data.create_new_department && data.department_name) {
      const { data: dept, error: deptErr } = await supabase
        .from(DEPARTMENTS)
        .insert({
          name: data.department_name,
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
        return { success: false, error: `Failed to create department: ${deptErr?.message}` };
      }
      departmentId = dept.id;
    }

    // Create new position if requested
    if (data.create_new_position && data.position_title && departmentId) {
      const { data: pos, error: posErr } = await supabase
        .from(POSITIONS)
        .insert({
          title: data.position_title,
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
        return { success: false, error: `Failed to create position: ${posErr?.message}` };
      }
      positionId = pos.id;
    }

    if (!departmentId || !positionId) {
      return { success: false, error: "Department and position are required." };
    }

    /* ── Step 3: Create Employee Record ── */
    const { data: employee, error: empErr } = await supabase
      .from(EMPLOYEES)
      .insert({
        person_id: person.id,
        account_id: null, // will be set if account is created
        employee_number: data.employee_number || null,
        department: null,   // denormalized field (legacy), use assignments instead
        position: null,     // denormalized field (legacy), use assignments instead
        hire_date: data.hire_date || null,
        employment_status: "active",
        employment_type: data.employment_type || "full_time",
        contract_end_date: data.contract_end_date || null,
        probation_end_date: data.probation_end_date || null,
        work_email: data.work_email || null,
        work_phone: data.work_phone || null,
        work_location: data.work_location || "office",
        manager_id: null,
        notes: null,
        // Private address
        private_address_line1: data.private_address_line1 || null,
        private_address_line2: data.private_address_line2 || null,
        private_city: data.private_city || null,
        private_state: data.private_state || null,
        private_country: data.private_country || null,
        private_postal_code: data.private_postal_code || null,
        // Emergency contact
        emergency_contact_name: data.emergency_contact_name || null,
        emergency_contact_phone: data.emergency_contact_phone || null,
        emergency_contact_relationship: data.emergency_contact_relationship || null,
        // Personal
        birth_date: data.birthday || null,
        marital_status: data.marital_status || null,
        nationality: data.nationality || null,
        gender: data.gender || null,
        number_of_children: data.number_of_children ? parseInt(data.number_of_children, 10) : null,
        // Documents / Visa
        identification_id: data.identification_id || null,
        passport_number: data.passport_number || null,
        visa_number: data.visa_number || null,
        visa_expiry_date: data.visa_expiry_date || null,
        // Bank
        bank_name: data.bank_name || null,
        bank_account_holder: data.bank_account_holder || null,
        bank_account_number: data.bank_account_number || null,
        bank_iban: data.bank_iban || null,
        bank_swift: data.bank_swift || null,
        bank_currency: data.bank_currency || null,
      })
      .select()
      .single();

    if (empErr || !employee) {
      return { success: false, error: `Failed to create employee: ${empErr?.message}` };
    }

    /* ── Step 4: Create Assignment ── */
    const { error: assignErr } = await supabase
      .from(ASSIGNMENTS)
      .insert({
        person_id: person.id,
        position_id: positionId,
        department_id: departmentId,
        is_primary: true,
        start_date: data.hire_date || null,
        end_date: null,
        is_active: true,
      });

    if (assignErr) {
      console.error("[Assignment] Create:", assignErr.message);
    }

    /* ── Step 5: Create Position History entry ── */
    await supabase.from(HISTORY).insert({
      position_id: positionId,
      person_id: person.id,
      department_id: departmentId,
      action: "assigned",
      from_position_id: null,
      to_position_id: positionId,
      notes: `Initial assignment on hire`,
    });

    /* ── Step 6 (Optional): Create Account ── */
    let accountId: string | null = null;

    if (data.create_account) {
      const loginEmail = data.login_email || data.work_email || data.personal_email;
      const username = data.username || suggestUsername(`${data.first_name} ${data.last_name}`);

      // Lightweight base64 tag for temp password (matches accounts-admin pattern)
      const hashTag = `tmp:${btoa(data.temp_password)}`;

      const { data: account, error: accErr } = await supabase
        .from(ACCOUNTS)
        .insert({
          username,
          login_email: loginEmail || `${username}@koleex.local`,
          password_hash: hashTag,
          force_password_change: true,
          two_factor_enabled: false,
          last_login_at: null,
          user_type: "internal",
          status: "invited",
          role_id: data.role_id || null,
          person_id: person.id,
          company_id: null,
          avatar_url: data.photo_url || null,
          internal_notes: null,
          preferences: {},
          auth_user_id: null,
          created_by: null,
        })
        .select()
        .single();

      if (accErr || !account) {
        console.error("[Account] Create:", accErr?.message);
        // Non-fatal — employee is created, account can be added later
      } else {
        accountId = account.id;
        // Link account to employee
        await supabase
          .from(EMPLOYEES)
          .update({ account_id: account.id })
          .eq("id", employee.id);
      }
    }

    return {
      success: true,
      personId: person.id,
      employeeId: employee.id,
      accountId: accountId || undefined,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" };
  }
}

/* ═══════════════════════════════════════════════════
   UPDATE / DELETE
   ═══════════════════════════════════════════════════ */

/** Update person fields */
export async function updateEmployeePerson(
  personId: string,
  updates: Partial<PersonRow>,
): Promise<boolean> {
  const { error } = await supabase.from(PEOPLE).update(updates).eq("id", personId);
  if (error) { console.error("[Person] Update:", error.message); return false; }
  return true;
}

/** Update HR fields */
export async function updateEmployeeHR(
  employeeId: string,
  updates: Partial<EmployeeRow>,
): Promise<boolean> {
  const { error } = await supabase.from(EMPLOYEES).update(updates).eq("id", employeeId);
  if (error) { console.error("[Employee] Update:", error.message); return false; }
  return true;
}

/** Deactivate an employee (soft delete) */
export async function deactivateEmployee(employeeId: string): Promise<boolean> {
  // Set employee status
  const { error: empErr } = await supabase
    .from(EMPLOYEES)
    .update({ employment_status: "inactive" })
    .eq("id", employeeId);

  if (empErr) { console.error("[Employee] Deactivate:", empErr.message); return false; }

  // Get person_id and account_id
  const { data: emp } = await supabase
    .from(EMPLOYEES)
    .select("person_id, account_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (emp?.person_id) {
    // Deactivate assignments
    await supabase
      .from(ASSIGNMENTS)
      .update({ is_active: false, end_date: new Date().toISOString().split("T")[0] })
      .eq("person_id", emp.person_id)
      .eq("is_active", true);
  }

  if (emp?.account_id) {
    // Suspend the account
    await supabase
      .from(ACCOUNTS)
      .update({ status: "suspended" })
      .eq("id", emp.account_id);
  }

  return true;
}

/* ═══════════════════════════════════════════════════
   INLINE DEPARTMENT / POSITION CREATION
   ═══════════════════════════════════════════════════ */

export async function createDepartment(name: string): Promise<DepartmentRow | null> {
  const { data, error } = await supabase
    .from(DEPARTMENTS)
    .insert({
      name,
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

  if (error) { console.error("[Department] Create:", error.message); return null; }
  return data as DepartmentRow;
}

export async function createPosition(
  title: string,
  departmentId: string,
): Promise<PositionRow | null> {
  const { data, error } = await supabase
    .from(POSITIONS)
    .insert({
      title,
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

  if (error) { console.error("[Position] Create:", error.message); return null; }
  return data as PositionRow;
}
