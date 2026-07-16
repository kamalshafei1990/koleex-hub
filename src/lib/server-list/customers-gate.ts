/* Pure decision for the Wave 2A.1 Customers preview gate — unit-testable
   (no window). Production hosts (koleexgroup.com) ALWAYS get legacy unless an
   explicit ?serverlist=1 override is present; ?serverlist=0 forces legacy. */
export function shouldUseServerList(hostname: string, search: string): boolean {
  const sp = new URLSearchParams(search || "");
  const override = sp.get("serverlist");
  if (override === "1") return true;
  if (override === "0") return false;
  const isProd = hostname === "hub.koleexgroup.com" || hostname.endsWith(".koleexgroup.com");
  return !isProd;
}
