"use client";

/* ---------------------------------------------------------------------------
   ViewAsPicker — top-bar dropdown for Super Admin only.

   Two modes, switchable via a tab strip inside the dropdown:
     · User — view the system as a specific user (their role + their
       account-level overrides). POST /api/auth/view-as { accountId }.
     · Role — view the system as if you had only that role's grants,
       no account-level overrides. The SA stays themselves; only the
       effective role swaps. POST /api/auth/view-as/role { roleId }.

   Performance:
     · Lists are cached at module scope so reopening the picker is free.
     · BOTH lists prefetch in parallel on first open, so tab switching
       is instant.
     · Picking does a SOFT switch (no window.location.reload). We bust
       the bootstrap cache, retry it with `cache:no-store`, then run
       router.refresh() — all RSCs + bootstrap listeners update in place.
     · Skeleton rows show during the first fetch so the dropdown never
       looks empty.

   Non-SA: returns null. While viewing-as is already active, the
   picker hides (the banner's "Exit" is the only way out).
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMeBootstrap, retryMeBootstrap } from "@/lib/me-bootstrap";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";

interface AccountRow {
  id: string;
  username: string;
  login_email: string;
  user_type: string;
  status: string;
  role_id: string | null;
  role_name: string | null;
}

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  can_view_private: boolean;
  module_count: number;
}

type Mode = "user" | "role";

/* ── Module-scoped cache ───────────────────────────────────────────────
   Lists are shared across the whole app — there's only one picker
   instance, but if the picker remounts (route changes inside RootShell,
   theme flip, etc.) we don't want to refetch the same lists. */
/* Structured fetch result so callers can surface SPECIFIC errors
   ("HTTP 500", "Network error", "Timed out") instead of a generic
   "couldn't load" — that opacity was the worst part of the previous
   build, especially on a hot-reloading dev server where the first
   request can hit a still-compiling route. */
type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; message: string };

const moduleCache: {
  users: AccountRow[] | null;
  roles: RoleRow[] | null;
  usersFetchedAt: number;
  rolesFetchedAt: number;
  inflightUsers: Promise<FetchResult<AccountRow[]>> | null;
  inflightRoles: Promise<FetchResult<RoleRow[]>> | null;
} = {
  users: null,
  roles: null,
  usersFetchedAt: 0,
  rolesFetchedAt: 0,
  inflightUsers: null,
  inflightRoles: null,
};
/* Refresh module cache after this many ms. */
const CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 8_000;

function isFresh(ts: number): boolean {
  return Date.now() - ts < CACHE_TTL_MS;
}

/** Public hook so other components (e.g. ViewAsBanner) can invalidate
 *  the picker's caches on exit. */
export function invalidateViewAsLists(): void {
  moduleCache.users = null;
  moduleCache.roles = null;
  moduleCache.usersFetchedAt = 0;
  moduleCache.rolesFetchedAt = 0;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { credentials: "include", signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function rawFetchUsers(): Promise<FetchResult<AccountRow[]>> {
  try {
    const res = await fetchWithTimeout("/api/auth/view-as/users");
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        status: res.status,
        message: j.error ?? `HTTP ${res.status}`,
      };
    }
    const j = (await res.json()) as { accounts?: AccountRow[] };
    return { ok: true, data: j.accounts ?? [] };
  } catch (e) {
    const isAbort =
      (e as Error)?.name === "AbortError" ||
      String(e).includes("aborted");
    return {
      ok: false,
      status: null,
      message: isAbort ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s` : "Network error",
    };
  }
}

async function rawFetchRoles(): Promise<FetchResult<RoleRow[]>> {
  try {
    const res = await fetchWithTimeout("/api/auth/view-as/roles");
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        status: res.status,
        message: j.error ?? `HTTP ${res.status}`,
      };
    }
    const j = (await res.json()) as { roles?: RoleRow[] };
    return { ok: true, data: j.roles ?? [] };
  } catch (e) {
    const isAbort =
      (e as Error)?.name === "AbortError" ||
      String(e).includes("aborted");
    return {
      ok: false,
      status: null,
      message: isAbort ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s` : "Network error",
    };
  }
}

async function fetchUsers(): Promise<FetchResult<AccountRow[]>> {
  if (moduleCache.users && isFresh(moduleCache.usersFetchedAt)) {
    return { ok: true, data: moduleCache.users };
  }
  if (moduleCache.inflightUsers) return moduleCache.inflightUsers;
  moduleCache.inflightUsers = (async () => {
    let res = await rawFetchUsers();
    /* One soft retry on transient failure — dev hot-reload often
       compiles the route on first request and fails, then succeeds on
       second. 250ms backoff is enough to clear most cases. */
    if (!res.ok && (res.status == null || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 250));
      res = await rawFetchUsers();
    }
    if (res.ok) {
      moduleCache.users = res.data;
      moduleCache.usersFetchedAt = Date.now();
    }
    return res;
  })().finally(() => {
    moduleCache.inflightUsers = null;
  });
  return moduleCache.inflightUsers;
}

async function fetchRoles(): Promise<FetchResult<RoleRow[]>> {
  if (moduleCache.roles && isFresh(moduleCache.rolesFetchedAt)) {
    return { ok: true, data: moduleCache.roles };
  }
  if (moduleCache.inflightRoles) return moduleCache.inflightRoles;
  moduleCache.inflightRoles = (async () => {
    let res = await rawFetchRoles();
    if (!res.ok && (res.status == null || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 250));
      res = await rawFetchRoles();
    }
    if (res.ok) {
      moduleCache.roles = res.data;
      moduleCache.rolesFetchedAt = Date.now();
    }
    return res;
  })().finally(() => {
    moduleCache.inflightRoles = null;
  });
  return moduleCache.inflightRoles;
}

export default function ViewAsPicker({ dk }: { dk: boolean }) {
  const router = useRouter();
  const { data: bootstrap } = useMeBootstrap();
  const [accounts, setAccounts] = useState<AccountRow[] | null>(moduleCache.users);
  const [roles, setRoles] = useState<RoleRow[] | null>(moduleCache.roles);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("user");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const isSuperAdmin = bootstrap?.isSuperAdmin ?? false;

  /* Prefetch BOTH lists in parallel on first open. Errors are surfaced
     specifically per-list so the user can see the actual HTTP status
     or "timed out" instead of an opaque "couldn't load". Partial
     success is also handled — if users loaded but roles failed, the
     User tab still works.

     Self-heal step: when both calls fail with auth-shaped errors
     (401/403), the most likely cause is a stale view-as cookie that
     didn't get cleared on a previous exit (Next.js cookies().delete()
     occasionally fails to round-trip a Set-Cookie). The bootstrap
     in-memory cache has SA=true (which is why the picker is even
     showing), but the server sees the lingering cookie and answers
     under role-mode. We re-fetch the bootstrap with `no-store` —
     either it confirms the SA state and the lists work on retry, or
     it picks up the cookie and the picker auto-hides. */
  const ensureLoaded = useCallback(async () => {
    setLoadError(null);
    let [u, r] = await Promise.all([fetchUsers(), fetchRoles()]);

    const bothAuthShaped =
      !u.ok &&
      !r.ok &&
      (u.status === 401 || u.status === 403) &&
      (r.status === 401 || r.status === 403);
    if (bothAuthShaped) {
      /* Bust the bootstrap, then retry once. */
      invalidateViewAsLists();
      try {
        await retryMeBootstrap();
      } catch {
        /* ignore — fall through to whichever error message we have */
      }
      [u, r] = await Promise.all([fetchUsers(), fetchRoles()]);
    }

    if (u.ok) setAccounts(u.data);
    if (r.ok) setRoles(r.data);
    if (!u.ok && !r.ok) {
      setLoadError(
        `Couldn't load lists — users: ${u.message}; roles: ${r.message}`,
      );
    } else if (!u.ok) {
      setLoadError(`Couldn't load users: ${u.message}`);
    } else if (!r.ok) {
      setLoadError(`Couldn't load roles: ${r.message}`);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void ensureLoaded();
  }, [open, ensureLoaded]);

  /* Warm the cache on hover of the trigger button — typically buys
     ~150ms before the user actually clicks open. Silent — errors here
     are not surfaced so a transient hover-prefetch failure can't
     poison the UI. */
  function handleTriggerHover() {
    if (!isSuperAdmin || bootstrap?.viewingAs) return;
    if (
      moduleCache.users &&
      moduleCache.roles &&
      isFresh(moduleCache.usersFetchedAt) &&
      isFresh(moduleCache.rolesFetchedAt)
    )
      return;
    void fetchUsers();
    void fetchRoles();
  }

  /* Close on outside click. */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  /* Soft switch — replaces window.location.reload() with cache-bust +
     RSC refresh. Bootstrap listeners (banner, sidebar, header) update
     in place. */
  async function softSwitch() {
    /* Invalidate the lists cache too — entering view-as changes which
       users / roles the new identity can see. Picker hides anyway, but
       this avoids stale data on Exit. */
    invalidateViewAsLists();
    await retryMeBootstrap();
    router.refresh();
  }

  async function handlePickUser(targetId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/view-as", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: targetId }),
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? `view-as failed (${res.status})`);
        setBusy(false);
        return;
      }
      setOpen(false);
      await softSwitch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "view-as failed");
    } finally {
      setBusy(false);
    }
  }

  async function handlePickRole(roleId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/view-as/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId }),
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? `view-as failed (${res.status})`);
        setBusy(false);
        return;
      }
      setOpen(false);
      await softSwitch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "view-as failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isSuperAdmin) return null;
  if (bootstrap?.viewingAs) return null;

  /* Filter the active list. */
  const usersLoaded = accounts !== null;
  const rolesLoaded = roles !== null;
  const filteredUsers = !accounts
    ? []
    : search.trim()
      ? accounts.filter((a) => {
          const s = search.toLowerCase();
          return (
            a.username.toLowerCase().includes(s) ||
            a.login_email.toLowerCase().includes(s) ||
            (a.role_name ?? "").toLowerCase().includes(s)
          );
        })
      : accounts;
  const filteredRoles = !roles
    ? []
    : search.trim()
      ? roles.filter((r) => {
          const s = search.toLowerCase();
          return (
            r.name.toLowerCase().includes(s) ||
            (r.description ?? "").toLowerCase().includes(s)
          );
        })
      : roles;

  const activeLoaded = mode === "user" ? usersLoaded : rolesLoaded;
  const activeFiltered = mode === "user" ? filteredUsers : filteredRoles;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={handleTriggerHover}
        className={`h-9 px-3 rounded-xl border text-[12px] font-medium flex items-center gap-2 transition-all ${
          dk
            ? "bg-white/[0.04] border-white/10 text-white/85 hover:bg-white/[0.08]"
            : "bg-black/[0.04] border-black/10 text-black/80 hover:bg-black/[0.08]"
        }`}
        title="Super Admin — view the system as another user or role"
      >
        <UsersIcon size={13} className="shrink-0" />
        <span className="max-w-[120px] truncate hidden sm:inline">View as</span>
        <AngleDownIcon size={11} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          className={`absolute right-0 top-11 z-50 w-[360px] max-w-[calc(100vw-1rem)] rounded-xl border shadow-2xl overflow-hidden ${
            dk ? "bg-[#141414] border-white/10" : "bg-white border-black/10"
          }`}
        >
          {/* Header label */}
          <div
            className={`px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider ${
              dk ? "text-white/50" : "text-black/50"
            }`}
          >
            View as
          </div>

          {/* Mode tabs — segmented pill, equal width. */}
          <div className="px-2 pb-2">
            <div
              className={`grid grid-cols-2 gap-0.5 rounded-lg p-0.5 ${
                dk ? "bg-white/[0.06]" : "bg-black/[0.05]"
              }`}
            >
              {(["user", "role"] as Mode[]).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setSearch("");
                    }}
                    className={`h-7 rounded-md text-[11.5px] font-semibold transition-all ${
                      active
                        ? dk
                          ? "bg-[#1f1f1f] text-white shadow-sm"
                          : "bg-white text-black shadow-sm"
                        : dk
                          ? "text-white/55 hover:text-white/80"
                          : "text-black/55 hover:text-black/80"
                    }`}
                  >
                    {m === "user" ? "By user" : "By role"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div
            className={`px-2 pb-2 border-b ${
              dk ? "border-white/[0.06]" : "border-black/[0.06]"
            }`}
          >
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                mode === "user"
                  ? "Search by name, email, role…"
                  : "Search roles…"
              }
              className={`w-full h-8 px-2.5 rounded-md border text-[12px] outline-none ${
                dk
                  ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/35"
                  : "bg-black/[0.03] border-black/[0.08] text-black placeholder:text-black/40"
              }`}
            />
          </div>

          {/* Error banner */}
          {loadError && (
            <button
              type="button"
              onClick={() => {
                invalidateViewAsLists();
                void ensureLoaded();
              }}
              className={`block w-full text-left px-3 py-2 text-[11px] ${
                dk
                  ? "bg-red-500/10 text-red-300 border-b border-red-500/20 hover:bg-red-500/15"
                  : "bg-red-500/10 text-red-700 border-b border-red-500/20 hover:bg-red-500/15"
              }`}
            >
              {loadError}
            </button>
          )}

          {/* Busy overlay during pick */}
          {busy && (
            <div
              className={`absolute inset-0 z-10 flex items-center justify-center text-[11.5px] font-medium ${
                dk
                  ? "bg-black/40 text-white/80 backdrop-blur-sm"
                  : "bg-white/60 text-black/70 backdrop-blur-sm"
              }`}
            >
              Switching…
            </div>
          )}

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto">
            {!activeLoaded ? (
              /* Skeleton rows during initial fetch — concrete visual
                 feedback beats a "Loading…" text. */
              <SkeletonList dk={dk} />
            ) : activeFiltered.length === 0 ? (
              <div
                className={`px-3 py-4 text-[12px] ${
                  dk ? "text-white/45" : "text-black/45"
                }`}
              >
                {mode === "user"
                  ? accounts && accounts.length === 0
                    ? "No other users in your tenant."
                    : "No matches."
                  : roles && roles.length === 0
                    ? "No roles available."
                    : "No matches."}
              </div>
            ) : mode === "user" ? (
              (activeFiltered as AccountRow[]).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handlePickUser(a.id)}
                  className={`w-full px-3 py-2.5 text-left flex items-center gap-2 transition-colors disabled:opacity-50 ${
                    dk ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.03]"
                  }`}
                >
                  <UsersIcon
                    size={13}
                    className={`shrink-0 ${
                      dk ? "text-white/60" : "text-black/60"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[12.5px] font-semibold truncate ${
                        dk ? "text-white" : "text-black"
                      }`}
                    >
                      {a.username}
                    </div>
                    <div
                      className={`text-[10.5px] truncate ${
                        dk ? "text-white/45" : "text-black/45"
                      }`}
                    >
                      {a.role_name ?? a.user_type} · {a.login_email}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              (activeFiltered as RoleRow[]).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handlePickRole(r.id)}
                  className={`w-full px-3 py-2.5 text-left flex items-start gap-2 transition-colors disabled:opacity-50 ${
                    dk ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.03]"
                  }`}
                >
                  <UsersIcon
                    size={13}
                    className={`shrink-0 mt-[3px] ${
                      dk ? "text-white/60" : "text-black/60"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[12.5px] font-semibold truncate ${
                          dk ? "text-white" : "text-black"
                        }`}
                      >
                        {r.name}
                      </span>
                      <span
                        className={`ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          dk
                            ? "bg-white/[0.08] text-white/65"
                            : "bg-black/[0.06] text-black/55"
                        }`}
                      >
                        {r.module_count}{" "}
                        {r.module_count === 1 ? "module" : "modules"}
                      </span>
                    </div>
                    {r.description && (
                      <div
                        className={`mt-0.5 text-[10.5px] truncate ${
                          dk ? "text-white/45" : "text-black/45"
                        }`}
                        title={r.description}
                      >
                        {r.description}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Skeleton row component ────────────────────────────────────────── */
function SkeletonList({ dk }: { dk: boolean }) {
  const bg = dk ? "bg-white/[0.06]" : "bg-black/[0.05]";
  return (
    <div className="px-3 py-2 space-y-3 animate-pulse">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className={`h-3 w-3 rounded-full ${bg}`} />
          <div className="flex-1 space-y-1.5">
            <div className={`h-3 rounded ${bg}`} style={{ width: `${60 + (i % 3) * 10}%` }} />
            <div className={`h-2 rounded ${bg}`} style={{ width: `${40 + (i % 4) * 8}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
