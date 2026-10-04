"use client";

/* ---------------------------------------------------------------------------
   Model choice — which Koleex AI model this user asked for.

   Owner, 2026-09-23: the picker beside the message box, like the big chat
   apps. The catalog (names, lines, voice) is lib/ai/koleex-models.ts; this
   is only the user's CHOICE, kept exactly like the orb style
   (components/ai-orb/orb-style.ts):

     · on the account (`preferences.ai_model`), so the phone, the iPad and the
       Mac ask for the same model;
     · mirrored in localStorage, so the picker shows the right name on its
       first frame instead of flicking from Auto once the account arrives;
     · a choice just made on this device outranks an account snapshot for a
       few seconds — the refetch after a save can still carry the old value.

   A PREFERENCE, NOT A PERMISSION. The browser sends what the user chose with
   each turn; the server resolves it (an unknown or switched-off model is
   Auto) and says which model actually answered. Nothing here can make the
   server serve a model it would not.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";
import {
  DEFAULT_KOLEEX_MODEL,
  normalizeKoleexModel,
  type KoleexModelId,
} from "@/lib/ai/koleex-model-ids";

const KEY = "koleex-ai-model";
const EVENT = "kx-ai-model";

export function getModelChoice(): KoleexModelId {
  if (typeof window === "undefined") return DEFAULT_KOLEEX_MODEL;
  try {
    return normalizeKoleexModel(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_KOLEEX_MODEL;
  }
}

function writeLocal(model: KoleexModelId): void {
  try { localStorage.setItem(KEY, model); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: model }));
}

let localWriteUntil = 0;

/** The USER chose. The caller persists it to the account. */
export function setModelChoice(model: KoleexModelId): void {
  if (typeof window === "undefined") return;
  localWriteUntil = Date.now() + 8000;
  writeLocal(normalizeKoleexModel(model));
}

/** The ACCOUNT says. Yields to a choice made in the last few seconds here. */
export function syncModelChoiceFromAccount(stored: unknown): void {
  if (typeof window === "undefined") return;
  if (Date.now() < localWriteUntil) return;
  const next = normalizeKoleexModel(stored);
  if (next !== getModelChoice()) writeLocal(next);
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) onChange(); };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current choice, re-rendering when it changes. */
export function useModelChoice(): KoleexModelId {
  return useSyncExternalStore(subscribe, getModelChoice, () => DEFAULT_KOLEEX_MODEL);
}
