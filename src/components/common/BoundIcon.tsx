"use client";

/* ---------------------------------------------------------------------------
   BoundIcon — render a semantic icon from the Semantic Icon Registry, with
   the code-icon as fallback. Every surface (launcher, sidebar, settings)
   resolves the same map, so binding app.discuss in Database › Visual
   Library re-skins Discuss everywhere within a minute. No binding → the
   original code icon keeps rendering, so the system can never lose an icon.
   --------------------------------------------------------------------------- */

import { useEffect, useState, type ReactNode } from "react";
import { fetchIconBindings, getIconBindingSync } from "@/lib/visual-bindings";

export default function BoundIcon({
  semanticKey, fallback, className = "h-6 w-6",
}: {
  semanticKey: string;
  fallback: ReactNode;
  className?: string;
}) {
  /* First render already resolves through the warm-started mirror — this
     is what killed the visible fallback→registry icon swap the owner saw
     on every page load ("two layers"). The effect below only refreshes
     when the binding actually changed. */
  const [url, setUrl] = useState<string | undefined>(() => getIconBindingSync(semanticKey));
  useEffect(() => {
    let alive = true;
    fetchIconBindings()
      .then((m) => {
        if (!alive) return;
        const next = m[semanticKey];
        setUrl((prev) => (prev === next ? prev : next));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [semanticKey]);

  if (!url) return <>{fallback}</>;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ maskImage: `url("${url}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain", WebkitMaskImage: `url("${url}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain" }}
    />
  );
}
