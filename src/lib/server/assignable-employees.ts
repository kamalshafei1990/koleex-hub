import "server-only";

import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   Assignable employees — the ONE list every "pick a person" control should
   use (To-do assignees, Project manager, Task assignee, …).

   Internal + active + human: excludes customer/portal accounts, suspended
   accounts, and the automated non-human accounts that only exist for
   security probes (p0b_*) and service workflows (*-actor / *_actor).
   Names come from `people` (full_name + native name_alt) so pickers show
   real names, never raw usernames.
   --------------------------------------------------------------------------- */

export interface AssignableEmployee {
  account_id: string;
  username: string;
  full_name: string | null;
  name_alt: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
}

const isServiceAccount = (u: string) =>
  u.startsWith("p0b_") || u.endsWith("-actor") || u.endsWith("_actor");

export async function listAssignableEmployees(
  tenantId: string | null,
): Promise<AssignableEmployee[]> {
  let q = supabaseServer
    .from("accounts")
    .select("id, username, avatar_url, person_id")
    .eq("user_type", "internal")
    .eq("status", "active");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Array<{
    id: string;
    username: string;
    avatar_url: string | null;
    person_id: string | null;
  }>).filter((a) => !isServiceAccount(a.username));
  if (rows.length === 0) return [];

  const ids = rows.map((a) => a.id);
  const personIds = rows.map((a) => a.person_id).filter(Boolean) as string[];

  const [peopleRes, empRes] = await Promise.all([
    personIds.length > 0
      ? supabaseServer.from("people").select("id, full_name, name_alt").in("id", personIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; name_alt: string | null }> }),
    supabaseServer
      .from("koleex_employees")
      .select("account_id, department, position")
      .in("account_id", ids),
  ]);

  const personMap = new Map(
    ((peopleRes.data ?? []) as Array<{ id: string; full_name: string | null; name_alt: string | null }>).map(
      (p) => [p.id, p],
    ),
  );
  const empMap = new Map(
    ((empRes.data ?? []) as Array<{
      account_id: string;
      department: string | null;
      position: string | null;
    }>).map((e) => [e.account_id, e]),
  );

  return rows
    .map((a) => {
      const person = a.person_id ? personMap.get(a.person_id) : null;
      const emp = empMap.get(a.id);
      return {
        account_id: a.id,
        username: a.username,
        full_name: person?.full_name ?? null,
        name_alt: person?.name_alt ?? null,
        avatar_url: a.avatar_url,
        department: emp?.department ?? null,
        position: emp?.position ?? null,
      };
    })
    .sort((x, y) =>
      (x.full_name || x.username || "").localeCompare(y.full_name || y.username || ""),
    );
}
