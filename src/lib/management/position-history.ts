/* ---------------------------------------------------------------------------
   Position history — the one shape every writer of koleex_position_history
   uses (26 Sep 2026, owner's pick).

   The table's columns are exactly HISTORY_COLUMNS. Three writers used to
   insert columns it does not have (`change_type`, `effective_date`, and
   `changed_by_account_id` before it was added), so the insert failed — a
   transfer left no trace, and only one row was ever recorded. Every writer
   now builds its row here:

     assigned     someone takes a position (a hire, a first assignment)
     transferred  someone moves from one position to another — ONE row, with
                  from_position_id and to_position_id; the history of either
                  position finds it (GET /api/management/activity matches all
                  three position columns)
     removed      someone leaves a position

   Who made the change is the SESSION's account, never the client's word.
   Pure: the API routes and the validator share it.
   --------------------------------------------------------------------------- */

export const HISTORY_ACTIONS = ["assigned", "transferred", "removed"] as const;
export type HistoryAction = (typeof HISTORY_ACTIONS)[number];

/** The table's columns, as they are (id is generated). */
export const HISTORY_COLUMNS = [
  "position_id", "person_id", "department_id", "action", "from_position_id", "to_position_id", "notes", "changed_by_account_id", "created_at",
] as const;

export interface HistoryRow {
  position_id: string;
  person_id: string;
  department_id: string | null;
  action: HistoryAction;
  from_position_id: string | null;
  to_position_id: string | null;
  notes: string | null;
  changed_by_account_id: string | null;
  created_at?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v : null);

/** A row for one change. `position_id` is the position it is filed under:
 *  for a transfer, the new one (the old one is `from_position_id`). */
export function historyRow(x: {
  action: HistoryAction; personId: string; departmentId: string | null;
  fromPositionId?: string | null; toPositionId?: string | null;
  notes?: string | null; changedBy: string | null; at?: string;
}): HistoryRow {
  const from = x.fromPositionId ?? null;
  const to = x.toPositionId ?? null;
  const position = x.action === "removed" ? from ?? to : to ?? from;
  if (!position) throw new Error("a history row needs a position");
  return {
    position_id: position,
    person_id: x.personId,
    department_id: x.departmentId,
    action: x.action,
    from_position_id: x.action === "assigned" ? null : from,
    to_position_id: x.action === "removed" ? null : to,
    notes: x.notes?.trim() ? x.notes.trim().slice(0, 500) : null,
    changed_by_account_id: x.changedBy,
    ...(x.at ? { created_at: x.at } : {}),
  };
}

/** A row the browser asks to add (the Management page's assignment), kept
 *  to the table's own fields and checked — or what is wrong with it. */
export function historyFromClient(raw: unknown, changedBy: string): HistoryRow | { error: string } {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const action = HISTORY_ACTIONS.find((a) => a === o.action);
  if (!action) return { error: `action must be one of ${HISTORY_ACTIONS.join(", ")}` };
  const personId = id(o.person_id);
  if (!personId) return { error: "person_id is required" };
  const position = id(o.position_id);
  const from = id(o.from_position_id) ?? (action !== "assigned" ? position : null);
  const to = id(o.to_position_id) ?? (action !== "removed" ? position : null);
  if (!from && !to) return { error: "position_id is required" };
  return historyRow({
    action, personId, departmentId: id(o.department_id), fromPositionId: from, toPositionId: to,
    notes: typeof o.notes === "string" ? o.notes : null, changedBy,
  });
}
