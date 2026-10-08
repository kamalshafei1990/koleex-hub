"use client";

/* Contacts is loaded dynamically, matching /customers and /suppliers.

   It imports `country-state-city` at module scope, whose city dataset is
   ~8 MB raw / 2.3 MB gzipped. A STATIC import here put that module in the
   eager graph, and because two routes referenced it the bundler hoisted it
   into a chunk the app shell pulls on every first load — measured 2,270 KB
   of the home page's 3,502 KB of JavaScript, for a dataset the home page
   never touches. */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";
import { shouldUseServerList } from "@/lib/server-list/contacts-gate";
import { useMeBootstrap } from "@/lib/me-bootstrap";

/* Wave 2A controlled internal rollout gate (mirrors Customers + Suppliers).
   Which Contacts UI renders is decided by shouldUseServerList() using the
   TRUSTED, server-resolved cohort flag from /api/me/bootstrap
   (`contactsServerList`) — never client-supplied identity. Precedence:
   ?serverlist=0 → legacy · ?serverlist=1 → server · cohort → server ·
   Preview host → server · else (production) → legacy.

   Both implementations are `next/dynamic` so a cold launch downloads ONLY the
   selected chunk (the 11.6k-line legacy Contacts is not bundled for server-list
   users; the server-list adapter is not bundled for legacy users), and we wait
   for the trusted cohort flag before mounting either — no double render. */
const Contacts = dynamic(() => import("@/components/contacts/Contacts"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading contacts…" />,
});
const ContactsServerList = dynamic(
  () => import("@/components/contacts/ContactsServerList"),
  { ssr: false, loading: () => <DirectoryListSkeleton label="Loading contacts…" /> },
);

function decide(inCohort: boolean): boolean {
  if (typeof window === "undefined") return false;
  return shouldUseServerList(window.location.hostname, window.location.search, inCohort);
}

export default function ContactsPage() {
  const { data, loading } = useMeBootstrap();
  const [mode, setMode] = useState<null | "legacy" | "server">(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (loading) return; // wait for the trusted cohort flag before deciding/telemetry
    const inCohort = data?.contactsServerList === true;
    const sl = decide(inCohort);
    let keep = true;
    queueMicrotask(() => { if (keep) setMode(sl ? "server" : "legacy"); });
    if (!firedRef.current) {
      firedRef.current = true;
      const eventType = sl ? "contacts_server_list_open" : "contacts_legacy_list_open";
      try {
        const body = JSON.stringify({ eventType, route: "/contacts" });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/activity/track", new Blob([body], { type: "application/json" }));
        } else {
          void fetch("/api/activity/track", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body }).catch(() => {});
        }
      } catch { /* telemetry is best-effort */ }
    }
    return () => { keep = false; };
  }, [loading, data]);

  return mode === null ? (
    <DirectoryListSkeleton label="Loading contacts…" />
  ) : mode === "server" ? (
    <ContactsServerList />
  ) : (
    <Contacts />
  );
}
