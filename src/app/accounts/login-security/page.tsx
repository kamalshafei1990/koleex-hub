"use client";

/* ---------------------------------------------------------------------------
   /accounts/login-security — Phase 2A · Security Center (A5 cutover).

   The redesigned Security Center is now the DEFAULT (the old engineering
   "Monitor" was retired at A5). READ-ONLY, super-admin only. Consumes
   GET /api/admin/login-analytics (S3b). Advisory analysis only:

     • NEVER enables enforcement, NEVER changes env vars.
     • NO "turn on enforce" control, NO mutations.
     • Production stays AUTH_RATELIMIT=observe.

   ?v=2 is now a harmless no-op (this IS v2). SecurityCenter reads its own
   ?tab= / ?ip= / ?identifier= deep-links, hence the Suspense boundary.
   --------------------------------------------------------------------------- */

import { Suspense } from "react";
import AuthGate from "@/components/admin/AuthGate";
import SecurityCenter from "@/components/security/SecurityCenter";

export default function LoginSecurityPage() {
  return (
    <AuthGate title="Login Security" subtitle="Observe-mode rate-limit analytics and enforcement readiness">
      <Suspense fallback={null}>
        <SecurityCenter />
      </Suspense>
    </AuthGate>
  );
}
