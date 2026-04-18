/* ---------------------------------------------------------------------------
   Identity System — Supabase CRUD for the refactored accounts layer.

   Covers:
     - people           — person/contact records
     - companies        — organisations (customer level lives here)
     - employees        — internal HR records
     - accounts         — login identity only
     - roles            — role catalogue (read-only seeded data)
     - access_presets   — role → default permission bundle

   Uses the untyped admin client (anon key) just like products-admin.ts.
   All access is gated at the UI layer by AdminAuth.

   Password handling note:
     `password_hash` on accounts is intentionally permissive today. We store
     the temporary password as a lightweight base64 tag (NOT a cryptographic
     hash) so we can round-trip it until Supabase Auth is wired up. The
     first time a user logs in with real auth, `force_password_change` will
     require them to set a proper password that Supabase Auth handles.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type { ScopeContext } from "./scope";
import type {
  AccountRow, AccountInsert, AccountUpdate, AccountStatus, AccountWithLinks,
  CompanyRow, CompanyInsert,
  PersonRow, PersonInsert,
  EmployeeRow, EmployeeInsert, EmployeeUpdate,
  RoleRow,
  AccessPresetRow,
  AccountPermissionOverrideRow, AccountPermissionOverrideInsert,
  AccountPreferences,
} from "@/types/supabase";
import type { AccessLevel } from "@/lib/access-control";
import { logEvent } from "./account-security";

const ACCOUNTS = "accounts";
const COMPANIES = "companies";
const ROLES = "roles";
const PEOPLE = "people";
const EMPLOYEES = "koleex_employees"; // renamed to avoid collision with legacy `employees` table
const ACCESS_PRESETS = "access_presets";
const PERMISSION_OVERRIDES = "account_permission_overrides";

/* ============================================================================
   Accounts
   ============================================================================ */

export async function fetchAccounts(
  ctx?: ScopeContext | null,
): Promise<AccountRow[]> {
  // API-first: goes through /api/accounts which requires auth + the
  // "Accounts" module permission. Legacy direct-Supabase path below
  // stays as a fallback for code still calling this without a session.
  try {
    const res = await fetch("/api/accounts", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { accounts: AccountRow[] };
      return json.accounts;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[Accounts] API failed:", e);
  }

  let q = supabase
    .from(ACCOUNTS)
    .select("*")
    .order("created_at", { ascending: false });
  // Multi-tenancy: scope to current tenant. Customer-tenant admins see
  // only their own users. SA viewing via the tenant picker sees the
  // tenant they picked.
  if (ctx?.tenant_id) q = q.eq("tenant_id", ctx.tenant_id);
  const { data, error } = await q;
  if (error) {
    console.error("[Accounts] Fetch:", error.message);
    return [];
  }
  return (data as AccountRow[]) || [];
}

export async function fetchAccountById(id: string): Promise<AccountRow | null> {
  const { data, error } = await supabase
    .from(ACCOUNTS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[Accounts] Fetch by id:", error.message);
    return null;
  }
  return (data as AccountRow) || null;
}

/**
 * Lightweight version of fetchAccountWithLinks tuned for the MainHeader /
 * UserMenu. Only fetches the fields the header renders (avatar, name, type,
 * role name) and pulls person + role via embedded resources so it's a SINGLE
 * round trip instead of the 6+ that fetchAccountWithLinks makes.
 *
 * Returns an AccountWithLinks-shaped object so callers that reuse the same
 * type don't need to branch — the unused join fields are simply null/[].
 */
export async function fetchAccountForHeader(
  id: string,
): Promise<AccountWithLinks | null> {
  // Consult the shared bootstrap cache first — same response shape
  // (with person + role joins) is already warm for the page. Saves an
  // extra /api/me/header round-trip on every navigation.
  try {
    const { getMeBootstrap } = await import("./me-bootstrap");
    const boot = await getMeBootstrap();
    if (boot?.header && (boot.header as { id?: string }).id === id) {
      return boot.header as unknown as AccountWithLinks;
    }
  } catch {
    /* fall through to the dedicated endpoint */
  }

  // Not in cache (e.g. viewing a different account) → hit the
  // dedicated /api/me/header endpoint. Blocked to service_role.
  try {
    const res = await fetch("/api/me/header", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as {
        account: AccountWithLinks | null;
      };
      return json.account;
    }
    if (res.status === 401) return null;
  } catch (e) {
    console.error("[Accounts] fetchAccountForHeader API failed:", e);
  }

  const { data, error } = await supabase
    .from(ACCOUNTS)
    .select(
      `
        id,
        username,
        user_type,
        avatar_url,
        person_id,
        company_id,
        role_id,
        person:people(id, full_name, avatar_url),
        role:roles(id, name)
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Accounts] Fetch header:", error.message);
    return null;
  }
  if (!data) return null;

  // Supabase's embedded-resource syntax can return either an object or an
  // array depending on FK cardinality — normalise both to a single row.
  const row = data as Record<string, unknown>;
  const personRaw = row.person;
  const roleRaw = row.role;
  const person = Array.isArray(personRaw)
    ? (personRaw[0] as PersonRow | undefined) ?? null
    : ((personRaw as PersonRow | null) ?? null);
  const role = Array.isArray(roleRaw)
    ? (roleRaw[0] as RoleRow | undefined) ?? null
    : ((roleRaw as RoleRow | null) ?? null);

  return {
    id: row.id as string,
    auth_user_id: null,
    username: row.username as string,
    login_email: "",
    password_hash: null,
    force_password_change: false,
    two_factor_enabled: false,
    last_login_at: null,
    user_type: row.user_type as AccountRow["user_type"],
    status: "active" as AccountRow["status"],
    role_id: (row.role_id as string | null) ?? null,
    person_id: (row.person_id as string | null) ?? null,
    company_id: (row.company_id as string | null) ?? null,
    contact_id: (row.contact_id as string | null) ?? null,
    tenant_id: (row.tenant_id as string) ?? "",
    is_super_admin: (row.is_super_admin as boolean) ?? false,
    avatar_url: (row.avatar_url as string | null) ?? null,
    internal_notes: null,
    preferences: {},
    created_at: "",
    updated_at: "",
    created_by: null,
    person,
    company: null,
    role,
    preset: null,
    employee: null,
    overrides: [],
  };
}

/**
 * Fetch an account plus every linked record (person, company, role, preset,
 * employee, permission overrides) in one shot. Uses parallel queries rather
 * than a joined select so we can keep the untyped Supabase client simple.
 */
export async function fetchAccountWithLinks(
  id: string,
): Promise<AccountWithLinks | null> {
  // API-first: /api/accounts/[id] returns the enriched object in one
  // round-trip via service_role. The individual fetchPersonById /
  // fetchCompanyById / fetchRoleById / fetchEmployeeByAccountId calls
  // still use anon-key reads which are blocked by RLS now.
  try {
    const res = await fetch("/api/accounts/" + id, { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as {
        account: AccountWithLinks | null;
      };
      return json.account;
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  } catch (e) {
    console.error("[Accounts] fetchAccountWithLinks API failed:", e);
  }

  const account = await fetchAccountById(id);
  if (!account) return null;

  const [person, company, role, employee, overrides] = await Promise.all([
    account.person_id ? fetchPersonById(account.person_id) : Promise.resolve(null),
    account.company_id ? fetchCompanyById(account.company_id) : Promise.resolve(null),
    account.role_id ? fetchRoleById(account.role_id) : Promise.resolve(null),
    fetchEmployeeByAccountId(account.id),
    fetchPermissionOverrides(account.id),
  ]);

  const preset = account.role_id
    ? await fetchAccessPresetByRoleId(account.role_id)
    : null;

  return { ...account, person, company, role, preset, employee, overrides };
}

export async function createAccount(
  input: Omit<AccountInsert, "password_hash" | "force_password_change" | "preferences"> & {
    temporary_password?: string;
    preferences?: AccountPreferences;
  },
): Promise<AccountRow | null> {
  try {
    const res = await fetch("/api/accounts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = (await res.json()) as { account: AccountRow | null };
      return json.account;
    }
    if (res.status === 401 || res.status === 403) return null;
  } catch (e) {
    console.error("[Accounts] createAccount API failed:", e);
  }

  const { temporary_password, preferences, ...rest } = input;
  const payload: Record<string, unknown> = {
    ...rest,
    password_hash: temporary_password ? hashTempPassword(temporary_password) : null,
    force_password_change: true,
    preferences: preferences ?? {},
  };

  const { data, error } = await supabase
    .from(ACCOUNTS)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[Accounts] Create:", error.message);
    return null;
  }
  return data as AccountRow;
}

export async function updateAccount(
  id: string,
  updates: AccountUpdate,
): Promise<boolean> {
  try {
    const res = await fetch("/api/accounts/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Accounts] updateAccount API failed:", e);
  }
  const { error } = await supabase.from(ACCOUNTS).update(updates).eq("id", id);
  if (error) {
    console.error("[Accounts] Update:", error.message);
    return false;
  }
  return true;
}

export async function setAccountStatus(
  id: string,
  status: AccountStatus,
): Promise<boolean> {
  try {
    const res = await fetch("/api/accounts/" + id + "/status", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Accounts] setAccountStatus API failed:", e);
  }
  const ok = await updateAccount(id, { status });
  if (ok) {
    void logEvent(id, "logout", { reason: "status_change", status });
  }
  return ok;
}

export async function resetAccountPassword(
  id: string,
  newTemporaryPassword: string,
): Promise<boolean> {
  const { error } = await supabase
    .from(ACCOUNTS)
    .update({
      password_hash: hashTempPassword(newTemporaryPassword),
      force_password_change: true,
    })
    .eq("id", id);
  if (error) {
    console.error("[Accounts] Reset password:", error.message);
    return false;
  }
  void logEvent(id, "password_reset", { source: "admin" });
  return true;
}

/** Flip the force-password-change flag on without issuing a new password. */
export async function setForcePasswordChange(
  id: string,
  force: boolean,
): Promise<boolean> {
  try {
    const res = await fetch("/api/accounts/" + id + "/force-password-change", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Accounts] setForcePasswordChange API failed:", e);
  }
  const { error } = await supabase
    .from(ACCOUNTS)
    .update({ force_password_change: force })
    .eq("id", id);
  if (error) {
    console.error("[Accounts] Set force password change:", error.message);
    return false;
  }
  void logEvent(
    id,
    force ? "force_reset_enabled" : "force_reset_cleared",
    {},
  );
  return true;
}

export async function deleteAccount(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/accounts/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Accounts] deleteAccount API failed:", e);
  }
  const { error } = await supabase.from(ACCOUNTS).delete().eq("id", id);
  if (error) {
    console.error("[Accounts] Delete:", error.message);
    return false;
  }
  return true;
}

/**
 * Set (or clear) the avatar on an account.
 *
 * `avatarUrl` is expected to be either a data URL produced by the client-side
 * resizer in AccountDetail (see `fileToResizedDataUrl`) or `null` to remove
 * the current avatar. We deliberately don't validate the string here so the
 * same helper can later accept public Storage object URLs if we migrate off
 * data URLs.
 */
export async function updateAccountAvatar(
  id: string,
  avatarUrl: string | null,
): Promise<boolean> {
  try {
    const res = await fetch("/api/accounts/" + id + "/avatar", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: avatarUrl }),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Accounts] updateAccountAvatar API failed:", e);
  }
  const { error } = await supabase
    .from(ACCOUNTS)
    .update({ avatar_url: avatarUrl })
    .eq("id", id);
  if (error) {
    console.error("[Accounts] Update avatar:", error.message);
    return false;
  }
  return true;
}

export async function isUsernameAvailable(
  username: string,
  excludeId?: string,
): Promise<boolean> {
  let q = supabase.from(ACCOUNTS).select("id").eq("username", username);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) return true;
  return !data || data.length === 0;
}

export async function isLoginEmailAvailable(
  loginEmail: string,
  excludeId?: string,
): Promise<boolean> {
  let q = supabase.from(ACCOUNTS).select("id").eq("login_email", loginEmail);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) return true;
  return !data || data.length === 0;
}

/* ============================================================================
   People (person / contact records)
   ============================================================================ */

export async function fetchPeople(
  ctx?: ScopeContext | null,
): Promise<PersonRow[]> {
  try {
    const res = await fetch("/api/people", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { people: PersonRow[] };
      return json.people;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[People] API failed:", e);
  }

  let q = supabase
    .from(PEOPLE)
    .select("*")
    .order("full_name", { ascending: true });
  if (ctx?.tenant_id) q = q.eq("tenant_id", ctx.tenant_id);
  const { data, error } = await q;
  if (error) {
    console.error("[People] Fetch:", error.message);
    return [];
  }
  return (data as PersonRow[]) || [];
}

export async function fetchPersonById(id: string): Promise<PersonRow | null> {
  const { data, error } = await supabase
    .from(PEOPLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as PersonRow) || null;
}

/**
 * List customer-app contacts for the "Linked Customer Contact" picker in
 * AccountForm. Required for user_type = "customer" under the per-user_type
 * CHECK constraint — a customer login must point at the contact row where
 * tier / credit / policy lives.
 *
 * Default: customers + suppliers only (the relevant B2B profiles). Pass
 * `anyType` to include all contact_types (employee / company too).
 */
export interface ContactLite {
  id: string;
  full_name: string;
  company_name: string | null;
  contact_type: string | null;
  customer_type: string | null;
  country: string | null;
}

export async function fetchCustomerContacts(
  options: { anyType?: boolean } = {},
): Promise<ContactLite[]> {
  let q = supabase
    .from("contacts")
    .select("id, full_name, company_name, contact_type, customer_type, country")
    .order("full_name", { ascending: true });
  if (!options.anyType) {
    q = q.in("contact_type", ["customer", "supplier"]);
  }
  const { data, error } = await q;
  if (error) {
    console.error("[Contacts] Fetch for picker:", error.message);
    return [];
  }
  return (data as ContactLite[]) ?? [];
}

export async function createPerson(input: PersonInsert): Promise<PersonRow | null> {
  try {
    const res = await fetch("/api/people", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = (await res.json()) as { person: PersonRow | null };
      return json.person;
    }
    if (res.status === 401 || res.status === 403) return null;
  } catch (e) {
    console.error("[People] createPerson API failed:", e);
  }
  const { data, error } = await supabase
    .from(PEOPLE)
    .insert(input)
    .select()
    .single();
  if (error) {
    console.error("[People] Create:", error.message);
    return null;
  }
  return data as PersonRow;
}

export async function updatePerson(
  id: string,
  updates: Partial<PersonInsert>,
): Promise<boolean> {
  try {
    const res = await fetch("/api/people/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[People] updatePerson API failed:", e);
  }
  const { error } = await supabase.from(PEOPLE).update(updates).eq("id", id);
  if (error) {
    console.error("[People] Update:", error.message);
    return false;
  }
  return true;
}

/* ============================================================================
   Companies
   ============================================================================ */

export async function fetchCompanies(
  ctx?: ScopeContext | null,
): Promise<CompanyRow[]> {
  try {
    const res = await fetch("/api/companies", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { companies: CompanyRow[] };
      return json.companies;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[Companies] API failed:", e);
  }

  let q = supabase
    .from(COMPANIES)
    .select("*")
    .order("name", { ascending: true });
  if (ctx?.tenant_id) q = q.eq("tenant_id", ctx.tenant_id);
  const { data, error } = await q;
  if (error) {
    console.error("[Companies] Fetch:", error.message);
    return [];
  }
  return (data as CompanyRow[]) || [];
}

export async function fetchCompanyById(id: string): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from(COMPANIES)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as CompanyRow) || null;
}

export async function createCompany(
  input: CompanyInsert,
): Promise<CompanyRow | null> {
  try {
    const res = await fetch("/api/companies", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = (await res.json()) as { company: CompanyRow | null };
      return json.company;
    }
    if (res.status === 401 || res.status === 403) return null;
  } catch (e) {
    console.error("[Companies] createCompany API failed:", e);
  }
  const { data, error } = await supabase
    .from(COMPANIES)
    .insert(input)
    .select()
    .single();
  if (error) {
    console.error("[Companies] Create:", error.message);
    return null;
  }
  return data as CompanyRow;
}

export async function updateCompany(
  id: string,
  updates: Partial<CompanyInsert>,
): Promise<boolean> {
  try {
    const res = await fetch("/api/companies/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Companies] updateCompany API failed:", e);
  }
  const { error } = await supabase.from(COMPANIES).update(updates).eq("id", id);
  if (error) {
    console.error("[Companies] Update:", error.message);
    return false;
  }
  return true;
}

/* ============================================================================
   Employees
   ============================================================================ */

/**
 * List all Koleex employees with their linked person profile, ready for the
 * AccountForm's "Existing Employee" picker.
 *
 * This is the picker that replaces the freestyle Person dropdown for
 * user_type = "internal", enforcing the rule that every internal login must
 * be tied to an Employee record (not just any person).
 *
 * Excludes employees that already have an account_id linked, unless
 * `includeAlreadyLinked` is true (which the edit form passes so the currently
 * linked employee stays selected).
 */
export interface EmployeeWithPerson {
  employee_id: string;
  person_id: string;
  account_id: string | null;
  employee_number: string | null;
  department: string | null;
  position: string | null;
  full_name: string;
  email: string | null;
  job_title: string | null;
  work_email: string | null;
}

export async function fetchEmployeesWithPerson(
  options: { includeAlreadyLinked?: boolean; ctx?: ScopeContext | null } = {},
): Promise<EmployeeWithPerson[]> {
  try {
    const qs = options.includeAlreadyLinked ? "?includeLinked=1" : "";
    const res = await fetch("/api/employees-with-person" + qs, {
      credentials: "include",
    });
    if (res.ok) {
      const json = (await res.json()) as { employees: EmployeeWithPerson[] };
      return json.employees;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[Employees] API failed:", e);
  }

  // Legacy fallback — direct anon-key query.
  let q = supabase
    .from(EMPLOYEES)
    .select(
      `id, person_id, account_id, employee_number, department, position, work_email,
       person:people(full_name, email, job_title)`,
    )
    .order("employee_number", { ascending: true, nullsFirst: false });
  // Multi-tenancy: limit the Employee picker to the current tenant so a
  // customer-tenant admin can't accidentally link their new account to
  // a Koleex employee.
  if (options.ctx?.tenant_id) q = q.eq("tenant_id", options.ctx.tenant_id);
  const { data, error } = await q;
  if (error) {
    console.error("[Employees] Fetch for picker:", error.message);
    return [];
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const mapped: EmployeeWithPerson[] = rows
    .map((r) => {
      const personRaw = r.person;
      const person = Array.isArray(personRaw)
        ? (personRaw[0] as Record<string, unknown> | undefined)
        : (personRaw as Record<string, unknown> | null);
      if (!r.person_id || !person) return null;
      return {
        employee_id: r.id as string,
        person_id: r.person_id as string,
        account_id: (r.account_id as string | null) ?? null,
        employee_number: (r.employee_number as string | null) ?? null,
        department: (r.department as string | null) ?? null,
        position: (r.position as string | null) ?? null,
        full_name: (person.full_name as string) || "Unnamed employee",
        email: (person.email as string | null) ?? null,
        job_title: (person.job_title as string | null) ?? null,
        work_email: (r.work_email as string | null) ?? null,
      };
    })
    .filter((x): x is EmployeeWithPerson => x !== null);

  if (options.includeAlreadyLinked) return mapped;
  return mapped.filter((e) => e.account_id === null);
}

/* ============================================================================
   Account permission overrides — per-account app hiding
   ============================================================================

   Lets an admin hide specific apps from a specific account on top of the
   role's defaults. A User role might grant access to "Products" broadly,
   but for a particular account the admin can add an override that hides
   Products just for them.

   Implementation note: the existing account_permission_overrides table
   uses `module_key` as the column name but we store the koleex_permissions
   module_name (Proper Case, e.g. "Products") so the override and the
   role's permission matrix share one naming convention.

   "Hidden" here means `can_view = false` in an override row. When an
   override exists with can_view=false, usePermittedModules() subtracts
   that module from the viewer's visible set regardless of what the role
   allows. Super Admin bypasses overrides.
   ============================================================================ */

/** Return the set of module names currently hidden for a given account
 *  (override rows with can_view = false). */
export async function fetchHiddenModulesForAccount(
  accountId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from(PERMISSION_OVERRIDES)
    .select("module_key, can_view")
    .eq("account_id", accountId)
    .eq("can_view", false);
  if (error) {
    console.error("[Accounts] fetchHiddenModules:", error.message);
    return [];
  }
  return ((data ?? []) as { module_key: string }[]).map((r) => r.module_key);
}

/** Write the hidden-module set for an account. Diffs against what's
 *  already stored: inserts new overrides for newly-hidden modules,
 *  deletes overrides for modules that were previously hidden and now
 *  aren't. Idempotent — safe to call repeatedly with the same set. */
export async function saveHiddenModulesForAccount(
  accountId: string,
  hidden: string[],
): Promise<{ ok: boolean; error: string | null }> {
  const existing = await fetchHiddenModulesForAccount(accountId);
  const toAdd = hidden.filter((m) => !existing.includes(m));
  const toRemove = existing.filter((m) => !hidden.includes(m));

  if (toAdd.length > 0) {
    const rows = toAdd.map((m) => ({
      account_id: accountId,
      module_key: m,
      access_level: "none",
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
      data_scope: "own",
    }));
    const { error: insErr } = await supabase
      .from(PERMISSION_OVERRIDES)
      .upsert(rows, { onConflict: "account_id,module_key" });
    if (insErr) return { ok: false, error: insErr.message };
  }

  if (toRemove.length > 0) {
    const { error: delErr } = await supabase
      .from(PERMISSION_OVERRIDES)
      .delete()
      .eq("account_id", accountId)
      .in("module_key", toRemove);
    if (delErr) return { ok: false, error: delErr.message };
  }

  return { ok: true, error: null };
}

/** Write-through: stamp the new account_id on the employee row. Called
 *  right after the account is created so the HR side knows which login
 *  belongs to which employee. One-shot, idempotent, never throws. */
export async function linkEmployeeToAccount(
  employeeId: string,
  accountId: string,
): Promise<void> {
  const { error } = await supabase
    .from(EMPLOYEES)
    .update({ account_id: accountId })
    .eq("id", employeeId);
  if (error) {
    console.error("[Employees] Link to account:", error.message);
  }
}

export async function fetchEmployeeByAccountId(
  accountId: string,
): Promise<EmployeeRow | null> {
  const { data, error } = await supabase
    .from(EMPLOYEES)
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) return null;
  return (data as EmployeeRow) || null;
}

export async function createEmployee(
  input: EmployeeInsert,
): Promise<EmployeeRow | null> {
  try {
    const res = await fetch("/api/employees", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = (await res.json()) as { employee: EmployeeRow | null };
      return json.employee;
    }
    if (res.status === 401 || res.status === 403) return null;
  } catch (e) {
    console.error("[Employees] createEmployee API failed:", e);
  }
  const { data, error } = await supabase
    .from(EMPLOYEES)
    .insert(input)
    .select()
    .single();
  if (error) {
    console.error("[Employees] Create:", error.message);
    return null;
  }
  return data as EmployeeRow;
}

/**
 * Update a Koleex employee record. Used by the Private HR tab on the account
 * detail page to persist private address, emergency contact, nationality,
 * visa data, etc.
 */
export async function updateEmployee(
  id: string,
  updates: EmployeeUpdate,
): Promise<boolean> {
  try {
    const res = await fetch("/api/employees/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Employees] updateEmployee API failed:", e);
  }
  const { error } = await supabase.from(EMPLOYEES).update(updates).eq("id", id);
  if (error) {
    console.error("[Employees] Update:", error.message);
    return false;
  }
  return true;
}

/**
 * Upsert a Koleex employee by account_id. Creates a new HR record if one
 * doesn't exist yet, otherwise updates in place. Used by the Private HR tab
 * when an internal account has no linked employee record.
 */
export async function upsertEmployeeByAccountId(
  accountId: string,
  personId: string | null,
  updates: EmployeeUpdate,
): Promise<EmployeeRow | null> {
  const existing = await fetchEmployeeByAccountId(accountId);
  if (existing) {
    const ok = await updateEmployee(existing.id, updates);
    if (!ok) return null;
    return { ...existing, ...updates } as EmployeeRow;
  }
  // Create a minimal HR record.
  const created = await createEmployee({
    account_id: accountId,
    person_id: personId,
    employee_number: null,
    department: null,
    position: null,
    hire_date: null,
    employment_status: "active",
    manager_id: null,
    work_email: null,
    work_phone: null,
    notes: null,
    private_address_line1: null,
    private_address_line2: null,
    private_city: null,
    private_state: null,
    private_country: null,
    private_postal_code: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relationship: null,
    birth_date: null,
    marital_status: null,
    nationality: null,
    identification_id: null,
    passport_number: null,
    visa_number: null,
    visa_expiry_date: null,
    ...updates,
  } as EmployeeInsert);
  return created;
}

/* ============================================================================
   Roles & Access Presets
   ============================================================================ */

export async function fetchRoles(): Promise<RoleRow[]> {
  try {
    const res = await fetch("/api/roles", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { roles: RoleRow[] };
      return json.roles;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[Roles] Fetch API failed:", e);
  }
  const { data, error } = await supabase
    .from(ROLES)
    .select("*")
    .order("display_order", { ascending: true });
  if (error) {
    console.error("[Roles] Fetch:", error.message);
    return [];
  }
  return (data as RoleRow[]) || [];
}

export async function fetchRoleById(id: string): Promise<RoleRow | null> {
  const { data, error } = await supabase
    .from(ROLES)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as RoleRow) || null;
}

export async function fetchAccessPresets(): Promise<AccessPresetRow[]> {
  const { data, error } = await supabase.from(ACCESS_PRESETS).select("*");
  if (error) {
    console.error("[AccessPresets] Fetch:", error.message);
    return [];
  }
  return (data as AccessPresetRow[]) || [];
}

export async function fetchAccessPresetByRoleId(
  roleId: string,
): Promise<AccessPresetRow | null> {
  const { data, error } = await supabase
    .from(ACCESS_PRESETS)
    .select("*")
    .eq("role_id", roleId)
    .maybeSingle();
  if (error) return null;
  return (data as AccessPresetRow) || null;
}

/* ============================================================================
   Account Preferences (jsonb)

   Preferences are stored as a jsonb column on accounts. We never write the
   full defaults bag back into the DB — only the keys the user actually set.
   The UI merges stored values with DEFAULT_PREFERENCES for display.
   ============================================================================ */

export async function updateAccountPreferences(
  id: string,
  preferences: AccountPreferences,
): Promise<boolean> {
  try {
    const res = await fetch("/api/accounts/" + id + "/preferences", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences }),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Accounts] updateAccountPreferences API failed:", e);
  }
  const { error } = await supabase
    .from(ACCOUNTS)
    .update({ preferences })
    .eq("id", id);
  if (error) {
    console.error("[Accounts] Update preferences:", error.message);
    return false;
  }
  return true;
}

/* ============================================================================
   Per-account Permission Overrides

   The `account_permission_overrides` table stores sparse overrides that layer
   on top of the role's access_preset. Absence of a row for a given module
   means "use the preset default".
   ============================================================================ */

export async function fetchPermissionOverrides(
  accountId: string,
): Promise<AccountPermissionOverrideRow[]> {
  const { data, error } = await supabase
    .from(PERMISSION_OVERRIDES)
    .select("*")
    .eq("account_id", accountId);
  if (error) {
    console.error("[PermissionOverrides] Fetch:", error.message);
    return [];
  }
  return (data as AccountPermissionOverrideRow[]) || [];
}

/**
 * Upsert a single permission override. Creates a row if one doesn't exist
 * for (account_id, module_key), otherwise updates the access_level.
 */
export async function upsertPermissionOverride(
  accountId: string,
  moduleKey: string,
  accessLevel: AccessLevel,
  granular?: { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; data_scope: string },
): Promise<boolean> {
  const payload: AccountPermissionOverrideInsert = {
    account_id: accountId,
    module_key: moduleKey,
    access_level: accessLevel,
    can_view: granular?.can_view ?? (accessLevel !== "none"),
    can_create: granular?.can_create ?? (accessLevel !== "none"),
    can_edit: granular?.can_edit ?? (accessLevel === "manager" || accessLevel === "admin"),
    can_delete: granular?.can_delete ?? (accessLevel === "admin"),
    data_scope: (granular?.data_scope as "own" | "department" | "all") ?? "own",
  };
  try {
    const res = await fetch(
      "/api/accounts/" + accountId + "/permission-overrides",
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403) return false;
  } catch (e) {
    console.error("[PermissionOverrides] upsert API failed:", e);
  }
  const { error } = await supabase
    .from(PERMISSION_OVERRIDES)
    .upsert(payload, { onConflict: "account_id,module_key" });
  if (error) {
    console.error("[PermissionOverrides] Upsert:", error.message);
    return false;
  }
  return true;
}

/**
 * Delete an override row — used when a user resets a module back to its
 * preset default ("no override").
 */
export async function deletePermissionOverride(
  accountId: string,
  moduleKey: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      "/api/accounts/" + accountId + "/permission-overrides",
      {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_key: moduleKey }),
      },
    );
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403) return false;
  } catch (e) {
    console.error("[PermissionOverrides] delete API failed:", e);
  }
  const { error } = await supabase
    .from(PERMISSION_OVERRIDES)
    .delete()
    .eq("account_id", accountId)
    .eq("module_key", moduleKey);
  if (error) {
    console.error("[PermissionOverrides] Delete:", error.message);
    return false;
  }
  return true;
}

/**
 * Replace the full set of overrides for an account with a new set. Deletes
 * rows that no longer exist and upserts the rest. Used by the Access Rights
 * tab when saving the whole grid at once.
 */
export async function replacePermissionOverrides(
  accountId: string,
  nextOverrides: {
    module_key: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
    data_scope: string;
  }[],
): Promise<boolean> {
  // Derive legacy access_level from granular flags for backward compat
  const deriveLevel = (o: typeof nextOverrides[0]) => {
    if (o.can_delete) return "admin";
    if (o.can_edit) return "manager";
    if (o.can_view || o.can_create) return "user";
    return "none";
  };
  const payload = nextOverrides.map((o) => ({
    account_id: accountId,
    module_key: o.module_key,
    can_view: o.can_view,
    can_create: o.can_create,
    can_edit: o.can_edit,
    can_delete: o.can_delete,
    data_scope: o.data_scope,
    access_level: deriveLevel(o),
  }));

  // API-first: POST /api/accounts/[id]/permission-overrides replaces
  // the whole set server-side via service_role. The anon-key DELETE +
  // INSERT path below is blocked by RLS now.
  try {
    const res = await fetch(
      "/api/accounts/" + accountId + "/permission-overrides",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: payload }),
      },
    );
    if (res.ok) {
      // Permissions just changed — invalidate the shared bootstrap
      // cache so the next page nav sees the fresh set.
      try {
        const { invalidateMeBootstrap } = await import("./me-bootstrap");
        invalidateMeBootstrap();
      } catch {
        /* ignore */
      }
      return true;
    }
    if (res.status === 401 || res.status === 403) return false;
  } catch (e) {
    console.error("[PermissionOverrides] replace API failed:", e);
  }

  const { error: delErr } = await supabase
    .from(PERMISSION_OVERRIDES)
    .delete()
    .eq("account_id", accountId);
  if (delErr) {
    console.error("[PermissionOverrides] Replace/delete:", delErr.message);
    return false;
  }
  if (nextOverrides.length === 0) return true;
  const { error: insErr } = await supabase
    .from(PERMISSION_OVERRIDES)
    .insert(payload);
  if (insErr) {
    console.error("[PermissionOverrides] Replace/insert:", insErr.message);
    return false;
  }
  return true;
}

/* ============================================================================
   Helpers
   ============================================================================ */

/**
 * Lightweight client-side hash for the temporary password column.
 * This is NOT a cryptographic password hash — it's a base64 tag used as a
 * placeholder until Supabase Auth is wired up. The first time a user logs in
 * with real auth, `force_password_change` will require them to set a proper
 * password that Supabase Auth will handle with bcrypt.
 */
function hashTempPassword(plain: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return `tmp$${window.btoa(unescape(encodeURIComponent(plain)))}`;
  }
  return `tmp$${Buffer.from(plain, "utf8").toString("base64")}`;
}

/**
 * Look up an account row by username. Used by the legacy login form so we
 * can validate username+password against the accounts table without going
 * through Supabase Auth. Case-insensitive match — usernames are always
 * lowercased on insert, but we ilike-match defensively.
 */
export async function fetchAccountByUsername(
  username: string,
): Promise<AccountRow | null> {
  const trimmed = username.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from(ACCOUNTS)
    .select("*")
    .ilike("username", trimmed)
    .maybeSingle();
  if (error) {
    console.error("[Accounts] Lookup by username:", error.message);
    return null;
  }
  return (data as AccountRow) || null;
}

/** Lookup an account by login_email. Used by the legacy /login flow
 *  where users identify themselves by email rather than username. */
export async function fetchAccountByLoginEmail(
  loginEmail: string,
): Promise<AccountRow | null> {
  const trimmed = loginEmail.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from(ACCOUNTS)
    .select("*")
    .ilike("login_email", trimmed)
    .maybeSingle();
  if (error) {
    console.error("[Accounts] Lookup by email:", error.message);
    return null;
  }
  return (data as AccountRow) || null;
}

/**
 * Legacy login: verify a username + plaintext password against the accounts
 * table using the same `tmp$<base64>` tag format that createAccount /
 * resetAccountPassword write. Returns the matched account on success, or
 * null on any failure (no row, wrong password, suspended, etc).
 *
 * SECURITY NOTE: This is not cryptographically secure — the "hash" is just
 * base64. It's a bridge until we flip on Supabase Auth. We still short-
 * circuit on suspended / archived accounts so disabled people can't sign in.
 */
export async function verifyAccountLogin(
  username: string,
  password: string,
): Promise<
  | { ok: true; account: AccountRow }
  | { ok: false; reason: "not_found" | "wrong_password" | "disabled" }
> {
  // API-first: /api/auth/signin verifies via the service_role client and
  // mints the HttpOnly session cookie in one round-trip. Required now that
  // the accounts table is no longer readable via the anon key.
  try {
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const json = (await res.json()) as
      | { ok: true; account: { id: string; username: string; login_email: string; user_type: string } }
      | { ok: false; error: string };
    if (res.ok && "ok" in json && json.ok) {
      // The signin route doesn't return the full AccountRow — it returns
      // the minimal fields needed to bootstrap the client identity. For
      // AdminAuth's downstream state (scope ctx, sidebar, etc.) the hard
      // reload in the caller fetches the full account via /api/me.
      return {
        ok: true,
        account: {
          id: json.account.id,
          username: json.account.username,
          login_email: json.account.login_email,
          user_type: json.account.user_type,
          status: "active",
        } as AccountRow,
      };
    }
    if (res.status === 403) return { ok: false, reason: "disabled" };
    // 400 / 401 / anything else → indistinguishable bad credentials.
    return { ok: false, reason: "wrong_password" };
  } catch (e) {
    console.error("[Accounts] verifyAccountLogin API failed:", e);
  }

  // Legacy fallback — only reachable on network failure. Kept so the app
  // still attempts an auth before giving up.
  const account = await fetchAccountByUsername(username);
  if (!account) return { ok: false, reason: "not_found" };
  if (account.status !== "active") return { ok: false, reason: "disabled" };
  const expected = hashTempPassword(password);
  if (!account.password_hash || account.password_hash !== expected) {
    return { ok: false, reason: "wrong_password" };
  }
  return { ok: true, account };
}

/** Generate a short, human-readable temporary password. */
export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `Kx-${out.slice(0, 4)}-${out.slice(4, 8)}${out.slice(8, 10)}`;
}

/**
 * Slugify a person's full name into a suggested username.
 * "Jane Cooper" → "jane.cooper"
 */
export function suggestUsername(fullName: string): string {
  return fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, ".")
    .slice(0, 32);
}
