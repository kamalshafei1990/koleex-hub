"use client";

/* ---------------------------------------------------------------------------
   useToast — the kit way to replace window.alert().

   Companion to useConfirm: two lines per component and every notice renders
   through the elected TS-2 Toast (tinted glass, bottom-center) instead of
   the browser's system popup.

     const { showToast, toastElement } = useToast();
     …
     if (!r.ok) { showToast(j.error ?? "Save failed", "error"); return; }
     …
     return (<>…{toastElement}</>);

   The hook owns the timeout (TS-2's contract says the caller does):
   errors linger longer than successes so they can actually be read.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Toast from "./Toast";

type Kind = "success" | "error" | "info";

export function useToast() {
  const [toast, setToast] = useState<{ msg: ReactNode; kind: Kind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showToast = useCallback((msg: ReactNode, kind: Kind = "success", ms?: number) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, kind });
    timer.current = setTimeout(() => setToast(null), ms ?? (kind === "error" ? 5000 : 3200));
  }, []);

  const toastElement = toast ? <Toast message={toast.msg} kind={toast.kind} /> : null;

  return { showToast, toastElement };
}
