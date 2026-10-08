"use client";

/* ---------------------------------------------------------------------------
   usePrefSlice — one instant-save preferences slice (display, notifications…)
   for a Settings tab. Settings audit, 29/09/2026.

   What each tab used to do, and what went wrong:
     · it sent its WHOLE local copy of the slice, so a stale copy put back
       what another screen had just changed (Region vs. Display both own
       `display`; the bell's pause lives in `notifications`);
     · it ignored a failed save — the switch stayed flipped, nothing said so,
       and the next refresh quietly flipped it back;
     · it stopped following the account after any change it had not made
       itself (the JSON-equality guard never "caught up" once a pause landed).

   Now: only the fields the person changed are sent (the server merges them
   into the stored slice — account_prefs_merge_nested); fields still being
   saved stay as chosen while everything else follows the account; and a
   failed save puts the old values back and raises `failed` for the tab to
   show.
   --------------------------------------------------------------------------- */

import { useState } from "react";

export function usePrefSlice<T extends object>(
  incoming: T,
  save: (changed: Partial<T>) => Promise<boolean>,
  apply?: (value: T) => void,
): { value: T; patch: (next: Partial<T>) => void; failed: boolean } {
  const [value, setValue] = useState<T>(incoming);
  const [pending, setPending] = useState<Partial<T>>({});
  const [failed, setFailed] = useState(false);

  /* Follow the account when it changes — during render, not in an effect, so
     there is no frame showing the old value. Fields still in flight keep the
     person's choice until the account carries it. */
  const json = JSON.stringify(incoming);
  const [seen, setSeen] = useState(json);
  if (json !== seen) {
    setSeen(json);
    const keys = Object.keys(pending) as (keyof T)[];
    const stillPending: Partial<T> = {};
    for (const k of keys) if (incoming[k] !== pending[k]) stillPending[k] = pending[k];
    if (keys.length > 0) setPending(stillPending);
    setValue({ ...incoming, ...stillPending });
  }

  const patch = (next: Partial<T>) => {
    const before: Partial<T> = {};
    for (const k of Object.keys(next) as (keyof T)[]) before[k] = value[k];
    const merged = { ...value, ...next };
    setValue(merged);
    setPending((p) => ({ ...p, ...next }));
    setFailed(false);
    apply?.(merged);
    void save(next).then((ok) => {
      if (ok) return;
      setPending((p) => {
        const rest = { ...p };
        for (const k of Object.keys(next) as (keyof T)[]) delete rest[k];
        return rest;
      });
      setValue((cur) => {
        const restored = { ...cur, ...before };
        apply?.(restored);
        return restored;
      });
      setFailed(true);
    });
  };

  return { value, patch, failed };
}
