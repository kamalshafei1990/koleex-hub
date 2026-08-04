"use client";

/* Contacts is loaded dynamically, matching /customers and /suppliers.

   It imports `country-state-city` at module scope, whose city dataset is
   ~8 MB raw / 2.3 MB gzipped. A STATIC import here put that module in the
   eager graph, and because two routes referenced it the bundler hoisted it
   into a chunk the app shell pulls on every first load — measured 2,270 KB
   of the home page's 3,502 KB of JavaScript, for a dataset the home page
   never touches. */

import dynamic from "next/dynamic";

const Contacts = dynamic(() => import("@/components/contacts/Contacts"), {
  ssr: false,
  loading: () => (
    <div className="p-6 space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-[var(--bg-surface)] animate-pulse" />
      ))}
    </div>
  ),
});

export default function ContactsPage() {
  return <Contacts />;
}
