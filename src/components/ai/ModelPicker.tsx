"use client";

/* ---------------------------------------------------------------------------
   ModelPicker — "Auto ⌄" beside the message box; opens the Koleex models.

   Owner, 2026-09-23, with screenshots of the pickers in the big chat apps:
   a name on the button, a list with what each model is good at, a tick on
   the one in use. Koleex names only — the catalog (lib/ai/koleex-models.ts)
   never names a vendor, and neither does anything here.

   WHAT "AVAILABLE" MEANS. The list asks the server (/api/ai/models) which
   models can serve right now; one that cannot — not set up, or switched off
   by an operator — is shown dimmed and cannot be chosen. The server decides
   that, and decides it again on every turn: a stale list can at worst show
   a model as choosable that the server then serves as Auto, and the reply
   says so ("Answered by …").

   Built like the sidebar's RowMenu: portalled, fixed against the button's
   own rectangle, arrow keys, Escape and Tab close it and give focus back.
   It opens UPWARD — the composer sits at the bottom of the screen.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ChevronDownIcon from "@/components/icons/ui/ChevronDownIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import {
  KOLEEX_MODELS,
  KOLEEX_MODEL_INFO,
  type KoleexModelId,
} from "@/lib/ai/koleex-models";
import type { Lang } from "@/lib/i18n";

export interface ModelPickerCopy {
  model: string;
  modelUnavailable: string;
  modelTextOnly: string;
}

type Availability = Partial<Record<KoleexModelId, boolean>>;

/* One fetch per page, shared by every picker on it. A failed fetch leaves
   every model choosable: the server still resolves the choice on each turn,
   so a missing list can never grant anything — it only loses the dimming. */
let availabilityOnce: Promise<Availability> | null = null;
function loadAvailability(): Promise<Availability> {
  if (!availabilityOnce) {
    availabilityOnce = fetch("/api/ai/models", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { models?: Array<{ id: string; available: boolean }> } | null) => {
        const out: Availability = {};
        for (const m of j?.models ?? []) {
          if ((KOLEEX_MODELS as readonly string[]).includes(m.id)) out[m.id as KoleexModelId] = m.available === true;
        }
        return out;
      })
      .catch(() => {
        availabilityOnce = null;
        return {};
      });
  }
  return availabilityOnce;
}

const W = 288;
const GAP = 6;
const EDGE = 8;

export default function ModelPicker({
  value,
  onChange,
  lang,
  copy,
  disabled,
}: {
  value: KoleexModelId;
  onChange: (model: KoleexModelId) => void;
  lang: Lang;
  copy: ModelPickerCopy;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number; maxHeight: number } | null>(null);
  const [avail, setAvail] = useState<Availability>({});
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const l = lang === "zh" || lang === "ar" ? lang : "en";

  useEffect(() => {
    let live = true;
    void loadAvailability().then((a) => { if (live) setAvail(a); });
    return () => { live = false; };
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus({ preventScroll: true });
  }, []);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    /* Rise above the whole message box, not just the button, so the list
       never covers what the user is typing. */
    const top = (el.closest("form") ?? el).getBoundingClientRect().top;
    const rtl = getComputedStyle(el).direction === "rtl";
    /* Hang from the button's outer edge: its right edge in English and
       Chinese, its left in Arabic — then keep the panel on the screen. */
    const wanted = rtl ? r.left : r.right - W;
    const left = Math.min(Math.max(EDGE, wanted), window.innerWidth - W - EDGE);
    setPos({
      bottom: window.innerHeight - top + GAP,
      left: Math.max(EDGE, left),
      maxHeight: Math.max(160, top - GAP - EDGE),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]:not([aria-disabled="true"])');
      const current = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
      (current ?? items?.[0])?.focus({ preventScroll: true });
    });
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); closeMenu(); } };
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeMenu]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]:not([aria-disabled="true"])') ?? [],
    );
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => { e.preventDefault(); items[(n + items.length) % items.length].focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") { e.preventDefault(); closeMenu(); }
  };

  const pick = (id: KoleexModelId) => {
    if (avail[id] === false) return;
    if (id !== value) onChange(id);
    closeMenu();
  };

  const current = KOLEEX_MODEL_INFO[value];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) place();
          setOpen((v) => !v);
        }}
        className={`h-10 px-3 rounded-full inline-flex items-center gap-1 shrink-0 text-[13px] font-medium transition-colors disabled:opacity-40 ${
          open
            ? "text-[var(--text-primary)] bg-[var(--bg-surface-subtle)]"
            : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${copy.model}: ${current.name[l]}`}
        title={copy.model}
      >
        <span>{current.short[l]}</span>
        <span aria-hidden className="inline-flex"><ChevronDownIcon size={14} /></span>
      </button>

      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            role="menu"
            aria-label={copy.model}
            onKeyDown={onMenuKey}
            dir={lang === "ar" ? "rtl" : "ltr"}
            className="kx-pop-panel fixed z-[61] overflow-y-auto py-1.5"
            style={{ bottom: pos.bottom, left: pos.left, width: W, maxHeight: pos.maxHeight }}
          >
            <div className="px-4 pt-1.5 pb-1 text-[12px] font-semibold text-[var(--text-dim)]">{copy.model}</div>
            {KOLEEX_MODELS.map((id) => {
              const info = KOLEEX_MODEL_INFO[id];
              const off = avail[id] === false;
              const on = id === value;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  aria-disabled={off || undefined}
                  tabIndex={-1}
                  onClick={() => pick(id)}
                  className={`w-full flex items-start gap-3 px-4 py-2.5 text-start transition-colors focus:outline-none ${
                    off
                      ? "opacity-45 cursor-not-allowed"
                      : "hover:bg-[var(--bg-surface-subtle)] focus-visible:bg-[var(--bg-surface-subtle)]"
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[var(--text-primary)]">{info.name[l]}</span>
                      {!info.voice && (
                        <span className="text-[11px] px-1.5 py-px rounded-full border border-[var(--border-subtle)] text-[var(--text-dim)]">
                          {copy.modelTextOnly}
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] leading-snug text-[var(--text-dim)] mt-0.5">
                      {off ? copy.modelUnavailable : info.blurb[l]}
                    </span>
                  </span>
                  <span className="h-5 w-5 shrink-0 mt-0.5 inline-flex items-center justify-center text-[var(--text-primary)]">
                    {on && <span aria-hidden className="inline-flex"><CheckIcon size={16} /></span>}
                  </span>
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
