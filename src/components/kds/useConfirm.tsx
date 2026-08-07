"use client";

/* ---------------------------------------------------------------------------
   useConfirm — the kit way to replace window.confirm().

   After hand-rolling the staged-state + ConfirmDialog pattern across QA,
   admin, commercial-policy and finance (22 sites), this hook makes the next
   conversion two lines:

     const { askConfirm, confirmDialog } = useConfirm();
     …
     const remove = (row: Row) =>
       askConfirm(t("x.confirmRemove", "Remove this item?"), async () => {
         await fetch(…);           // the original body, awaits and all —
         await reload();           // the closure captures the row
       });
     …
     return (<>…{confirmDialog}</>);

   tone/label options mirror kds ConfirmDialog (danger default; pass
   tone: "neutral" for benign confirms, per the CF-1 extension).
   --------------------------------------------------------------------------- */

import { useCallback, useState, type ReactNode } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface Ask {
  title: ReactNode;
  run: () => void | Promise<void>;
  confirmLabel?: string;
  tone?: "danger" | "neutral";
}

export function useConfirm() {
  const [ask, setAsk] = useState<Ask | null>(null);

  const askConfirm = useCallback(
    (title: ReactNode, run: () => void | Promise<void>, opts?: { confirmLabel?: string; tone?: "danger" | "neutral" }) => {
      setAsk({ title, run, ...opts });
    },
    [],
  );

  const confirmDialog = (
    <ConfirmDialog
      open={ask !== null}
      title={ask?.title ?? ""}
      confirmLabel={ask?.confirmLabel ?? "Confirm"}
      tone={ask?.tone ?? "danger"}
      onCancel={() => setAsk(null)}
      onConfirm={() => {
        const run = ask?.run;
        setAsk(null);
        if (run) void run();
      }}
    />
  );

  return { askConfirm, confirmDialog };
}
