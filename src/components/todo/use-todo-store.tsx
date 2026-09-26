"use client";

/* ---------------------------------------------------------------------------
   useTodoStore — the To-do list's data, and every change made to it.

   THE THREE RULES THIS FILE EXISTS FOR:

   1. A change shows at once and survives the refresh behind it.
      Every write is optimistic. The old screen then refetched the whole list
      after each write AND on the realtime ping that same write caused — two
      downloads per tick — and a refetch that STARTED before the write landed
      could come back with the pre-write row and flip a ticked task back to
      undone for a beat. Refreshes are now coalesced into one, and an answer
      that raced a write is thrown away and asked again.

   2. A failure never lies. A write the server refuses is rolled back and the
      reader is told; a failed LOAD keeps the list that is on screen instead
      of replacing it with "No tasks yet".

   3. Completing and deleting can be undone. Delete is held back for a few
      seconds under an Undo toast (the server delete is permanent — notes and
      all — so the grace period is the only safe undo), and is committed at
      once if the screen goes away.

   The handlers are handed to memoised rows, so they are exposed through one
   STABLE object (useStableActions) whose methods always run the latest
   render's code — rows re-render only when their own task changes.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  TodoAssigneeInfo, TodoLabelRow, TodoMetadata, TodoPriority, TodoRecurrence, TodoRow, TodoStatus, TodoWithRelations,
} from "@/types/supabase";
import {
  addTodoNote, createTodoResult, deleteTodo, deleteTodoNote, subscribeToTodos, toggleTodoResult, updateTodoResult,
  type TodoWriteResult,
} from "@/lib/todo-admin";
import { loadCompletedPage, loadTodoSnap, mergeTodos, saveTodoWarm, type TodoSnap } from "./todo-data";
import type { TFn } from "./todo-ui";

type Toast = (msg: ReactNode, kind?: "success" | "error" | "info", ms?: number) => void;

export interface TaskFields {
  title: string;
  description: string | null;
  priority: TodoPriority;
  label: string | null;
  due_date: string | null;
  start_date: string | null;
  remind_at: string | null;
  status: TodoStatus;
  recurrence: TodoRecurrence;
  recurrence_until: string | null;
  assigned_department: string | null;
  assign_to_all: boolean;
  metadata: TodoMetadata;
}

const EMPTY: TodoWithRelations[] = [];

export interface DoneState {
  rows: TodoWithRelations[];
  /** Cursor for the next page; null once history is exhausted. */
  nextBefore: string | null;
  loaded: boolean;
  loading: boolean;
  error: boolean;
}
const NO_DONE: DoneState = { rows: [], nextBefore: null, loaded: false, loading: false, error: false };
const UNDO_MS = 5000;
export const isTempTask = (id: string) => id.startsWith("tmp-");

/* ── Refresh coordinator — plain JS, created once per mounted list. ── */
function createRefresher() {
  let mutating = 0;
  let epoch = 0;
  let inflight: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sink: { apply: (s: TodoSnap) => void; fail: (e: unknown) => void } | null = null;

  const schedule = (ms = 600) => {
    if (!sink) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void run(true); }, ms);
  };
  const run = (revalidate: boolean): Promise<void> => {
    if (inflight) { again = true; return inflight; }
    const started = epoch;
    inflight = (async () => {
      try {
        const snap = await loadTodoSnap(revalidate);
        if (!sink) return;
        /* A write started or finished while this was in flight: its answer
           may predate the write. Ask again rather than paint it. */
        if (mutating > 0 || epoch !== started) { again = true; return; }
        sink.apply(snap);
      } catch (e) {
        sink?.fail(e);
      } finally {
        inflight = null;
        if (again && sink) { again = false; schedule(250); }
      }
    })();
    return inflight;
  };
  return {
    connect(s: NonNullable<typeof sink>) { sink = s; },
    dispose() { sink = null; if (timer) clearTimeout(timer); timer = null; },
    run,
    schedule,
    async mutate<T>(fn: () => Promise<T>): Promise<T> {
      mutating++; epoch++;
      try { return await fn(); } finally { mutating--; epoch++; schedule(); }
    },
  };
}

/* A stable facade over handlers that are re-created every render. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useStableActions<T extends Record<string, (...args: any[]) => any>>(impl: T): T {
  const ref = useRef(impl);
  useEffect(() => { ref.current = impl; });
  const [stable] = useState(() => {
    const out = {} as Record<string, unknown>;
    for (const k of Object.keys(impl)) out[k] = (...args: unknown[]) => ref.current[k](...args);
    return out as T;
  });
  return stable;
}

export function useTodoStore({ warm, warmKey, accountId, isSA, tenantId, t, toast }: {
  warm: TodoSnap | null;
  warmKey: string;
  accountId: string | null;
  isSA: boolean;
  tenantId: string | null;
  t: TFn;
  toast: Toast;
}) {
  const [fresh, setFresh] = useState<TodoSnap | null>(null);
  const [error, setError] = useState<unknown>(null);
  /* True once the NETWORK has answered (a warm paint alone does not count) —
     a deep link may only conclude "not found" after this. */
  const [synced, setSynced] = useState(false);
  /* Rows deleted but still inside their Undo window. */
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [engine] = useState(createRefresher);
  const busy = useRef(new Set<string>());
  /* Undo runs seconds later, so it must reach the LATEST handlers (a stale
     render's closure would compare against a list from before the change). */
  const undoRef = useRef<{
    setStatus: (id: string, s: TodoStatus, silent?: boolean) => Promise<void>;
    toggle: (id: string) => Promise<void>;
  } | null>(null);
  const pendingDeletes = useRef(new Map<string, { ids: string[]; timer: ReturnType<typeof setTimeout> }>());

  /* Finished history beyond the open set — paged in on demand. */
  const [done, setDone] = useState<DoneState>(NO_DONE);
  const doneBusy = useRef(false);

  const data = fresh ?? warm;
  const open = data?.todos ?? EMPTY;
  const todos = useMemo(() => mergeTodos(open, done.rows), [open, done.rows]);

  /* ── load, realtime, resume ── */
  useEffect(() => {
    engine.connect({
      apply: (s) => { setFresh(s); setError(null); setSynced(true); },
      fail: (e) => { setError(e); setSynced(true); },
    });
    void engine.run(false);
    return () => engine.dispose();
  }, [engine]);

  useEffect(() => {
    if (!tenantId) return;
    return subscribeToTodos(tenantId, () => engine.schedule(0));
  }, [tenantId, engine]);

  /* An installed PWA resumes instead of reloading; catch up when it does. */
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > 30_000) engine.schedule(0);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [engine]);

  /* The warm copy follows every change, debounced — serialising a few
     hundred rows on each tick is a cost nobody sees until they do. */
  useEffect(() => {
    if (!fresh || !warmKey) return;
    const id = setTimeout(() => saveTodoWarm(warmKey, hidden.size
      ? { ...fresh, todos: fresh.todos.filter((x) => !hidden.has(x.id)) }
      : fresh), 800);
    return () => clearTimeout(id);
  }, [fresh, hidden, warmKey]);

  /* The old hand-rolled mirror is superseded by the shared warm cache. */
  useEffect(() => {
    if (!accountId) return;
    try { window.localStorage.removeItem(`kx_todo_snap_v2:${accountId}`); } catch { /* noop */ }
  }, [accountId]);

  /* Leaving the screen (or the app) commits deletes still under Undo — the
     grace period must never turn a delete into a silent no-op. */
  useEffect(() => {
    const pending = pendingDeletes.current;
    const flush = () => {
      for (const [batch, entry] of pending) {
        clearTimeout(entry.timer);
        pending.delete(batch);
        entry.ids.forEach((id) => void deleteTodo(id));
      }
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, []);

  /* ── local patches — functional, so racing updates compose ── */
  const patchSnap = (fn: (s: TodoSnap) => TodoSnap) =>
    setFresh((prev) => {
      const base = prev ?? warm;
      return base ? fn(base) : prev;
    });
  const patchTodos = (fn: (list: TodoWithRelations[]) => TodoWithRelations[]) =>
    patchSnap((s) => ({ ...s, todos: fn(s.todos) }));
  /* A task can sit in the open set or in loaded history — patch both. */
  const patchTask = (id: string, p: Partial<TodoWithRelations> | ((x: TodoWithRelations) => TodoWithRelations)) => {
    const apply = (list: TodoWithRelations[]) =>
      list.map((x) => (x.id === id ? (typeof p === "function" ? p(x) : { ...x, ...p }) : x));
    patchTodos(apply);
    setDone((d) => (d.rows.some((x) => x.id === id) ? { ...d, rows: apply(d.rows) } : d));
  };
  const dropTasks = (ids: Set<string>) => {
    patchTodos((list) => list.filter((x) => !ids.has(x.id)));
    setDone((d) => (d.rows.some((x) => ids.has(x.id)) ? { ...d, rows: d.rows.filter((x) => !ids.has(x.id)) } : d));
  };
  const unhide = (ids: string[]) =>
    setHidden((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

  const find = (id: string) => todos.find((x) => x.id === id);
  const isOwner = (x: TodoWithRelations) =>
    isSA || (!!accountId && (x.created_by_account_id === accountId || x.assigned_by_account_id === accountId));
  /* Why a write failed, in words the reader can act on. A 409 (the task
     changed under us) is already followed by the refresh every write
     schedules, so the row settles to the server's truth. */
  const reason = (r: TodoWriteResult<unknown> | null, assignAll = false): string => {
    if (!r || r.ok) return t("err.saveFailed");
    if (r.status === 409) return t("err.conflict");
    if (r.status === 403) return assignAll ? t("err.assignAllAdmin") : t("err.forbidden");
    if (r.status === 400 && r.error) return r.error;
    if (r.status === 0) return t("err.offline");
    return t("err.saveFailed");
  };
  const fail = (r: TodoWriteResult<unknown> | null = null) => toast(reason(r), "error");

  /* One write in flight per task: a second tap while the first was on the
     wire flipped the row twice and let a late rollback restore the wrong
     state. */
  const guarded = async (id: string, fn: () => Promise<void>) => {
    if (isTempTask(id) || busy.current.has(id)) return;
    busy.current.add(id);
    try { await fn(); } finally { busy.current.delete(id); }
  };
  const withUndo = (label: string, onUndo: () => void) => (
    <>
      {label}
      <button type="button" onClick={onUndo}
        className="ms-2 h-6 px-2 rounded-md bg-white/10 hover:bg-white/20 text-[12px] font-bold">
        {t("toast.undo")}
      </button>
    </>
  );

  const actions = useStableActions({
    /* ── status / completion ── */
    async setStatus(id: string, status: TodoStatus, silent = false) {
      await guarded(id, async () => {
        const before = find(id);
        if (!before || before.status === status) return;
        const done = status === "done";
        const submits = done && !isOwner(before) && before.approval_state !== "approved";
        if (submits) patchTask(id, { approval_state: "pending" });
        else patchTask(id, { status, completed: done, completed_at: done ? before.completed_at ?? new Date().toISOString() : null });
        const r = await engine.mutate(() => updateTodoResult(id, { status }));
        if (!r.ok) {
          patchTask(id, { status: before.status, completed: before.completed, completed_at: before.completed_at, approval_state: before.approval_state });
          fail(r);
        } else if (!silent && done) {
          toast(withUndo(t(submits ? "toast.submitted" : "toast.completed"),
            () => void undoRef.current?.setStatus(id, before.status ?? "todo", true)), "success", UNDO_MS);
        }
      });
    },

    async toggle(id: string) {
      await guarded(id, async () => {
        const before = find(id);
        if (!before) return;
        /* Mirrors the toggle route: a participant ticking a task that is not
           yet approved submits (or withdraws) it — it never completes it. The
           assigner ticking a PENDING task approves it; the old screen sent a
           withdraw there and cancelled the assignee's submission. */
        if (!isOwner(before) && !before.completed && before.approval_state !== "approved") {
          const withdrawing = before.approval_state === "pending";
          patchTask(id, { approval_state: withdrawing ? null : "pending" });
          const r = await engine.mutate(() => toggleTodoResult(id));
          if (!r.ok) { patchTask(id, { approval_state: before.approval_state }); fail(r); return; }
          if (!withdrawing) toast(withUndo(t("toast.submitted"), () => void undoRef.current?.toggle(id)), "success", UNDO_MS);
          return;
        }
        const completing = !before.completed;
        patchTask(id, {
          completed: completing,
          completed_at: completing ? new Date().toISOString() : null,
          status: completing ? "done" : "todo",
          approval_state: completing ? (before.approval_state === "pending" ? "approved" : before.approval_state) : null,
        });
        const r = await engine.mutate(() => toggleTodoResult(id));
        if (!r.ok) {
          patchTask(id, { completed: before.completed, completed_at: before.completed_at, status: before.status, approval_state: before.approval_state });
          fail(r);
          return;
        }
        /* The server says where the task actually ended up; if another
           write got there first, show that rather than our guess. */
        if (r.data.completed !== null && r.data.completed !== completing) {
          patchTask(id, { completed: r.data.completed, completed_at: r.data.completed ? before.completed_at : null, status: r.data.completed ? "done" : before.status });
          return;
        }
        if (completing) {
          const back = before.status && before.status !== "done" ? before.status : "todo";
          toast(withUndo(t("toast.completed"), () => void undoRef.current?.setStatus(id, back, true)), "success", UNDO_MS);
        }
      });
    },

    /* ── approval decisions (assigner) ── */
    async approve(id: string) {
      await guarded(id, async () => {
        const before = find(id);
        if (!before) return;
        const now = new Date().toISOString();
        patchTask(id, { approval_state: "approved", completed: true, completed_at: now, status: "done" });
        const r = await engine.mutate(() => updateTodoResult(id, { approval_state: "approved", status: "done" }));
        if (!r.ok) { patchTask(id, () => before); fail(r); }
      });
    },

    async reject(id: string, reason: string) {
      const text = reason.trim();
      if (!text) return;
      await guarded(id, async () => {
        const before = find(id);
        if (!before) return;
        const metadata = {
          ...((before.metadata as TodoMetadata | null) ?? {}),
          rejection: { reason: text, by: accountId, at: new Date().toISOString() },
        };
        patchTask(id, { approval_state: "rejected", completed: false, completed_at: null, status: "in_progress", metadata });
        /* The reason alone: the server writes it into the task's OWN
           metadata, so a concurrent edit to attachments or the checklist is
           never overwritten by our copy of the column. */
        const r = await engine.mutate(() => updateTodoResult(id, { approval_state: "rejected", status: "in_progress" }, { rejectionReason: text }));
        if (!r.ok) { patchTask(id, () => before); fail(r); }
      });
    },

    /* ── delete, held back under Undo ── */
    remove(ids: string[]) {
      const owned = ids.filter((id) => { const x = find(id); return !!x && !isTempTask(id) && isOwner(x); });
      const skipped = ids.length - owned.length;
      if (owned.length === 0) {
        if (skipped) toast(t("toast.cannotDelete"), "info");
        return;
      }
      const batch = `${owned[0]}:${owned.length}:${pendingDeletes.current.size}`;
      setHidden((prev) => new Set([...prev, ...owned]));
      const commit = async () => {
        const entry = pendingDeletes.current.get(batch);
        if (!entry) return;
        pendingDeletes.current.delete(batch);
        const results = await engine.mutate(() => Promise.all(entry.ids.map((x) => deleteTodo(x))));
        const gone = new Set(entry.ids.filter((_, i) => results[i]));
        if (gone.size) dropTasks(gone);
        unhide(entry.ids);
        if (gone.size < entry.ids.length) fail();
      };
      pendingDeletes.current.set(batch, { ids: owned, timer: setTimeout(() => void commit(), UNDO_MS) });
      const undo = () => {
        const entry = pendingDeletes.current.get(batch);
        if (!entry) return;
        clearTimeout(entry.timer);
        pendingDeletes.current.delete(batch);
        unhide(entry.ids);
      };
      const label = owned.length === 1 ? t("toast.deleted") : `${owned.length} ${t("toast.deletedMany")}`;
      toast(withUndo(skipped ? `${label} · ${skipped} ${t("toast.skipped")}` : label, undo), "info", UNDO_MS);
    },

    /* ── bulk ── */
    async bulkStatus(ids: string[], status: TodoStatus) {
      const befores = ids.map(find).filter((x): x is TodoWithRelations => !!x && !isTempTask(x.id));
      const done = status === "done";
      const now = new Date().toISOString();
      befores.forEach((b) => {
        if (done && !isOwner(b) && b.approval_state !== "approved") patchTask(b.id, { approval_state: "pending" });
        else patchTask(b.id, { status, completed: done, completed_at: done ? b.completed_at ?? now : null });
      });
      const results = await engine.mutate(() => Promise.all(befores.map((b) => updateTodoResult(b.id, { status }))));
      const failed = results.filter((r) => !r.ok);
      befores.forEach((b, i) => { if (!results[i].ok) patchTask(b.id, () => b); });
      if (failed.length) fail(failed[0]);
    },

    async bulkReassign(ids: string[], assignee: TodoAssigneeInfo) {
      const befores = ids.map(find).filter((x): x is TodoWithRelations => !!x && !isTempTask(x.id) && isOwner(x));
      const skipped = ids.length - befores.length;
      befores.forEach((b) => patchTask(b.id, { assignees: [assignee], assign_to_all: false, assigned_department: null }));
      const results = await engine.mutate(() =>
        Promise.all(befores.map((b) => updateTodoResult(b.id, { assign_to_all: false, assigned_department: null }, { newAssigneeIds: [assignee.account_id] }))),
      );
      const failed = results.filter((r) => !r.ok);
      befores.forEach((b, i) => { if (!results[i].ok) patchTask(b.id, () => b); });
      if (failed.length) fail(failed[0]);
      else if (skipped) toast(`${skipped} ${t("toast.skipped")}`, "info");
    },

    /* ── notes & checklist ── */
    async addNote(todoId: string, body: string): Promise<boolean> {
      if (!accountId || isTempTask(todoId)) return false;
      const note = await engine.mutate(() => addTodoNote(todoId, accountId, body));
      if (!note) { fail(); return false; }
      const self = data?.employees.find((e) => e.account_id === accountId);
      patchTask(todoId, (x) => ({
        ...x,
        notes: [...x.notes, {
          ...note,
          author_username: self?.username ?? "",
          author_full_name: self?.full_name ?? null,
          author_avatar_url: self?.avatar_url ?? null,
        }],
      }));
      return true;
    },

    async deleteNote(todoId: string, noteId: string) {
      const before = find(todoId);
      if (!before) return;
      patchTask(todoId, (x) => ({ ...x, notes: x.notes.filter((n) => n.id !== noteId) }));
      const ok = await engine.mutate(() => deleteTodoNote(noteId));
      if (!ok) { patchTask(todoId, (x) => ({ ...x, notes: before.notes })); fail(); }
    },

    async toggleChecklistItem(todoId: string, itemId: string) {
      await guarded(todoId, async () => {
        const before = find(todoId);
        if (!before || !isOwner(before)) return;
        const meta = (before.metadata ?? {}) as TodoMetadata;
        const checklist = (Array.isArray(meta.checklist) ? meta.checklist : [])
          .map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
        const metadata = { ...meta, checklist };
        patchTask(todoId, { metadata });
        const r = await engine.mutate(() => updateTodoResult(todoId, { metadata }));
        if (!r.ok) { patchTask(todoId, { metadata: before.metadata }); fail(r); }
      });
    },

    /* ── create / edit (quick add + the task form) ── */
    /* create / edit answer null on success, or the reason it failed — the
       form shows it in place and stays open; quick add toasts it. */
    async create(fields: TaskFields, assigneeIds: string[]): Promise<string | null> {
      const assignees = (data?.employees ?? []).filter((e) => assigneeIds.includes(e.account_id));
      const now = new Date().toISOString();
      const tempId = `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const done = fields.status === "done";
      const temp = withRelations({
        ...fields, id: tempId, completed: done, completed_at: done ? now : null,
        created_at: now, updated_at: now, created_by_account_id: accountId, assigned_by_account_id: accountId,
        approval_state: null, approved_at: null, approved_by_account_id: null, recurrence_parent_id: null,
        recurrence_spawned_for: null, source: "manual", source_id: null, is_private: false, tenant_id: null, reminded_at: null,
      }, assignees);
      patchTodos((list) => [temp, ...list]);
      const r = await engine.mutate(() => createTodoResult({ ...fields, assignee_account_ids: assigneeIds }));
      if (!r.ok || !r.data) {
        patchTodos((list) => list.filter((x) => x.id !== tempId));
        return reason(r.ok ? null : r, fields.assign_to_all);
      }
      const row = r.data;
      patchTodos((list) => list.map((x) => (x.id === tempId ? withRelations(row, assignees) : x)));
      return null;
    },

    async edit(id: string, fields: TaskFields, assigneeIds: string[]): Promise<string | null> {
      const before = find(id);
      if (!before) return t("toast.notFound");
      const assignees = (data?.employees ?? []).filter((e) => assigneeIds.includes(e.account_id));
      patchTask(id, { ...fields, assignees, completed: fields.status === "done" });
      const r = await engine.mutate(() => updateTodoResult(id, fields, { newAssigneeIds: assigneeIds }));
      if (r.ok) return null;
      patchTask(id, () => before);
      return reason(r, fields.assign_to_all && !before.assign_to_all);
    },

    addLabel(label: TodoLabelRow) {
      patchSnap((s) => (s.labels.some((l) => l.id === label.id) ? s : { ...s, labels: [...s.labels, label] }));
    },

    /* Next page of finished tasks (the first call loads the first page). */
    async loadMoreDone() {
      if (doneBusy.current || (done.loaded && !done.nextBefore)) return;
      doneBusy.current = true;
      setDone((d) => ({ ...d, loading: true, error: false }));
      try {
        const page = await loadCompletedPage(done.loaded ? done.nextBefore : null);
        setDone((d) => {
          const have = new Set(d.rows.map((x) => x.id));
          return { rows: [...d.rows, ...page.todos.filter((x) => !have.has(x.id))], nextBefore: page.nextBefore, loaded: true, loading: false, error: false };
        });
      } catch {
        setDone((d) => ({ ...d, loading: false, error: true }));
      } finally {
        doneBusy.current = false;
      }
    },

    retry() {
      setError(null);
      void engine.run(true);
    },
  });

  useEffect(() => { undoRef.current = actions; }, [actions]);

  return { data, todos, done, hidden, loading: !data && !error, error, synced, actions };
}

function withRelations(row: TodoRow, assignees: TodoAssigneeInfo[]): TodoWithRelations {
  return {
    ...row,
    assignees,
    assigner: null,
    notes: [],
    series_cadence: row.recurrence ?? null,
    series_period: row.recurrence ? (row.start_date ?? row.created_at)?.slice(0, 10) ?? null : null,
  };
}

export type TodoActions = ReturnType<typeof useTodoStore>["actions"];
