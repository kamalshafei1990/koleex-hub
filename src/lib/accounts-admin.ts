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

export async function fetchAccounts(): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from(ACCOUNTS)
    .select("*")
    .order("created_at", { ascending: false });
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
 * Fetch an account plus every linked record (person, company, role, preset,
 * employee, permission overrides) in one shot. Uses parallel queries rather
 * than a joined select so we can keep the untyped Supabase client simple.
 */
export async function fetchAccountWithLinks(
  id: string,
): Promise<AccountWithLinks | null> {
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
  const ok = await updateAccount(id, { status });
  if (ok) {
    // Mirror status changes into the audit log so the Security tab can show
    // "account suspended / archived / activated" alongside login events.
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
  const { error } = await supabase.from(ACCOUNTS).delete().eq("id", id);
  if (error) {
    console.error("[Accounts] Delete:", error.message);
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

export async function fetchPeople(): Promise<PersonRow[]> {
  const { data, error } = await supabase
    .from(PEOPLE)
    .select("*")
    .order("full_name", { ascending: true });
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

export async function createPerson(input: PersonInsert): Promise<PersonRow | null> {
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

export async function fetchCompanies(): Promise<CompanyRow[]> {
  const { data, error } = await supabase
    .from(COMPANIES)
    .select("*")
    .order("name", { ascending: true });
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
): Promise<boolean> {
  const payload: AccountPermissionOverrideInsert = {
    account_id: accountId,
    module_key: moduleKey,
    access_level: accessLevel,
  };
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
  nextOverrides: { module_key: string; access_level: AccessLevel }[],
): Promise<boolean> {
  // Delete every existing row for this account first (simple and correct).
  const { error: delErr } = await supabase
    .from(PERMISSION_OVERRIDES)
    .delete()
    .eq("account_id", accountId);
  if (delErr) {
    console.error("[PermissionOverrides] Replace/delete:", delErr.message);
    return false;
  }
  if (nextOverrides.length === 0) return true;

  const payload: AccountPermissionOverrideInsert[] = nextOverrides.map((o) => ({
    account_id: accountId,
    module_key: o.module_key,
    access_level: o.access_level,
  }));
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
