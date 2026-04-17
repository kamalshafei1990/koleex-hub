"use client";

/* ---------------------------------------------------------------------------
   TenantPicker — top-bar dropdown for Super Admin only.

   Renders a compact picker that lets a Super Admin "view as" another tenant
   without logging out. The picked tenant id is stored in localStorage as
   `koleex.sa.active_tenant_id`; loadScopeContext() reads this override on
   every page load so subsequent queries are scoped to the picked tenant.

   For non-SA users this component returns null — regular accounts are
   always locked to their own tenant.

   Switching tenants does a hard reload so every in-memory fetch is
   re-run against the new tenant_id.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentAccountIdSync } from "@/lib/identity";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  is_host: boolean;
}

const TENANT_OVERRIDE_KEY = "koleex.sa.active_tenant_id";

/** Read the SA tenant override from localStorage. Returns null when no
 *  override is set — loadScopeContext then falls back to the account's
 *  own tenant_id. */
export function readTenantOverride(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TENANT_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

/** Set / clear the SA tenant override. Only callable client-side. */
export function setTenantOverride(tenantId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (tenantId === null) {
      window.localStorage.removeItem(TENANT_OVERRIDE_KEY);
    } else {
      window.localStorage.setItem(TENANT_OVERRIDE_KEY, tenantId);
    }
  } catch {
    // ignore storage failures
  }
}

export default function TenantPicker({ dk }: { dk: boolean }) {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [accountTenantId, setAccountTenantId] = useState<string | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /* ── Load tenants + SA check on mount ── */
  useEffect(() => {
    const accountId = getCurrentAccountIdSync();
    if (!accountId) return;
    (async () => {
      // Check if viewer is SA (role or account level)
      const { data: acc } = await supabaseAdmin
        .from("accounts")
        .select(
          "tenant_id, is_super_admin, roles:role_id(is_super_admin)",
        )
        .eq("id", accountId)
        .maybeSingle();
      const accData = acc as {
        tenant_id: string;
        is_super_admin: boolean;
        roles?:
          | { is_super_admin: boolean }
          | { is_super_admin: boolean }[]
          | null;
      } | null;
      const roleRaw = accData?.roles;
      const role = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw ?? null;
      const sa =
        (accData?.is_super_admin ?? false) || (role?.is_super_admin ?? false);
      setIsSuperAdmin(sa);
      setAccountTenantId(accData?.tenant_id ?? null);

      if (!sa) return; // Non-SA users don't see the picker

      // Load tenant list
      const { data: t } = await supabaseAdmin
        .from("tenants")
        .select("id, slug, name, is_host")
        .eq("active", true)
        .order("is_host", { ascending: false })
        .order("name", { ascending: true });
      setTenants((t as TenantRow[]) ?? []);

      // Apply current override or fall back to account tenant
      const override = readTenantOverride();
      setActiveTenantId(override ?? accData?.tenant_id ?? null);
    })();
  }, []);

  /* ── Close on outside click ── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  /* ── Handle tenant switch ── */
  function handlePick(tenantId: string) {
    // If picking your own account's tenant, clear the override so
    // loadScopeContext goes back to the natural default.
    if (tenantId === accountTenantId) {
      setTenantOverride(null);
    } else {
      setTenantOverride(tenantId);
    }
    // Hard reload so every in-memory state is rebuilt with the new tenant.
    window.location.reload();
  }

  // Render nothing for non-SA. Render nothing if only one tenant exists
  // (no point in a picker).
  if (!isSuperAdmin) return null;
  if (tenants.length < 2) return null;

  const active = tenants.find((t) => t.id === activeTenantId) ?? null;

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
        title="Super Admin tenant picker — switch between tenants"
      >
        <Building2Icon size={13} className="shrink-0" />
        <span className="max-w-[140px] truncate">
          {active?.name ?? "Pick tenant"}
        </span>
        {active?.is_host && (
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
              dk ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-500/15 text-emerald-700"
            }`}
          >
            Host
          </span>
        )}
        <AngleDownIcon size={11} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          className={`absolute right-0 top-11 z-50 min-w-[240px] rounded-xl border shadow-2xl overflow-hidden ${
            dk
              ? "bg-[#141414] border-white/10"
              : "bg-white border-black/10"
          }`}
        >
          <div
            className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
              dk ? "text-white/50" : "text-black/50"
            }`}
          >
            Viewing as tenant
          </div>
          {tenants.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handlePick(t.id)}
              className={`w-full px-3 py-2.5 text-left flex items-center gap-2 transition-colors ${
                t.id === activeTenantId
                  ? dk
                    ? "bg-white/[0.08]"
                    : "bg-black/[0.05]"
                  : dk
                    ? "hover:bg-white/[0.04]"
                    : "hover:bg-black/[0.03]"
              }`}
            >
              <Building2Icon
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
                  {t.name}
                </div>
                <div
                  className={`text-[10.5px] font-mono truncate ${
                    dk ? "text-white/45" : "text-black/45"
                  }`}
                >
                  {t.slug}
                  {t.is_host && " · host"}
                </div>
              </div>
              {t.id === activeTenantId && (
                <CheckIcon
                  size={13}
                  className={dk ? "text-emerald-400" : "text-emerald-600"}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
