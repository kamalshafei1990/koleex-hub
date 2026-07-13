import "server-only";

/* ---------------------------------------------------------------------------
   people-access — who may modify person (identity) records.

   ACCESS POLICY (access-architecture vision, 2026-07-13): employee identity
   data is COMPANY data. Regular users may NOT edit their own person record —
   only callers whose role can edit Employees (HR) or Accounts, or the Super
   Admin. Self-service in Settings is limited to account PREFERENCES.

   Used by PATCH /api/people/[id] (enforcement) and GET /api/me/can-edit-profile
   (so the Settings UI can render read-only with the same rule — one policy,
   two consumers, no drift).
   --------------------------------------------------------------------------- */

import { requireModuleAction, type ServerAuthContext } from "./auth";

export async function callerMayEditPeople(auth: ServerAuthContext): Promise<boolean> {
  const denyEmployees = await requireModuleAction(auth, "Employees", "edit");
  if (!denyEmployees) return true;
  const denyAccounts = await requireModuleAction(auth, "Accounts", "edit");
  return !denyAccounts;
}
