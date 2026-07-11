"use client";

/* Settings → Signature & stamp. Manages the tenant-wide company stamp and
   authorized signature baked into quotations, invoices, and packing lists.
   Reuses GET/POST/DELETE /api/quotations/saved-assets (super-admin writes). */

import { useEffect, useRef, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";

type Kind = "stamp" | "signature";
interface Assets { stampUrl: string | null; signatureUrl: string | null }

export default function StampSignatureTab(_props: { account: AccountWithLinks }) {
  const [assets, setAssets] = useState<Assets>({ stampUrl: null, signatureUrl: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/quotations/saved-assets", { credentials: "include" });
      if (res.ok) setAssets((await res.json()) as Assets);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  async function upload(kind: Kind, file: File) {
    if (!file.type.startsWith("image/")) { setMsg({ kind: "err", text: "Please choose an image." }); return; }
    if (file.size > 4 * 1024 * 1024) { setMsg({ kind: "err", text: "Image too large — max 4 MB." }); return; }
    setBusy(kind); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", file);
      const res = await fetch("/api/quotations/saved-assets", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg({ kind: "err", text: j.error || `Upload failed (${res.status})` });
        return;
      }
      setMsg({ kind: "ok", text: `${kind === "stamp" ? "Stamp" : "Signature"} updated` });
      await load();
    } finally { setBusy(null); }
  }

  async function remove(kind: Kind) {
    setBusy(kind); setMsg(null);
    try {
      const res = await fetch("/api/quotations/saved-assets", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) { setMsg({ kind: "err", text: `Couldn't remove (${res.status})` }); return; }
      setMsg({ kind: "ok", text: "Removed" });
      await load();
    } finally { setBusy(null); }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] py-6">
        <SpinnerIcon className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[var(--text-dim)] px-1">
        Applied tenant-wide to quotations, invoices, and packing lists.
      </p>
      <Slot kind="stamp" label="Company stamp" hint="Square works best (China-standard seal)." square url={assets.stampUrl} busy={busy === "stamp"} onUpload={upload} onRemove={remove} />
      <Slot kind="signature" label="Authorized signature" hint="Transparent PNG on white looks cleanest." url={assets.signatureUrl} busy={busy === "signature"} onUpload={upload} onRemove={remove} />

      {msg && (
        <p className={`text-[12px] px-1 ${msg.kind === "ok" ? "text-[#00CC66]" : "text-[#FF6B6B]"}`}>{msg.text}</p>
      )}
    </div>
  );
}

function Slot({ kind, label, hint, url, square, busy, onUpload, onRemove }: {
  kind: Kind; label: string; hint: string; url: string | null; square?: boolean;
  busy: boolean; onUpload: (k: Kind, f: File) => void; onRemove: (k: Kind) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--text-primary)]">{label}</h2>
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{hint}</p>
        </div>
        {busy && <SpinnerIcon className="h-4 w-4 animate-spin text-[var(--text-dim)]" />}
      </div>

      <div className="flex items-center gap-4">
        <div
          className={`shrink-0 border border-[var(--border-subtle)] bg-white flex items-center justify-center overflow-hidden ${square ? "h-24 w-24 rounded-xl" : "h-20 w-40 rounded-xl"}`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[11px] text-[#9CA3AF]">None set</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {url ? "Replace" : "Upload"}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => onRemove(kind)}
              disabled={busy}
              className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[#FF6B6B] hover:border-[#FF6B6B]/40 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <TrashIcon className="h-3.5 w-3.5" /> Remove
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(kind, f); if (fileRef.current) fileRef.current.value = ""; }}
          />
        </div>
      </div>
    </section>
  );
}
