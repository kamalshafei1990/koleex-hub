/* ---------------------------------------------------------------------------
   Accounts Admin — Supabase CRUD for accounts, companies, and roles.

   Uses the untyped admin client (anon key) just like products-admin.ts.
   All access is gated at the UI layer by AdminAuth (sessionStorage-based
   password gate) — do NOT expose these helpers to untrusted clients.

   Password handling note:
     `password_hash` on accounts is intentionally permissive today. We store
     the temporary password as a lightweight hash (not suitable as the final
     auth primitive) so we can round-trip it until Supabase Auth is wired up.
     `force_password_change` is forced to true on create so the first real
     login (once Auth is online) will require a reset.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type {
  AccountRow,
  AccountInsert,
  AccountUpdate,
  AccountStatus,
  CompanyRow,
  CompanyInsert,
  RoleRow,
} from "@/types/supabase";

const ACCOUNTS = "accounts";
const COMPANIES = "companies";
const ROLES = "roles";

/* ── Accounts ── */

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

export async function isEmailAvailable(
  email: string,
  excludeId?: string,
): Promise<boolean> {
  let q = supabase.from(ACCOUNTS).select("id").eq("email", email);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) return true;
  return !data || data.length === 0;
}

/* ── Companies ── */

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

/* ── Roles ── */

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

/* ── Helpers ── */

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

/** Convenience: generate a short, human-readable temporary password. */
export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `Kx-${out.slice(0, 4)}-${out.slice(4, 8)}${out.slice(8, 10)}`;
}
