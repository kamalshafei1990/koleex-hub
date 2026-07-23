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
import { cachedGet, invalidateCachedGet } from "./client-cache";
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
const DEPARTMENTS = "koleex_departments";
const POSITIONS = "koleex_positions";
const HISTORY = "koleex_position_history";

/* ── Employee list item (joined data) ── */
export interface EmployeeListItem {
  id: string;                   // koleex_employees.id
  person_id: string;
  person: {
    full_name: string;
    /** Native / alternate name (people.name_alt — e.g. the Chinese name).
        /api/employees has always returned it; the type omitted it, so every
        surface that wanted the second line had to cast. Render via
        <PersonName name={...} alt={...} />. */
    name_alt: string | null;
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
  /** active | on_leave | terminated | … Only meaningful when editing — a new
      hire is always created active, so the create form doesn't show it. */
  employment_status: string;
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
  /* WeChat identity + social presence + scans of the legal IDs. */
  wechat_id: string;
  wechat_qr_url: string;
  /** JSON string of [{platform, value}] — the form edits it as an array and
      serialises here so the rest of the wizard stays a flat string map. */
  social_accounts: string;
  /** JSON string of skill assessment rows — see parseSkills on the server. */
  skills: string;
  /** JSON string of baseline behavior items — written as a baseline
      assessment on CREATE only (edit manages behavior in the HR app). */
  behavior_baseline: string;
  national_id_doc_url: string;
  national_id_back_doc_url: string;
  passport_doc_url: string;
  visa_doc_url: string;

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
    employment_status: "active",
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
    bank_currency: "CNY",
    wechat_id: "",
    wechat_qr_url: "",
    social_accounts: "[]",
    skills: "[]",
    behavior_baseline: "[]",
    national_id_doc_url: "",
    national_id_back_doc_url: "",
    passport_doc_url: "",
    visa_doc_url: "",
    initial_salary: "",
    /* KOLEEX bills and pays in CNY — a USD default meant correcting the
       currency on literally every new hire. */
    salary_currency: "CNY",
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

/** Departments are org structure — they change on the scale of months, not
 *  page loads. A minute of reuse is invisible to users and removes the burst. */
const DEPARTMENTS_TTL_MS = 60_000;

/** Fetch all departments for picker.
 *  Routed through /api/management/departments so the request runs
 *  under the service-role client and respects tenant scoping —
 *  RLS on koleex_departments otherwise returns an empty list and
 *  leaves the Add Employee wizard stuck on "Loading…". */
export async function fetchDepartments(): Promise<DepartmentRow[]> {
  /* Coalesced: the Employees page, the wizard and the picker each ask for
     the department list on mount — three identical requests per load, and
     under that burst this endpoint went from 71ms to 10.2s and started
     returning 500s. It is 23 rows of reference data; one request is enough. */
  try {
    const json = await cachedGet<{ departments?: DepartmentRow[] }>(
      "/api/management/departments", DEPARTMENTS_TTL_MS,
    );
    return (json.departments ?? []).filter((d) => d.is_active !== false);
  } catch (e) {
    console.error("[Departments] fetch failed:", e);
    return [];
  }
}

/** Fetch positions for a given department.
 *  Routed through /api/management/positions for the same reason as
 *  fetchDepartments — RLS blocks the anon client. */
export async function fetchPositionsByDepartment(departmentId: string): Promise<PositionRow[]> {
  try {
    const qs = new URLSearchParams({ department_id: departmentId });
    const res = await fetch(`/api/management/positions?${qs.toString()}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) {
      console.error("[Positions] HTTP", res.status);
      return [];
    }
    const json = (await res.json()) as { positions?: PositionRow[] };
    return (json.positions ?? []).filter((p) => p.is_active !== false);
  } catch (e) {
    console.error("[Positions] fetch failed:", e);
    return [];
  }
}

/** Fetch all employees as list items (joined across tables).
 *
 *  Runs through /api/employees so the joins execute under the
 *  service_role client. The old browser version was blocked by RLS
 *  on koleex_employees and returned an empty list, making every
 *  newly-created employee look like it disappeared.
 *
 *  Pass `{ activeOnly: true }` for the Manager / Supervisor picker —
 *  we don't want to offer terminated employees as supervisors. */
export async function fetchEmployeeList(
  opts: { activeOnly?: boolean } = {},
): Promise<EmployeeListItem[]> {
  try {
    const url = opts.activeOnly ? "/api/employees?activeOnly=1" : "/api/employees";
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return [];
    const json = (await res.json()) as { employees: EmployeeListItem[] };
    return json.employees ?? [];
  } catch (e) {
    console.error("[Employees] Fetch:", e);
    return [];
  }
}

/** Fetch a single employee with all linked data.
 *
 *  Goes through /api/employees/[id] so the joins run with the
 *  service_role client. The old browser version read koleex_employees
 *  directly with the anon key and got an empty result (RLS hides the
 *  row), which made the profile page show "Employee not found" for
 *  records that were saved successfully seconds earlier. */
export async function fetchEmployeeProfile(employeeId: string): Promise<EmployeeWithLinks | null> {
  if (!employeeId) return null;
  try {
    const res = await fetch(`/api/employees/${employeeId}`, { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as EmployeeWithLinks | { error: string };
    if ("error" in json) return null;
    return json;
  } catch (e) {
    console.error("[fetchEmployeeProfile]", e);
    return null;
  }
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

export interface CreateEmployeeResult {
  success: boolean;
  /** Populated on both failure AND partial success (e.g. the
   *  employee saved but account creation was skipped). Callers
   *  should show `error` whenever it's set, regardless of `success`. */
  error?: string;
  personId?: string;
  employeeId?: string;
  accountId?: string;
  /** Login credentials echoed back once so the Add Employee success
   *  modal can display them for the admin to copy. Null when no
   *  account was created. The temp password is base64 in the DB;
   *  this is the only moment it's retrievable in plain text. */
  accountUsername?: string;
  accountLoginEmail?: string;
  tempPassword?: string;
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
   UPDATE / DELETE — API-first.

   The old updateEmployeePerson/updateEmployeeHR/deactivateEmployee
   helpers wrote through the browser anon client, which the P0 RLS
   lockdown blocks on people/koleex_employees/accounts — they silently
   failed and had no callers. Replaced with server-route calls that
   carry real permission gating + audit logging.
   ═══════════════════════════════════════════════════ */

export interface UpdateEmployeeInput {
  /** koleex_employees columns to update (HR fields). */
  employee?: Partial<EmployeeRow>;
  /** Shared people profile columns (name, contact, address). */
  person?: Partial<PersonRow>;
  /** Move the employee in the org chart. Both ids required together. */
  assignment?: { department_id: string; position_id: string };
}

/** Update an employee across employee/person/assignment in one call.
 *  Server enforces the Employees·edit permission + private-column policy. */
export async function updateEmployee(
  employeeId: string,
  input: UpdateEmployeeInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/employees/${employeeId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok) return { ok: false, error: json?.error ?? `Server returned ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/** Hard-delete an employee record. HR-owned rows cascade; the shared
 *  person stays and any login account is suspended server-side.
 *  Server enforces the Employees·delete permission. */
export async function deleteEmployee(
  employeeId: string,
): Promise<{ ok: boolean; error?: string; accountSuspended?: boolean }> {
  try {
    const res = await fetch(`/api/employees/${employeeId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string; accountSuspended?: boolean }
      | null;
    if (!res.ok) return { ok: false, error: json?.error ?? `Server returned ${res.status}` };
    return { ok: true, accountSuspended: json?.accountSuspended };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
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

/* ═══════════════════════════════════════════════════
   EDIT — the write + read halves that let the edit screen reuse the
   create form. Before this, editing had its own smaller form writing a
   different subset of columns, so the two screens disagreed about what an
   employee record contains.
   ═══════════════════════════════════════════════════ */

/** Save the full wizard payload over an existing employee.
 *  Mirrors createFullEmployee(); the server route is the mirror of POST. */
export async function updateFullEmployee(
  employeeId: string,
  data: EmployeeWizardData,
): Promise<CreateEmployeeResult> {
  try {
    const res = await fetch("/api/employees/full", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, employee_id: employeeId }),
    });
    try {
      return (await res.json()) as CreateEmployeeResult;
    } catch {
      return { success: false, error: `Server returned ${res.status}.` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/** Dates arrive as full timestamps; the date inputs want YYYY-MM-DD. */
function dateOnly(v: unknown): string {
  return typeof v === "string" && v ? v.slice(0, 10) : "";
}
/** Every wizard field is a controlled string — null/undefined would flip the
 *  inputs from controlled to uncontrolled and React would warn. */
function s(v: unknown): string {
  return v == null ? "" : String(v);
}

/** Profile record → the exact shape the create form edits.
 *  Anything absent falls back to emptyWizardData()'s default, so a field the
 *  DB has never held still renders as an empty control rather than blowing up. */
export function wizardDataFromProfile(p: EmployeeWithLinks): EmployeeWizardData {
  const base = emptyWizardData();
  const person = p.person as unknown as Record<string, unknown>;
  const emp = p.employee as unknown as Record<string, unknown>;

  return {
    ...base,
    photo_url: (person.avatar_url as string | null) ?? null,
    title: base.title,
    first_name: s(person.first_name),
    middle_name: base.middle_name,
    last_name: s(person.last_name),
    first_name_alt: s(person.first_name_alt),
    last_name_alt: s(person.last_name_alt),
    gender: s(emp.gender),
    birthday: dateOnly(emp.birth_date),
    nationality: s(emp.nationality),
    marital_status: s(emp.marital_status),
    number_of_children: emp.number_of_children == null ? "" : String(emp.number_of_children),
    personal_phone: s(person.phone),
    personal_email: s(person.email),

    employee_number: s(emp.employee_number),
    hire_date: dateOnly(emp.hire_date),
    employment_type: s(emp.employment_type) || "full_time",
    employment_status: s(emp.employment_status) || "active",
    contract_end_date: dateOnly(emp.contract_end_date),
    probation_end_date: dateOnly(emp.probation_end_date),
    work_email: s(emp.work_email),
    work_phone: s(emp.work_phone),
    work_location: s(emp.work_location) || "office",

    department_id: p.assignment?.department_id ?? "",
    position_id: p.assignment?.position_id ?? "",
    department_name: "",
    position_title: "",
    create_new_department: false,
    create_new_position: false,

    /* Home address lives on the person record (identity consolidation). */
    private_address_line1: s(person.address_line1),
    private_address_line2: s(person.address_line2),
    private_city: s(person.city),
    private_state: s(person.state),
    private_country: s(person.country),
    private_postal_code: s(person.postal_code),

    emergency_contact_name: s(emp.emergency_contact_name),
    emergency_contact_phone: s(emp.emergency_contact_phone),
    emergency_contact_relationship: s(emp.emergency_contact_relationship),

    identification_id: s(emp.identification_id),
    passport_number: s(emp.passport_number),
    visa_number: s(emp.visa_number),
    visa_expiry_date: dateOnly(emp.visa_expiry_date),

    bank_name: s(emp.bank_name),
    bank_account_holder: s(emp.bank_account_holder),
    bank_account_number: s(emp.bank_account_number),
    bank_iban: s(emp.bank_iban),
    bank_swift: s(emp.bank_swift),
    bank_currency: s(emp.bank_currency),
    wechat_id: s(emp.wechat_id),
    wechat_qr_url: s(emp.wechat_qr_url),
    social_accounts: JSON.stringify(
      Array.isArray(emp.social_accounts) ? emp.social_accounts : [],
    ),
    skills: JSON.stringify(p.skills ?? []),
    behavior_baseline: "[]",  // baseline is a create-time concept; edit uses HR
    national_id_doc_url: s(emp.national_id_doc_url),
    national_id_back_doc_url: s(emp.national_id_back_doc_url),
    passport_doc_url: s(emp.passport_doc_url),
    visa_doc_url: s(emp.visa_doc_url),

    initial_salary: emp.initial_salary == null ? "" : String(emp.initial_salary),
    salary_currency: s(emp.salary_currency),
    manager_id: s(emp.manager_id),

    insurance_provider: s(emp.insurance_provider),
    insurance_policy_number: s(emp.insurance_policy_number),
    insurance_class: s(emp.insurance_class),
    insurance_expiry_date: dateOnly(emp.insurance_expiry_date),

    social_security_number: s(emp.social_security_number),
    tax_id: s(emp.tax_id),

    education_degree: s(emp.education_degree),
    education_institution: s(emp.education_institution),
    education_field: s(emp.education_field),
    education_graduation_year:
      emp.education_graduation_year == null ? "" : String(emp.education_graduation_year),

    driving_license_number: s(emp.driving_license_number),
    driving_license_type: s(emp.driving_license_type),
    driving_license_expiry: dateOnly(emp.driving_license_expiry),

    blood_type: s(emp.blood_type),
    religion: s(emp.religion),
    languages: s(emp.languages),

    emergency_contact2_name: s(emp.emergency_contact2_name),
    emergency_contact2_phone: s(emp.emergency_contact2_phone),
    emergency_contact2_relationship: s(emp.emergency_contact2_relationship),

    /* Account creation is never part of an edit — the Account tab owns it. */
    create_account: false,
    username: "",
    login_email: "",
    temp_password: "",
    role_id: "",
  };
}
