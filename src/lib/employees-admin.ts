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
  first_name_alt: string;
  last_name_alt: string;
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

  // Salary at Hire
  initial_salary: string;
  salary_currency: string;

  // Manager
  manager_id: string;

  // Insurance
  insurance_provider: string;
  insurance_policy_number: string;
  insurance_class: string;
  insurance_expiry_date: string;

  // Social Security / Tax
  social_security_number: string;
  tax_id: string;

  // Education
  education_degree: string;
  education_institution: string;
  education_field: string;
  education_graduation_year: string;

  // Driving License
  driving_license_number: string;
  driving_license_type: string;
  driving_license_expiry: string;

  // Extra Personal
  blood_type: string;
  religion: string;
  languages: string;

  // Second Emergency Contact
  emergency_contact2_name: string;
  emergency_contact2_phone: string;
  emergency_contact2_relationship: string;

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
    first_name_alt: "",
    last_name_alt: "",
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
    initial_salary: "",
    salary_currency: "USD",
    manager_id: "",
    insurance_provider: "",
    insurance_policy_number: "",
    insurance_class: "",
    insurance_expiry_date: "",
    social_security_number: "",
    tax_id: "",
    education_degree: "",
    education_institution: "",
    education_field: "",
    education_graduation_year: "",
    driving_license_number: "",
    driving_license_type: "",
    driving_license_expiry: "",
    blood_type: "",
    religion: "",
    languages: "",
    emergency_contact2_name: "",
    emergency_contact2_phone: "",
    emergency_contact2_relationship: "",
    /* Default ON. Gap #1 from the connectivity audit: employees
       without an account are invisible to every app that keys on
       account_id (CRM, Projects, Todos, Planning, Calendar, Notes).
       We still let the user turn it off for a back-office-only HR
       record, but the UI nudges against it. */
    create_account: true,
    username: "",
    login_email: "",
    temp_password: generateTemporaryPassword(),
    role_id: "",
  };
}

/* ═══════════════════════════════════════════════════
   FETCH HELPERS
   ═══════════════════════════════════════════════════ */

/** Generate next employee number (EMP-001, EMP-002, ...).
 *
 *  Goes through /api/employees/next-number so the scan runs on the
 *  server with the service_role client. The old version queried
 *  koleex_employees directly from the browser, which RLS blocks —
 *  so it always returned EMP-001 and every new hire collided with
 *  the existing first row.
 *
 *  Falls back to EMP-001 if the endpoint can't be reached; the
 *  server-side uniqueness check will still catch the dupe and ask
 *  the user to pick a different number manually. */
export async function generateEmployeeNumber(): Promise<string> {
  try {
    const res = await fetch("/api/employees/next-number", { credentials: "include" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = (await res.json()) as { employeeNumber?: string };
    return json.employeeNumber || "EMP-001";
  } catch (e) {
    console.warn("[generateEmployeeNumber] falling back to EMP-001:", e);
    return "EMP-001";
  }
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

/** Fetch all employees as list items (joined across tables).
 *  Pass `{ activeOnly: true }` for things like the Manager picker —
 *  we don't want to offer terminated employees as supervisors. */
export async function fetchEmployeeList(
  opts: { activeOnly?: boolean } = {},
): Promise<EmployeeListItem[]> {
  let query = supabase.from(EMPLOYEES).select("*").order("created_at", { ascending: false });
  if (opts.activeOnly) query = query.eq("employment_status", "active");
  const { data: employees, error: empErr } = await query;

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
   EMPLOYEE ACTIVITY (cross-app aggregator)

   Gap #3 from the connectivity audit: the employee profile had no
   "what has this person actually been doing" panel, even though
   every app (CRM, Quotations, Invoices, Projects, Todos, HR, etc.)
   is already keyed to the same account_id / employee_id.

   This aggregator pulls the last N rows from each module in parallel
   and returns counts + a small recent list per bucket. Every query
   is error-tolerant — if a table or column doesn't exist in a given
   deployment the bucket silently returns empty counts rather than
   blowing up the whole page.
   ═══════════════════════════════════════════════════ */

export interface ActivityItem {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  href?: string | null;
  createdAt: string | null;
}

export interface ActivityBucket {
  count: number;
  recent: ActivityItem[];
}

export interface EmployeeActivity {
  crmOpportunities: ActivityBucket;
  quotations: ActivityBucket;
  invoices: ActivityBucket;
  projectsManaged: ActivityBucket;
  tasksAssigned: ActivityBucket;
  todosAssigned: ActivityBucket;
  leaveRequests: ActivityBucket;
  calendarEvents: ActivityBucket;
  notes: ActivityBucket;
  /** True when the employee has no account yet — most buckets will
   *  be empty since they're keyed by account_id. The profile page
   *  uses this to show a "create an account to enable activity"
   *  nudge. */
  missingAccount: boolean;
}

const EMPTY_BUCKET: ActivityBucket = { count: 0, recent: [] };

function empty(): EmployeeActivity {
  return {
    crmOpportunities: EMPTY_BUCKET,
    quotations: EMPTY_BUCKET,
    invoices: EMPTY_BUCKET,
    projectsManaged: EMPTY_BUCKET,
    tasksAssigned: EMPTY_BUCKET,
    todosAssigned: EMPTY_BUCKET,
    leaveRequests: EMPTY_BUCKET,
    calendarEvents: EMPTY_BUCKET,
    notes: EMPTY_BUCKET,
    missingAccount: false,
  };
}

/* Generic wrapper — runs a fetcher, swallows errors so one broken
   module can't take down the whole profile page. */
async function safeBucket<T>(
  fetcher: () => Promise<{ rows: T[]; count: number | null }>,
  map: (r: T) => ActivityItem,
): Promise<ActivityBucket> {
  try {
    const { rows, count } = await fetcher();
    return {
      count: count ?? rows.length,
      recent: rows.map(map),
    };
  } catch (e) {
    console.warn("[EmployeeActivity bucket]", e);
    return EMPTY_BUCKET;
  }
}

/** Fetch a cross-module activity snapshot for one employee. All
 *  buckets are queried in parallel; a failure in any single bucket
 *  returns an empty one rather than rejecting. */
export async function fetchEmployeeActivity(
  employeeId: string,
  accountId: string | null,
): Promise<EmployeeActivity> {
  if (!employeeId) return empty();

  const limit = 5;

  /* HR bucket — keyed on employee_id, independent of account. */
  const leavePromise = safeBucket<Record<string, unknown>>(
    async () => {
      const { data, count } = await supabase
        .from("hr_leave_requests")
        .select("id, leave_type_id, status, start_date, end_date, days, created_at", { count: "exact" })
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return { rows: (data || []) as Record<string, unknown>[], count };
    },
    (r) => ({
      id: String(r.id),
      title: `${r.days ?? "?"} day${Number(r.days) === 1 ? "" : "s"} leave`,
      subtitle: `${r.start_date ?? ""} → ${r.end_date ?? ""}`,
      status: (r.status as string) || null,
      createdAt: (r.created_at as string) || null,
      href: "/hr",
    }),
  );

  /* Everything else is keyed on account_id. If the employee has no
     account yet, short-circuit with empty buckets + a flag so the
     UI can prompt. */
  if (!accountId) {
    const leave = await leavePromise;
    return { ...empty(), leaveRequests: leave, missingAccount: true };
  }

  const [
    crm,
    quotations,
    invoices,
    projectsManaged,
    tasksAssigned,
    todosAssigned,
    calendarEvents,
    notes,
    leave,
  ] = await Promise.all([
    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("crm_opportunities")
          .select("id, name, stage_id, value, currency, expected_close_date, created_at", { count: "exact" })
          .eq("owner_account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.name as string) || "Opportunity",
        subtitle: r.expected_close_date ? `Close ${r.expected_close_date}` : null,
        amount: r.value as number | null,
        currency: (r.currency as string) || null,
        status: null,
        createdAt: (r.created_at as string) || null,
        href: "/crm",
      }),
    ),

    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("quotations")
          .select("id, quote_no, status, total, currency, issue_date, created_at", { count: "exact" })
          .eq("created_by", accountId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.quote_no as string) || "Quotation",
        subtitle: (r.issue_date as string) || null,
        status: (r.status as string) || null,
        amount: r.total as number | null,
        currency: (r.currency as string) || null,
        createdAt: (r.created_at as string) || null,
        href: `/quotations/${r.id}`,
      }),
    ),

    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("invoices")
          .select("id, invoice_no, status, total, currency, issue_date, created_at", { count: "exact" })
          .eq("created_by_account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.invoice_no as string) || "Invoice",
        subtitle: (r.issue_date as string) || null,
        status: (r.status as string) || null,
        amount: r.total as number | null,
        currency: (r.currency as string) || null,
        createdAt: (r.created_at as string) || null,
        href: `/invoices/${r.id}`,
      }),
    ),

    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("projects")
          .select("id, name, code, status, planned_end, created_at", { count: "exact" })
          .eq("manager_account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.name as string) || "Project",
        subtitle: (r.code as string) || null,
        status: (r.status as string) || null,
        createdAt: (r.created_at as string) || null,
        href: `/projects/${r.id}`,
      }),
    ),

    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("project_tasks")
          .select("id, title, status, priority, due_date, project_id, created_at", { count: "exact" })
          .eq("assignee_account_id", accountId)
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(limit);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.title as string) || "Task",
        subtitle: r.due_date ? `Due ${r.due_date}` : null,
        status: (r.status as string) || null,
        createdAt: (r.created_at as string) || null,
        href: `/projects/${r.project_id}`,
      }),
    ),

    safeBucket<Record<string, unknown>>(
      async () => {
        /* Todos use a Postgres array column for assignees. The `cs`
           (contains) filter checks membership without pulling all
           rows to the client. */
        const { data, count } = await supabase
          .from("todos")
          .select("id, title, status, priority, due_date, created_at", { count: "exact" })
          .contains("assignee_account_ids", [accountId])
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(limit);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.title as string) || "Todo",
        subtitle: r.due_date ? `Due ${r.due_date}` : null,
        status: (r.status as string) || null,
        createdAt: (r.created_at as string) || null,
        href: `/todo`,
      }),
    ),

    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("koleex_calendar_events")
          .select("id, title, starts_at, ends_at, event_type, created_at", { count: "exact" })
          .eq("account_id", accountId)
          .gte("starts_at", new Date(Date.now() - 90 * 86400_000).toISOString())
          .order("starts_at", { ascending: false })
          .limit(limit);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.title as string) || "Event",
        subtitle: (r.starts_at as string) || null,
        status: (r.event_type as string) || null,
        createdAt: (r.created_at as string) || null,
        href: "/calendar",
      }),
    ),

    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("notes")
          .select("id, title, updated_at, created_at", { count: "exact" })
          .eq("account_id", accountId)
          .order("updated_at", { ascending: false })
          .limit(limit);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.title as string) || "Untitled note",
        subtitle: null,
        status: null,
        createdAt: (r.updated_at as string) || (r.created_at as string) || null,
        href: "/notes",
      }),
    ),

    leavePromise,
  ]);

  return {
    crmOpportunities: crm,
    quotations,
    invoices,
    projectsManaged,
    tasksAssigned,
    todosAssigned,
    leaveRequests: leave,
    calendarEvents,
    notes,
    missingAccount: false,
  };
}

/* ═══════════════════════════════════════════════════
   CREATE EMPLOYEE (full wizard flow)
   ═══════════════════════════════════════════════════ */

interface CreateEmployeeResult {
  success: boolean;
  /** Populated on both failure AND partial success (e.g. the
   *  employee saved but account creation was skipped). Callers
   *  should show `error` whenever it's set, regardless of `success`. */
  error?: string;
  personId?: string;
  employeeId?: string;
  accountId?: string;
}

/* EMAIL_RE / toIntOrNull / toNumOrNull used to live here for the old
   in-browser createFullEmployee flow. They moved to
   /api/employees/full/route.ts along with the rest of the insert
   chain — the helpers below are intentionally not duplicated. */

export async function createFullEmployee(data: EmployeeWizardData): Promise<CreateEmployeeResult> {
  /* ── Moved to server route ──
     The full wizard flow now runs on the server at
     POST /api/employees/full with the service_role client. That fixes
     the RLS block the user hit on the `people` table (the browser anon
     key is blocked from INSERTing people rows on purpose), and the
     sensitive HR inserts (salary, bank, visa, passport) no longer
     travel through the anon client at all.

     Kept the same return shape + error semantics so the page doesn't
     need to change. */
  try {
    const res = await fetch("/api/employees/full", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    let json: CreateEmployeeResult;
    try {
      json = (await res.json()) as CreateEmployeeResult;
    } catch {
      return { success: false, error: `Server returned ${res.status}.` };
    }
    return json;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { success: false, error: msg };
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
