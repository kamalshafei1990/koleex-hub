"use client";

/* ---------------------------------------------------------------------------
   ViewAsPicker — top-bar dropdown for Super Admin only.

   Twin of TenantPicker but for USERS instead of tenants. Lets a SA see
   the Hub through any other account's eyes: the sidebar shows what they
   see, every API call enforces their permissions, the bootstrap returns
   their data. Useful for verifying role configuration without juggling
   accounts.

   On pick: POST /api/auth/view-as { accountId } → cookie set → hard
   reload so every cached fetch is re-issued under the new identity.

   Non-SA: returns null.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentAccountIdSync } from "@/lib/identity";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

interface AccountRow {
  id: string;
  username: string;
  login_email: string;
  user_type: string;
  status: string;
  role_id: string | null;
  role_name: string | null;
}

export default function ViewAsPicker({ dk }: { dk: boolean }) {
  const { data: bootstrap } = useMeBootstrap();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /* ── SA check + roster load on mount ────────────────────────────
     We piggy-back on the bootstrap response for the SA flag (already
     cached); the account list is a separate query because it's only
     needed when the picker actually opens. */
  useEffect(() => {
    const accountId = getCurrentAccountIdSync();
    if (!accountId) return;
    setIsSuperAdmin(bootstrap?.isSuperAdmin ?? false);
  }, [bootstrap]);

  /* Load roster on first open. Scope to the SA's tenant — view-as is
     only valid within one tenant (cross-tenant view = TenantPicker). */
  useEffect(() => {
    if (!open || accounts.length > 0) return;
    const tenantId = bootstrap?.auth?.tenant_id;
    if (!tenantId) return;
    (async () => {
      const { data } = await supabaseAdmin
        .from("accounts")
        .select(
          "id, username, login_email, user_type, status, role_id, role:roles(name)",
        )
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("username", { ascending: true });
      const rows = ((data as Array<Record<string, unknown>>) ?? []).map((r) => {
        const role = r.role as { name?: string } | { name?: string }[] | null;
        const roleName = Array.isArray(role) ? role[0]?.name ?? null : role?.name ?? null;
        return {
          id: r.id as string,
          username: r.username as string,
          login_email: r.login_email as string,
          user_type: r.user_type as string,
          status: r.status as string,
          role_id: r.role_id as string | null,
          role_name: roleName,
        };
      });
      setAccounts(rows);
    })();
  }, [open, bootstrap?.auth?.tenant_id, accounts.length]);

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

  async function handlePick(targetId: string) {
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
      /* Hard reload so every cached fetch is re-issued under the
         target user's identity. */
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "view-as failed");
      setBusy(false);
    }
  }

  if (!isSuperAdmin) return null;
  /* If already viewing-as, hide the picker — the banner's "Exit" is
     the only way out so the user can't accidentally chain view-as. */
  if (bootstrap?.viewingAs) return null;

  const filtered = search.trim()
    ? accounts.filter((a) => {
        const s = search.toLowerCase();
        return (
          a.username.toLowerCase().includes(s) ||
          a.login_email.toLowerCase().includes(s) ||
          (a.role_name ?? "").toLowerCase().includes(s)
        );
      })
    : accounts;

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
        title="Super Admin — view the system as another user"
      >
        <UsersIcon size={13} className="shrink-0" />
        <span className="max-w-[120px] truncate hidden sm:inline">View as</span>
        <AngleDownIcon size={11} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          className={`absolute right-0 top-11 z-50 min-w-[320px] rounded-xl border shadow-2xl overflow-hidden ${
            dk ? "bg-[#141414] border-white/10" : "bg-white border-black/10"
          }`}
        >
          <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${dk ? "text-white/50" : "text-black/50"}`}>
            View as user
          </div>
          <div className={`px-2 pb-2 border-b ${dk ? "border-white/[0.06]" : "border-black/[0.06]"}`}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, role…"
              className={`w-full h-8 px-2.5 rounded-md border text-[12px] outline-none ${
                dk
                  ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/35"
                  : "bg-black/[0.03] border-black/[0.08] text-black placeholder:text-black/40"
              }`}
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className={`px-3 py-4 text-[12px] ${dk ? "text-white/45" : "text-black/45"}`}>
                {accounts.length === 0 ? "Loading users…" : "No matches"}
              </div>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handlePick(a.id)}
                  className={`w-full px-3 py-2.5 text-left flex items-center gap-2 transition-colors disabled:opacity-50 ${
                    dk ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.03]"
                  }`}
                >
                  <UsersIcon size={13} className={`shrink-0 ${dk ? "text-white/60" : "text-black/60"}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12.5px] font-semibold truncate ${dk ? "text-white" : "text-black"}`}>
                      {a.username}
                    </div>
                    <div className={`text-[10.5px] truncate ${dk ? "text-white/45" : "text-black/45"}`}>
                      {a.role_name ?? a.user_type} · {a.login_email}
                    </div>
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
