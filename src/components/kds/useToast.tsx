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
  /* msg is nulled on clear while the KIND is kept, so the pill holds its
     tint through the fall-away instead of flipping colour mid-exit. */
  const [toast, setToast] = useState<{ msg: ReactNode | null; kind: Kind }>({ msg: null, kind: "success" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showToast = useCallback((msg: ReactNode, kind: Kind = "success", ms?: number) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, kind });
    timer.current = setTimeout(
      () => setToast((t) => ({ msg: null, kind: t.kind })),
      ms ?? (kind === "error" ? 5000 : 3200),
    );
  }, []);

  /* Toast is rendered UNCONDITIONALLY (it returns null itself when there is
     nothing to show). Unmounting it on clear meant its exit choreography
     never ran: the component never saw `message` flip to null, so every
     toast in the Hub still vanished with a hard cut. The kind is held past
     the clear too, so the pill keeps its tint while it falls away. */
  const toastElement = <Toast message={toast.msg} kind={toast.kind} />;

  return { showToast, toastElement };
}
