"use client";

/* ---------------------------------------------------------------------------
   ShareDialog — manage who a note is shared with. Owner can add collaborators
   from their organization (search by name/email), set each to View or Edit,
   change a permission, or remove. A non-owner collaborator sees the roster
   read-only and can leave the note.

   Same Hub modal language as NotesDialog.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import {
  fetchNoteShares,
  fetchShareCandidates,
  addNoteShare,
  updateNoteShare,
  removeNoteShare,
  shareAccountLabel,
  type NoteSharesResponse,
  type ShareAccount,
} from "@/lib/notes";

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-bold text-[var(--text-secondary)]">
      {initials || "?"}
    </div>
  );
}

export default function ShareDialog({
  noteId,
  open,
  onClose,
  onChanged,
}: {
  noteId: string | null;
  open: boolean;
  onClose: () => void;
  /** Fired after any share mutation so the parent can refresh badges. */
  onChanged?: () => void;
}) {
  const [data, setData] = useState<NoteSharesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ShareAccount[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    if (!noteId) return;
    setLoading(true);
    const res = await fetchNoteShares(noteId);
    setData(res);
    setLoading(false);
  }, [noteId]);

  useEffect(() => {
    if (open && noteId) {
      setQuery("");
      setCandidates([]);
      void reload();
    }
  }, [open, noteId, reload]);

  const isOwner = data?.isOwner ?? false;
  const sharedIds = new Set((data?.shares ?? []).map((s) => s.account_id));

  // Debounced candidate search (owner only).
  useEffect(() => {
    if (!open || !isOwner) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const list = await fetchShareCandidates(query);
      setCandidates(list.filter((a) => !sharedIds.has(a.id)));
      setSearching(false);
    }, 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, isOwner, data]);

  const add = async (accountId: string) => {
    if (!noteId) return;
    setBusyId(accountId);
    await addNoteShare(noteId, accountId, "edit");
    await reload();
    setBusyId(null);
    setQuery("");
    onChanged?.();
  };

  const changePermission = async (shareId: string, permission: "view" | "edit") => {
    if (!noteId) return;
    setBusyId(shareId);
    await updateNoteShare(noteId, shareId, permission);
    await reload();
    setBusyId(null);
    onChanged?.();
  };

  const remove = async (shareId: string) => {
    if (!noteId) return;
    setBusyId(shareId);
    await removeNoteShare(noteId, shareId);
    await reload();
    setBusyId(null);
    onChanged?.();
  };

  if (!open) return null;

  return (
    <ScrollLockOverlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[76vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)] shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Share note</h2>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
              {isOwner ? "Invite people in your organization to collaborate" : "People with access to this note"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors">
            <CrossIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Add people (owner) */}
          {isOwner && (
            <div className="px-5 pt-4">
              <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-3 gap-2 focus-within:border-[var(--border-focus)] transition-colors">
                <SearchIcon className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people by name or email…"
                  className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none h-10"
                />
                {searching && <SpinnerIcon className="h-3.5 w-3.5 animate-spin text-[var(--text-dim)]" />}
              </div>

              {candidates.length > 0 && (
                <div className="mt-2 rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                  {candidates.slice(0, 6).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => void add(a.id)}
                      disabled={busyId === a.id}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-surface-hover)] transition-colors text-left disabled:opacity-50"
                    >
                      <Avatar name={shareAccountLabel(a)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">{shareAccountLabel(a)}</div>
                        <div className="text-[11px] text-[var(--text-dim)] truncate">{a.login_email || a.role || ""}</div>
                      </div>
                      {busyId === a.id ? (
                        <SpinnerIcon className="h-3.5 w-3.5 animate-spin text-[var(--text-dim)]" />
                      ) : (
                        <span className="text-[11px] font-semibold text-[#0066FF]">Add</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && !searching && candidates.length === 0 && (
                <p className="mt-2 text-[11.5px] text-[var(--text-dim)] px-1">No matching people.</p>
              )}
            </div>
          )}

          {/* Roster */}
          <div className="px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
              People with access
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] py-3">
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Owner */}
                {data?.owner && (
                  <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
                    <Avatar name={shareAccountLabel(data.owner.account)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">
                        {shareAccountLabel(data.owner.account)}
                      </div>
                      <div className="text-[11px] text-[var(--text-dim)] truncate">
                        {data.owner.account?.login_email || ""}
                      </div>
                    </div>
                    <span className="text-[10.5px] font-semibold px-2 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      Owner
                    </span>
                  </div>
                )}

                {/* Shares */}
                {(data?.shares ?? []).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors">
                    <Avatar name={shareAccountLabel(s.account)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">{shareAccountLabel(s.account)}</div>
                      <div className="text-[11px] text-[var(--text-dim)] truncate">{s.account?.login_email || ""}</div>
                    </div>

                    {isOwner ? (
                      <>
                        <select
                          value={s.permission}
                          disabled={busyId === s.id}
                          onChange={(e) => void changePermission(s.id, e.target.value as "view" | "edit")}
                          className="h-7 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                        >
                          <option value="edit">Can edit</option>
                          <option value="view">Can view</option>
                        </select>
                        <button
                          onClick={() => void remove(s.id)}
                          disabled={busyId === s.id}
                          title="Remove"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-40"
                        >
                          {busyId === s.id ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <TrashIcon className="h-3.5 w-3.5" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-[10.5px] font-semibold px-2 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                        {s.permission === "view" ? "Can view" : "Can edit"}
                      </span>
                    )}
                  </div>
                ))}

                {!loading && (data?.shares?.length ?? 0) === 0 && (
                  <p className="text-[11.5px] text-[var(--text-dim)] px-2 py-1">
                    {isOwner ? "Not shared yet — add someone above." : "Only you and the owner."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-[var(--border-subtle)] shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}
