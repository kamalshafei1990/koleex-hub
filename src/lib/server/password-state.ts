/* ---------------------------------------------------------------------------
   password-state — safe, server-side derivation of an account's password
   status for display. NEVER returns the hash or any secret.

   The Account Details Security tab must show an account's password status
   WITHOUT ever receiving `password_hash`. This helper computes a coarse,
   display-only enum from the account row (which the GET route reads via
   service_role) and the API then returns ONLY the enum + safe metadata.

   Pure function (no I/O, no "server-only") so it is unit-testable directly.
   --------------------------------------------------------------------------- */

export type PasswordState =
  | "ACTIVE" //            real password set (secure hash)
  | "TEMPORARY" //         password set but legacy/temporary (should rotate)
  | "RESET_REQUIRED" //    password set, but force-change is on
  | "NO_PASSWORD" //       no password configured → cannot sign in with one
  | "EXTERNAL_PROVIDER" // delegated to an external auth provider (Supabase/SSO)
  | "PENDING_SETUP"; //    reserved (account provisioned, awaiting first setup)

/** Minimal, secret-free shape needed to derive the state. */
export interface PasswordStateInput {
  auth_user_id?: string | null;
  password_hash?: string | null;
  password_algo?: string | null;
  force_password_change?: boolean | null;
}

/** The safe, display-only password facts returned to the client. NEVER the hash. */
export interface PasswordStateView {
  password_state: PasswordState;
  has_password: boolean;
}

/** Is this hash a legacy / temporary (reversible) tag rather than a real KDF hash? */
function isLegacyOrTemp(hash: string, algo?: string | null): boolean {
  return algo === "legacy" || hash.startsWith("tmp$");
}

/**
 * Derive the display-only password state. Order matters:
 *   external provider → no password → reset required → temporary → active.
 * Takes only secret-free fields; returns only the enum + has_password.
 */
export function derivePasswordState(acc: PasswordStateInput): PasswordStateView {
  const hash = acc.password_hash ?? null;

  // 1. Delegated to an external auth provider (Supabase Auth / SSO). The local
  //    hash (if any) is not the source of truth in this case.
  if (acc.auth_user_id) {
    return { password_state: "EXTERNAL_PROVIDER", has_password: !!hash };
  }

  // 2. No local password at all → sign-in with a password is impossible.
  if (!hash) {
    return { password_state: "NO_PASSWORD", has_password: false };
  }

  // 3. Has a password, but the admin/system forced a change on next login.
  if (acc.force_password_change) {
    return { password_state: "RESET_REQUIRED", has_password: true };
  }

  // 4. Has a password, but it's a legacy/temporary tag → flag for rotation.
  if (isLegacyOrTemp(hash, acc.password_algo)) {
    return { password_state: "TEMPORARY", has_password: true };
  }

  // 5. Real, current password.
  return { password_state: "ACTIVE", has_password: true };
}
