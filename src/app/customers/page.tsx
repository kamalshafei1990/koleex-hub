"use client";
import { useEffect, useRef, useState } from "react";
import Contacts from "@/components/contacts/Contacts";
import CustomersServerList from "@/components/customers/CustomersServerList";
import PermissionGate from "@/components/layout/PermissionGate";
import { shouldUseServerList } from "@/lib/server-list/customers-gate";
import { useMeBootstrap } from "@/lib/me-bootstrap";

/* Wave 2A.1 controlled internal rollout gate.
   Which Customers UI renders is decided by shouldUseServerList() using the
   TRUSTED, server-resolved cohort flag from /api/me/bootstrap
   (`customersServerList`) — never client-supplied identity. Precedence:
   ?serverlist=0 → legacy · ?serverlist=1 → server · cohort → server ·
   Preview host → server · else (production) → legacy.

   Renders legacy until the bootstrap flag is known, so production
   (non-cohort) never flashes anything different. One privacy-safe mode-open
   telemetry event is recorded per route session (no customer/search data). */
function decide(inCohort: boolean): boolean {
  if (typeof window === "undefined") return false;
  return shouldUseServerList(window.location.hostname, window.location.search, inCohort);
}

export default function CustomersPage() {
  const { data, loading } = useMeBootstrap();
  const [serverList, setServerList] = useState(false); // default legacy → prod unchanged
  const firedRef = useRef(false);

  useEffect(() => {
    if (loading) return; // wait for the trusted cohort flag before deciding/telemetry
    const inCohort = data?.customersServerList === true;
    const sl = decide(inCohort);
    setServerList(sl);
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
      {serverList ? <CustomersServerList /> : <Contacts filterType="customer" />}
    </PermissionGate>
  );
}
