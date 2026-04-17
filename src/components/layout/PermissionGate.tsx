"use client";

/* ---------------------------------------------------------------------------
   PermissionGate — wrap any page with this to enforce role-based access.

     <PermissionGate module="CRM">
       <CRMPage />
     </PermissionGate>

   Rules:
     - While ScopeContext + permission are resolving → minimal loading UI
     - Super Admin → always passes
     - Non-SA without can_view on the module → "No access" page
     - Non-SA with can_view = true → children render
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { usePermission } from "@/lib/use-scope";
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
  const { allowed, loading, ctx } = usePermission(module);

  if (loading || !ctx) {
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
