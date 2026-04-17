"use client";

/* ---------------------------------------------------------------------------
   identity — resolves "which account is the current user" in both auth modes.

   Legacy mode (the default until Supabase Auth is flipped on):
     There is no real session. The admin password gate just toggles a
     sessionStorage flag. We still want the MainHeader / UserMenu to show a
     real name + avatar + role for the person using the hub, so we let them
     pick which account row represents "me" and remember that choice in
     localStorage. On first load we auto-pick if exactly one internal account
     exists (common case for a new install).

   Supabase mode (deferred — plumbed but inactive):
     When `isSupabaseAuthEnabled()` is true, the chosen identity is instead
     resolved by looking up `accounts.auth_user_id = auth.users.id`. That
     lookup is not yet implemented here — the hook falls back to the legacy
     localStorage path so UI can still render during the transition period.

   Usage:
     const { account, loading, refresh } = useCurrentAccount();
     const accountId = getCurrentAccountIdSync(); // synchronous read
     setCurrentAccountId("uuid");
--------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { fetchAccounts, fetchAccountForHeader } from "./accounts-admin";
import type { AccountWithLinks } from "@/types/supabase";
import { clearScopeContextCache } from "./scope";

const CURRENT_ACCOUNT_KEY = "koleex-current-account-id";
const CURRENT_ACCOUNT_CACHE_KEY = "koleex-current-account-cache";
const IDENTITY_EVENT = "koleex-identity-change";

/* How long a cached header account stays fresh before we silently refetch.
   Short enough that edits propagate quickly, long enough that SPA navigation
   feels instant. We still refetch in the background on every mount, so this
   only controls whether we SHOW the cached value immediately. */
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachedAccount {
  id: string;
  data: AccountWithLinks;
  ts: number;
}

function readCache(): CachedAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CURRENT_ACCOUNT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAccount;
    if (!parsed || !parsed.id || !parsed.data) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(id: string, data: AccountWithLinks): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedAccount = { id, data, ts: Date.now() };
    window.sessionStorage.setItem(
      CURRENT_ACCOUNT_CACHE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    /* sessionStorage quota or JSON stringify failure — safe to ignore,
       the hook will fall back to a fresh network fetch. */
  }
}

function clearCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CURRENT_ACCOUNT_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function getCurrentAccountIdSync(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CURRENT_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function setCurrentAccountId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      window.localStorage.setItem(CURRENT_ACCOUNT_KEY, id);
    } else {
      window.localStorage.removeItem(CURRENT_ACCOUNT_KEY);
    }
    /* Changing who "I am" always invalidates the cached profile. */
    clearCache();
    /* Also invalidate the scope context cache so the next hook mount
       picks up the new identity's tenant / role / SA flags instead of
       the previous user's. */
    clearScopeContextCache();
    /* Notify listeners in the same tab. The `storage` event only fires in
       *other* tabs, so we dispatch a custom event for in-tab updates. */
    window.dispatchEvent(new CustomEvent(IDENTITY_EVENT, { detail: id }));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the current account + its joined person/company/role. Re-runs when
 * the stored account id changes (e.g. the user uploads a new avatar and we
 * want the header to refresh without a full page reload).
 */
export function useCurrentAccount() {
  /* Hydrate synchronously from the session cache on first render so the
     header avatar / name show up instantly on SPA navigations. The cache
     lives in sessionStorage so it's wiped on a fresh tab. */
  const [account, setAccount] = useState<AccountWithLinks | null>(() => {
    const cached = readCache();
    const id = getCurrentAccountIdSync();
    if (cached && cached.id === id) return cached.data;
    return null;
  });
  const [loading, setLoading] = useState(() => {
    const cached = readCache();
    const id = getCurrentAccountIdSync();
    return !(cached && cached.id === id);
  });
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    clearCache();
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let id = getCurrentAccountIdSync();

      /* If we don't have a stored id yet, try to auto-pick: if exactly one
         internal account exists in the DB, that's "me". */
      if (!id) {
        try {
          const rows = await fetchAccounts();
          const internals = rows.filter((r) => r.user_type === "internal");
          if (internals.length === 1) {
            id = internals[0].id;
            setCurrentAccountId(id);
          }
        } catch {
          /* ignore — leave id null so UI falls back to the generic state */
        }
      }

      if (!id) {
        if (!cancelled) {
          setAccount(null);
          setLoading(false);
        }
        return;
      }

      /* Fast path: if the cache matches the resolved id, we already rendered
         it in the state initializer — skip the network entirely. The cache
         TTL (readCache) guarantees we'll re-query at some point. */
      const cached = readCache();
      if (cached && cached.id === id) {
        if (!cancelled) setLoading(false);
        return;
      }

      /* Cache miss: single-query fetch (people + roles joined). */
      const full = await fetchAccountForHeader(id);
      if (cancelled) return;
      if (full) writeCache(id, full);
      setAccount(full);
      setLoading(false);
    }

    void load();

    /* Same-tab updates (upload avatar → refresh header). */
    function onChange() {
      void load();
    }
    window.addEventListener(IDENTITY_EVENT, onChange);
    /* Cross-tab updates. */
    function onStorage(e: StorageEvent) {
      if (e.key === CURRENT_ACCOUNT_KEY) void load();
    }
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener(IDENTITY_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [version]);

  return { account, loading, refresh };
}

/**
 * Fire-and-forget: dispatch the change event for anything listening, without
 * changing the stored id. Call this after updating an existing account so the
 * header refetches. Invalidates the cache so the next hook mount hits the
 * network and shows fresh data.
 */
export function notifyIdentityChanged(): void {
  if (typeof window === "undefined") return;
  clearCache();
  const id = getCurrentAccountIdSync();
  window.dispatchEvent(new CustomEvent(IDENTITY_EVENT, { detail: id }));
}
