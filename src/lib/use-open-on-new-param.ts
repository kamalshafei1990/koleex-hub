"use client";

/* ---------------------------------------------------------------------------
   useOpenOnNewParam — `?new=1` on an app's URL opens its create form.

   Smart Create (and the Data Entry hub) link to `/<app>?new=1`. Before this
   hook almost no app read the param, so those links landed on the list and
   the operator had to find the "New" button themselves.

   `?create=1` is accepted too — the Inventory and Purchase screens already
   link that way (Purchase home's "+" goes to /purchase/orders?create=1).

   Fires ONCE per mount, then strips the param from the URL with replaceState
   so a refresh or Back does not reopen the form. `ready` lets an app wait
   until whatever the form needs has loaded.

   Already on the page? A push to the same path does not remount it, so the
   param would never be read. Smart Create dispatches OPEN_NEW_EVENT with the
   path instead (requestOpenNew), and the mounted page opens its form.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";

export const OPEN_NEW_EVENT = "koleex:open-new";

/** Ask the page mounted at `pathname` to open its create form. */
export function requestOpenNew(pathname: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_NEW_EVENT, { detail: pathname }));
}

export function useOpenOnNewParam(open: () => void, ready = true): void {
  const done = useRef(false);
  const openRef = useRef(open);
  const readyRef = useRef(ready);
  useEffect(() => {
    openRef.current = open;
    readyRef.current = ready;
  });

  useEffect(() => {
    if (done.current || !ready) return;
    const url = new URL(window.location.href);
    const key = url.searchParams.get("new") === "1" ? "new" : url.searchParams.get("create") === "1" ? "create" : null;
    if (!key) return;
    done.current = true;
    url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    openRef.current();
  }, [ready]);

  useEffect(() => {
    const onRequest = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== window.location.pathname) return;
      if (readyRef.current) openRef.current();
    };
    window.addEventListener(OPEN_NEW_EVENT, onRequest);
    return () => window.removeEventListener(OPEN_NEW_EVENT, onRequest);
  }, []);
}
