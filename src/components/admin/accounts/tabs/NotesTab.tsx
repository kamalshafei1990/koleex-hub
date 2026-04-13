"use client";

/* ---------------------------------------------------------------------------
   NotesTab — internal admin notes on the account.

   Plain textarea that persists to accounts.internal_notes. Visible only to
   admins viewing the account — never to the account holder themselves.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import type { AccountWithLinks } from "@/types/supabase";
import { updateAccount } from "@/lib/accounts-admin";
import {
  tabCardClass,
  tabSectionTitle,
  textareaClass,
  TabActionBar,
} from "./shared";

interface Props {
  account: AccountWithLinks;
  onChanged?: (notes: string | null) => void;
}

export default function NotesTab({ account, onChanged }: Props) {
  const initial = account.internal_notes ?? "";
  const [notes, setNotes] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setNotes(account.internal_notes ?? ""), [account.internal_notes]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const dirty = notes !== initial;

  async function save() {
    setSaving(true);
    setError(null);
    const ok = await updateAccount(account.id, {
      internal_notes: notes.trim() ? notes : null,
    });
    setSaving(false);
    if (!ok) {
      setError("Could not save notes.");
      return;
    }
    setToast("Notes saved.");
    onChanged?.(notes.trim() ? notes : null);
  }

  return (
    <div className="space-y-4">
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <DocumentIcon className="h-3.5 w-3.5" />
          Internal Notes
        </h2>
        <p className="text-[12px] text-[var(--text-dim)] mb-4">
          Private notes visible only to admins viewing this account. The account
          holder never sees these notes.
        </p>
        <textarea
          className={textareaClass}
          rows={12}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Private admin notes: onboarding context, escalations, history, etc."
        />
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

      <section className={tabCardClass}>
        <TabActionBar
          dirty={dirty}
          saving={saving}
          onSave={save}
          onReset={() => setNotes(initial)}
        />
      </section>
    </div>
  );
}
