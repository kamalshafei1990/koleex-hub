"use client";

/* ---------------------------------------------------------------------------
   FixEvidenceForm — admin/developer attaches AFTER screenshots + a fix
   summary / commit / PR link to an issue. Reuses POST /api/qa/upload (the
   existing screenshot upload endpoint) — no parallel upload pipeline.

   Drag, drop, paste, file picker. Each successful upload is added to a
   staged list; submitting POSTs the path list + metadata to
   POST /api/qa/reports/[id]/evidence which creates a new cycle.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";

interface Staged { path: string; name: string; type: string; size: number; localUrl: string }

interface Props {
  issueId: string;
  onSaved: () => void;       // parent refetches; realtime also triggers
  defaultCommit?: string;
}

export default function FixEvidenceForm({ issueId, onSaved, defaultCommit = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [summary, setSummary] = useState("");
  const [commit, setCommit] = useState(defaultCommit);
  const [pr, setPr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  // Sync commit field if the parent passes in a new default.
  useEffect(() => { setCommit(defaultCommit); }, [defaultCommit]);

  // Free object URLs on unmount to avoid leaks.
  useEffect(() => () => { staged.forEach((s) => URL.revokeObjectURL(s.localUrl)); }, [staged]);

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { setErr("Only image files."); return; }
    if (file.size > 5 * 1024 * 1024) { setErr("Each image must be under 5 MB."); return; }
    setErr(null);
    setUploading((n) => n + 1);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/qa/upload", { method: "POST", body: fd });
      const json = (await r.json().catch(() => null)) as { path?: string; error?: string } | null;
      if (!r.ok || !json?.path) { setErr(json?.error || "Upload failed."); return; }
      const localUrl = URL.createObjectURL(file);
      const path = json.path;
      setStaged((prev) => [...prev, { path, name: file.name, type: file.type, size: file.size, localUrl }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading((n) => Math.max(0, n - 1));
    }
  }, []);

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((f) => { void upload(f); });
  }, [upload]);

  // Drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onOver = (e: DragEvent) => { e.preventDefault(); el.classList.add("ring-2", "ring-[var(--border-focus)]"); };
    const onLeave = () => { el.classList.remove("ring-2", "ring-[var(--border-focus)]"); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); el.classList.remove("ring-2", "ring-[var(--border-focus)]");
      if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
    };
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  // Paste from clipboard
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f && f.type.startsWith("image/")) files.push(f);
        }
      }
      if (files.length) handleFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, handleFiles]);

  const remove = (path: string) => {
    setStaged((prev) => {
      const next = prev.filter((s) => s.path !== path);
      const gone = prev.find((s) => s.path === path);
      if (gone) URL.revokeObjectURL(gone.localUrl);
      return next;
    });
  };

  const submit = async () => {
    if (busy) return;
    if (staged.length === 0 && !summary.trim() && !commit.trim() && !pr.trim()) {
      setErr("Add at least one screenshot or a summary."); return;
    }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/qa/reports/${issueId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summary.trim() || null,
          commit_hash: commit.trim() || null,
          pr_link: pr.trim() || null,
          after_attachments: staged.map((s) => ({ path: s.path, type: s.type, size: s.size })),
        }),
      });
      const json = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) { setErr(json?.error || "Could not save."); return; }
      // Reset
      staged.forEach((s) => URL.revokeObjectURL(s.localUrl));
      setStaged([]); setSummary(""); setPr(""); setOpen(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
      >
        + Add fix evidence
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          New fix evidence
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </button>
      </div>

      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-dim)]">After screenshots</label>
        <div
          ref={dropRef}
          className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-center text-[12px] text-[var(--text-dim)] transition"
        >
          Drop images here, paste with ⌘V, or{" "}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="font-semibold text-[var(--text-primary)] underline underline-offset-2"
          >
            choose files
          </button>
          {uploading > 0 && <span className="ms-2">· uploading {uploading}…</span>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.currentTarget.value = ""; }}
        />
        {staged.length > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {staged.map((s) => (
              <li key={s.path} className="relative">
                <img src={s.localUrl} alt="" className="block h-20 w-full rounded-md border border-[var(--border-subtle)] object-cover" />
                <button
                  type="button"
                  onClick={() => remove(s.path)}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 text-[10px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
                  aria-label="Remove"
                >✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-dim)]">Fix summary</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="What changed and why…"
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] leading-relaxed outline-none focus:border-[var(--border-focus)]"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-dim)]">Commit</label>
          <input
            value={commit}
            onChange={(e) => setCommit(e.target.value)}
            placeholder="a5b5481d"
            maxLength={80}
            className="w-full min-h-[38px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-dim)]">PR link</label>
          <input
            value={pr}
            onChange={(e) => setPr(e.target.value)}
            placeholder="https://github.com/…/pull/241"
            maxLength={500}
            className="w-full min-h-[38px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
        </div>
      </div>

      {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500">{err}</div>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || uploading > 0}
          className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save fix evidence"}
        </button>
      </div>
    </div>
  );
}
