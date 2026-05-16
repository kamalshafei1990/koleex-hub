"use client";

/* ===========================================================================
   AttachmentList  —  Phase 2.1

   Compact monochrome list of attached files. Used inline inside the
   preview drawer. Each row shows: thumbnail (image) or PDF glyph,
   file name, category chip, size, upload date, primary-mark, audit
   metadata, and a small actions cluster (open, replace, remove).

   Mirrors the rest of Hub: hairline borders, monochrome surfaces,
   no chunky controls.
   ========================================================================== */

import { formatBytes, isImageMime, isPdfMime } from "@/lib/attachments/client";
import type { AttachmentCategory, FinanceAttachment } from "@/lib/finance/types";

const CATEGORY_LABEL: Record<AttachmentCategory, string> = {
  receipt:            "Receipt",
  invoice:            "Invoice",
  shipping_doc:       "Shipping",
  customs_doc:        "Customs",
  payment_screenshot: "Payment",
  contract:           "Contract",
  other:              "Doc",
};

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

interface Props {
  attachments: FinanceAttachment[];
  onOpen?: (a: FinanceAttachment) => void;
  onMakePrimary?: (a: FinanceAttachment) => void;
  onDelete?: (a: FinanceAttachment) => void;
  /** Show audit metadata (uploader account, etc.). Off by default for compact lists. */
  showAudit?: boolean;
}

export default function AttachmentList({
  attachments, onOpen, onMakePrimary, onDelete, showAudit = true,
}: Props) {
  if (attachments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] px-4 py-6 text-center text-[12px] text-gray-500">
        No files attached yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.05] bg-white/[0.012]">
      {attachments.map((a) => {
        const isImg = isImageMime(a.file_type);
        const isPdf = isPdfMime(a.file_type);
        return (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
            {/* Thumbnail or glyph */}
            <button
              type="button"
              onClick={() => onOpen?.(a)}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.04] transition-colors hover:bg-white/[0.08]"
              title="Open"
            >
              {isImg && a.signed_url ? (
                /* Native img tag — we don't want next/image to optimise a
                   short-lived signed URL into its loader cache. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.signed_url}
                  alt={a.file_name}
                  className="h-full w-full object-cover"
                />
              ) : isPdf ? (
                <PdfGlyph />
              ) : (
                <FileGlyph />
              )}
            </button>

            {/* Body */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-[12px] font-medium text-gray-200">{a.file_name}</span>
                {a.is_primary && (
                  <span className="rounded-full bg-white/[0.10] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-gray-300">
                    Primary
                  </span>
                )}
                <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-gray-400">
                  {CATEGORY_LABEL[a.category]}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                <span>{formatBytes(a.file_size)}</span>
                <span>·</span>
                <span>{shortDate(a.uploaded_at)}</span>
                {showAudit && a.uploaded_by && (
                  <>
                    <span>·</span>
                    <span title={a.uploaded_by} className="truncate max-w-[140px]">uploaded by {a.uploaded_by.slice(0, 8)}…</span>
                  </>
                )}
                {a.notes && (
                  <>
                    <span>·</span>
                    <span className="truncate italic text-gray-400">“{a.notes}”</span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1">
              <ActionButton onClick={() => onOpen?.(a)} title="Open">
                <OpenIcon />
              </ActionButton>
              {onMakePrimary && !a.is_primary && (
                <ActionButton onClick={() => onMakePrimary(a)} title="Mark primary">
                  <StarIcon />
                </ActionButton>
              )}
              {onDelete && (
                <ActionButton onClick={() => onDelete(a)} title="Remove" danger>
                  <TrashIcon />
                </ActionButton>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ActionButton({
  children, onClick, title, danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.05] bg-white/[0.02] transition-colors " +
        (danger
          ? "text-gray-400 hover:border-rose-500/[0.25] hover:bg-rose-500/[0.06] hover:text-rose-300"
          : "text-gray-400 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-gray-100")
      }
    >
      {children}
    </button>
  );
}

function OpenIcon() { return (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3h7v7" /><path d="M21 3l-9 9" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
); }

function PdfGlyph() { return (
  <span className="text-[9px] font-semibold tracking-wider text-gray-400">PDF</span>
); }

function FileGlyph() { return (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
  </svg>
); }

function StarIcon() { return (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15 9 22 9.3 17 14 18.5 21 12 17.5 5.5 21 7 14 2 9.3 9 9 12 2" />
  </svg>
); }

function TrashIcon() { return (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
); }
