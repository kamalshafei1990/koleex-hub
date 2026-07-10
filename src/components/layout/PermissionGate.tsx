"use client";

/* ---------------------------------------------------------------------------
   PermissionGate — wrap any page with this to enforce role-based access.

     <PermissionGate module="CRM">
       <CRMPage />
     </PermissionGate>

   Rules:
     - While ScopeContext + permission are resolving → minimal loading UI
     - Bootstrap FAILED to load (timeout / network) → "couldn't load — retry"
       (never the misleading "no access": a real no-permission user always
       receives a payload, so a missing payload only ever means a load failure)
     - Super Admin → always passes
     - Non-SA without can_view on the module → "No access" page
     - Non-SA with can_view = true → children render
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePermission } from "@/lib/use-scope";
import { retryMeBootstrap } from "@/lib/me-bootstrap";
import LockIcon from "@/components/icons/ui/LockIcon";

export default function PermissionGate({
  module,
  children,
  fallback,
}: {
  /** Module name as stored in koleex_permissions (case-sensitive). */
  module: string;
  children: React.ReactNode;
  /** Optional custom fallback shown when denied. Defaults to a generic
   *  "no access" card with a link back to the dashboard. */
  fallback?: React.ReactNode;
}) {
  const { allowed, loading, failed, ctx } = usePermission(module);
  const [retrying, setRetrying] = useState(false);
  const autoRetried = useRef(false);

  const doRetry = () => {
    setRetrying(true);
    void retryMeBootstrap().finally(() => setRetrying(false));
  };

  // Self-heal: the first time a load failure appears (e.g. a cold Tokyo
  // server or a brief network blip), silently retry once before bothering
  // the operator with the Retry card.
  useEffect(() => {
    if (failed && !autoRetried.current) {
      autoRetried.current = true;
      doRetry();
    }
    if (!failed) autoRetried.current = false;
  }, [failed]);

  // Loading — either the permission check is resolving, or a silent auto-retry
  // is in flight. Show the calm progress bar, not an error.
  if (loading || retrying) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-2 w-32 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
          <div className="h-full w-1/2 bg-[var(--bg-inverted)] animate-pulse" />
        </div>
      </div>
    );
  }

  // Bootstrap couldn't load (timeout / network / server cold start). This is
  // NOT a permission denial — offer a Retry instead of scaring the user with
  // "you don't have access".
  if (failed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center mb-4">
            <div className="h-2 w-8 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
              <div className="h-full w-1/2 bg-[var(--text-dim)] animate-pulse" />
            </div>
          </div>
          <h1 className="text-[18px] font-bold text-[var(--text-primary)] mb-2">
            Couldn&rsquo;t load {module}
          </h1>
          <p className="text-[13px] text-[var(--text-dim)] leading-relaxed mb-5">
            The connection to the server timed out — this is usually a slow
            network or the server waking up. Your access is fine; just try again.
          </p>
          <button
            type="button"
            onClick={doRetry}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-2 w-32 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
          <div className="h-full w-1/2 bg-[var(--bg-inverted)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <>
        {fallback ?? (
          <div className="min-h-[60vh] flex items-center justify-center px-6">
            <div className="max-w-md w-full text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/[0.1] border border-amber-500/20 flex items-center justify-center mb-4">
                <LockIcon className="h-6 w-6 text-amber-400" />
              </div>
              <h1 className="text-[18px] font-bold text-[var(--text-primary)] mb-2">
                You don&rsquo;t have access to {module}
              </h1>
              <p className="text-[13px] text-[var(--text-dim)] leading-relaxed mb-5">
                Your role doesn&rsquo;t include permission to view this
                module. Ask a Super Admin to adjust your role in
                <span className="font-mono text-[var(--text-muted)]"> /roles</span>{" "}
                if you need access.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}
