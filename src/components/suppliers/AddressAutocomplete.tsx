"use client";

/* AMap (高德) address autocomplete for the supplier address block (report D).
   China-friendly, no VPN. Talks only to our /api/geocode proxy (the AMap key
   stays server-side). Self-hides entirely when AMAP_WEB_KEY isn't configured,
   so the form is unchanged until the key is added. */

import { useEffect, useRef, useState } from "react";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";

interface Tip { id: string; name: string; district: string; adcode: string; address: string; location: string }
export interface GeoPick { formatted: string; country: string; province: string; city: string; district: string }

export default function AddressAutocomplete({
  label,
  placeholder,
  hint,
  onSelect,
}: {
  label: string;
  placeholder: string;
  hint?: string;
  onSelect: (r: GeoPick) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = probing
  const [q, setQ] = useState("");
  const [tips, setTips] = useState<Tip[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Probe once: if the key isn't configured the route says { disabled: true }.
  useEffect(() => {
    let alive = true;
    fetch("/api/geocode?q=%E5%8C%97%E4%BA%AC", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (alive) setEnabled(!j?.disabled); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, []);

  // Close on outside click.
  useEffect(() => {
    function h(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const search = (text: string) => {
    setQ(text);
    if (tRef.current) clearTimeout(tRef.current);
    if (!text.trim()) { setTips([]); setOpen(false); return; }
    tRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(text.trim())}`, { credentials: "include" });
        const j = (await r.json()) as { tips?: Tip[] };
        setTips(Array.isArray(j.tips) ? j.tips.slice(0, 8) : []);
        setOpen(true);
      } catch { setTips([]); } finally { setBusy(false); }
    }, 280);
  };

  const pick = async (tip: Tip) => {
    setOpen(false);
    setQ(`${tip.district}${tip.name}`);
    // Resolve structured province/city/district via geocode for a clean fill.
    let geo: GeoPick = { formatted: `${tip.district}${tip.name}`, country: "", province: "", city: "", district: "" };
    try {
      const r = await fetch(`/api/geocode?address=${encodeURIComponent(`${tip.district}${tip.name}`)}`, { credentials: "include" });
      const j = (await r.json()) as { geocode?: { formatted_address: string; country: string; province: string; city: string; district: string } | null };
      if (j.geocode) {
        geo = {
          formatted: j.geocode.formatted_address || geo.formatted,
          country: j.geocode.country || "",
          province: j.geocode.province || "",
          city: j.geocode.city || j.geocode.district || "",
          district: j.geocode.district || "",
        };
      }
    } catch { /* fall back to the tip text */ }
    onSelect(geo);
  };

  if (!enabled) return null; // probing or no key → render nothing

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-xs text-[var(--text-faint)] mb-1 block">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"><MapPinIcon size={14} /></span>
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          onFocus={() => { if (tips.length) setOpen(true); }}
          placeholder={placeholder}
          className="w-full h-9 ps-8 pe-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
        />
        {busy ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-faint)]">…</span> : null}
      </div>
      {hint ? <p className="mt-1 text-[10.5px] text-[var(--text-dim)]">{hint}</p> : null}
      {open && tips.length > 0 ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg">
          {tips.map((tip, i) => (
            <button
              key={tip.id || i}
              type="button"
              onClick={() => pick(tip)}
              className="flex w-full items-start gap-2 px-3 py-2 text-start hover:bg-[var(--bg-surface-hover)]"
            >
              <MapPinIcon size={13} className="mt-0.5 shrink-0 text-[var(--text-faint)]" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-[var(--text-primary)]">{tip.name}</span>
                {tip.district ? <span className="block truncate text-[11px] text-[var(--text-faint)]">{tip.district}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
