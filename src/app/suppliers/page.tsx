"use client";
import { useEffect, useRef, useState } from "react";
import Contacts from "@/components/contacts/Contacts";
import SuppliersServerList from "@/components/suppliers/SuppliersServerList";
import PermissionGate from "@/components/layout/PermissionGate";
import { shouldUseServerList } from "@/lib/server-list/suppliers-gate";
import { useMeBootstrap } from "@/lib/me-bootstrap";

/* Wave 2A.2 controlled internal rollout gate (mirrors Customers).
   Which Suppliers UI renders is decided by shouldUseServerList() using the
   TRUSTED, server-resolved cohort flag from /api/me/bootstrap
   (`suppliersServerList`) — never client-supplied identity. Precedence:
   ?serverlist=0 → legacy · ?serverlist=1 → server · cohort → server ·
   Preview host → server · else (production) → legacy.

   Renders legacy until the bootstrap flag is known, so production
   (non-cohort) never flashes anything different. One privacy-safe mode-open
   telemetry event per route session (no supplier/search data). */
function decide(inCohort: boolean): boolean {
  if (typeof window === "undefined") return false;
  return shouldUseServerList(window.location.hostname, window.location.search, inCohort);
}

export default function SuppliersPage() {
  const { data, loading } = useMeBootstrap();
  const [serverList, setServerList] = useState(false); // default legacy → prod unchanged
  const firedRef = useRef(false);

  useEffect(() => {
    if (loading) return; // wait for the trusted cohort flag before deciding/telemetry
    const inCohort = data?.suppliersServerList === true;
    const sl = decide(inCohort);
    setServerList(sl);
    if (!firedRef.current) {
      firedRef.current = true;
      const eventType = sl ? "suppliers_server_list_open" : "suppliers_legacy_list_open";
      try {
        const body = JSON.stringify({ eventType, route: "/suppliers" });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/activity/track", new Blob([body], { type: "application/json" }));
        } else {
          void fetch("/api/activity/track", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body }).catch(() => {});
        }
      } catch { /* telemetry is best-effort */ }
    }
  }, [loading, data]);

  return (
    <PermissionGate module="Suppliers">
      {serverList ? <SuppliersServerList /> : <Contacts filterType="supplier" />}
    </PermissionGate>
  );
}
