"use client";

import { useMemo, useState } from "react";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import ModalShell from "./DiscussModalShell";
import { DiscussAvatar as Avatar } from "./DiscussAvatar";
import { nativeAltOf, type DiscussRecipient } from "./discuss-shared";

/* ═══════════════════════════════════════════════════════════════════════════
   NEW CHANNEL MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

export default function NewChannelModal({
  recipients,
  currentAccountId,
  onCancel,
  onCreate,
  t,
}: {
  recipients: DiscussRecipient[];
  currentAccountId: string;
  onCancel: () => void;
  onCreate: (input: {
    name: string;
    description?: string;
    kind: "group" | "channel";
    memberIds: string[];
  }) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"group" | "channel">("channel");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients
      .filter((r) => r.id !== currentAccountId)
      .filter(
        (r) =>
          !q ||
          r.username.toLowerCase().includes(q) ||
          (r.full_name ?? "").toLowerCase().includes(q),
      );
  }, [recipients, currentAccountId, search]);

  const canSubmit = name.trim().length > 0;

  return (
    <ModalShell title={t("new.channel.title")} onCancel={onCancel} width={520} closeLabel={t("btn.close", "Close")}>
      <div className="p-5 flex flex-col gap-4">
        {/* Kind toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind("channel")}
            className={`p-3 rounded-lg border text-start transition-colors ${
              kind === "channel"
                ? "border-[var(--border-strong)] bg-[var(--bg-surface-active)]"
                : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)]">
              <HashtagIcon className="h-3.5 w-3.5" />
              {t("new.channel.public")}
            </div>
            <div className="text-[10.5px] text-[var(--text-dim)] mt-0.5">
              {t("new.channel.publicDesc")}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setKind("group")}
            className={`p-3 rounded-lg border text-start transition-colors ${
              kind === "group"
                ? "border-[var(--border-strong)] bg-[var(--bg-surface-active)]"
                : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)]">
              <LockIcon className="h-3.5 w-3.5" />
              {t("new.channel.private")}
            </div>
            <div className="text-[10.5px] text-[var(--text-dim)] mt-0.5">
              {t("new.channel.privateDesc")}
            </div>
          </button>
        </div>

        {/* Name + description */}
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
            {t("new.channel.name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("new.channel.namePh")}
            className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] outline-none text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
            {t("new.channel.description")}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("new.channel.topicPh")}
            className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] outline-none text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
          />
        </div>

        {/* Members picker */}
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
            {t("details.members")}
          </label>
          <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] max-h-[240px] overflow-hidden flex flex-col">
            <div className="h-9 px-3 flex items-center gap-2 border-b border-[var(--border-subtle)]">
              <SearchIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("sidebar.search")}
                className="flex-1 bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
              />
            </div>
            <div className="overflow-y-auto">
              {candidates.map((r) => {
                const isOn = selected.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (isOn) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      })
                    }
                    className={`w-full px-3 py-2 flex items-center gap-2.5 text-start transition-colors ${
                      isOn ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    <Avatar
                      name={r.full_name || r.username}
                      url={r.avatar_url}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                        {r.full_name || r.username}
                        {nativeAltOf(r.full_name, r.name_alt) && (
                          <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">
                            {nativeAltOf(r.full_name, r.name_alt)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] truncate">
                        @{r.username}
                        {r.role_name && (
                          <span className="ms-1.5">· {r.role_name}</span>
                        )}
                      </div>
                    </div>
                    {isOn && <CheckIcon className="h-4 w-4 text-[var(--text-secondary)]" />}
                  </button>
                );
              })}
              {candidates.length === 0 && (
                <div className="p-4 text-center text-[11px] text-[var(--text-dim)]">
                  {t("search.noResults")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 h-14 px-4 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3 rounded-lg text-[11.5px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          {t("btn.cancel")}
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onCreate({
              name: name.trim(),
              description: description.trim() || undefined,
              kind,
              memberIds: Array.from(selected),
            })
          }
          className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11.5px] font-semibold hover:bg-[var(--bg-inverted-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          {t("new.channel.create")}
        </button>
      </div>
    </ModalShell>
  );
}

