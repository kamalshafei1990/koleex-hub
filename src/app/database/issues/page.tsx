"use client";

/* Legacy route — Issue Reports moved OUT of the Database app to /issues.
   Kept only as a redirect so old notification deep-links (?issue=…) and
   bookmarks keep working. */

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Redirector() {
  const router = useRouter();
  const sp = useSearchParams();
  useEffect(() => {
    const q = sp.toString();
    router.replace(q ? `/issues?${q}` : "/issues");
  }, [router, sp]);
  return null;
}

export default function LegacyIssuesRedirect() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}
