"use client";

/* ---------------------------------------------------------------------------
   ViewAsPicker — top-bar dropdown for Super Admin only.

   Two modes, switchable via a tab strip inside the dropdown:
     · User — view the system as a specific user (their role + their
       account-level overrides). POST /api/auth/view-as { accountId }.
     · Role — view the system as if you had only that role's grants,
       no account-level overrides. The SA stays themselves; only the
       effective role swaps. POST /api/auth/view-as/role { roleId }.

   On pick the appropriate cookie is set, then a hard reload re-issues
   every cached fetch under the new identity.

   Non-SA: returns null. While viewing-as is already active, the
   picker hides (the banner's "Exit" is the only way out).
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { getCurrentAccountIdSync } from "@/lib/identity";
import { useMeBootstrap } from "@/lib/me-bootstrap";
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

export default function ViewAsPicker({ dk }: { dk: boolean }) {
  const { data: bootstrap } = useMeBootstrap();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("user");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /* ── SA check on mount ─────────────────────────────────────── */
  useEffect(() => {
    const accountId = getCurrentAccountIdSync();
    if (!accountId) return;
    setIsSuperAdmin(bootstrap?.isSuperAdmin ?? false);
  }, [bootstrap]);

  /* Lazy-load the active mode's list on first open / mode switch. */
  useEffect(() => {
    if (!open) return;
    if (mode === "user" && accounts.length > 0) return;
    if (mode === "role" && roles.length > 0) return;
    setLoadError(null);
    (async () => {
      try {
        const url =
          mode === "user"
            ? "/api/auth/view-as/users"
            : "/api/auth/view-as/roles";
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setLoadError(j.error ?? `Failed (${res.status})`);
          return;
        }
        const j = (await res.json()) as
          | { accounts?: AccountRow[]; roles?: RoleRow[] };
        if (mode === "user") setAccounts(j.accounts ?? []);
        else setRoles(j.roles ?? []);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [open, mode, accounts.length, roles.length]);

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
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "view-as failed");
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
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "view-as failed");
      setBusy(false);
    }
  }

  if (!isSuperAdmin) return null;
  if (bootstrap?.viewingAs) return null;

  /* Filter the active list. */
  const filteredUsers = search.trim()
    ? accounts.filter((a) => {
        const s = search.toLowerCase();
        return (
          a.username.toLowerCase().includes(s) ||
          a.login_email.toLowerCase().includes(s) ||
          (a.role_name ?? "").toLowerCase().includes(s)
        );
      })
    : accounts;

  const filteredRoles = search.trim()
    ? roles.filter((r) => {
        const s = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(s) ||
          (r.description ?? "").toLowerCase().includes(s)
        );
      })
    : roles;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
        /* Fixed width: was `min-w-[340px]`, which let long role
           descriptions push the dropdown wider than the viewport. The
           `max-w` clamp keeps mobile happy. `overflow-hidden` guards
           against any stray overflow inside the rows. */
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

          {/* Mode tabs — segmented pill, equal width via grid so the
              active state never visually dominates the inactive one. */}
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
                      setLoadError(null);
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
            <div
              className={`px-3 py-2 text-[11px] ${
                dk
                  ? "bg-red-500/10 text-red-300 border-b border-red-500/20"
                  : "bg-red-500/10 text-red-700 border-b border-red-500/20"
              }`}
            >
              {loadError}
            </div>
          )}

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto">
            {mode === "user" ? (
              filteredUsers.length === 0 ? (
                <div
                  className={`px-3 py-4 text-[12px] ${
                    dk ? "text-white/45" : "text-black/45"
                  }`}
                >
                  {loadError
                    ? "—"
                    : accounts.length === 0
                      ? "Loading users…"
                      : "No matches"}
                </div>
              ) : (
                filteredUsers.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handlePickUser(a.id)}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-2 transition-colors disabled:opacity-50 ${
                      dk
                        ? "hover:bg-white/[0.04]"
                        : "hover:bg-black/[0.03]"
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
              )
            ) : filteredRoles.length === 0 ? (
              <div
                className={`px-3 py-4 text-[12px] ${
                  dk ? "text-white/45" : "text-black/45"
                }`}
              >
                {loadError
                  ? "—"
                  : roles.length === 0
                    ? "Loading roles…"
                    : "No matches"}
              </div>
            ) : (
              filteredRoles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handlePickRole(r.id)}
                  className={`w-full px-3 py-2.5 text-left flex items-start gap-2 transition-colors disabled:opacity-50 ${
                    dk
                      ? "hover:bg-white/[0.04]"
                      : "hover:bg-black/[0.03]"
                  }`}
                >
                  <UsersIcon
                    size={13}
                    className={`shrink-0 mt-[3px] ${
                      dk ? "text-white/60" : "text-black/60"
                    }`}
                  />
                  {/* Title row — name on the left, "N modules" pill on the right. */}
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
                        {r.module_count} {r.module_count === 1 ? "module" : "modules"}
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
