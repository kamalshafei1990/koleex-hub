"use client";

/* Dev-only gate for the performance panel. `process.env.NODE_ENV` is inlined
   at build time, so in production the dynamic import below is dead code —
   the panel contributes ZERO bytes to production bundles and can never render
   for real users. */

import dynamic from "next/dynamic";

const Panel =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("./PerfPanel"), { ssr: false })
    : null;

export default function PerfPanelGate() {
  return Panel ? <Panel /> : null;
}
