"use client";

/* ---------------------------------------------------------------------------
   Passport scan — upload, store, and read.

   Reading happens in the BROWSER: tesseract.js is loaded with a dynamic
   import, exactly as the Translator and the catalogue reader already do, so
   the OCR engine never enters the app's bundle and costs nothing to anyone
   who does not scan a passport.

   What it reads is the MRZ — the two dense lines at the foot of the data
   page — not the printed fields above it. Every MRZ field carries a check
   digit, so a mis-read character fails arithmetic instead of quietly becoming
   a wrong passport number on a consular document. Anything that fails its
   check is reported by name and left for the operator to type.

   The MRZ has no date of issue. That field always stays manual, and the box
   says so rather than leaving the operator to wonder why it stayed empty.
   --------------------------------------------------------------------------- */

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { travelT } from "@/lib/translations/travel";
import Button from "@/components/ui/Button";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { failedChecks, parseMrz, type MrzResult } from "@/lib/invitations/mrz";

/** Characters the MRZ can contain. Constraining the alphabet is most of what
 *  makes OCR of a machine-readable zone reliable. */
const MRZ_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<";

export default function PassportScanBox({
  contactId,
  onRead,
}: {
  contactId: string | null;
  onRead: (m: MrzResult) => void;
}) {
  const { t } = useTranslation(travelT);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<"upload" | "read" | null>(null);
  /** In-app viewer — a new-tab open strands the desktop app (no tabs there,
   *  no way back), exactly what happened with the licence. */
  const [viewingScan, setViewingScan] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Kept in memory so "read" can re-run without another round trip. */
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [scanUrl, setScanUrl] = useState<string | null>(null);

  /* ── read the MRZ out of an image ─────────────────────────────────────── */
  const read = useCallback(
    async (file: File) => {
      setBusy("read");
      setError(null);
      setNote(null);
      setProgress(0);
      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng", undefined, {
          logger: (m: { progress?: number }) =>
            setProgress(Math.round((m.progress ?? 0) * 100)),
        });
        try {
          await worker.setParameters({ tessedit_char_whitelist: MRZ_CHARS });
          const { data } = await worker.recognize(file);
          const parsed = parseMrz(data.text ?? "");
          if (!parsed) {
            setError(
              "Could not find the machine-readable zone. Photograph the whole data page, flat and in focus, including the two dense lines at the bottom.",
            );
            return;
          }
          onRead(parsed);
          const failed = failedChecks(parsed);
          setNote(
            failed.length === 0
              ? "Read and verified. The date of issue is not in the machine-readable zone — type it in."
              : `Read, but these did not verify and should be checked against the page: ${failed.join(", ")}. The date of issue is not in the zone — type it in.`,
          );
        } finally {
          await worker.terminate();
        }
      } catch {
        setError("Could not read the image.");
      } finally {
        setBusy(null);
        setProgress(0);
      }
    },
    [onRead],
  );

  /* ── upload to the private bucket ─────────────────────────────────────── */
  const upload = useCallback(
    async (file: File) => {
      if (!contactId) return;
      setBusy("upload");
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/contacts/${contactId}/passport`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "Upload failed.");
          return;
        }
        const body = (await res.json()) as { scanUrl: string | null };
        setScanUrl(body.scanUrl);
      } catch {
        setError("Upload failed.");
      } finally {
        setBusy(null);
      }
    },
    [contactId],
  );

  const onFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      setLocalFile(file);
      /* Read first — it is what the operator is waiting for. The upload runs
         after, and a failed upload never blocks the data they just got. */
      void read(file).then(() => {
        if (contactId) void upload(file);
      });
    },
    [contactId, read, upload],
  );

  return (
    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{t("scan.title")}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{t("scan.hint")}</p>
        </div>
        <div className="flex items-center gap-2">
          {scanUrl && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setViewingScan(true)}
            >
              {t("scan.view")}
            </Button>
          )}
          {localFile && !busy && (
            <Button variant="secondary" size="sm" onClick={() => void read(localFile)}>
              {t("scan.read")}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => fileRef.current?.click()}
          >
            {busy === "read" ? (
              <span className="flex items-center gap-2">
                <SpinnerIcon size={14} />
                {t("scan.reading")}
                {progress > 0 ? ` ${progress}%` : ""}
              </span>
            ) : busy === "upload" ? (
              <span className="flex items-center gap-2">
                <SpinnerIcon size={14} />
                {t("act.saving")}
              </span>
            ) : localFile ? (
              t("scan.replace")
            ) : (
              t("scan.upload")
            )}
          </Button>
        </div>
      </div>

      {viewingScan && scanUrl && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4 py-6 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setViewingScan(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("scan.title")}
        >
          <div
            className="kx-glass-pop relative max-h-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- one-off
                document view; next/image buys nothing here */}
            <img src={scanUrl} alt="Passport scan, full size" className="max-h-[85vh] w-auto max-w-[90vw] bg-white object-contain" />
            <button
              type="button"
              onClick={() => setViewingScan(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/90 text-lg leading-none text-[var(--text-primary)] shadow hover:bg-[var(--bg-surface-hover)]"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          /* Reset so choosing the SAME file again still fires a change. */
          e.target.value = "";
        }}
      />

      {!contactId && (
        <p className="mt-2 text-[11px] text-[var(--text-dim)]">
          Pick a customer first if you want the scan saved to their record. Reading works either way.
        </p>
      )}
      {note && <p className="mt-2 text-xs text-[var(--text-secondary)]">{note}</p>}
      {error && <p className="mt-2 text-xs text-[var(--state-error)]">{error}</p>}
    </div>
  );
}
