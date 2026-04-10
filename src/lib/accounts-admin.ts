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
  EmployeeRow, EmployeeInsert,
  RoleRow,
  AccessPresetRow,
} from "@/types/supabase";

const ACCOUNTS = "accounts";
const COMPANIES = "companies";
const ROLES = "roles";
const PEOPLE = "people";
const EMPLOYEES = "employees";
const ACCESS_PRESETS = "access_presets";

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
 * employee) in one shot. Uses parallel queries rather than a joined select so
 * we can keep the untyped Supabase client simple.
 */
export async function fetchAccountWithLinks(
  id: string,
): Promise<AccountWithLinks | null> {
  const account = await fetchAccountById(id);
  if (!account) return null;

  const [person, company, role, employee] = await Promise.all([
    account.person_id ? fetchPersonById(account.person_id) : Promise.resolve(null),
    account.company_id ? fetchCompanyById(account.company_id) : Promise.resolve(null),
    account.role_id ? fetchRoleById(account.role_id) : Promise.resolve(null),
    fetchEmployeeByAccountId(account.id),
  ]);

  const preset = account.role_id
    ? await fetchAccessPresetByRoleId(account.role_id)
    : null;

  return { ...account, person, company, role, preset, employee };
}

export async function createAccount(
  input: Omit<AccountInsert, "password_hash" | "force_password_change"> & {
    temporary_password?: string;
  },
): Promise<AccountRow | null> {
  const { temporary_password, ...rest } = input;
  const payload: Record<string, unknown> = {
    ...rest,
    password_hash: temporary_password ? hashTempPassword(temporary_password) : null,
    force_password_change: true,
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
  return updateAccount(id, { status });
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
