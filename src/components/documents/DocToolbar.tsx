"use client";

/* ---------------------------------------------------------------------------
   DocToolbar — the shared action bar for every Documents-app editor
   (quotation / invoice / packing list). Mirrors the Invoices/Quotations
   toolbar: Back · Status · Save Draft · Save Final · Duplicate · Export PDF ·
   Excel · Send · Print · Delete. All behaviour is passed in via handlers so the
   same bar drives all three document kinds.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import TableIcon from "@/components/icons/ui/TableIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import PrintIcon from "@/components/icons/ui/PrintIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";

export type SaveState = "idle" | "saving" | "saved" | "error";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-yellow-500/15 text-yellow-400",
  final: "bg-green-500/15 text-green-300",
  sent: "bg-blue-500/15 text-blue-300",
  paid: "bg-green-500/20 text-green-300",
  cancelled: "bg-red-500/15 text-red-300",
};

function StatusPill({
  status,
  statuses,
  onChange,
}: {
  status: string;
  statuses: string[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const cls = STATUS_STYLE[status] ?? "bg-white/10 text-gray-200";
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-xs font-semibold uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 ${cls}`}
        style={{ letterSpacing: "0.03em", cursor: "pointer" }}
        title="Click to change status"
      >
        {status}
        <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 40,
            minWidth: 140,
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setOpen(false);
                if (s !== status) onChange(s);
              }}
              className="w-full text-left text-xs font-semibold uppercase px-3 py-2 rounded-md hover:bg-white/10 transition"
              style={{ color: s === status ? "#fff" : "rgba(255,255,255,0.7)", letterSpacing: "0.03em" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const btn =
  "inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed";

export default function DocToolbar({
  backLabel = "Templates",
  onBack,
  status,
  statuses = ["draft", "final", "sent"],
  onStatusChange,
  saveState,
  saveError,
  dirty,
  onSaveDraft,
  onSaveFinal,
  onDuplicate,
  onExportPdf,
  pdfLoading,
  onExcel,
  onSend,
  onPrint,
  onDelete,
}: {
  backLabel?: string;
  onBack: () => void;
  status: string;
  statuses?: string[];
  onStatusChange: (next: string) => void;
  saveState: SaveState;
  saveError?: string | null;
  dirty?: boolean;
  onSaveDraft: () => void;
  onSaveFinal: () => void;
  onDuplicate: () => void;
  onExportPdf: () => void;
  pdfLoading?: boolean;
  onExcel: () => void;
  onSend: () => void;
  onPrint: () => void;
  onDelete?: () => void;
}) {
  const saving = saveState === "saving";
  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        background: "#111",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
      >
        <ArrowLeftIcon size={15} />
        {backLabel}
      </button>

      <div style={{ flex: 1 }} />

      {dirty && saveState === "idle" && (
        <span
          title="You have unsaved changes"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 999, background: "rgba(255,204,0,0.12)", color: "#FFCC00", border: "1px solid rgba(255,204,0,0.28)" }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFCC00" }} />
          Unsaved
        </span>
      )}

      <StatusPill status={status} statuses={statuses} onChange={onStatusChange} />

      {saveState !== "idle" && (
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full ${
            saveState === "saving"
              ? "bg-blue-500/15 text-blue-300"
              : saveState === "saved"
                ? "bg-green-500/20 text-green-300"
                : "bg-red-500/20 text-red-300"
          }`}
          title={saveError || undefined}
        >
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "✓ Saved"}
          {saveState === "error" && "✕ Save failed"}
        </span>
      )}

      <button
        onClick={onSaveDraft}
        disabled={saving}
        className="px-4 py-2 text-sm text-gray-300 bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Draft"}
      </button>
      <button
        onClick={onSaveFinal}
        disabled={saving}
        className="px-4 py-2 text-sm bg-[var(--bg-inverted)] hover:opacity-90 text-[var(--text-inverted)] rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Final"}
      </button>
      <button onClick={onDuplicate} className={btn} title="Clone this document into a new draft (fresh number).">
        <CopyIcon size={14} /> Duplicate
      </button>
      <button onClick={onExportPdf} disabled={pdfLoading} className={btn} title="Open the browser print dialog and pick 'Save as PDF'.">
        <DownloadIcon size={14} /> {pdfLoading ? "Opening…" : "Export PDF"}
      </button>
      <button onClick={onExcel} className={btn} title="Download this document as an Excel (.xlsx) spreadsheet.">
        <TableIcon size={14} /> Excel
      </button>
      <button onClick={onSend} className={btn} title="Open your mail app pre-filled with the recipient and a cover note.">
        <PaperPlaneIcon size={14} /> Send
      </button>
      <button onClick={onPrint} className={btn}>
        <PrintIcon size={14} /> Print
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-400 bg-[var(--bg-surface)] hover:bg-red-500/20 rounded-lg transition"
          title="Delete this saved document"
        >
          <TrashIcon size={14} />
        </button>
      )}
    </div>
  );
}
