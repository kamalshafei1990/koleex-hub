"use client";

/* ---------------------------------------------------------------------------
   AddMembersModal — pick people to add to a group / channel (details pane).

   Offers the tenant's messageable accounts minus the current members. The
   server re-checks everything (active member of the channel; every account
   filtered to the caller's tenant), so this list is a convenience, not a gate.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import ModalShell from "./DiscussModalShell";
import { DiscussAvatar as Avatar } from "./DiscussAvatar";
import { nativeAltOf, type DiscussRecipient, type DiscussT } from "./discuss-shared";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { CheckIcon } from "@/components/icons/ui";

export default function AddMembersModal({
  candidates,
  onCancel,
  onAdd,
  t,
}: {
  /** Accounts that are NOT already active members. */
  candidates: DiscussRecipient[];
  onCancel: () => void;
  /** Resolves when the write finished; the modal closes on success. */
  onAdd: (accountIds: string[]) => Promise<boolean>;
  t: DiscussT;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter(
      (r) =>
        !q ||
        r.username.toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.name_alt ?? "").toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (picked.size === 0 || busy) return;
    setBusy(true);
    const ok = await onAdd(Array.from(picked));
    setBusy(false);
    if (ok) onCancel();
  };

  return (
    <ModalShell title={t("admin.addMembers", "Add members")} onCancel={onCancel} width={440} closeLabel={t("btn.close", "Close")}>
      <div className="p-5 flex flex-col gap-3">
        <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <SearchIcon className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("new.dm.toPh")}
            aria-label={t("new.dm.toPh")}
            className="flex-1 min-w-0 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto flex flex-col gap-0.5" role="group" aria-label={t("admin.addMembers", "Add members")}>
          {candidates.length === 0 ? (
            <div className="p-4 text-center text-[11.5px] text-[var(--text-dim)]">
              {t("admin.noneToAdd", "Everyone is already here")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-[11.5px] text-[var(--text-dim)]">{t("search.noResults")}</div>
          ) : (
            filtered.map((r) => {
              const on = picked.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(r.id)}
                  className={`w-full px-3 py-2 flex items-center gap-2.5 text-start rounded-lg transition-colors ${
                    on ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  <Avatar name={r.full_name || r.username} url={r.avatar_url} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                      {r.full_name || r.username}
                      {nativeAltOf(r.full_name, r.name_alt) && (
                        <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">
                          {nativeAltOf(r.full_name, r.name_alt)}
                        </span>
                      )}
                    </span>
                    <span className="block text-[10.5px] text-[var(--text-dim)] truncate">@{r.username}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                      on
                        ? "bg-[var(--bg-inverted)] border-[var(--bg-inverted)] text-[var(--text-inverted)]"
                        : "border-[var(--border-color)]"
                    }`}
                  >
                    {on && <CheckIcon className="h-3 w-3" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3 rounded-lg text-[12px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t("btn.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={picked.size === 0 || busy}
            className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[var(--bg-inverted-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {busy && <SpinnerIcon className="h-3.5 w-3.5" />}
            {t("admin.addSelected", "Add {n}").replace("{n}", String(picked.size))}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
