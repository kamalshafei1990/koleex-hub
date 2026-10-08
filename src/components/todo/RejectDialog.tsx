"use client";

/* Send-back-for-rework dialog. The reason is REQUIRED — the server refuses a
   return without one — so Send stays disabled until there is text, rather
   than failing after the click. It reaches the assignee on the task's banner,
   in their inbox and by push. */

import { useState } from "react";
import Modal from "@/components/kds/Modal";
import type { TFn } from "./todo-ui";

export default function RejectDialog({ t, onCancel, onSend }: {
  t: TFn;
  onCancel: () => void;
  onSend: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const send = () => { if (reason.trim()) onSend(reason.trim()); };
  return (
    <Modal open onClose={onCancel} title={t("approval.rejectTitle")}
      actions={
        <>
          <button type="button" onClick={send} disabled={!reason.trim()}
            className="h-9 px-4 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[12.5px] font-bold hover:bg-amber-500/30 transition-colors disabled:opacity-40">
            {t("approval.rejectSubmit")}
          </button>
          <button type="button" onClick={onCancel}
            className="h-9 px-4 rounded-xl text-[12.5px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors">
            {t("modal.cancel")}
          </button>
        </>
      }>
      <p className="text-[12px] text-[var(--text-dim)]">{t("approval.rejectHint")}</p>
      <textarea autoFocus value={reason} rows={3} aria-label={t("approval.rejectTitle")}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
        }}
        placeholder={t("approval.rejectPlaceholder")}
        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] resize-none" />
    </Modal>
  );
}
