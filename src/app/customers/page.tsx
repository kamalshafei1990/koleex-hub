"use client";
import { useEffect, useState } from "react";
import Contacts from "@/components/contacts/Contacts";
import CustomersServerList from "@/components/customers/CustomersServerList";
import PermissionGate from "@/components/layout/PermissionGate";
import { shouldUseServerList } from "@/lib/server-list/customers-gate";

/* Wave 2A.1 PREVIEW gate.
   The server-list Customers UI is enabled ONLY on non-production hosts (Vercel
   Preview *.vercel.app) or with an explicit `?serverlist=1`. It defaults to the
   unchanged legacy Contacts UI and flips only AFTER mount, so PRODUCTION
   (hub.koleexgroup.com) never renders anything different and never flashes —
   the effect finds a production host and leaves `serverList` false.
   `?serverlist=0` forces legacy anywhere. Rollback = merge nothing / delete the
   branch; the endpoint + hook are untouched by disabling this gate. */
function decideServerList(): boolean {
  if (typeof window === "undefined") return false;
  return shouldUseServerList(window.location.hostname, window.location.search);
}

export default function CustomersPage() {
  const [serverList, setServerList] = useState(false); // default legacy → prod unchanged
  useEffect(() => { setServerList(decideServerList()); }, []);
  return (
    <PermissionGate module="Customers">
      {serverList ? <CustomersServerList /> : <Contacts filterType="customer" />}
    </PermissionGate>
  );
}
