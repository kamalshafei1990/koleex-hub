"use client";

/* Brand Center — the files of one design: download for every reader; with
   the rights, add files (several at once) and remove one. A failure is shown
   under this design, where the action was — never at the top of the page. */

import { useRef, useState } from "react";
import { deleteDesignFile, fileDownloadHref, uploadDesignFile, type BcFile, type UploadError } from "@/lib/brand-center/client";
import RrIcon from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type T = (k: string) => string;

const size = (b: number | null) => (b === null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default function DesignFiles({ t, designId, files, canEdit, onChanged }: { t: T; designId: string; files: BcFile[]; canEdit: boolean; onChanged: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setProblem(null);
    const errors: Array<{ name: string; error: UploadError }> = [];
    for (const f of Array.from(list)) {
      setBusy(f.name);
      const r = await uploadDesignFile(designId, f);
      if (!r.ok) errors.push({ name: f.name, error: r.error });
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    if (errors.length) setProblem(errors.map((e) => `${e.name}: ${t(`files.${e.error}`)}`).join(" · "));
    await onChanged();
  };

  return (
    <div className="mt-2 w-full">
      {files.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((f) => (
            <li key={f.id} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-[12px]">
              <a href={fileDownloadHref(f.id)} dir="auto" className="inline-flex min-w-0 items-center gap-1.5 text-[var(--text-primary)] hover:underline" title={t("files.download")}>
                <RrIcon name="download" size={12} />
                <span className="truncate">{f.file_name}</span>
              </a>
              <span className="shrink-0 text-[11px] text-[var(--text-dim)] tabular-nums">{size(f.size_bytes)}</span>
              {canEdit && (
                <button type="button" aria-label={t("files.remove")} disabled={busy === f.id}
                  onClick={async () => { setBusy(f.id); const r = await deleteDesignFile(f.id); setBusy(null); if (!r.ok) setProblem(t("files.failed")); await onChanged(); }}
                  className="shrink-0 rounded p-0.5 text-[var(--text-dim)] hover:text-red-500">
                  <RrIcon name="cross" size={10} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit && (
        <div className="mt-1.5">
          <input ref={input} id={`bc-files-${designId}`} type="file" multiple className="hidden" onChange={(e) => void add(e.target.files)} />
          <button type="button" onClick={() => input.current?.click()} disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-subtle)] px-2 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60">
            {busy ? <SpinnerIcon size={11} /> : <RrIcon name="upload" size={11} />}
            {busy ? `${t("files.uploading")} ${busy.length > 40 ? "…" : busy}` : t("files.add")}
          </button>
        </div>
      )}
      {problem ? <p role="alert" dir="auto" className="mt-1.5 text-[12px] text-red-500">{problem}</p> : null}
    </div>
  );
}
