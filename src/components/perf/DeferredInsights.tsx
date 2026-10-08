"use client";

/* ---------------------------------------------------------------------------
   Vercel Speed Insights + Web Analytics, loaded once the page has finished
   fetching instead of in every page's first download.

   Speed Insights — real-user Core Web Vitals (LCP/INP/CLS) with P75
   percentiles per route; sends only performance timings + normalized route
   names, no user content. Web Analytics — WHO is using the Hub from WHERE
   (the question it exists to answer: "would a server closer to mainland
   China change anything?"); cookieless, route + country + device class +
   referrer, never a user id, name, form value or content. Both scripts are
   served from THIS origin (/_vercel/insights), so they load wherever the Hub
   loads, mainland China included. Dashboards: Vercel → project → Speed
   Insights / Analytics (enable once, owner-side).

   Deferred because nothing on screen needs them (~7 KB of code on every cold
   load, measured 25/09/2026) — until after the load event and a quiet
   network. The vitals library reads the browser's
   BUFFERED performance entries, so loading after first paint still reports
   the first paint; the page view is sent when the script arrives.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { whenNetworkQuiet, whenPageLoaded } from "@/lib/net-idle";

const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights), { ssr: false });
const Analytics = dynamic(() => import("@vercel/analytics/next").then((m) => m.Analytics), { ssr: false });

export default function DeferredInsights() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    /* After the load event, not just after the fetches: a script started
       before `load` holds the load event open until it arrives. */
    void whenPageLoaded().then(() => whenNetworkQuiet()).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  if (!ready) return null;
  return (
    <>
      <SpeedInsights />
      <Analytics />
    </>
  );
}
