"use client";

/* KDS Drawer — ELECTED DR-1 by owner 2026-08-02 (Approvals style):
   end-side panel, eyebrow + title header, ruled footer slot. */

export default function Drawer({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
  maxWidth = "sm:max-w-[560px]",
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="flex-1 bg-black/30 backdrop-blur-[2px]" />
      <aside className={`flex h-full w-full flex-col border-s border-white/[0.06] bg-[var(--bg-primary)] shadow-[-12px_0_48px_-12px_rgba(0,0,0,0.6)] ${maxWidth}`}>
        <header className="flex items-start gap-3 border-b border-white/[0.05] px-4 py-3">
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">{eyebrow}</p>}
            <p className="mt-0.5 truncate text-[14px] font-medium text-[var(--text-primary)]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-[var(--text-dim)] transition-colors hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">{children}</div>
        {footer && <footer className="border-t border-white/[0.05] px-4 py-3 space-y-2">{footer}</footer>}
      </aside>
    </div>
  );
}
