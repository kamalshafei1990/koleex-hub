"use client";

/* Super Admin alert preferences — toggle in-app alerts per kind.
   Reads/writes /api/super-admin/notification-preferences. */

import { useCallback, useEffect, useState } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const KINDS: Array<{ key: string; label: string }> = [
  { key: "login", label: "User logins" },
  { key: "new_device", label: "Login from a new device" },
  { key: "failed_login_threshold", label: "Repeated failed logins" },
  { key: "data_delete", label: "Data deletions" },
  { key: "price_cost_change", label: "Price / cost changes" },
  { key: "admin_role_change", label: "Admin / role changes" },
  { key: "settings_change", label: "Settings / policy changes" },
  { key: "sensitive_export", label: "Sensitive exports" },
  { key: "file_change", label: "File uploads / deletions" },
];

type Prefs = Record<string, { inapp?: boolean }>;

export default function AlertPreferencesModal({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/notification-preferences", { credentials: "include" });
      if (res.ok) setPrefs(((await res.json()) as { prefs: Prefs }).prefs ?? {});
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Default = on; only an explicit inapp:false disables.
  const isOn = (k: string) => prefs[k]?.inapp !== false;
  const toggle = (k: string) =>
    setPrefs((p) => ({ ...p, [k]: { ...p[k], inapp: !(p[k]?.inapp !== false) } }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/super-admin/notification-preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs }),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Alert preferences</h2>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>
        {loading ? (
          <div className="h-40 flex items-center justify-center"><SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" /></div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              <p className="text-[12px] text-[var(--text-dim)] mb-3">
                Choose which security &amp; business events send you an in-app alert. All are on by default.
              </p>
              {KINDS.map((k) => (
                <label key={k.key} className="flex items-center justify-between gap-3 py-2 cursor-pointer">
                  <span className="text-[13px] text-[var(--text-primary)]">{k.label}</span>
                  <button
                    type="button"
                    onClick={() => toggle(k.key)}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${isOn(k.key) ? "bg-[var(--accent)]" : "bg-[var(--bg-inverted)]/[0.15]"}`}
                    aria-pressed={isOn(k.key)}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${isOn(k.key) ? "start-[18px]" : "start-0.5"}`} />
                  </button>
                </label>
              ))}
            </div>
            <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-subtle)]">
              <button onClick={onClose} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]">Cancel</button>
              <button onClick={save} disabled={saving} className="h-9 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
                {saving && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
