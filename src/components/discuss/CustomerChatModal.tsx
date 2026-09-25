"use client";

/* ---------------------------------------------------------------------------
   CustomerChatModal — Phase E "Start a customer chat" picker.

   What it does:
     · Lets the user search their CRM contacts
     · On pick, calls findOrCreateCustomerChannel() — server-side
       (/api/discuss/mutate createCustomerChannel, session identity +
       tenant) — which returns the tenant's existing channel for that
       contact (joining the caller to it) or creates one linked via
       `discuss_channels.linked_contact_id`
     · On success, bubbles the new channel id up so DiscussApp can
       refresh the sidebar and select the channel automatically

   Why it's isolated:
     · DiscussApp.tsx is already 2,500+ lines; this modal has its own
       async search loop with debouncing that would bloat the parent
     · Keeping it separate means Phase E can be shipped without
       retouching the internal-chat code paths at all
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { DiscussAvatar } from "./DiscussAvatar";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import {
  findOrCreateCustomerChannel,
  searchContactsForChat,
} from "@/lib/discuss";
import type { DiscussLinkedContact } from "@/types/supabase";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* Cheap debounce hook — keeps the RPC quiet while the user is typing. */
function useDebounced<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

export interface CustomerChatModalProps {
  /** Called when the user hits "Start chat" and the channel exists. */
  onCreated: (channelId: string) => void;
  /** Called when the user cancels. */
  onCancel: () => void;
  /** i18n helper from useTranslation(discussT). Falls back to English. */
  t: (key: string, fallback?: string) => string;
}

export default function CustomerChatModal({
  onCreated,
  onCancel,
  t,
}: CustomerChatModalProps) {
  useScrollLock();
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<DiscussLinkedContact[]>([]);
  const [selected, setSelected] = useState<DiscussLinkedContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const debouncedQuery = useDebounced(query, 220);
  const titleId = useId();

  /* Escape closes (unless a create is in flight). */
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !creating) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, creating]);

  /* Fetch contacts whenever the debounced query changes. First mount
     triggers with an empty string, which returns the most recent
     customers so the picker has something to show immediately. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchContactsForChat(debouncedQuery)
      .then((rows) => {
        if (cancelled) return;
        setContacts(rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Discuss] Customer search:", err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  /* When the search results change, if we had a selected contact that's
     no longer visible, drop the selection so the create button disables. */
  useEffect(() => {
    if (!selected) return;
    if (!contacts.some((c) => c.id === selected.id)) setSelected(null);
  }, [contacts, selected]);

  const canCreate = selected !== null && !creating;

  const handleCreate = useCallback(async () => {
    if (!selected) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const channelId = await findOrCreateCustomerChannel({
        contactId: selected.id,
      });
      if (!channelId) {
        setErrorMsg(
          t("customer.newChat.error", "Couldn't start the conversation"),
        );
        setCreating(false);
        return;
      }
      onCreated(channelId);
    } catch (err) {
      console.error("[Discuss] Create customer channel:", err);
      setErrorMsg(
        t("customer.newChat.error", "Couldn't start the conversation"),
      );
      setCreating(false);
    }
  }, [selected, onCreated, t]);

  const listBody = useMemo(() => {
    if (loading) {
      return (
        <div className="p-6 flex items-center justify-center text-[var(--text-dim)]">
          <SpinnerIcon className="h-4 w-4" />
        </div>
      );
    }
    if (contacts.length === 0) {
      return (
        <div className="p-6 text-center">
          <div className="text-[12px] text-[var(--text-muted)]">
            {t("customer.newChat.noResults", "No matching contacts")}
          </div>
          <div className="mt-1 text-[10.5px] text-[var(--text-dim)]">
            {t(
              "customer.newChat.noResultsHint",
              "Add them in the CRM first, then come back here.",
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-0.5">
        {contacts.map((c) => {
          const isOn = selected?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c)}
              className={`w-full px-3 py-2.5 flex items-center gap-3 text-start rounded-lg transition-colors ${
                isOn
                  ? "bg-[var(--bg-surface-active)] ring-1 ring-inset ring-[#567FB2]/50"
                  : "hover:bg-[var(--bg-surface)]"
              }`}
            >
              <DiscussAvatar name={c.display_name} url={c.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                  {c.display_name}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-[var(--text-dim)]">
                  {c.company && (
                    <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                      <Building2Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.company}</span>
                    </span>
                  )}
                  {c.email && (
                    <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                      <EnvelopeIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </span>
                  )}
                </div>
              </div>
              {isOn && (
                <CheckIcon className="h-4 w-4 text-[#567FB2] dark:text-[#7FA9D6] shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    );
  }, [contacts, loading, selected, t]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh] overflow-y-auto bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !creating) onCancel();
      }}
    >
      <div
        className="w-full rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
        style={{ maxWidth: 520 }}
      >
        {/* Header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-[var(--bg-surface)] text-[var(--text-muted)]">
              <UserPlusIcon className="h-3.5 w-3.5" />
            </div>
            <h2 id={titleId} className="text-[14px] font-semibold text-[var(--text-primary)]">
              {t("customer.newChat.title", "Start a customer conversation")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("btn.close", "Close")}
            className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Hint */}
        <div className="px-5 pt-4 pb-2 text-[11.5px] text-[var(--text-muted)] leading-relaxed">
          {t(
            "customer.newChat.hint",
            "Pick a CRM contact — the chat becomes linked to their record.",
          )}
        </div>

        {/* Search input */}
        <div className="px-5 pb-3">
          <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
            <SearchIcon className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("customer.newChat.search", "Search contacts…")}
              className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                aria-label={t("btn.clear", "Clear")}
              >
                <CrossIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results list */}
        <div className="px-3 max-h-[380px] overflow-y-auto">{listBody}</div>

        {/* Error message */}
        {errorMsg && (
          <div className="px-5 py-2 text-[11px] text-red-400 border-t border-red-500/20 bg-red-500/5">
            {errorMsg}
          </div>
        )}

        {/* Footer actions */}
        <div className="shrink-0 h-14 px-4 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <button
            type="button"
            onClick={onCancel}
            disabled={creating}
            className="h-8 px-3 rounded-lg text-[11.5px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {t("btn.cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={handleCreate}
            className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11.5px] font-semibold hover:bg-[var(--bg-inverted-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5"
          >
            {creating ? (
              <>
                <SpinnerIcon className="h-3 w-3" />
                {t("btn.creating", "Starting…")}
              </>
            ) : (
              t("customer.newChat.create", "Start chat")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
