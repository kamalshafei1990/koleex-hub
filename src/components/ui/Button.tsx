"use client";

/* ---------------------------------------------------------------------------
   Button — Koleex Hub canonical button primitive.

   ONE source of truth for button styling across every app. Pick a variant
   and a size; everything else (color, border, radius, hover, transition)
   is handled by tokens — never hardcode `bg-gray-500`, `rounded-xl`, etc.

   variant:
     · primary    — inverted bg, inverted text  (CTAs: New, Save, Submit)
     · secondary  — surface bg + subtle border  (Cancel, Edit, secondary actions)
     · ghost      — text-only, no border / bg   (icon buttons, toolbar links)
     · danger     — rose accent for destructive actions

   size:
     · sm  — h-8  px-3   text-[12px]
     · md  — h-9  px-3.5 text-[12.5px]   ← default
     · lg  — h-10 px-4   text-[13px]

   Examples:
     <Button onClick={save}>Save</Button>
     <Button variant="secondary" size="sm" icon="pencil">Edit</Button>
     <Button variant="primary" icon="plus">New Order</Button>
     <Button variant="ghost" size="sm" aria-label="Delete" icon="trash" />
   --------------------------------------------------------------------------- */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** RrIcon name OR a custom node rendered before the children. */
  icon?: RrIconName | ReactNode;
  /** RrIcon name OR a custom node rendered after the children. */
  iconAfter?: RrIconName | ReactNode;
  /** Spinner state for async actions. */
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 active:opacity-80",
  secondary:
    "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] " +
    "hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]",
  ghost:
    "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
  danger:
    "border border-rose-500/40 bg-rose-500/10 text-rose-400 " +
    "hover:border-rose-500/60 hover:bg-rose-500/15",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-[12.5px] gap-1.5 rounded-md",
  lg: "h-10 px-4 text-[13px] gap-2 rounded-lg",
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 12, md: 13, lg: 14 };

function renderIcon(icon: RrIconName | ReactNode | undefined, size: ButtonSize) {
  if (icon === undefined || icon === null || icon === false) return null;
  if (typeof icon === "string") {
    return <RrIcon name={icon as RrIconName} size={ICON_SIZE[size]} />;
  }
  return icon;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, iconAfter, loading, className = "", children, disabled, type, ...rest },
  ref,
) {
  const base =
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold " +
    "transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] " +
    "disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      className={`${base} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        renderIcon(icon, size)
      )}
      {children}
      {!loading && renderIcon(iconAfter, size)}
    </button>
  );
});

export default Button;
