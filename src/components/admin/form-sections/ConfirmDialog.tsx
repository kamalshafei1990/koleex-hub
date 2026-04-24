"use client";

/* ---------------------------------------------------------------------------
   ConfirmDialog — themed replacement for window.confirm().

   Small reusable component so the rest of the admin can swap out
   native browser confirms (which Safari renders with a system
   dialog that clashes with the hub's dark theme) for a dialog
   that matches the hub's design tokens.

   Usage:
     const [deleteOpen, setDeleteOpen] = useState(false);
     ...
     <ConfirmDialog
       open={deleteOpen}
       onClose={() => setDeleteOpen(false)}
       onConfirm={() => { doDelete(); setDeleteOpen(false); }}
       title="Delete 'Lockstitch 9500'?"
       message="This removes the product, its models, media, and prices. Cannot be undone."
       confirmLabel="Delete"
       destructive
     />
   --------------------------------------------------------------------------- */

import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: Props) {
  const confirmCls = destructive
    ? "h-10 px-6 rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors"
    : "h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={confirmCls}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {message && (
        <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">{message}</p>
      )}
    </Modal>
  );
}
