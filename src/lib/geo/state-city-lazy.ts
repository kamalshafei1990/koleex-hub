"use client";

/* ---------------------------------------------------------------------------
   state-city-lazy — on-demand loader for country-state-city's State/City.

   SYS-3: the library's city.json alone is 7.7 MB (states 544 KB). Importing
   { State, City } statically welds the world's city database onto whatever
   route chunk does it — /customers shipped ~2.7 MB of JS largely because of
   this. Country (96 KB) is cheap and stays a static import where needed;
   State/City load HERE, on first use (opening an address editor), off the
   route's critical path.

   Pattern: components call useStateCity() — it kicks the dynamic import on
   mount and re-renders the component when the dataset arrives; the *Sync
   getters return [] until then, so pickers render empty for the beat it
   takes the chunk to land. Store is globalThis-anchored (SYS-4) so every
   chunk copy shares one load.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import type { IState, ICity } from "country-state-city";

interface CscSlice {
  State: (typeof import("country-state-city"))["State"];
  City: (typeof import("country-state-city"))["City"];
}
interface Store {
  mod: CscSlice | null;
  loading: Promise<void> | null;
  listeners: Set<() => void>;
}
const g = globalThis as typeof globalThis & { __kxStateCity?: Store };
const store: Store =
  g.__kxStateCity ?? (g.__kxStateCity = { mod: null, loading: null, listeners: new Set() });

export function ensureStateCity(): Promise<void> {
  if (store.mod) return Promise.resolve();
  if (!store.loading) {
    store.loading = import("country-state-city").then((m) => {
      store.mod = { State: m.State, City: m.City };
      store.listeners.forEach((l) => l());
    });
  }
  return store.loading;
}

export function stateCityReady(): boolean {
  return !!store.mod;
}

/** Kick the load when `active` (default true) and re-render when the
 *  dataset arrives. Pass a gate (e.g. `view === "form"`) from components
 *  that mount long before the address editor is on screen — otherwise the
 *  8 MB chunk downloads at screen open, defeating the whole split. */
export function useStateCity(active = true): boolean {
  const [ready, setReady] = useState(stateCityReady());
  useEffect(() => {
    if (!active) return;
    if (stateCityReady()) { setReady(true); return; }
    let alive = true;
    const onReady = () => { if (alive) setReady(true); };
    store.listeners.add(onReady);
    void ensureStateCity();
    return () => { alive = false; store.listeners.delete(onReady); };
  }, [active]);
  return ready;
}

export function getStatesOfCountrySync(countryCode: string): IState[] {
  return store.mod ? store.mod.State.getStatesOfCountry(countryCode) : [];
}

export function getCitiesOfStateSync(countryCode: string, stateCode: string): ICity[] {
  return store.mod ? store.mod.City.getCitiesOfState(countryCode, stateCode) : [];
}

export function getCitiesOfCountrySync(countryCode: string): ICity[] {
  return store.mod ? (store.mod.City.getCitiesOfCountry(countryCode) || []) : [];
}
