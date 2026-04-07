/* ---------------------------------------------------------------------------
   Todo Admin — Manage tasks.
   Metadata stored as JSON in Supabase Storage (config/todos.json).
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";

const BUCKET = "media";
const CONFIG_PATH = "config/todos.json";

export interface TodoEntry {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: "high" | "medium" | "low";
  label: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// ── Fetch all todos ──

export async function fetchTodos(): Promise<TodoEntry[]> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(CONFIG_PATH);
    if (error || !data) return [];
    const text = await data.text();
    return JSON.parse(text) as TodoEntry[];
  } catch {
    return [];
  }
}

// ── Save todos (overwrite JSON) ──

async function saveTodos(entries: TodoEntry[]): Promise<boolean> {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const { error } = await supabase.storage.from(BUCKET).upload(CONFIG_PATH, blob, {
    cacheControl: "0",
    upsert: true,
  });
  if (error) {
    console.error("[Todos] Save:", error.message);
    return false;
  }
  return true;
}

// ── Create todo ──

export async function createTodo(
  entry: Omit<TodoEntry, "id" | "created_at" | "updated_at" | "completed_at">,
): Promise<TodoEntry | null> {
  const entries = await fetchTodos();
  const newEntry: TodoEntry = {
    ...entry,
    id: crypto.randomUUID(),
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  entries.unshift(newEntry);
  const ok = await saveTodos(entries);
  return ok ? newEntry : null;
}

// ── Update todo ──

export async function updateTodo(
  id: string,
  updates: Partial<TodoEntry>,
): Promise<boolean> {
  const entries = await fetchTodos();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return false;
  entries[idx] = {
    ...entries[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  return saveTodos(entries);
}

// ── Toggle complete ──

export async function toggleTodo(id: string): Promise<boolean> {
  const entries = await fetchTodos();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return false;
  const now = new Date().toISOString();
  entries[idx] = {
    ...entries[idx],
    completed: !entries[idx].completed,
    completed_at: !entries[idx].completed ? now : null,
    updated_at: now,
  };
  return saveTodos(entries);
}

// ── Delete todo ──

export async function deleteTodo(id: string): Promise<boolean> {
  const entries = await fetchTodos();
  const filtered = entries.filter((e) => e.id !== id);
  return saveTodos(filtered);
}

// ── Reorder todos ──

export async function reorderTodos(ids: string[]): Promise<boolean> {
  const entries = await fetchTodos();
  const ordered: TodoEntry[] = [];
  for (const id of ids) {
    const entry = entries.find((e) => e.id === id);
    if (entry) ordered.push(entry);
  }
  // Add any entries not in ids list (safety)
  for (const entry of entries) {
    if (!ids.includes(entry.id)) ordered.push(entry);
  }
  return saveTodos(ordered);
}
