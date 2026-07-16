"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import PermissionGate from "@/components/layout/PermissionGate";
import AppLoadingSkeleton from "@/components/ui/AppLoadingSkeleton";
import { shouldUseServerList } from "@/lib/server-list/customers-gate";
import { useMeBootstrap } from "@/lib/me-bootstrap";

/* Wave 2A.1 controlled internal rollout gate.
   Which Customers UI renders is decided by shouldUseServerList() using the
   TRUSTED, server-resolved cohort flag from /api/me/bootstrap
   (`customersServerList`) — never client-supplied identity. Precedence:
   ?serverlist=0 → legacy · ?serverlist=1 → server · cohort → server ·
   Preview host → server · else (production) → legacy.

   Cold-start correction (Phase 4 — Cold Start): the two implementations are
   now `next/dynamic` so a cold launch downloads ONLY the selected chunk — the
   11.6k-line legacy Contacts is no longer bundled into the /customers route
   for server-list users, and the server-list adapter is no longer bundled for
   legacy (production) users. We also wait for the trusted cohort flag before
   mounting EITHER implementation, so there is no legacy→server double render
   and no double list request. The route loading.tsx + the skeleton below cover
   the brief bootstrap-resolve window (bootstrap is warm-started from
   localStorage, so this is near-instant on a warm reload). */
const Contacts = dynamic(() => import("@/components/contacts/Contacts"), {
  loading: () => <AppLoadingSkeleton label="Loading Customers…" />,
});
const CustomersServerList = dynamic(
  () => import("@/components/customers/CustomersServerList"),
  { loading: () => <AppLoadingSkeleton label="Loading Customers…" /> },
);

function decide(inCohort: boolean): boolean {
  if (typeof window === "undefined") return false;
  return shouldUseServerList(window.location.hostname, window.location.search, inCohort);
}

export default function CustomersPage() {
  const { data, loading } = useMeBootstrap();
  /* null = undecided (bootstrap not yet resolved) → show skeleton, mount
     NEITHER implementation. Precedence + ?serverlist=0/1 behaviour is
     unchanged (decide() is identical). */
  const [mode, setMode] = useState<null | "legacy" | "server">(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (loading) return; // wait for the trusted cohort flag before deciding/telemetry
    const inCohort = data?.customersServerList === true;
    const sl = decide(inCohort);
    setMode(sl ? "server" : "legacy");
    if (!firedRef.current) {
      firedRef.current = true;
      const eventType = sl ? "customers_server_list_open" : "customers_legacy_list_open";
      try {
        const body = JSON.stringify({ eventType, route: "/customers" });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/activity/track", new Blob([body], { type: "application/json" }));
        } else {
          void fetch("/api/activity/track", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body }).catch(() => {});
        }
      } catch { /* telemetry is best-effort */ }
    }
  }, [loading, data]);

  return (
    <PermissionGate module="Customers">
      {mode === null ? (
        <AppLoadingSkeleton label="Loading Customers…" />
      ) : mode === "server" ? (
        <CustomersServerList />
      ) : (
        <Contacts filterType="customer" />
      )}
    </PermissionGate>
  );
}
