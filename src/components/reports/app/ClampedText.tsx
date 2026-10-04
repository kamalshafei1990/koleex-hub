"use client";

/* Text that shows its first four lines and opens in place ("Read all").
   Whether it is cut is MEASURED (scrollHeight against the clamped box),
   before paint and again when the box changes width, so the button appears
   only when something is actually hidden — on a phone and on a wide screen
   alike — and never pops in after the text has painted. The button's
   visibility is set on the element itself, not through state, so measuring
   costs no second render. */

import { useLayoutEffect, useRef, useState } from "react";

export default function ClampedText({ children, className = "", more, less }: {
  children: React.ReactNode;
  className?: string;
  more: string;
  less: string;
}) {
  const [whole, setWhole] = useState(false);
  const box = useRef<HTMLParagraphElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const p = box.current;
    const b = btn.current;
    if (!p || !b || whole) return;
    const check = () => { b.hidden = p.scrollHeight <= p.clientHeight + 1; };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(p);
    return () => ro.disconnect();
  }, [whole, children]);
  return (
    <>
      <p ref={box} className={`${className} ${whole ? "" : "line-clamp-4"}`}>{children}</p>
      <button ref={btn} type="button" onClick={() => setWhole((v) => !v)} aria-expanded={whole}
        className="mt-0.5 text-[11.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">
        {whole ? less : more}
      </button>
    </>
  );
}
