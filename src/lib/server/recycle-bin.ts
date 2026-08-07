import "server-only";

/* ---------------------------------------------------------------------------
   Recycle bin — recoverable offboarding (owner directive 2026-08-07).

   Deleting an employee, an internal account, or a customer must:
     1. warn the operator (client dialogs),
     2. remove the person AND their activity from the live system,
     3. stay recoverable "any time".

   Mechanics per kind:
     · internal account — SOFT delete: accounts.status = 'deleted' (login
       blocked by auth, hidden from lists/pickers). Activity sweep: To-do
       assignment rows + PRIVATE to-dos are snapshotted then removed.
       Restore = status back to active + re-insert the swept rows.
     · employee — the HR row is snapshotted and hard-deleted (HR-owned data
       cascades), active org assignments are snapshotted and ended, and the
       login account goes through the account flow above.
     · customer — the accounts_identity_per_type CHECK forces a customer
       account to keep contact_id, so soft-keeping the account while the
       contact dies is impossible: BOTH rows are snapshotted and
       hard-deleted; restore re-inserts both.

   Every deletion lands ONE koleex_recycle_bin row whose snapshot holds
   everything restore needs. The table is RLS deny-all (service-role
   gateway), same posture as hr_*.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

type Row = Record<string, unknown>;

export interface BinEntry {
  id: string;
  kind: "employee" | "customer" | "account";
  label: string | null;
  deleted_at: string;
  restored_at: string | null;
}

/* Snapshot + remove the account's To-do footprint. Returns what was swept. */
async function sweepAccountActivity(accountId: string): Promise<{
  todo_assignees: Row[];
  private_todos: Row[];
}> {
  const [{ data: assignees }, { data: privates }] = await Promise.all([
    supabaseServer.from("koleex_todo_assignees").select("*").eq("account_id", accountId),
    supabaseServer.from("koleex_todos").select("*").eq("created_by_account_id", accountId).eq("is_private", true),
  ]);
  await supabaseServer.from("koleex_todo_assignees").delete().eq("account_id", accountId);
  await supabaseServer.from("koleex_todos").delete().eq("created_by_account_id", accountId).eq("is_private", true);
  return { todo_assignees: (assignees ?? []) as Row[], private_todos: (privates ?? []) as Row[] };
}

/* Soft-delete one account and archive its swept activity inside `snapshot`.
   Shared by the account and employee flows. */
export async function softDeleteAccount(accountId: string): Promise<{
  account: Row | null;
  swept: { todo_assignees: Row[]; private_todos: Row[] };
}> {
  const { data: account } = await supabaseServer
    .from("accounts").select("*").eq("id", accountId).maybeSingle();
  if (!account) return { account: null, swept: { todo_assignees: [], private_todos: [] } };
  const swept = await sweepAccountActivity(accountId);
  await supabaseServer.from("accounts").update({ status: "deleted" }).eq("id", accountId);
  return { account: account as Row, swept };
}

export async function recordBinEntry(opts: {
  tenantId: string | null;
  kind: "employee" | "customer" | "account";
  label: string | null;
  accountId?: string | null;
  personId?: string | null;
  snapshot: Row;
  deletedBy: string | null;
}): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("koleex_recycle_bin")
    .insert({
      tenant_id: opts.tenantId,
      kind: opts.kind,
      label: opts.label,
      account_id: opts.accountId ?? null,
      person_id: opts.personId ?? null,
      snapshot: opts.snapshot,
      deleted_by: opts.deletedBy,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[recycle-bin] insert failed", error.message);
    return null;
  }
  return data.id as string;
}

/* Re-insert rows one table at a time, tolerating rows whose parents died
   after the deletion (e.g. a to-do that was itself removed later). */
async function reinsert(table: string, rows: Row[]): Promise<number> {
  let ok = 0;
  for (const row of rows) {
    const { error } = await supabaseServer.from(table).insert(row);
    if (!error) ok += 1;
    else if (error.code !== "23503" && error.code !== "23505") {
      console.warn(`[recycle-bin] restore ${table}`, error.message);
    }
  }
  return ok;
}

export async function restoreBinEntry(binId: string, tenantId: string | null): Promise<{
  ok: boolean;
  error?: string;
  kind?: string;
}> {
  let q = supabaseServer.from("koleex_recycle_bin").select("*").eq("id", binId).is("restored_at", null);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: entry } = await q.maybeSingle();
  if (!entry) return { ok: false, error: "Recycle-bin entry not found (or already restored)." };

  const snap = (entry.snapshot ?? {}) as {
    account?: Row | null;
    accounts?: Row[];
    employee?: Row | null;
    contact?: Row | null;
    assignments?: Row[];
    swept?: { todo_assignees?: Row[]; private_todos?: Row[] };
  };

  if (entry.kind === "customer") {
    /* Contact first (accounts' identity CHECK needs it), then accounts. */
    if (snap.contact) {
      const { error } = await supabaseServer.from("contacts").insert(snap.contact);
      if (error && error.code !== "23505") return { ok: false, error: `Contact restore failed: ${error.message}` };
    }
    await reinsert("accounts", (snap.accounts ?? []).map((a) => ({ ...a, status: "active" })));
  } else {
    /* account / employee: reactivate the soft-deleted login. */
    if (entry.account_id) {
      await supabaseServer.from("accounts").update({ status: "active" }).eq("id", entry.account_id);
    }
    if (entry.kind === "employee" && snap.employee) {
      const { error } = await supabaseServer.from("koleex_employees").insert(snap.employee);
      if (error && error.code !== "23505") return { ok: false, error: `Employee restore failed: ${error.message}` };
      /* Re-open the org-chart assignments that the delete ended. */
      for (const a of snap.assignments ?? []) {
        await supabaseServer
          .from("koleex_assignments")
          .update({ is_active: true, end_date: null })
          .eq("id", a.id as string);
      }
    }
    /* Bring the To-do footprint back (rows whose to-do died stay gone). */
    await reinsert("koleex_todos", snap.swept?.private_todos ?? []);
    await reinsert("koleex_todo_assignees", snap.swept?.todo_assignees ?? []);
  }

  await supabaseServer
    .from("koleex_recycle_bin")
    .update({ restored_at: new Date().toISOString() })
    .eq("id", binId);
  return { ok: true, kind: entry.kind as string };
}
