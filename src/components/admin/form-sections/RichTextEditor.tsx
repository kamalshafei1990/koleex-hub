"use client";

/* ---------------------------------------------------------------------------
   RichTextEditor — lightweight contentEditable WYSIWYG with a toolbar.
   Zero external deps. Produces HTML that's safe to store in Supabase.

   Supported controls:
     Headings (H1/H2/H3/P), Bold, Italic, Underline, Font size, Font color,
     Bullet list, Numbered list, Alignment, Quote, Link, Table insert, Clear,
     Undo/Redo.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, useCallback } from "react";
import BoldIcon from "@/components/icons/ui/BoldIcon";
import ItalicIcon from "@/components/icons/ui/ItalicIcon";
import UnderlineIcon from "@/components/icons/ui/UnderlineIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import ListOrderedIcon from "@/components/icons/ui/ListOrderedIcon";
import AlignLeftIcon from "@/components/icons/ui/AlignLeftIcon";
import AlignCenterIcon from "@/components/icons/ui/AlignCenterIcon";
import AlignRightIcon from "@/components/icons/ui/AlignRightIcon";
import QuoteIcon from "@/components/icons/ui/QuoteIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";
import TypeIcon from "@/components/icons/ui/TypeIcon";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import RemoveFormattingIcon from "@/components/icons/ui/RemoveFormattingIcon";
import Undo2Icon from "@/components/icons/ui/Undo2Icon";
import Redo2Icon from "@/components/icons/ui/Redo2Icon";
import TableIcon from "@/components/icons/ui/TableIcon";
import Heading1Icon from "@/components/icons/ui/Heading1Icon";
import Heading2Icon from "@/components/icons/ui/Heading2Icon";
import Heading3Icon from "@/components/icons/ui/Heading3Icon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import Modal from "./Modal";
import { uploadProductFile } from "@/lib/products-admin";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const FONT_SIZES = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "14px" },
  { label: "Medium", value: "16px" },
  { label: "Large", value: "18px" },
  { label: "XL", value: "22px" },
  { label: "XXL", value: "28px" },
];

const COLORS = [
  "#ffffff", "#e5e7eb", "#9ca3af",
  "#fbbf24", "#f97316", "#ef4444",
  "#22c55e", "#10b981", "#14b8a6",
  "#3b82f6", "#6366f1", "#8b5cf6",
];

/* Platform-aware modifier for keyboard-shortcut tooltips. "⌘" is
   the Mac symbol for Command, "Ctrl+" is the Windows / Linux
   equivalent. Falls back to ⌘ during SSR since Koleex's ops team
   runs primarily on macOS — minor quirk, consistent visual. */
const MOD_KEY =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl+";

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 260 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [linkError, setLinkError] = useState<string | null>(null);

  /* Insert-link / insert-table used to shell out to native window.prompt()
     which Safari renders with a system dialog that clashes with the
     hub's dark theme. These state values drive dedicated dark-themed
     Modal dialogs (see below) so the popups match the rest of the UI. */
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  /* Image insert modal. Supports both file upload (→ Supabase
     Storage) and URL paste (hotlink to an external image). Alt
     text is captured here so the generated <img> tag has proper
     accessibility / SEO metadata out of the gate. */
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  /* Paste-with-formatting flag. Default paste (⌘V) strips
     everything to plain text — great for cleaning garbage from
     Word. ⌘+Shift+V flips this flag for ONE paste event so the
     browser's native rich-paste runs through unaltered (for when
     the admin really wants the bold + bullets + headings). */
  const preserveNextPasteRef = useRef(false);

  /* Text that was selected at the moment the admin opened the Link
     modal. We stash the Range because clicking an input inside the
     modal collapses the selection; without this, the createLink
     command runs against an empty selection and silently does
     nothing. Restored just before the exec call. */
  const savedRangeRef = useRef<Range | null>(null);

  /* The last HTML string this component emitted via onChange. Used
     by the sync effect below to distinguish "the parent is echoing
     back what I just typed" (skip — would reset the caret) from
     "the parent is injecting something new" (apply — e.g. the
     Description step's Quick Start Block buttons setting the
     editor content programmatically). The old `activeElement ===
     editor` guard blocked BOTH cases, so Quick Start Blocks had
     no visible effect while the editor was focused. */
  const lastEmittedRef = useRef<string>("");

  // Sync external value → editor content, preserving caret position
  // when the update is our own echo.
  useEffect(() => {
    if (!editorRef.current) return;
    // Already matches the DOM — nothing to do.
    if (editorRef.current.innerHTML === (value || "")) return;
    // If the incoming value is exactly the string we last emitted,
    // this is our own echo from an onInput — don't touch the DOM,
    // otherwise we'd jump the caret to position 0 on every keystroke.
    if (value === lastEmittedRef.current) return;
    // Otherwise it's a genuine external update — apply it even if
    // the editor is currently focused.
    editorRef.current.innerHTML = value || "";
    lastEmittedRef.current = value || "";
  }, [value]);

  const updateActive = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
      justifyLeft: document.queryCommandState("justifyLeft"),
      justifyCenter: document.queryCommandState("justifyCenter"),
      justifyRight: document.queryCommandState("justifyRight"),
    });
  }, []);

  const exec = useCallback((command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      /* Tag this as our own emission so the sync effect won't
         try to re-write the DOM (which would collapse the caret). */
      lastEmittedRef.current = html;
      onChange(html);
    }
    updateActive();
  }, [onChange, updateActive]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastEmittedRef.current = html;
      onChange(html);
    }
    updateActive();
  };

  /* Default paste strips formatting (keeps data clean when copying
     from Word / websites with heavy styles). Admin can hold
     ⌘+Shift+V (captured in handleKeyDown) to preserve HTML on the
     very next paste — handy for moving content from Google Docs
     with bullets + bold intact. */
  const handlePaste = (e: React.ClipboardEvent) => {
    if (preserveNextPasteRef.current) {
      preserveNextPasteRef.current = false;
      // Let the browser's native rich paste handle it.
      return;
    }
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  /* Capture ⌘+Shift+V before the paste event fires. Setting the
     ref here makes the very next onPaste skip the strip logic. */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod && e.shiftKey && (e.key === "v" || e.key === "V")) {
      preserveNextPasteRef.current = true;
      // Do NOT preventDefault — we still want the browser's native
      // paste handler to fire. The ref just tells handlePaste to
      // step out of the way this one time.
    }
  };

  const setBlock = (tag: string) => exec("formatBlock", tag);
  const setSize = (size: string) => {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const span = document.createElement("span");
      span.style.fontSize = size;
      try {
        const range = selection.getRangeAt(0);
        span.appendChild(range.extractContents());
        range.insertNode(span);
        selection.removeAllRanges();
      } catch {
        // ignore if DOM state is invalid
      }
    }
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    setShowSizes(false);
  };
  const setColor = (color: string) => {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, color);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    setShowColors(false);
  };

  /* Capture the caret / selection range inside the editor so we can
     restore it after the admin has been typing in the modal's input
     (moving focus away collapses the original range). */
  const snapshotSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
        return;
      }
    }
    savedRangeRef.current = null;
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    const range = savedRangeRef.current;
    editorRef.current?.focus();
    if (sel && range) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const openLinkModal = () => {
    snapshotSelection();
    setLinkUrl("");
    setLinkError(null);
    setLinkModalOpen(true);
  };

  /* Validate the URL before handing it to document.execCommand.
     The old flow happily created a link with any string the admin
     typed ("htp://", "google.com" with no protocol, etc.), then
     the rendered <a> silently went to a broken destination. Now
     we require a well-formed URL and auto-prepend https:// when
     the admin forgets the protocol. */
  const confirmLink = () => {
    const raw = linkUrl.trim();
    if (!raw) return;
    // Auto-prepend https:// for protocol-less input ("example.com").
    const candidate = /^(https?:|mailto:|tel:|ftp:|\/\/|\/|#)/i.test(raw)
      ? raw
      : `https://${raw}`;
    try {
      // Using URL() throws on malformed input — the only cheap
      // structural check we have without a full URL regex.
      new URL(candidate.startsWith("/") || candidate.startsWith("#") ? `https://x.test${candidate}` : candidate);
    } catch {
      setLinkError("That doesn't look like a valid URL. Include a domain (e.g. https://example.com).");
      return;
    }
    setLinkError(null);
    setLinkModalOpen(false);
    restoreSelection();
    exec("createLink", candidate);
  };

  const openImageModal = () => {
    snapshotSelection();
    setImageFile(null);
    setImageUrl("");
    setImageAlt("");
    setImageError(null);
    setImageUploading(false);
    setImageModalOpen(true);
  };

  /* Confirm the insert. Two paths:
     · File selected → upload to Supabase Storage via
       uploadProductFile → receive a public URL → insert <img>.
     · URL only → skip upload, insert <img> directly.
     Max file size ~8MB (keeps product pages fast). Insert adds a
     safe max-width style so big images don't blow past the
     content column on the public page. */
  const confirmImage = async () => {
    const url = imageUrl.trim();
    if (!imageFile && !url) {
      setImageError("Upload a file or paste an image URL.");
      return;
    }
    setImageError(null);

    let finalUrl = url;
    if (imageFile) {
      if (imageFile.size > 8 * 1024 * 1024) {
        setImageError("File is too large. Please upload an image under 8 MB.");
        return;
      }
      if (!/^image\//.test(imageFile.type)) {
        setImageError("Only image files are supported.");
        return;
      }
      setImageUploading(true);
      const uploaded = await uploadProductFile(imageFile);
      setImageUploading(false);
      if (!uploaded) {
        setImageError("Upload failed. Try again or paste an image URL instead.");
        return;
      }
      finalUrl = uploaded.url;
    }

    /* Light URL sanity check — same trick as the link validator.
       Reject clearly malformed strings; everything else we trust
       since the admin is the author. */
    try {
      new URL(finalUrl);
    } catch {
      setImageError("The image URL doesn't look valid.");
      return;
    }

    setImageModalOpen(false);
    restoreSelection();
    const alt = imageAlt.trim().replace(/"/g, "&quot;");
    const html = `<img src="${finalUrl}" alt="${alt}" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;" />`;
    exec("insertHTML", html);
  };

  const openTableModal = () => {
    snapshotSelection();
    setTableRows(3);
    setTableCols(3);
    setTableModalOpen(true);
  };

  const confirmTable = () => {
    const rows = Math.max(1, Math.min(50, Math.floor(tableRows || 0)));
    const cols = Math.max(1, Math.min(20, Math.floor(tableCols || 0)));
    setTableModalOpen(false);
    if (!rows || !cols) return;
    restoreSelection();
    let html = "<table class=\"rte-table\" style=\"width:100%;border-collapse:collapse;margin:8px 0;\"><tbody>";
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += "<td style=\"border:1px solid #374151;padding:6px 10px;\">&nbsp;</td>";
      }
      html += "</tr>";
    }
    html += "</tbody></table><p></p>";
    exec("insertHTML", html);
  };

  const clearFormatting = () => exec("removeFormat");

  const btn = (active: boolean) =>
    `h-8 w-8 rounded-lg flex items-center justify-center transition-all text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] ${
      active ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-inner" : ""
    }`;

  const divider = <div className="w-px h-5 bg-[var(--border-subtle)] mx-1" />;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 overflow-hidden focus-within:border-[var(--border-focus)] transition-colors">
      {/* Toolbar
          On narrow viewports the 20+ toolbar buttons used to wrap
          onto 3–4 rows and take up half the editor height. Switch
          to a single horizontally-scrollable row with flex-nowrap
          so the toolbar stays compact on mobile and admins can
          side-scroll to less-common actions. Custom scrollbar
          hidden since it looks ugly inside the toolbar surface. */}
      <div
        className="flex items-center gap-0.5 flex-nowrap overflow-x-auto px-2 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60 backdrop-blur scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {/* Headings */}
        <button type="button" onClick={() => setBlock("H1")} className={btn(false)} title="Heading 1"><Heading1Icon className="h-4 w-4" /></button>
        <button type="button" onClick={() => setBlock("H2")} className={btn(false)} title="Heading 2"><Heading2Icon className="h-4 w-4" /></button>
        <button type="button" onClick={() => setBlock("H3")} className={btn(false)} title="Heading 3"><Heading3Icon className="h-4 w-4" /></button>
        <button type="button" onClick={() => setBlock("P")} className={btn(false)} title="Paragraph"><TypeIcon className="h-4 w-4" /></button>
        {divider}
        {/* Basic formatting — tooltips now show the real platform
            shortcut instead of hard-coded "Ctrl+", so Mac admins
            see ⌘B / ⌘I / ⌘U which matches every other app on
            macOS. */}
        <button type="button" onClick={() => exec("bold")} className={btn(activeFormats.bold)} title={`Bold (${MOD_KEY}B)`}><BoldIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec("italic")} className={btn(activeFormats.italic)} title={`Italic (${MOD_KEY}I)`}><ItalicIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec("underline")} className={btn(activeFormats.underline)} title={`Underline (${MOD_KEY}U)`}><UnderlineIcon className="h-4 w-4" /></button>
        {divider}
        {/* Font size */}
        <div className="relative">
          <button type="button" onClick={() => { setShowSizes(!showSizes); setShowColors(false); }} className={`h-8 px-2 rounded-lg flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] ${showSizes ? "bg-[var(--bg-surface)]" : ""}`} title="Font size">
            Aa
          </button>
          {showSizes && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-2xl z-30 py-1 min-w-[140px]">
              {FONT_SIZES.map((s) => (
                <button key={s.value} type="button" onClick={() => setSize(s.value)} className="w-full px-4 py-1.5 text-left text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors" style={{ fontSize: s.value }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Font color */}
        <div className="relative">
          <button type="button" onClick={() => { setShowColors(!showColors); setShowSizes(false); }} className={`${btn(false)} ${showColors ? "bg-[var(--bg-surface)]" : ""}`} title="Font color">
            <PaletteIcon className="h-4 w-4" />
          </button>
          {showColors && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-2xl z-30 p-2 grid grid-cols-6 gap-1.5">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className="h-6 w-6 rounded-md border border-[var(--border-subtle)] hover:scale-110 transition-transform" style={{ backgroundColor: c }} title={c} />
              ))}
            </div>
          )}
        </div>
        {divider}
        {/* Lists */}
        <button type="button" onClick={() => exec("insertUnorderedList")} className={btn(activeFormats.insertUnorderedList)} title="Bullet list"><ListIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec("insertOrderedList")} className={btn(activeFormats.insertOrderedList)} title="Numbered list"><ListOrderedIcon className="h-4 w-4" /></button>
        {divider}
        {/* Alignment */}
        <button type="button" onClick={() => exec("justifyLeft")} className={btn(activeFormats.justifyLeft)} title="Align left"><AlignLeftIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec("justifyCenter")} className={btn(activeFormats.justifyCenter)} title="Align center"><AlignCenterIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec("justifyRight")} className={btn(activeFormats.justifyRight)} title="Align right"><AlignRightIcon className="h-4 w-4" /></button>
        {divider}
        {/* Quote */}
        <button type="button" onClick={() => setBlock("BLOCKQUOTE")} className={btn(false)} title="Quote"><QuoteIcon className="h-4 w-4" /></button>
        {/* Link */}
        <button type="button" onClick={openLinkModal} className={btn(false)} title="Insert link"><Link2Icon className="h-4 w-4" /></button>
        {/* Image */}
        <button type="button" onClick={openImageModal} className={btn(false)} title="Insert image"><PictureIcon className="h-4 w-4" /></button>
        {/* Table */}
        <button type="button" onClick={openTableModal} className={btn(false)} title="Insert table"><TableIcon className="h-4 w-4" /></button>
        {divider}
        {/* Undo/Redo/Clear */}
        <button type="button" onClick={() => exec("undo")} className={btn(false)} title={`Undo (${MOD_KEY}Z)`}><Undo2Icon className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec("redo")} className={btn(false)} title={`Redo (${MOD_KEY}Shift+Z)`}><Redo2Icon className="h-4 w-4" /></button>
        <button type="button" onClick={clearFormatting} className={btn(false)} title="Clear formatting"><RemoveFormattingIcon className="h-4 w-4" /></button>
      </div>

      {/* Editor surface
          dir="auto" — lets the browser flip individual paragraphs
          to RTL when the admin types Arabic / Hebrew / Persian
          without breaking the overall LTR layout when they mix
          English + Arabic in the same description (common on
          Koleex product pages). */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dir="auto"
        onInput={handleInput}
        onKeyUp={updateActive}
        onMouseUp={updateActive}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder || "Start typing…"}
        className="rte-content px-5 py-4 text-[14px] text-[var(--text-primary)] leading-relaxed outline-none focus:outline-none"
        style={{ minHeight }}
      />

      {/* ── Themed insert-link dialog ──
            Replaces window.prompt() which Safari renders with a
            system dialog that clashes with the hub's dark theme. */}
      <Modal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title="Insert link"
        subtitle="Paste the URL you want the selected text to point to."
        width="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setLinkModalOpen(false)}
              className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmLink}
              disabled={!linkUrl.trim()}
              className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all disabled:opacity-40"
            >
              Insert
            </button>
          </>
        }
      >
        <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">URL</label>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => { setLinkUrl(e.target.value); if (linkError) setLinkError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmLink();
            }
          }}
          autoFocus
          placeholder="https://example.com"
          className={`w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:ring-1 transition-all ${
            linkError
              ? "border-red-500/50 focus:border-red-500 focus:ring-red-500"
              : "border-[var(--border-subtle)] focus:border-[var(--border-focus)] focus:ring-[var(--border-focus)]"
          }`}
        />
        {linkError ? (
          <p className="text-[11px] text-red-400 mt-2">{linkError}</p>
        ) : (
          <p className="text-[11px] text-[var(--text-ghost)] mt-2">
            No protocol? We&apos;ll add <code className="bg-[var(--bg-surface)] px-1 rounded">https://</code> automatically.
          </p>
        )}
      </Modal>

      {/* ── Themed insert-table dialog ── */}
      <Modal
        open={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        title="Insert table"
        subtitle="Choose how many rows and columns to start with. You can edit cells afterwards."
        width="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setTableModalOpen(false)}
              className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmTable}
              disabled={!tableRows || !tableCols}
              className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all disabled:opacity-40"
            >
              Insert table
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Rows</label>
            <input
              type="number"
              min={1}
              max={50}
              value={tableRows}
              onChange={(e) => setTableRows(parseInt(e.target.value) || 0)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmTable(); } }}
              autoFocus
              className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Columns</label>
            <input
              type="number"
              min={1}
              max={20}
              value={tableCols}
              onChange={(e) => setTableCols(parseInt(e.target.value) || 0)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmTable(); } }}
              className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
            />
          </div>
        </div>
        <p className="text-[10px] text-[var(--text-ghost)] mt-3">
          Max 50 rows × 20 columns. A starter grid is inserted at the caret and you can keep typing inside it.
        </p>
      </Modal>

      {/* ── Themed insert-image dialog ──
            Upload a file OR paste an external URL. Alt text is
            captured here so the generated <img> has proper
            accessibility + SEO metadata from the moment it lands
            in the description. Images uploaded here go to the
            `media` bucket under `products/<timestamp>_<name>` and
            are served via Supabase's CDN — no separate record in
            the product_media table, these belong to the
            description body itself. */}
      <Modal
        open={imageModalOpen}
        onClose={() => { if (!imageUploading) setImageModalOpen(false); }}
        title="Insert image"
        subtitle="Upload a file or paste a URL. Alt text is important for SEO and screen readers."
        width="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setImageModalOpen(false)}
              disabled={imageUploading}
              className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmImage}
              disabled={imageUploading || (!imageFile && !imageUrl.trim())}
              className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold inline-flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
            >
              {imageUploading && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              {imageUploading ? "Uploading…" : "Insert"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* File drop zone */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Upload file</label>
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setImageFile(f || null);
                if (f) setImageUrl("");
                setImageError(null);
              }}
            />
            {imageFile ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                <PictureIcon className="h-5 w-5 text-[var(--text-dim)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] truncate">{imageFile.name}</p>
                  <p className="text-[10px] text-[var(--text-ghost)]">
                    {(imageFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setImageFile(null); if (imageFileInputRef.current) imageFileInputRef.current.value = ""; }}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  aria-label="Remove file"
                >
                  <CrossIcon className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                className="w-full h-24 rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50 hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <PictureIcon className="h-5 w-5 text-[var(--text-dim)]" />
                <span className="text-[11px] text-[var(--text-dim)]">Click to choose an image (max 8 MB)</span>
              </button>
            )}
          </div>

          {/* OR — URL */}
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            or paste a URL
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>
          <div>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                if (e.target.value) setImageFile(null);
                setImageError(null);
              }}
              placeholder="https://example.com/image.jpg"
              disabled={!!imageFile}
              className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          {/* Alt text */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
              Alt text <span className="text-[var(--text-ghost)] normal-case">(recommended)</span>
            </label>
            <input
              type="text"
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
              placeholder="e.g. Close-up of the walking-foot mechanism"
              className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1">
              Describe what the image shows. Screen readers use this; Google uses it for image search.
            </p>
          </div>

          {imageError && (
            <p className="text-[11px] text-red-400">{imageError}</p>
          )}
        </div>
      </Modal>

      <style jsx>{`
        .rte-content:empty::before {
          content: attr(data-placeholder);
          color: var(--text-ghost);
          pointer-events: none;
        }
        .rte-content h1 { font-size: 26px; font-weight: 700; margin: 12px 0 8px; }
        .rte-content h2 { font-size: 22px; font-weight: 700; margin: 10px 0 6px; }
        .rte-content h3 { font-size: 18px; font-weight: 600; margin: 8px 0 4px; }
        .rte-content p { margin: 6px 0; }
        .rte-content ul { list-style: disc; padding-left: 22px; margin: 8px 0; }
        .rte-content ol { list-style: decimal; padding-left: 22px; margin: 8px 0; }
        .rte-content li { margin: 3px 0; }
        .rte-content blockquote { border-left: 3px solid var(--border-focus); padding-left: 14px; color: var(--text-muted); font-style: italic; margin: 10px 0; }
        .rte-content a { color: #60a5fa; text-decoration: underline; }
        .rte-content table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        .rte-content td, .rte-content th { border: 1px solid var(--border-subtle); padding: 6px 10px; }
      `}</style>
    </div>
  );
}
