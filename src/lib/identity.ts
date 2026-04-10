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
import { fetchAccounts, fetchAccountWithLinks } from "./accounts-admin";
import type { AccountWithLinks } from "@/types/supabase";

const CURRENT_ACCOUNT_KEY = "koleex-current-account-id";
const IDENTITY_EVENT = "koleex-identity-change";

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
  const [account, setAccount] = useState<AccountWithLinks | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
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

      const full = await fetchAccountWithLinks(id);
      if (cancelled) return;
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
 * header refetches.
 */
export function notifyIdentityChanged(): void {
  if (typeof window === "undefined") return;
  const id = getCurrentAccountIdSync();
  window.dispatchEvent(new CustomEvent(IDENTITY_EVENT, { detail: id }));
}
