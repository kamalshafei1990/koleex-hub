"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import PermissionGate from "@/components/layout/PermissionGate";
import AppLoadingSkeleton from "@/components/ui/AppLoadingSkeleton";
import { shouldUseServerList } from "@/lib/server-list/suppliers-gate";
import { useMeBootstrap } from "@/lib/me-bootstrap";

/* Wave 2A.2 controlled internal rollout gate (mirrors Customers).
   Which Suppliers UI renders is decided by shouldUseServerList() using the
   TRUSTED, server-resolved cohort flag from /api/me/bootstrap
   (`suppliersServerList`) — never client-supplied identity. Precedence:
   ?serverlist=0 → legacy · ?serverlist=1 → server · cohort → server ·
   Preview host → server · else (production) → legacy.

   Cold-start correction (Phase 4 — Cold Start): both implementations are now
   `next/dynamic` so a cold launch downloads ONLY the selected chunk (the
   11.6k-line legacy Contacts is not bundled for server-list users; the
   server-list adapter is not bundled for legacy users), and we wait for the
   trusted cohort flag before mounting either — no legacy→server double render,
   no double list request. */
const Contacts = dynamic(() => import("@/components/contacts/Contacts"), {
  loading: () => <AppLoadingSkeleton label="Loading Suppliers…" />,
});
const SuppliersServerList = dynamic(
  () => import("@/components/suppliers/SuppliersServerList"),
  { loading: () => <AppLoadingSkeleton label="Loading Suppliers…" /> },
);

function decide(inCohort: boolean): boolean {
  if (typeof window === "undefined") return false;
  return shouldUseServerList(window.location.hostname, window.location.search, inCohort);
}

export default function SuppliersPage() {
  const { data, loading } = useMeBootstrap();
  const [mode, setMode] = useState<null | "legacy" | "server">(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (loading) return; // wait for the trusted cohort flag before deciding/telemetry
    const inCohort = data?.suppliersServerList === true;
    const sl = decide(inCohort);
    setMode(sl ? "server" : "legacy");
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
      {mode === null ? (
        <AppLoadingSkeleton label="Loading Suppliers…" />
      ) : mode === "server" ? (
        <SuppliersServerList />
      ) : (
        <Contacts filterType="supplier" />
      )}
    </PermissionGate>
  );
}
