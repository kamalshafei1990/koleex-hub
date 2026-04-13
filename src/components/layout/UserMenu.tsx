"use client";

/* ---------------------------------------------------------------------------
   UserMenu — avatar + dropdown that replaces the static "KS" circle in
   MainHeader. Works in both auth modes:

     - Legacy (NEXT_PUBLIC_USE_SUPABASE_AUTH ≠ "true"):
         · Shows "KS" avatar + "Koleex Admin" identity
         · "Sign Out" clears sessionStorage["koleex-admin"] and hard-reloads,
           kicking the user back to the AdminAuth password gate.
         · "Sign In" opens the legacy password prompt (already rendered by
           AdminAuth on protected routes), so we just link to "/".

     - Supabase (flag on):
         · Reads the current user from auth-client.getCurrentUser()
         · Avatar initials derived from email or user_metadata.username
         · "Sign Out" calls auth-client.signOut() (which also writes the
           audit log entry + revokes the account_sessions row) then
           redirects to "/login".
         · "Sign In" → "/login?next=<current path>"

   Theme aware: uses the same dk/light branches as MainHeader.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SignInIcon from "@/components/icons/ui/SignInIcon";
import SignOutIcon from "@/components/icons/ui/SignOutIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import {
  getCurrentUser,
  isSupabaseAuthEnabled,
  onAuthStateChange,
  signOut as supabaseSignOut,
} from "@/lib/auth-client";
import { setCurrentAccountId, useCurrentAccount } from "@/lib/identity";
import {
  LEGACY_SESSION_KEY,
  LEGACY_SESSION_USER_KEY,
} from "@/components/admin/AdminAuth";

type Identity =
  | { mode: "supabase"; signedIn: true; email: string; username?: string }
  | { mode: "supabase"; signedIn: false }
  | { mode: "legacy"; signedIn: true }
  | { mode: "legacy"; signedIn: false };

function initialsFor(identity: Identity): string {
  if (identity.mode === "legacy") return "KS";
  if (!identity.signedIn) return "—";
  const source = identity.username || identity.email;
  const clean = source.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "KX";
}

function displayNameFor(identity: Identity): string {
  if (identity.mode === "legacy") {
    return identity.signedIn ? "Koleex Admin" : "Not signed in";
  }
  if (!identity.signedIn) return "Not signed in";
  return identity.username || identity.email;
}

function subLineFor(identity: Identity): string {
  if (identity.mode === "legacy") {
    return identity.signedIn ? "Legacy session" : "Password gate";
  }
  if (!identity.signedIn) return "Supabase session";
  return identity.email;
}

export default function UserMenu({ dk }: { dk: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState<Identity>(() =>
    isSupabaseAuthEnabled()
      ? { mode: "supabase", signedIn: false }
      : { mode: "legacy", signedIn: false },
  );
  const menuRef = useRef<HTMLDivElement>(null);

  /* Load the richer "current account" row so we can show the real person
     name, avatar, role, and user type — not just the stub initials. This
     resolves in both auth modes (see src/lib/identity.ts). */
  const { account } = useCurrentAccount();

  const profile = useMemo(() => {
    if (!account) return null;
    const avatar = account.avatar_url || account.person?.avatar_url || null;
    const fullName = account.person?.full_name || account.username;
    const subtitle = [
      account.user_type,
      account.role?.name,
    ]
      .filter(Boolean)
      .join(" · ");
    return { avatar, fullName, subtitle };
  }, [account]);

  /* Load initial identity + keep it in sync. */
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (isSupabaseAuthEnabled()) {
        const user = await getCurrentUser();
        if (cancelled) return;
        if (user?.email) {
          const username = (user.user_metadata?.username as string | undefined) ?? undefined;
          setIdentity({
            mode: "supabase",
            signedIn: true,
            email: user.email,
            username,
          });
        } else {
          setIdentity({ mode: "supabase", signedIn: false });
        }
      } else {
        const signedIn =
          typeof window !== "undefined" &&
          window.localStorage.getItem(LEGACY_SESSION_KEY) === "true";
        setIdentity({ mode: "legacy", signedIn });
      }
    }

    void refresh();

    /* Supabase: react to sign-in / sign-out events in this or other tabs. */
    if (isSupabaseAuthEnabled()) {
      const unsub = onAuthStateChange(() => {
        void refresh();
      });
      return () => {
        cancelled = true;
        unsub();
      };
    }

    /* Legacy: localStorage syncs across tabs via the "storage" event. We
       also refresh on focus to cover the "just logged in on another tab"
       case where the listener might not have fired yet. */
    function onFocus() {
      void refresh();
    }
    function onStorage(e: StorageEvent) {
      if (e.key === LEGACY_SESSION_KEY) void refresh();
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /* Close the dropdown when clicking outside. */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleSignIn = useCallback(() => {
    setOpen(false);
    if (identity.mode === "supabase") {
      const next = encodeURIComponent(pathname || "/");
      router.push(`/login?next=${next}`);
    } else {
      /* Legacy: the root is now gated by AdminAuth, so a plain reload
         brings up the username + password form. */
      window.location.href = "/";
    }
  }, [identity, pathname, router]);

  const handleSignOut = useCallback(async () => {
    setOpen(false);
    if (identity.mode === "supabase") {
      await supabaseSignOut();
      setIdentity({ mode: "supabase", signedIn: false });
      router.replace("/login");
      return;
    }
    /* Legacy — clear the client-side session flags, drop the stored
       "current account id" (so the next sign-in doesn't inherit the old
       identity), and bounce home so AdminAuth re-renders the login form. */
    try {
      window.localStorage.removeItem(LEGACY_SESSION_KEY);
      window.localStorage.removeItem(LEGACY_SESSION_USER_KEY);
    } catch {
      /* ignore */
    }
    setCurrentAccountId(null);
    setIdentity({ mode: "legacy", signedIn: false });
    /* Hard reload so the AuthGate re-mounts and shows the login form. */
    window.location.href = "/";
  }, [identity, router]);

  const avatarLabel = initialsFor(identity);
  const displayName = profile?.fullName ?? displayNameFor(identity);
  const subLine = profile?.subtitle ?? subLineFor(identity);
  const avatarUrl = profile?.avatar ?? null;
  const signedIn = identity.signedIn;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group flex items-center gap-2 rounded-full transition-all ${
          open ? "ring-2 ring-offset-2 ring-offset-transparent ring-white/20" : ""
        }`}
      >
        <span
          className={`flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-full overflow-hidden text-[10px] md:text-[12px] font-semibold transition-all ring-1 ${
            dk
              ? "bg-white text-black ring-white/20 group-hover:ring-white/40"
              : "bg-black text-white ring-black/15 group-hover:ring-black/30"
          }`}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            avatarLabel
          )}
        </span>
        {profile && (
          <span className="hidden md:flex flex-col items-start leading-tight pe-1">
            <span
              className={`text-[12px] font-semibold max-w-[140px] truncate tracking-tight ${
                dk ? "text-white" : "text-black"
              }`}
            >
              {profile.fullName}
            </span>
            <span
              className={`text-[10px] capitalize max-w-[140px] truncate ${
                dk ? "text-white/45" : "text-black/45"
              }`}
            >
              {profile.subtitle}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full end-0 mt-2 w-64 rounded-xl border shadow-2xl overflow-hidden z-50 ${
            dk
              ? "border-white/[0.08] bg-[#0f0f0f]"
              : "border-black/[0.08] bg-white"
          }`}
        >
          {/* Identity block */}
          <div className={`px-4 py-3.5 border-b ${dk ? "border-white/[0.06]" : "border-black/[0.06]"}`}>
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full overflow-hidden text-[12px] font-semibold shrink-0 ${
                  dk ? "bg-white text-black" : "bg-black text-white"
                }`}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  avatarLabel
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-[13px] font-semibold truncate ${dk ? "text-white" : "text-black"}`}>
                  {displayName}
                </div>
                <div className={`text-[11px] truncate capitalize ${dk ? "text-white/50" : "text-black/50"}`}>
                  {subLine}
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  identity.mode === "supabase"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                }`}
              >
                <ShieldIcon className="h-2.5 w-2.5" />
                {identity.mode === "supabase" ? "Supabase Auth" : "Legacy"}
              </span>
              {signedIn && (
                <span
                  className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    dk
                      ? "bg-white/[0.06] text-white/60 border border-white/[0.08]"
                      : "bg-black/[0.04] text-black/60 border border-black/[0.08]"
                  }`}
                >
                  Active
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            {!signedIn ? (
              <button
                type="button"
                onClick={handleSignIn}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  dk
                    ? "text-white/80 hover:text-white hover:bg-white/[0.04]"
                    : "text-black/80 hover:text-black hover:bg-black/[0.04]"
                }`}
              >
                <SignInIcon className="h-4 w-4" />
                Sign in
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!account}
                  onClick={() => {
                    if (!account) return;
                    setOpen(false);
                    router.push(`/accounts/${account.id}`);
                  }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                    account
                      ? dk
                        ? "text-white/80 hover:text-white hover:bg-white/[0.04]"
                        : "text-black/80 hover:text-black hover:bg-black/[0.04]"
                      : dk
                        ? "text-white/40 cursor-default"
                        : "text-black/40 cursor-default"
                  }`}
                  title={
                    account
                      ? "Open your account profile"
                      : "Profile unavailable — no linked account"
                  }
                >
                  <UserIcon className="h-4 w-4" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                    dk
                      ? "text-red-300 hover:text-red-200 hover:bg-red-500/[0.08]"
                      : "text-red-600 hover:text-red-700 hover:bg-red-500/[0.06]"
                  }`}
                >
                  <SignOutIcon className="h-4 w-4" />
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
