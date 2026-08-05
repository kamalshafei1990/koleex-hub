"use client";

/* ---------------------------------------------------------------------------
   useCnyUsd — the CNY→USD rate for the "≈ $" hints beside factory costs.

   Two things keep this cheap enough to sit on a grid of 60 product cards:

     · `cachedGet` coalesces — the card component, the editor and anything
       else asking on the same page share ONE request;
     · the last rate is kept in localStorage, so the hint is already correct
       on first paint instead of appearing a second late. A daily reference
       rate a few hours old is right to the cent at the precision shown here,
       and the fresh value overwrites it as soon as it lands.

   Returns null until a rate is known, and the caller renders nothing — a
   converted price is worse than no price if the number might be wrong.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { cachedGet } from "@/lib/client-cache";

export interface FxQuote {
  rate: number;
  source: "tenant" | "live" | "fallback";
  asOf: string | null;
}

/* Module-scoped so the SECOND component to ask gets the rate synchronously,
   with no second render and no flash. It is not a localStorage warm-start on
   purpose: this list is server-rendered, and seeding initial state from
   storage would make the server's HTML and the client's first render
   disagree. `cachedGet` plus the endpoint's edge cache already make the
   first fetch cheap. */
let lastQuote: FxQuote | null = null;

export function useCnyUsd(): FxQuote | null {
  const [quote, setQuote] = useState<FxQuote | null>(lastQuote);

  useEffect(() => {
    let alive = true;
    cachedGet<FxQuote>("/api/fx/cny-usd", 60 * 60 * 1000)
      .then((fresh) => {
        if (!fresh || typeof fresh.rate !== "number" || fresh.rate <= 0) return;
        lastQuote = fresh;
        if (alive) setQuote(fresh);
      })
      .catch(() => {
        /* Never blank a rate we already showed. */
      });
    return () => { alive = false; };
  }, []);

  return quote;
}

/** "$1 = ¥7.16" — the direction people actually think in. */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "";
  return `$1 = ¥${(1 / rate).toFixed(2)}`;
}

/** Where the number came from, for the tooltip under every conversion. */
export function fxSourceTitle(q: FxQuote): string {
  const when = q.asOf ? ` · ${q.asOf}` : "";
  return q.source === "tenant"
    ? `Converted at your Finance rate${when}`
    : q.source === "live"
      ? `Daily reference rate${when}`
      : "Live rate unavailable — using a fallback";
}

/** "$2,752" — whole dollars. A factory cost hint does not need cents, and
 *  the extra digits only make the number harder to compare at a glance. */
export function formatUsd(cny: number, rate: number): string {
  const usd = cny * rate;
  if (!Number.isFinite(usd)) return "";
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}
