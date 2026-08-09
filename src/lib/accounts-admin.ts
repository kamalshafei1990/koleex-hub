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

import { uploadToStorage } from "./storage-client";
import type { ScopeContext } from "./scope";
import type {
  AccountRow, AccountInsert, AccountUpdate, AccountStatus, AccountWithLinks,
  CompanyRow, CompanyInsert,
  PersonRow, PersonInsert,
  EmployeeRow, EmployeeInsert, EmployeeUpdate,
  RoleRow,
  AccessPresetRow,
  AccountPreferences,
} from "@/types/supabase";
import { logEvent } from "./account-security";

/* No table-name constants any more, and no Supabase client: every read and
   write in this file goes through an API route. accounts, people, companies,
   koleex_employees, roles, access_presets and account_permission_overrides
   are ALL service-role-only, so the browser queries that used to sit under
   each API call could not touch a row — they only ever logged a second error
   after the first. Four of them were not fallbacks at all but the ONLY path,
   which is why hiding an app from an account, linking a new login to an
   employee, showing a role's access preset and saving the Private HR tab
   silently did nothing. */

/* ============================================================================
   Accounts
   ============================================================================ */

export async function fetchAccounts(
): Promise<AccountRow[]> {
  // API-first: goes through /api/accounts which requires auth + the
  // "Accounts" module permission. Legacy direct-Supabase path below
  // stays as a fallback for code still calling this without a session.
  try {
    /* Coalesced (SYS-2): CalendarApp + EventModal (and any other screen
       resolving account names) share one request per 60s window. Every
       mutation in this lib calls invalidateAccountsList() after a write. */
    const { cachedGet } = await import("@/lib/client-cache");
    const json = await cachedGet<{ accounts: AccountRow[] }>("/api/accounts", 60_000);
    return json.accounts;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("HTTP 401") || msg.includes("HTTP 403")) return [];
    console.error("[Accounts] API failed:", e);
  }

  return [];
}

export async function fetchAccountById(id: string): Promise<AccountRow | null> {
  if (!id) return null;
  /* Goes through the authenticated server route (service_role under
     the hood). The old browser query against the anon client was
     blocked by RLS on the `accounts` table, so the edit page
     rendered "Account not found" for rows that obviously exist.
     The endpoint returns { account: AccountRow + joins }; we peel
     off the joins to keep the return type identical. */
  try {
    const res = await fetch(`/api/accounts/${id}`, { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as { account?: Record<string, unknown> };
    if (!json.account) return null;
    const {
      person: _p, company: _c, role: _r, employee: _e, overrides: _o, preset: _pr,
      ...row
    } = json.account;
    void _p; void _c; void _r; void _e; void _o; void _pr;
    return row as unknown as AccountRow;
  } catch (e) {
    console.error("[Accounts] Fetch by id:", e);
    return null;
  }
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
    if (res.status !== 401) {
      console.error("[Accounts] fetchAccountForHeader:", res.status);
    }
    return null;
  } catch (e) {
    console.error("[Accounts] fetchAccountForHeader failed:", e);
    return null;
  }
}

/**
 * Fetch an account plus every linked record (person, company, role, preset,
 * employee, permission overrides) in one shot. Uses parallel queries rather
 * than a joined select so we can keep the untyped Supabase client simple.
 */
export async function fetchAccountWithLinks(
  id: string,
): Promise<AccountWithLinks | null> {
  /* /api/accounts/[id] returns the enriched object — person, company, role,
     preset, employee and overrides — in ONE round trip via service_role. The
     per-link browser helpers this replaced (fetchPersonById, fetchCompanyById,
     fetchRoleById, fetchEmployeeByAccountId) each read a service-role-only
     table with the anon key, so they returned null and the enriched object was
     assembled out of five nulls. They are deleted. */
  try {
    const res = await fetch("/api/accounts/" + id, { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as {
        account: AccountWithLinks | null;
      };
      return json.account;
    }
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
      console.error("[Accounts] fetchAccountWithLinks:", res.status);
    }
    return null;
  } catch (e) {
    console.error("[Accounts] fetchAccountWithLinks failed:", e);
    return null;
  }
}

/* Drop the coalesced /api/accounts list after any write so the next
   fetchAccounts() reads fresh (SYS-2 companion to the cachedGet above). */
async function invalidateAccountsList(): Promise<void> {
  try {
    const { invalidateCachedGet } = await import("@/lib/client-cache");
    invalidateCachedGet("/api/accounts");
  } catch { /* cache module unavailable — nothing to drop */ }
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
      void invalidateAccountsList();
      return json.account;
    }
    if (res.status !== 401 && res.status !== 403) {
      console.error("[Accounts] createAccount:", res.status);
    }
    return null;
  } catch (e) {
    /* The removed fallback inserted the row from the browser WITHOUT a
       password hash — Argon2 is server-only — so an account created down that
       path could never sign in. Failing here is the honest outcome. */
    console.error("[Accounts] createAccount failed:", e);
    return null;
  }
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
    if (res.ok) { void invalidateAccountsList(); return true; }
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Accounts] updateAccount API failed:", e);
  }
  return false;
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
    if (res.ok) { void invalidateAccountsList(); return true; }
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
  /* S1b: password hashing is server-only (Argon2id). Delegate to the password
     endpoint — which hashes via hashForWrite and persists password_algo +
     password_changed_at — instead of writing a hash from the client. The
     endpoint is super-admin-gated and clears force_password_change by default. */
  try {
    const res = await fetch(`/api/accounts/${id}/password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newTemporaryPassword }),
    });
    return res.ok;
  } catch (e) {
    console.error("[Accounts] resetAccountPassword API failed:", e);
    return false;
  }
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
  return false;
}

export async function deleteAccount(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/accounts/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) { void invalidateAccountsList(); return true; }
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Accounts] deleteAccount API failed:", e);
  }
  return false;
}

/**
 * Set (or clear) the avatar on an account.
 *
 * `avatarUrl` may be `null` (remove), a public URL, or a data URL from the
 * client-side resizers (ProfileTab / AccountDetail). Data URLs are NEVER
 * stored anymore: three legacy avatars saved this way (8–25 KB of base64 in
 * accounts.avatar_url) were re-shipped inside every API response that joined
 * the sender — one inbox feed page measured 137 KB for rows averaging 364
 * bytes. The guard lives HERE, not in the two upload UIs, so any future
 * caller inherits it: a data: URI is uploaded to the public `media` bucket
 * under avatars/ and the row stores the Storage URL instead.
 */
export async function updateAccountAvatar(
  id: string,
  avatarUrl: string | null,
): Promise<boolean> {
  if (avatarUrl?.startsWith("data:")) {
    const m = /^data:image\/(\w+);base64,([\s\S]+)$/.exec(avatarUrl);
    if (!m) {
      console.error("[Accounts] Update avatar: unsupported data URL");
      return false;
    }
    const [, fmt, b64] = m;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: `image/${fmt}` });
    const ext = fmt === "jpeg" ? "jpg" : fmt;
    /* Timestamped path: the bucket serves long-lived cache headers, so an
       overwritten fixed path would keep showing the OLD photo until the CDN
       expired it. A new object per change is instant and costs ~10 KB. */
    const up = await uploadToStorage("media", `avatars/${id}-${Date.now()}.${ext}`, blob, {
      cacheControl: "31536000",
      upsert: true,
    });
    if (!up.ok) {
      console.error("[Accounts] Avatar upload to Storage failed:", up.error);
      return false;
    }
    avatarUrl = up.data.publicUrl;
  }
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
  return false;
}

export async function isUsernameAvailable(
  username: string,
  excludeId?: string,
): Promise<boolean> {
  /* Fails CLOSED. The browser check this replaces returned TRUE on error, and
     `accounts` is service-role-only, so it errored every time and told the
     form that every name was free. */
  try {
    const qs = new URLSearchParams({ username: username });
    if (excludeId) qs.set("excludeId", excludeId);
    const res = await fetch(`/api/accounts/availability?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { username?: boolean };
    return json.username === true;
  } catch (e) {
    console.error("[Accounts] isUsernameAvailable failed:", e);
    return false;
  }
}

export async function isLoginEmailAvailable(
  loginEmail: string,
  excludeId?: string,
): Promise<boolean> {
  /* Fails CLOSED. The browser check this replaces returned TRUE on error, and
     `accounts` is service-role-only, so it errored every time and told the
     form that every name was free. */
  try {
    const qs = new URLSearchParams({ loginEmail: loginEmail });
    if (excludeId) qs.set("excludeId", excludeId);
    const res = await fetch(`/api/accounts/availability?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { loginEmail?: boolean };
    return json.loginEmail === true;
  } catch (e) {
    console.error("[Accounts] isLoginEmailAvailable failed:", e);
    return false;
  }
}

/* ============================================================================
   People (person / contact records)
   ============================================================================ */

export async function fetchPeople(
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

  return [];
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
  /* `contacts` is service-role-only, so the browser query this replaces
     returned nothing and the picker was always empty. */
  const types = options.anyType ? [""] : ["customer", "supplier"];
  try {
    const lists = await Promise.all(
      types.map(async (t) => {
        const res = await fetch(`/api/contacts${t ? `?type=${encodeURIComponent(t)}` : ""}`, {
          credentials: "include",
        });
        if (!res.ok) return [] as ContactLite[];
        const json = (await res.json()) as { contacts?: Record<string, unknown>[] };
        return (json.contacts ?? []).map((c) => ({
          id: String(c.id),
          full_name: (c.full_name as string) ?? (c.display_name as string) ?? "",
          company_name: (c.company_name as string) ?? null,
          contact_type: (c.contact_type as string) ?? null,
          customer_type: (c.customer_type as string) ?? null,
          country: (c.country as string) ?? null,
        })) as ContactLite[];
      }),
    );
    return lists.flat().sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  } catch (e) {
    console.error("[Contacts] Fetch for picker failed:", e);
    return [];
  }
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
  return null;
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
  return false;
}

/* ============================================================================
   Companies
   ============================================================================ */

export async function fetchCompanies(
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

  return [];
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
    console.error("[Companies] createCompany failed:", e);
  }
  return null;
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
    console.error("[Companies] updateCompany failed:", e);
  }
  return false;
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

  return [];
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
  try {
    const res = await fetch(`/api/accounts/${accountId}/permission-overrides`, {
      credentials: "include",
    });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
        console.error("[Accounts] fetchHiddenModules:", res.status);
      }
      return [];
    }
    const json = (await res.json()) as {
      overrides?: { module_key: string; can_view: boolean | null }[];
    };
    return (json.overrides ?? []).filter((o) => o.can_view === false).map((o) => o.module_key);
  } catch (e) {
    console.error("[Accounts] fetchHiddenModules failed:", e);
    return [];
  }
}

/** Write the hidden-module set for an account. Diffs against what's
 *  already stored: inserts new overrides for newly-hidden modules,
 *  deletes overrides for modules that were previously hidden and now
 *  aren't. Idempotent — safe to call repeatedly with the same set. */
export async function saveHiddenModulesForAccount(
  accountId: string,
  hidden: string[],
): Promise<{ ok: boolean; error: string | null }> {
  /* One call. The diff (which overrides to add, which to drop) happens on the
     server, where it can also see the overrides that are NOT about visibility
     and leave them alone. */
  try {
    const res = await fetch(`/api/accounts/${accountId}/permission-overrides`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden }),
    });
    if (res.ok) return { ok: true, error: null };
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: err?.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Write-through: stamp the new account_id on the employee row. Called
 *  right after the account is created so the HR side knows which login
 *  belongs to which employee. One-shot, idempotent, never throws. */
export async function linkEmployeeToAccount(
  employeeId: string,
  accountId: string,
): Promise<void> {
  try {
    const res = await fetch(`/api/employees/${employeeId}/link-account`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: accountId }),
    });
    if (!res.ok) console.error("[Employees] Link to account:", res.status);
  } catch (e) {
    console.error("[Employees] Link to account failed:", e);
  }
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
    console.error("[Employees] createEmployee failed:", e);
  }
  return null;
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
    console.error("[Employees] updateEmployee failed:", e);
  }
  return false;
}

/**
 * Find-or-create the HR record for an account and apply `updates`, in ONE
 * server call. Used by the Private HR tab when an internal account has no
 * linked employee record.
 *
 * It used to look the row up by account_id in the browser, then update or
 * insert — three statements against koleex_employees, a service-role-only
 * table, so none of them touched a row and the tab could not save.
 */
export async function upsertEmployeeByAccountId(
  accountId: string,
  personId: string | null,
  updates: EmployeeUpdate,
): Promise<EmployeeRow | null> {
  try {
    const res = await fetch(`/api/accounts/${accountId}/employee`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person_id: personId, updates }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      console.error("[Employees] upsertByAccountId:", err?.error ?? res.status);
      return null;
    }
    const json = (await res.json()) as { employee: EmployeeRow | null };
    return json.employee;
  } catch (e) {
    console.error("[Employees] upsertByAccountId failed:", e);
    return null;
  }
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
    console.error("[Roles] Fetch failed:", e);
  }
  return [];
}

export async function fetchAccessPresetByRoleId(
  roleId: string,
): Promise<AccessPresetRow | null> {
  try {
    const res = await fetch(`/api/roles/${roleId}/access-preset`, { credentials: "include" });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
        console.error("[AccessPresets] fetch:", res.status);
      }
      return null;
    }
    const json = (await res.json()) as { preset: AccessPresetRow | null };
    return json.preset;
  } catch (e) {
    console.error("[AccessPresets] fetch failed:", e);
    return null;
  }
}

/* ============================================================================
   Account Preferences (jsonb)

   Preferences are stored as a jsonb column on accounts. We never write the
   full defaults bag back into the DB — only the keys the user actually set.
   The UI merges stored values with DEFAULT_PREFERENCES for display.
   ============================================================================ */

/* Per-account save chain. The instant-apply Settings tabs fire one PATCH per
   toggle; two quick clicks meant two CONCURRENT read-merge-write requests on
   the server, and whichever read first could finish last — verified live: the
   UI showed Approvals ON while the DB kept false. Serializing per account id
   makes the last click's request also the last write. Module-level state is
   fine here: the race only ever comes from the same browser session. */
const prefsSaveChain = new Map<string, Promise<unknown>>();

export async function updateAccountPreferences(
  id: string,
  preferences: AccountPreferences,
): Promise<boolean> {
  const prev = prefsSaveChain.get(id) ?? Promise.resolve();
  const run = prev.then(() => updateAccountPreferencesNow(id, preferences));
  prefsSaveChain.set(id, run.catch(() => undefined));
  return run;
}

async function updateAccountPreferencesNow(
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
    console.error("[Accounts] updateAccountPreferences failed:", e);
  }
  return false;
}

/* ============================================================================
   Per-account Permission Overrides

   The `account_permission_overrides` table stores sparse overrides that layer
   on top of the role's access_preset. Absence of a row for a given module
   means "use the preset default".
   ============================================================================ */

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
    console.error("[PermissionOverrides] replace failed:", e);
  }
  /* No browser fallback for a PERMISSION write. The removed one deleted every
     override for the account and then re-inserted — from the browser, with the
     anon key. If the delete had succeeded and the insert failed, the account
     would silently lose all its overrides. */
  return false;
}

/* ============================================================================
   Helpers
   ============================================================================ */

/* Phase 2A S1b: the legacy client-side `hashTempPassword` was REMOVED.
   Password hashing is now Argon2id and happens exclusively server-side
   (src/lib/server/password.ts via the API routes) — this client-importable
   module must never produce a password hash. */

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
  | { ok: false; reason: "wrong_password" | "disabled" | "network" }
> {
  // API-first: /api/auth/signin verifies via the service_role client and
  // mints the HttpOnly session cookie in one round-trip. Required now that
  // the accounts table is no longer readable via the anon key.
  //
  // We intentionally do NOT return a separate "not_found" reason — the
  // API deliberately returns an indistinguishable 401 for both missing
  // accounts and wrong passwords so attackers can't probe for valid
  // usernames. Collapsing the client too keeps that invariant honest.
  // One automatic retry on transport failure: sign-in POSTs are exactly the
  // kind of request flaky networks (and the GFW) kill mid-flight, and a
  // second attempt usually goes straight through. Each attempt is capped at
  // 12s so the user never stares at a spinner while a dead socket drains.
  const attempt = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      return await fetch("/api/auth/signin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let res: Response;
    try {
      res = await attempt();
    } catch {
      res = await attempt(); // second chance for a transient network kill
    }
    const json = (await res.json()) as
      | { ok: true; account: { id: string; username: string; login_email: string; user_type: string } }
      | { ok: false; error: string };
    if (res.ok && "ok" in json && json.ok) {
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
    // A 500 with a JSON body describing a real server error (e.g.
    // SUPABASE_SERVICE_ROLE_KEY missing) — surface it as "network" so
    // the UI doesn't accuse the user of bad credentials for what is
    // really an infrastructure problem.
    if (
      res.status === 500 &&
      !("ok" in json ? json.ok : false) &&
      "error" in json &&
      json.error === "server_error"
    ) {
      return { ok: false, reason: "network" };
    }
    return { ok: false, reason: "wrong_password" };
  } catch (e) {
    // Pure network/DNS failure. The legacy anon-key fallback used to live
    // here but it's useless post-RLS lockdown — it always returned null
    // and surfaced a misleading "No account with that username" even for
    // valid users when the real API was just briefly unreachable.
    console.error("[Accounts] verifyAccountLogin API failed:", e);
    return { ok: false, reason: "network" };
  }
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
