"use client";

/* ---------------------------------------------------------------------------
   AccessRightsTab — per-module permission grid for an account.

   Each module row shows:
     - module name + description
     - current access level (from override OR preset default)
     - a select to change it
     - a reset-to-preset button when an override is active

   Data model:
     - Role's access_preset defines the default for every module.
     - account_permission_overrides holds sparse overrides per (account, module).
     - Absence of an override row = "use preset default".

   Saving:
     - Collects modules that differ from the preset default → upserts those.
     - Collects modules that match the preset default → deletes any existing
       override.
     - Uses replacePermissionOverrides for a simple, correct diff.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import UndoIcon from "@/components/icons/ui/UndoIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import type {
  AccountWithLinks,
  AccountPermissionOverrideRow,
  AccessLevel,
} from "@/types/supabase";
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_LABELS,
  MODULE_GROUPS,
  defaultAccessFromPreset,
} from "@/lib/access-control";
import { replacePermissionOverrides } from "@/lib/accounts-admin";
import {
  tabCardClass,
  tabSectionTitle,
  selectClass,
  TabActionBar,
} from "./shared";

interface Props {
  account: AccountWithLinks;
  onChanged?: (overrides: AccountPermissionOverrideRow[]) => void;
}

export default function AccessRightsTab({ account, onChanged }: Props) {
  const presetDefaults = useMemo(
    () => defaultAccessFromPreset(account.preset),
    [account.preset],
  );

  // Current effective access per module: override value if present, else preset default.
  const initialLevels = useMemo(() => {
    const map: Record<string, AccessLevel> = { ...presetDefaults };
    for (const o of account.overrides) {
      map[o.module_key] = o.access_level;
    }
    return map;
  }, [presetDefaults, account.overrides]);

  const [levels, setLevels] = useState<Record<string, AccessLevel>>(initialLevels);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLevels(initialLevels);
  }, [initialLevels]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const dirty = useMemo(() => {
    return Object.keys(levels).some((k) => levels[k] !== initialLevels[k]);
  }, [levels, initialLevels]);

  /** Does this module currently differ from the preset default? */
  function isOverridden(moduleKey: string): boolean {
    return levels[moduleKey] !== presetDefaults[moduleKey];
  }

  function setLevel(moduleKey: string, level: AccessLevel) {
    setLevels((prev) => ({ ...prev, [moduleKey]: level }));
  }

  function resetModule(moduleKey: string) {
    setLevels((prev) => ({ ...prev, [moduleKey]: presetDefaults[moduleKey] }));
  }

  function resetAll() {
    setLevels({ ...initialLevels });
  }

  async function saveAll() {
    setSaving(true);
    setError(null);

    // Build next override set: only modules that differ from preset default.
    const nextOverrides = Object.keys(levels)
      .filter((k) => levels[k] !== presetDefaults[k])
      .map((k) => ({ module_key: k, access_level: levels[k] }));

    const ok = await replacePermissionOverrides(account.id, nextOverrides);
    setSaving(false);
    if (!ok) {
      setError("Could not save access rights. Check the console for details.");
      return;
    }
    setToast("Access rights saved.");
    onChanged?.(
      nextOverrides.map((o, i) => ({
        id: `local-${i}`,
        account_id: account.id,
        module_key: o.module_key,
        access_level: o.access_level,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <ShieldIcon className="h-3.5 w-3.5" />
          Access Rights
        </h2>
        <p className="text-[12px] text-[var(--text-dim)] mb-0">
          Module permissions start from the role&rsquo;s default preset. Override
          any module below — overridden rows are tagged and can be reset back
          to the preset at any time.
        </p>
        {account.role && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
              Role
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-focus)]">
              {account.role.name}
            </span>
            {account.preset && (
              <span className="text-[11px] text-[var(--text-dim)]">
                · Preset: {account.preset.preset_name}
              </span>
            )}
          </div>
        )}
      </section>

      {toast && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <CheckCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <ExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Module groups */}
      {MODULE_GROUPS.map((group) => (
        <section key={group.key} className={tabCardClass}>
          <h3 className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-[0.08em] mb-4">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.modules.map((m) => {
              const current = levels[m.key] || "none";
              const overridden = isOverridden(m.key);
              return (
                <div
                  key={m.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    overridden
                      ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                        {m.label}
                      </span>
                      {overridden && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          Override
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p className="text-[11px] text-[var(--text-dim)] mt-0.5 truncate">
                        {m.description}
                      </p>
                    )}
                    <p className="text-[10px] text-[var(--text-ghost)] mt-0.5">
                      Preset default: {ACCESS_LEVEL_LABELS[presetDefaults[m.key]]}
                    </p>
                  </div>

                  <select
                    value={current}
                    onChange={(e) => setLevel(m.key, e.target.value as AccessLevel)}
                    className={`${selectClass} max-w-[180px]`}
                  >
                    {ACCESS_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {ACCESS_LEVEL_LABELS[lvl]}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => resetModule(m.key)}
                    disabled={!overridden}
                    className="h-10 w-10 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Reset to preset default"
                  >
                    <UndoIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className={tabCardClass}>
        <TabActionBar
          dirty={dirty}
          saving={saving}
          onSave={saveAll}
          onReset={resetAll}
        />
      </section>
    </div>
  );
}
