"use client";

/* KDS Button — ELECTED by owner 2026-08-02.
   primary        = R-2 ("Add Product" hero: h-10, rounded-xl, shadow)
   secondary      = E-BTN ("Today": surface-subtle + border, focus-border hover)
   ghost          = modal-cancel twin of primary's box (transparent until hover)
   iconPrimary    = E-BTN 32px inverted square ("+ New customer")
   iconSecondary  = E-BTN 32px bordered square (back arrow)
   iconNav        = E-BTN 40px toolbar nav (calendar prev/next)
   One shape per tier — local look-alikes are debt (kds-1.md §6). */

const VARIANTS = {
  primary:
    "h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 shadow-lg",
  secondary:
    "h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-semibold hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]",
  ghost:
    "h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]",
  iconPrimary:
    "h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90",
  iconSecondary:
    "h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]",
  iconNav:
    "h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]",
} as const;

export type KdsButtonVariant = keyof typeof VARIANTS;

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: KdsButtonVariant }) {
  return (
    <button
      {...rest}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-all disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
