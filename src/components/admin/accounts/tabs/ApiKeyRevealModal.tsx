"use client";

/* ---------------------------------------------------------------------------
   ApiKeyRevealModal — show a freshly-created API key exactly once.

   The DB only stores the sha256 of the key, so this modal is the only
   chance the user ever has to see the full token. We make it obvious,
   offer a copy button, and require explicit acknowledgement before closing.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { X, Copy, Check, AlertTriangle, KeyRound } from "lucide-react";

interface Props {
  token: string;
  keyName: string;
  onClose: () => void;
}

export default function ApiKeyRevealModal({ token, keyName, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — ignore silently; user can select+copy manually.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
              <KeyRound className="h-4 w-4" />
            </div>
            <h2 className="text-[15px] font-bold text-[var(--text-primary)] truncate">
              API key created
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-[var(--text-muted)]">
            Your key{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {keyName}
            </span>{" "}
            is ready. Copy it now — it will not be shown again.
          </p>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] text-amber-200 px-3 py-2.5 text-[12px] flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Koleex only stores a hash of this key. If you lose it, create a
              new one — it cannot be recovered.
            </span>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                Secret key
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="h-7 px-2.5 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </button>
            </div>
            <code className="block w-full break-all font-mono text-[12px] text-[var(--text-primary)] leading-relaxed select-all">
              {token}
            </code>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-[var(--border-subtle)]"
            />
            <span className="text-[12px] text-[var(--text-muted)]">
              I&rsquo;ve copied this key and stored it somewhere safe.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            disabled={!acknowledged}
            className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
