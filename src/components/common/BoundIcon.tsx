"use client";

/* ---------------------------------------------------------------------------
   BoundIcon — render a semantic icon from the Semantic Icon Registry, with
   the code-icon as fallback. Every surface (launcher, sidebar, settings)
   resolves the same map, so binding app.discuss in Database › Visual
   Library re-skins Discuss everywhere within a minute. No binding → the
   original code icon keeps rendering, so the system can never lose an icon.
   --------------------------------------------------------------------------- */

import { useEffect, useState, type ReactNode } from "react";
import { fetchIconBindings } from "@/lib/visual-bindings";

let SNAP: Record<string, string> = {};

export default function BoundIcon({
  semanticKey, fallback, className = "h-6 w-6",
}: {
  semanticKey: string;
  fallback: ReactNode;
  className?: string;
}) {
  const [url, setUrl] = useState<string | undefined>(() => SNAP[semanticKey]);
  useEffect(() => {
    let alive = true;
    fetchIconBindings()
      .then((m) => { SNAP = m; if (alive) setUrl(m[semanticKey]); })
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
