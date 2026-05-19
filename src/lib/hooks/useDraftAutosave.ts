"use client";

/* ===========================================================================
   useDraftAutosave — lightweight per-form draft recovery.

   Stores the form value in localStorage, namespaced by tenant + key,
   so an accidental refresh / closed tab doesn't lose work. Drafts
   auto-expire after a configurable TTL (default 24h) and clear after
   a successful submit.

   Usage:
     const draft = useDraftAutosave("expense:new", value, { tenantId, expireMs });
     // … on submit:
     draft.clear();
     // … to restore:
     if (draft.hasDraft) showResumePrompt(draft.restore());
   ========================================================================== */

import { useEffect, useState } from "react";

const PREFIX = "koleex.draft.";
const DEFAULT_EXPIRE_MS = 24 * 60 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 600;

interface Wrapped<T> {
  saved_at: number;
  tenant: string | null;
  value: T;
}

export interface DraftStore<T> {
  /** True if a saved draft exists on mount that you can offer to restore. */
  hasDraft: boolean;
  /** Returns the saved value (or null if expired/missing). */
  restore(): T | null;
  /** Clear the saved draft. Call after a successful submit. */
  clear(): void;
  /** Force-save the current value immediately (also called automatically). */
  flush(): void;
  /** Timestamp of the saved draft, ms epoch. */
  savedAt: number | null;
}

export function useDraftAutosave<T>(
  key: string,
  value: T,
  opts: {
    tenantId?: string | null;
    expireMs?: number;
    /** Disable autosave when the form is empty/initial. */
    enabled?: boolean;
  } = {},
): DraftStore<T> {
  const tenantId   = opts.tenantId ?? null;
  const expireMs   = opts.expireMs ?? DEFAULT_EXPIRE_MS;
  const enabled    = opts.enabled !== false;
  const storageKey = `${PREFIX}${tenantId ?? "anon"}:${key}`;

  /* React-Compiler-friendly probe: side effects + Date.now() belong inside
     a lazy useState initializer (runs once per mount), not the bare render
     body. Returns { hasDraft, savedAt } so we don't need a parallel ref. */
  const [probe, setProbe] = useState<{ hasDraft: boolean; savedAt: number | null }>(() => {
    if (typeof window === "undefined") return { hasDraft: false, savedAt: null };
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { hasDraft: false, savedAt: null };
    try {
      const parsed = JSON.parse(raw) as Wrapped<T>;
      const age = Date.now() - parsed.saved_at;
      if (age > expireMs || (tenantId && parsed.tenant && parsed.tenant !== tenantId)) {
        window.localStorage.removeItem(storageKey);
        return { hasDraft: false, savedAt: null };
      }
      return { hasDraft: true, savedAt: parsed.saved_at };
    } catch {
      window.localStorage.removeItem(storageKey);
      return { hasDraft: false, savedAt: null };
    }
  });
  const savedAt = probe.savedAt;
  const setSavedAt = (next: number | null) => setProbe((p) => ({ ...p, savedAt: next }));

  /* Debounced autosave on every value change. */
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const t = setTimeout(() => {
      const payload: Wrapped<T> = { saved_at: Date.now(), tenant: tenantId, value };
      try { window.localStorage.setItem(storageKey, JSON.stringify(payload)); setSavedAt(payload.saved_at); }
      catch { /* localStorage full or disabled — silently skip */ }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [storageKey, value, enabled, tenantId]);

  function restore(): T | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Wrapped<T>;
      const age = Date.now() - parsed.saved_at;
      if (age > expireMs) { window.localStorage.removeItem(storageKey); return null; }
      if (tenantId && parsed.tenant && parsed.tenant !== tenantId) return null;
      return parsed.value;
    } catch { return null; }
  }

  function clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(storageKey);
    setSavedAt(null);
  }

  function flush() {
    if (typeof window === "undefined") return;
    const payload: Wrapped<T> = { saved_at: Date.now(), tenant: tenantId, value };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    setSavedAt(payload.saved_at);
  }

  return {
    hasDraft: probe.hasDraft,
    restore, clear, flush, savedAt,
  };
}
