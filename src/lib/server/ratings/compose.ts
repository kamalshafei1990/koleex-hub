import "server-only";

/* ---------------------------------------------------------------------------
   ratings/compose — build one cycle's item rows from the org's reality.

   Item sources, in order (plan §L.1 — the four layers):
     · GENERAL skills/behaviors (library rows flagged is_general) — everyone
     · POSITION requirements (position_skill_requirements /
       position_behavior_requirements) through the employee's active primary
       assignment — with required_score / weight / is_mandatory SNAPSHOTTED
       onto the item, so a later position edit never rewrites a past month.

   compose is idempotent: existing rows (possibly already scored) are never
   touched — the unique key (cycle, employee, kind, ref) guards it.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export interface ComposeResult {
  employees: number;
  itemsCreated: number;
  withoutPosition: string[]; // employee ids — general items only
}

type RequirementRow = {
  skill_id?: string;
  behavior_indicator_id?: string;
  position_id: string;
  required_score: number | null;
  weight: number | null;
  is_mandatory: boolean | null;
};

export async function composeCycleItems(cycleId: string, tenantId: string): Promise<ComposeResult> {
  /* 1. active employees of the tenant */
  const { data: employees, error: empErr } = await supabaseServer
    .from("koleex_employees")
    .select("id, person_id")
    .eq("tenant_id", tenantId)
    .neq("employment_status", "terminated");
  if (empErr) throw new Error(empErr.message);
  const emps = employees ?? [];
  if (emps.length === 0) return { employees: 0, itemsCreated: 0, withoutPosition: [] };

  /* 2. active primary assignments → position per employee */
  const { data: assignments } = await supabaseServer
    .from("koleex_assignments")
    .select("person_id, position_id")
    .eq("is_active", true)
    .eq("is_primary", true)
    .in("person_id", emps.map((e) => e.person_id));
  const positionOf = new Map<string, string>();
  for (const a of assignments ?? []) if (a.position_id) positionOf.set(a.person_id, a.position_id);

  /* 3. the general pool */
  const [{ data: genSkills }, { data: genBehaviors }] = await Promise.all([
    supabaseServer.from("skills").select("id")
      .eq("tenant_id", tenantId).eq("is_active", true).eq("is_general", true),
    supabaseServer.from("behavior_indicators").select("id")
      .eq("tenant_id", tenantId).eq("is_active", true).eq("is_general", true),
  ]);

  /* 4. position requirements for every position in play, in one query each */
  const positionIds = [...new Set([...positionOf.values()])];
  const [{ data: skillReqs }, { data: behaviorReqs }] = positionIds.length
    ? await Promise.all([
        supabaseServer.from("position_skill_requirements")
          .select("skill_id, position_id, required_score, weight, is_mandatory")
          .in("position_id", positionIds),
        supabaseServer.from("position_behavior_requirements")
          .select("behavior_indicator_id, position_id, required_score, weight, is_mandatory")
          .in("position_id", positionIds),
      ])
    : [{ data: [] }, { data: [] }];

  const skillReqsByPosition = new Map<string, RequirementRow[]>();
  for (const r of (skillReqs ?? []) as RequirementRow[]) {
    skillReqsByPosition.set(r.position_id, [...(skillReqsByPosition.get(r.position_id) ?? []), r]);
  }
  const behaviorReqsByPosition = new Map<string, RequirementRow[]>();
  for (const r of (behaviorReqs ?? []) as RequirementRow[]) {
    behaviorReqsByPosition.set(r.position_id, [...(behaviorReqsByPosition.get(r.position_id) ?? []), r]);
  }

  /* 5. build the rows — general first, then the position layer on top */
  type ItemRow = Record<string, unknown>;
  const rows: ItemRow[] = [];
  const withoutPosition: string[] = [];

  for (const emp of emps) {
    const posId = positionOf.get(emp.person_id) ?? null;
    if (!posId) withoutPosition.push(emp.id);

    for (const s of genSkills ?? []) {
      rows.push({ cycle_id: cycleId, employee_id: emp.id, tenant_id: tenantId,
        item_kind: "skill", ref_id: s.id, scope: "general" });
    }
    for (const b of genBehaviors ?? []) {
      rows.push({ cycle_id: cycleId, employee_id: emp.id, tenant_id: tenantId,
        item_kind: "behavior", ref_id: b.id, scope: "general" });
    }

    if (posId) {
      for (const r of skillReqsByPosition.get(posId) ?? []) {
        rows.push({ cycle_id: cycleId, employee_id: emp.id, tenant_id: tenantId,
          item_kind: "skill", ref_id: r.skill_id, scope: "position",
          required_score: r.required_score, weight: r.weight ?? 1,
          is_mandatory: r.is_mandatory ?? false });
      }
      for (const r of behaviorReqsByPosition.get(posId) ?? []) {
        rows.push({ cycle_id: cycleId, employee_id: emp.id, tenant_id: tenantId,
          item_kind: "behavior", ref_id: r.behavior_indicator_id, scope: "position",
          required_score: r.required_score, weight: r.weight ?? 1,
          is_mandatory: r.is_mandatory ?? false });
      }
    }
  }

  /* the unique key makes this idempotent — existing (possibly scored) rows
     are skipped, never rewritten */
  let created = 0;
  if (rows.length > 0) {
    const { error, count } = await supabaseServer
      .from("rating_items")
      .upsert(rows, { onConflict: "cycle_id,employee_id,item_kind,ref_id", ignoreDuplicates: true, count: "exact" });
    if (error) throw new Error(error.message);
    created = count ?? 0;
  }

  return { employees: emps.length, itemsCreated: created, withoutPosition };
}
