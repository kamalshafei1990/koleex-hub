"use client";

/* ---------------------------------------------------------------------------
   QuotationA4Preview — the printable A4 quotation surface.

   Visual language: the ORIGINAL Koleex quotation layout (heavy black
   strips, two-column meta tables, bordered items table with black
   headers, full bank ladder, multi-line footer) with light polish:

     · Slightly richer "rich black" #0A0A0A instead of pure #000 so
       the strips read as branded ink rather than printer-ink black.
     · Hairline borders bumped from #DDD to a softer #E5E7EB —
       cleaner on screen, identical on paper.
     · Tabular numbers everywhere money appears.
     · Tiny label fonts moved from 8 → 9 px for legibility, with
       widened tracking so they still feel like "labels".
     · Picture cell grew from 80 → 96 px so product photos breathe.
     · Inter (the Hub typeface) loaded explicitly instead of the
       generic Helvetica fallback chain.
     · Mono font for the SWIFT / account number rows so they're
       unmistakable.

   Every editable handle on the original kept its semantics — same
   `contentEditable` / placeholder data attrs, same image-upload
   click target, same row-delete affordance.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowDownIcon from "@/components/icons/ui/ArrowDownIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import BoldIcon from "@/components/icons/ui/BoldIcon";
import ItalicIcon from "@/components/icons/ui/ItalicIcon";
import UnderlineIcon from "@/components/icons/ui/UnderlineIcon";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import TypeIcon from "@/components/icons/ui/TypeIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";

/* Mirrors the Quotation type in Quotations.tsx — kept local to avoid
   a circular import. */
export interface QuotationItem {
  description: string;
  model: string;
  image: string;
  unitPrice: number;
  qty: number;
  notes: string;
}

export interface Quotation {
  id: string;
  customerName: string;
  companyName: string;
  invoiceNo: string;
  date: string;
  clientNo: string;
  validTill: string;
  /* Legacy free-form address field — kept for back-compat with older
     quotations that pre-date the structured QUOTATION TO card. The
     editor no longer surfaces it; use toAddress / toAcid / toEmail. */
  quotTo: string;
  /* Structured QUOTATION TO fields. Mirror the FROM card layout
     so the two parties are formatted identically: address line +
     phone / mobile / email / website grid. All optional so older
     docs still render. `toAcid` is kept for back-compat but no
     longer surfaced on the quotation (moved to Invoice template). */
  toAddress?: string;
  toAcid?: string;
  toPhone?: string;
  toMobile?: string;
  toEmail?: string;
  toWebsite?: string;
  items: QuotationItem[];
  tax: number;
  shipping: number;
  others: number;
  terms: string;
  /* Same enum as the parent's Quotation type (Quotations.tsx). The
     preview doesn't itself dispatch transitions — it only reads
     status when it needs to gate UI (e.g. hiding the editor chrome
     on accepted/expired quotes) — so we keep the local type loose
     to avoid coupling. */
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  createdAt: string;
  updatedAt: string;
  /* History of status transitions for this quote. Matches the parent
     type. Optional — never rendered by the preview directly today
     but propagated through editor saves. */
  statusHistory?: { status: string; at: string; by?: string }[];
  /* Per-quote authorised stamp + signature URLs. Optional — older
     quotations have these undefined and the editor falls back to the
     dashed-placeholder. See Quotations.tsx for the matching field on
     the parent's Quotation interface. */
  stampUrl?: string;
  signatureUrl?: string;
  /* Optional FK-by-text into the contacts table for the linked
     customer. Persisted in the doc payload (not the schema's
     customer_id column, which targets the legacy pricing-engine
     customers table). Lets the editor remember which CRM record a
     quote was auto-filled from. */
  customerContactId?: string;
  /* Master-data picks from the Terms quick-fill row. The renderer
     reads these so the picker dropdowns hydrate with the saved
     selection when an existing doc is opened. */
  paymentTermId?: string;
  incotermId?: string;
  incotermLocation?: string;
  shippingMethodId?: string;
}

interface Props {
  current: Quotation;
  setCurrent: Dispatch<SetStateAction<Quotation | null>>;
  updateItem: <K extends keyof QuotationItem>(
    idx: number,
    field: K,
    value: QuotationItem[K],
  ) => void;
  addItem: () => void;
  /* Optional handler for the "+ From catalog" button. The parent
     owns the picker modal — this prop just opens it. If undefined,
     the button is hidden (e.g. when used somewhere without a
     parent-supplied catalog). */
  onPickFromCatalog?: () => void;
  /* Optional handler for the "Link customer" button on the
     QUOTATION TO header. Parent owns the modal. */
  onPickCustomer?: () => void;
  /* Doc kind — flips the visible labels for the same renderer:
       "quotation" → "QUOTATION" / "Quotation No" / "Valid Till" /
                     "Quotation To"
       "invoice"   → "COMMERCIAL INVOICE" / "Invoice No" / "Due Date" /
                     "Invoice To"
     Defaults to "quotation" so existing callers don't need to
     update. The shared bones (KOLEEX header, items table, totals,
     stamp / signature) render identically. */
  docKind?: "quotation" | "invoice";
  /* Saved-asset hooks for the Stamp + Signature cards. The parent
     fetches /api/quotations/saved-assets on mount and passes the
     URLs (or null) here, plus the handlers that attach/detach an
     asset on the current quote. Buttons are gated on isSuperAdmin
     — for everyone else the cards behave like read-only previews
     (image renders if set, no editor affordance). */
  savedStampUrl?: string | null;
  savedSignatureUrl?: string | null;
  isSuperAdmin?: boolean;
  onAttachSavedStamp?: () => void;
  onAttachSavedSignature?: () => void;
  onUploadStamp?: (file: File) => void;
  onUploadSignature?: (file: File) => void;
  onClearStamp?: () => void;
  onClearSignature?: () => void;
  removeItem: (idx: number) => void;
  moveItem: (idx: number, direction: -1 | 1) => void;
  handleImageUpload: (idx: number, file: File) => void;
  fileInputRefs: MutableRefObject<{ [key: number]: HTMLInputElement | null }>;
  subTotal: number;
  grandTotal: number;
  fmt: (n: number) => string;
  numberToWords: (num: number) => string;
}

/* Token strip — single source of truth for the polished palette. */
const T = {
  black:    "#0A0A0A",   // rich black, used for every "black" strip
  ink:      "#1A1A1A",   // body text
  inkSoft:  "#4B5563",   // secondary text (footer, "thanks" line)
  inkGhost: "#9CA3AF",   // placeholders, very-fine print
  border:   "#E5E7EB",   // hairline borders
  surface:  "#F5F5F5",   // light gray label backgrounds (Subtotal, Bank labels)
  paper:    "#FFFFFF",
  mono:     "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/* Cell styles for the compact 4-column Koleex Contact card. Mirrors
   the meta-table label / value pattern but with tighter padding so
   the whole 3-row card stays ~92 px tall. */
const contactLabelCellStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#fff",
  background: "#0A0A0A",
  width: 80,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
  border: "1px solid #E5E7EB",
  padding: "4px 12px",
  verticalAlign: "middle",
};

const contactValueCellStyle: React.CSSProperties = {
  border: "1px solid #E5E7EB",
  padding: "4px 12px",
  verticalAlign: "middle",
  fontSize: 11,
};

const inputResetStyle: React.CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  font: "inherit",
  color: "inherit",
  width: "100%",
  padding: 0,
  margin: 0,
};

export default function QuotationA4Preview({
  current,
  setCurrent,
  updateItem,
  addItem,
  onPickFromCatalog,
  onPickCustomer,
  docKind = "quotation",
  savedStampUrl,
  savedSignatureUrl,
  isSuperAdmin,
  onAttachSavedStamp,
  onAttachSavedSignature,
  onUploadStamp,
  onUploadSignature,
  onClearStamp,
  onClearSignature,
  removeItem,
  moveItem,
  handleImageUpload,
  fileInputRefs,
  subTotal,
  grandTotal,
  fmt,
  numberToWords,
}: Props) {
  const setMeta = <K extends keyof Quotation>(key: K, value: Quotation[K]) =>
    setCurrent((prev) => (prev ? { ...prev, [key]: value } : prev));

  /* Total quantity across every line item — auto-injected into the
     "Total Qty:" line of the Terms & Conditions box so the salesperson
     doesn't have to keep that number in sync manually. */
  const totalQty = useMemo(
    () => current.items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0),
    [current.items],
  );
  /* Bumped every time something OUTSIDE the rich-text terms area
     changes the terms — Quick Fill picks, future 'apply customer
     defaults' button, etc. TermsArea force-syncs its innerHTML on
     this revision so the visible text matches even if the operator
     had the rich-text area focused at the moment of the pick. */
  const [termsRevision, setTermsRevision] = useState(0);

  /* Which item-description cell currently has the user's focus.
     The rich-text toolbar renders right above that cell so the user
     can hit B / I / U / colour / size without losing their text
     selection. */
  const [focusedItemIdx, setFocusedItemIdx] = useState<number | null>(null);

  /* `document.execCommand` is deprecated in spec but every browser
     (Chrome, Safari, Firefox, Edge) still supports the formatting
     primitives we need (bold / italic / underline / foreColor /
     fontSize). We wrap the calls so the toolbar can stay tiny and
     keep focus on the contentEditable via mouseDown preventDefault. */
  const exec = (cmd: string, value?: string) => {
    try { document.execCommand(cmd, false, value); }
    catch { /* command unsupported — silently ignore */ }
  };

  /* ─── Pagination ─────────────────────────────────────────────────
     Each page is packed with as many items as it physically holds.
     Capacities measured from the live render at 96 dpi:
       · A4 inner content height: 1067 px (297 mm minus 32 + 24 px
         border-box padding).
       · Row height: ~110 px (88 px picture cell + 22 px row padding).
       · Page 1 header section (logo band 94 + brand strips 68 +
         meta strip 62 + FROM card 200 + QUOTATION TO card 220 +
         margins ~30 + items thead 30) ≈ 705 px → 360 px left for
         items → 4 rows × 110 = 440 px (slight overshoot tolerated
         because real row height is closer to 104 with the smaller
         picture cell).
       · Middle page (no thead — header is page-1 only): 1067 px
         budget → 9 rows × 110 = 990 px, picked 8 for safety.
       · Last page (items + totals + terms + stamp + bank + footer):
         footer block ≈ 700 px → 360 px left → 3 rows.
     If items.length ≤ ITEMS_LAST the whole document collapses to a
     single page. */
  /* Reduced page 1 capacity 5 → 4 — the QUOTATION TO card grew when
     the Phone / Mobile / Email / Web inline grid was added, pushing
     the header section past 700 px. Five rows × 110 px would land
     within 5 px of the page bottom (visibly touches the A4 edge),
     so we drop one row and gain ~110 px of breathing space below
     the items table on page 1. */
  const ITEMS_FIRST  = 4;
  const ITEMS_MIDDLE = 8;
  const ITEMS_LAST   = 3;

  const pages = useMemo(() => {
    const items = current.items;
    if (items.length === 0) return [{ items: [] as QuotationItem[], startIdx: 0 }];
    if (items.length <= ITEMS_LAST) {
      // Everything fits on one page (header + items + footer)
      return [{ items, startIdx: 0 }];
    }
    if (items.length <= ITEMS_FIRST + ITEMS_LAST) {
      // Two pages: first holds ITEMS_FIRST, last holds the rest
      return [
        { items: items.slice(0, ITEMS_FIRST), startIdx: 0 },
        { items: items.slice(ITEMS_FIRST), startIdx: ITEMS_FIRST },
      ];
    }

    /* Multi-page layout. Rule: fill each page to ITEMS_MIDDLE before
       moving to the next — no half-empty middle pages just to leave
       room for the footer block. The last page either:
         · carries the remaining items + the footer block
           (when 1 ≤ remaining ≤ ITEMS_LAST, the footer block can sit
            alongside the items), OR
         · becomes a footer-only "summary" page with no items table
           (when remaining hits 0 because items ended on a middle-page
            boundary, OR when remaining > ITEMS_LAST so the items
            wouldn't fit alongside the footer).
       This trades a half-empty middle page for a clearly-purposed
       summary page — much less wasted space overall. */
    const out: { items: QuotationItem[]; startIdx: number }[] = [];
    out.push({ items: items.slice(0, ITEMS_FIRST), startIdx: 0 });
    let offset = ITEMS_FIRST;

    /* Push full middle pages while the remaining items wouldn't fit
       on the last page alongside the footer block. */
    while (items.length - offset > ITEMS_LAST) {
      const chunk = Math.min(ITEMS_MIDDLE, items.length - offset);
      out.push({ items: items.slice(offset, offset + chunk), startIdx: offset });
      offset += chunk;
    }

    /* Final page. Either remaining items + footer, or footer-only. */
    out.push({ items: items.slice(offset), startIdx: offset });
    return out;
  }, [current.items]);

  return (
    <div className="quot-a4-stack">
    {pages.map((page, pageIdx) => {
      const isFirstPage = pageIdx === 0;
      const isLastPage  = pageIdx === pages.length - 1;
      const totalPages  = pages.length;
      const pageItems   = page.items;
      const startItemIdx = page.startIdx;
      /* True on the LAST page that actually has item rows. When the
         document ends with a footer-only summary page, that's the
         page BEFORE this one (pages[pageIdx+1].items.length === 0).
         The items-table footer (Total qty / Total amount) renders
         only here so it doesn't get repeated mid-document. */
      const isLastItemPage =
        pageItems.length > 0 &&
        (isLastPage || (pages[pageIdx + 1]?.items.length ?? 0) === 0);
      return (
    <div
      key={pageIdx}
      id={isFirstPage ? "quotation-a4-preview" : undefined}
      className="quot-a4-doc"
      dir="ltr"
      style={{
        /* Sizing intentionally NOT set here — the CSS @media print
           rule in Quotations.tsx (which has !important) controls the
           printed page geometry. Setting height inline here was
           competing with the @media print override and Safari kept
           applying the screen height (297 mm) during print layout,
           producing one blank sheet after every real page when the
           printer was set to US Letter (279 mm).

           For the on-screen view we use min-height + width via class
           styles, applied through globals. */
        background: T.paper,
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        margin: pageIdx === 0 ? "0 auto" : "32px auto 0",
        color: T.ink,
        fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
        fontSize: 11,
        lineHeight: 1.45,
        position: "relative",
      }}
    >
      <div className="quot-doc-inner">

        {isFirstPage && (<>
        {/* ═══════════════════════════════════════════════════════════════
            (a) HEADER — logo + QUOTATION wordmark
            ═══════════════════════════════════════════════════════════════ */}
        <div
          className="pq-top-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            /* Taller header band so the KOLEEX logo + QUOTATION
               wordmark sit comfortably in the middle of the
               whitespace between the A4 top edge and the first
               table (the COMPANY NAME / SHAPING THE FUTURE
               strip). Old padding (8 / 12) crammed the logo
               into the very top. New 36 / 32 px padding pushes
               the brand mark to roughly the vertical centre of
               that opening band. */
            padding: "36px 0 32px",
          }}
        >
          {/* Koleex wordmark logo.
              Path content fills the viewBox edge-to-edge (vertices
              touch y=0 / y=107.57). With a tight render height of
              25.4 px the descender pixel was getting rounded off by
              the browser, cropping the bottom of every letter by
              ~1 px. Padding the viewBox by 4 units top + bottom and
              giving the SVG a hair more height fixes it without
              visually scaling the wordmark. */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="180"
            height="28"
            viewBox="-4 -4 727.83 115.57"
            preserveAspectRatio="xMinYMid meet"
            style={{ display: "block", overflow: "visible" }}
          >
            <path fill={T.black} d="M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z" />
            <path fill={T.black} d="M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z" />
            <path fill={T.black} d="M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z" />
            <path fill={T.black} d="M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
            <path fill={T.black} d="M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
            <path fill={T.black} d="M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31Z" />
          </svg>

          <div
            className="pq-top-title"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: T.black,
              letterSpacing: "0.08em",
            }}
          >
            {docKind === "invoice" ? "COMMERCIAL INVOICE" : "QUOTATION"}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            (b + c) BRAND STRIPS — black company line + gray tagline
            wrapped in a single rounded container so the radius shows
            only on the outer corners and the two strips read as one
            grouped header block (matches the rest of the document's
            rounded language).
            ═══════════════════════════════════════════════════════════════ */}
        <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div
            className="pq-strip-black"
            style={{
              background: T.black,
              color: "#fff",
              padding: "7px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            <span style={{ color: "#fff" }}>
              KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.
            </span>
            <span style={{ color: "#fff" }}>
              {"科莱恪斯国际商业管理（台州）有限公司"}
            </span>
          </div>

          <div
            className="pq-strip-gray"
            style={{
              background: T.surface,
              color: "#333",
              padding: "5px 16px",
              textAlign: "center",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.18em",
            }}
          >
            SHAPING THE FUTURE.
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            (d) Meta strip ABOVE the From / Quotation-To party row.
            Four equal-width cells (Date · Quotation No · Valid Till ·
            Client No) using CSS grid so each pair stays the SAME
            width regardless of value length. Below: two side-by-side
            party cards (FROM / QUOTATION TO).

            "Quotation To" — not "Bill To" — is the correct term on a
            quote: this document isn't a bill yet, it's a price
            offer.

            Same design tokens everywhere: 12 px radii, rich black
            uppercase labels, hairline #E5E7EB borders, mono font on
            phone numbers + invoice number.
            ═══════════════════════════════════════════════════════════════ */}

        {/* ── Meta strip (4 equal columns) ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <MetaStripCell
            label="Date"
            isFirst
          >
            <input
              value={current.date}
              onChange={(e) => setMeta("date", e.target.value)}
              style={{ ...inputResetStyle, fontSize: 11, fontVariantNumeric: "tabular-nums" }}
            />
          </MetaStripCell>
          <MetaStripCell label={docKind === "invoice" ? "Invoice No" : "Quotation No"}>
            <span
              data-quote-no={current.invoiceNo || undefined}
              style={{ fontSize: 11, fontFamily: T.mono, letterSpacing: "0.02em" }}
            >
              {current.invoiceNo || "—"}
            </span>
          </MetaStripCell>
          <MetaStripCell label={docKind === "invoice" ? "Due Date" : "Valid Till"}>
            <input
              value={current.validTill}
              onChange={(e) => setMeta("validTill", e.target.value)}
              style={{ ...inputResetStyle, fontSize: 11, fontVariantNumeric: "tabular-nums" }}
            />
          </MetaStripCell>
          <MetaStripCell label="Client No" isLast>
            <input
              value={current.clientNo}
              onChange={(e) => setMeta("clientNo", e.target.value)}
              placeholder="—"
              style={{ ...inputResetStyle, fontSize: 11, fontVariantNumeric: "tabular-nums" }}
            />
          </MetaStripCell>
        </div>

        {/* ── FROM / QUOTATION TO row ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 14,
          }}
        >
          {/* ── FROM (Koleex) ── */}
          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: T.black,
                color: "#fff",
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              From
            </div>
            <div style={{ padding: "10px 14px" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.ink,
                  marginBottom: 4,
                  letterSpacing: "0.01em",
                }}
              >
                KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.
              </div>
              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: T.inkSoft,
                  marginBottom: 8,
                }}
              >
                ROOM 206, BUILDING 88, WEST FEIYUE TECHNOLOGICAL INNOVATIVE PARK, JINGSHUI AN COMMUNITY, XIACHEN STREET, JIAOJIANG DISTRICT, TAIZHOU CITY, ZHEJIANG PROVINCE, CHINA
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "55px 1fr",
                  rowGap: 3,
                  columnGap: 8,
                  fontSize: 10,
                }}
              >
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Phone</span>
                <span style={{ fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }}>+86 0576 8892 7796</span>
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mobile</span>
                <span style={{ fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }}>+86 130 7380 0720</span>
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</span>
                <span style={{ color: T.ink }}>info@koleexgroup.com</span>
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Web</span>
                <span style={{ color: T.ink }}>www.koleexgroup.com</span>
              </div>
            </div>
          </div>

          {/* ── QUOTATION TO (Customer) ──
              Back to the free-form card: black "QUOTATION TO" header
              over a single content area. The body is laid out as a
              tidy stack — company name (bold, prominent) at the top,
              then an inline label-value grid for Address, ACID
              Number, Contact, Email so the structured fields read
              clearly without the heavy black-label table style. */}
          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: T.black,
                color: "#fff",
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>{docKind === "invoice" ? "Invoice To" : "Quotation To"}</span>
              {/* Link-to-CRM button. Editor-only (`.no-print`) so the
                  black header strip stays clean on the printed PDF. */}
              {onPickCustomer && (
                <button
                  type="button"
                  className="no-print"
                  onClick={onPickCustomer}
                  title="Pick a customer from the CRM — auto-fills the fields below."
                  style={{
                    background: "rgba(255,255,255,0.14)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.25)",
                    padding: "2px 8px",
                    borderRadius: 5,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {current.customerContactId ? "Change" : "Link Customer"}
                </button>
              )}
            </div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Company name — prominent at the top */}
              <input
                value={current.companyName}
                onChange={(e) => setMeta("companyName", e.target.value)}
                placeholder="Company name"
                style={{ ...inputResetStyle, fontSize: 12, fontWeight: 700, color: T.ink, letterSpacing: "0.01em" }}
              />
              {/* Address — full width line under the company name.
                  Auto-grows to fit content so a long project address
                  never shows a scrollbar (which was visible in PDF
                  exports). overflow:hidden + JS scrollHeight sync
                  works in every browser; field-sizing:content gives
                  the same behaviour natively on newer Safari/Chrome. */}
              <textarea
                ref={(el) => {
                  if (!el) return;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                rows={2}
                value={current.toAddress ?? ""}
                onChange={(e) => {
                  setMeta("toAddress", e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder="Address"
                style={{
                  ...inputResetStyle,
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: T.inkSoft,
                  resize: "none",
                  overflow: "hidden",
                  minHeight: 28,
                  fieldSizing: "content",
                } as React.CSSProperties}
              />
              {/* Inline label-value grid for the remaining structured
                  fields. 105 px label column comfortably fits the
                  longest label "CONTACT PERSON:" on a single line;
                  the other labels (PHONE / MOBILE / EMAIL / WEB)
                  just left-align inside the wider gutter. Every
                  label also has whiteSpace: nowrap as a belt-and-
                  braces guarantee against wrapping. */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "105px 1fr",
                  rowGap: 3,
                  columnGap: 8,
                  fontSize: 10,
                }}
              >
                {/* ACID Number intentionally NOT shown on the
                    quotation — generated by Egypt's NAFEZA portal
                    once a shipment is registered, so it belongs on
                    the Commercial Invoice + shipment docs. Field
                    stays on the doc data model (toAcid) for
                    back-compat and will be surfaced on the Invoice
                    template. */}
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Contact Person:</span>
                <input
                  value={current.customerName}
                  onChange={(e) => setMeta("customerName", e.target.value)}
                  placeholder="Contact person"
                  style={{ ...inputResetStyle, fontWeight: 700, color: T.ink }}
                />
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Phone</span>
                <input
                  value={current.toPhone ?? ""}
                  onChange={(e) => setMeta("toPhone", e.target.value)}
                  placeholder="—"
                  style={{ ...inputResetStyle, fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }}
                />
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Mobile</span>
                <input
                  value={current.toMobile ?? ""}
                  onChange={(e) => setMeta("toMobile", e.target.value)}
                  placeholder="—"
                  style={{ ...inputResetStyle, fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }}
                />
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Email</span>
                <input
                  value={current.toEmail ?? ""}
                  onChange={(e) => setMeta("toEmail", e.target.value)}
                  placeholder="email@example.com"
                  style={{ ...inputResetStyle, color: T.ink }}
                />
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Web</span>
                <input
                  value={current.toWebsite ?? ""}
                  onChange={(e) => setMeta("toWebsite", e.target.value)}
                  placeholder="www.example.com"
                  style={{ ...inputResetStyle, color: T.ink }}
                />
              </div>
            </div>
          </div>
        </div>
        </>)}

        {/* ═══════════════════════════════════════════════════════════════
            (f) ITEMS TABLE — black headers, bordered cells, rounded
            corners. We can't use the `overflow: hidden` wrapper trick
            here (it would clip the action-button + notes overlays
            that escape the TOTAL cell to the right). Instead we use
            `border-collapse: separate` on the table itself + a single
            outer table border + per-cell box-shadow grid lines, then
            round the table's outer corners with `border-radius`. The
            four corner cells get matching radii via CSS so the inner
            cell backgrounds curve to follow the table border.

            Skipped entirely on a "summary" last page (items exhausted
            on the previous page, this page exists only to carry the
            totals + bank + footer block). No phantom empty table. */}
        {pageItems.length > 0 && (
        <table
          className="pq-tbl"
          cellSpacing={0}
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            tableLayout: "fixed",
            marginTop: 12,
          }}
        >
          {/* Items-table header renders on PAGE 1 ONLY. Continuation
              pages (2..N) start straight with rows — saves vertical
              space and matches the user's preferred print convention.
              The column widths set on the <th> still apply to <td>
              widths in subsequent pages because tableLayout: "fixed"
              propagates the colgroup measurements. */}
          {isFirstPage && (
            <thead>
              <tr>
                {/* Column widths measured against worst-case real
                    data from the Koleex catalogue:
                    · NO     5%  — 1–2 digits
                    · ITEM  28% — long descriptions (the only
                              column that absorbs line breaks)
                    · MODEL 15% — codes up to 19 chars
                              (XSO-988LC-4T-24BCTQ)
                    · PIC   15% — picture cell capped at 110 px
                              square via aspectRatio
                    · UPRC  14% — "(FOB NINGBO)" subtitle needs
                              ~85 px to sit on one line
                    · QTY    7% — up to 3 digits / footer "235"
                    · TOTAL 16% — line totals up to "44,368" */}
                <Th width="5%"  align="center" isFirst>NO.</Th>
                <Th width="28%" align="center">ITEM</Th>
                <Th width="15%" align="center">MODEL</Th>
                <Th width="15%" align="center">PICTURE</Th>
                <Th width="14%" align="center">
                  <div>UNIT PRICE</div>
                  <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.85, marginTop: 1, letterSpacing: "0.04em" }}>
                    (FOB NINGBO)
                  </div>
                </Th>
                <Th width="7%"  align="center">QTY</Th>
                <Th width="16%" align="center" isLast>TOTAL</Th>
              </tr>
            </thead>
          )}
          {/* Tableless colgroup on continuation pages — same widths
              as the thead so cells stay column-aligned with page 1
              even without a header. */}
          {!isFirstPage && (
            <colgroup>
              <col style={{ width: "5%" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
          )}
          <tbody>
            {pageItems.map((item, localIdx) => {
              /* `idx` is the GLOBAL item index across all pages, so
                 the handlers (updateItem / removeItem / moveItem /
                 handleImageUpload) operate on the right item in the
                 master items array regardless of which page rendered
                 the row. */
              const idx = startItemIdx + localIdx;
              const lineTotal = (Number(item.unitPrice) || 0) * (Number(item.qty) || 0);
              return (
                <tr key={idx} style={{ height: "auto", position: "relative" }}>
                  {/* The NO. cell carries an explicit height: 112 so
                      the row's <tr> is guaranteed to be at least 112
                      px tall — that's what anchors the row action
                      cluster + notes panel (both 112 px) inside the
                      row. minHeight on <tr> itself is unreliable
                      across browsers due to table layout. */}
                  <Td align="center" style={{ color: T.inkSoft, fontVariantNumeric: "tabular-nums", height: 112 }}>
                    {idx + 1}
                  </Td>
                  <Td>
                    {/* Floating rich-text toolbar — only rendered for
                        the row whose description currently has focus.
                        It sits 8 px above the cell with a small gap.
                        Buttons use mouseDown.preventDefault so the
                        contentEditable's text selection survives the
                        click and execCommand applies cleanly. */}
                    {focusedItemIdx === idx && (
                      <RichTextToolbar exec={exec} />
                    )}
                    <div
                      className="quot-item-rich"
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Item description..."
                      onFocus={() => setFocusedItemIdx(idx)}
                      onBlur={(e) => {
                        updateItem(idx, "description", e.currentTarget.innerHTML);
                        /* Defer clearing so a toolbar click (which
                           moves focus briefly) doesn't immediately
                           hide the toolbar. If focus moves to a
                           different description, that cell's onFocus
                           overwrites `focusedItemIdx` before this
                           setTimeout fires, so no flicker. */
                        setTimeout(() => {
                          setFocusedItemIdx((prev) => (prev === idx ? null : prev));
                        }, 200);
                      }}
                      dangerouslySetInnerHTML={{ __html: item.description }}
                      style={{
                        minHeight: 32,
                        fontSize: 11,
                        lineHeight: 1.55,
                        outline: "none",
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                      }}
                    />
                  </Td>
                  <Td>
                    <div
                      className="pq-cell-wrap"
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Model"
                      onBlur={(e) => updateItem(idx, "model", e.currentTarget.textContent || "")}
                      dangerouslySetInnerHTML={{ __html: item.model }}
                      style={{
                        minHeight: 18,
                        fontSize: 11,
                        fontFamily: T.mono,
                        letterSpacing: "0.02em",
                        outline: "none",
                      }}
                    />
                  </Td>
                  <Td align="center">
                    <PictureCell
                      idx={idx}
                      image={item.image}
                      fileInputRefs={fileInputRefs}
                      onUpload={(f) => handleImageUpload(idx, f)}
                      onClear={() => updateItem(idx, "image", "")}
                    />
                  </Td>
                  <Td align="right">
                    <div
                      className="pq-in-r"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const val = parseFloat((e.currentTarget.textContent || "0").replace(/[^0-9.]/g, "")) || 0;
                        updateItem(idx, "unitPrice", val);
                      }}
                      style={{
                        textAlign: "right",
                        fontSize: 11,
                        fontVariantNumeric: "tabular-nums",
                        outline: "none",
                      }}
                    >
                      {item.unitPrice > 0 ? fmt(item.unitPrice) : "0"}
                    </div>
                  </Td>
                  <Td align="center">
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const val = parseInt((e.currentTarget.textContent || "0").replace(/[^0-9]/g, ""), 10) || 0;
                        updateItem(idx, "qty", val);
                      }}
                      style={{
                        textAlign: "center",
                        fontSize: 11,
                        fontVariantNumeric: "tabular-nums",
                        outline: "none",
                      }}
                    >
                      {item.qty}
                    </div>
                  </Td>
                  <Td align="right" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(lineTotal)}

                    {/* Floating row actions — ↑ / ↓ / ✕ rendered as
                        children of the TOTAL cell (not extra <td>s)
                        so the table layout stays at exactly 7 columns
                        with no phantom column after TOTAL. The
                        negative `right` offset pushes the cluster
                        past the A4's right edge into the dark page
                        background. Always visible (not hover-only)
                        so users can discover them at a glance.
                        Hidden only on print via `no-print`. */}
                    {/* The cluster is a single dark pill (matches the
                        notes panel + the Hub's surface tokens) with 3
                        icon buttons. Subtle hairline dividers between
                        buttons read as one grouped control rather
                        than 3 floating circles. */}
                    {/* Row action cluster — sits in the dark area
                        outside the A4 paper. Three separate pill
                        buttons stacked vertically. Hub design system:
                        rounded-xl, surface background, subtle border,
                        clear hover. Bigger than before (36 px) so
                        they're obviously discoverable. */}
                    {/* Row action cluster — CSS Grid with explicit
                        track sizes so the 3 buttons CAN'T escape the
                        pill. Same outer height (124 px) but laid out
                        as a rigid 3-row grid instead of flex (flex
                        was letting children spill past the wrapper
                        on shorter rows). */}
                    <div
                      className="no-print"
                      style={{
                        position: "absolute",
                        top: "50%",
                        transform: "translateY(-50%)",
                        /* Cluster fully outside the A4 paper frame.
                           Geometry:
                             paper inner right padding ..... 32 px
                             gap from paper outer edge ..... 40 px
                             cluster width ................. 40 px
                           right offset = 32 + 40 + 40 = 112. */
                        right: -112,
                        width: 40,
                        /* Cluster height shrunk 112 → 100 to leave
                           visible vertical breathing space (≈15 px
                           above + below) between adjacent rows'
                           clusters. Picture-cell-driven rows are
                           ~130 px tall, so the slack now reads as a
                           clear vertical gap between controls. */
                        height: 100,
                        boxSizing: "border-box",
                        display: "grid",
                        /* 3 rigid 28 px rows + 2 × 4 px row gaps fit
                           inside 100 px minus 4 px padding × 2 = 92
                           content height. 28×3 + 4×2 = 92 ≤ 92. */
                        gridTemplateRows: "28px 28px 28px",
                        rowGap: 4,
                        alignContent: "center",
                        justifyItems: "center",
                        background: "#1A1A1A",
                        border: "1px solid #2D2D2D",
                        borderRadius: 10,
                        padding: 4,
                        boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
                        overflow: "hidden",
                        zIndex: 2,
                      }}
                    >
                      <RowActionBtn
                        title="Move row up"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, -1)}
                        icon={<ArrowUpIcon size={14} />}
                      />
                      <RowActionBtn
                        title="Move row down"
                        disabled={idx === current.items.length - 1}
                        onClick={() => moveItem(idx, 1)}
                        icon={<ArrowDownIcon size={14} />}
                      />
                      <RowActionBtn
                        title="Remove row"
                        disabled={current.items.length <= 1}
                        onClick={() => removeItem(idx)}
                        icon={<TrashIcon size={13} />}
                        destructive
                      />
                    </div>

                    {/* Internal notes — paired with the action cluster.
                        Same SOLID surface, same height (124), same
                        vertical-centre anchor, same shadow. Sits 8 px
                        to the right of the cluster. */}
                    <div
                      className="quot-row-notes no-print"
                      style={{
                        position: "absolute",
                        top: "50%",
                        transform: "translateY(-50%)",
                        /* Cluster's outer-right edge sits at right
                           offset 112 (cluster width 40 + 40 gap +
                           32 paper padding). Notes starts 48 px to
                           the right of the cluster — generous visual
                           gap between the two controls — and is
                           200 px wide.
                             right_offset = 112 + 48 + 200 = 360. */
                        right: -360,
                        width: 200,
                        /* Matches cluster height; 30 px slack against
                           the ~130 px row leaves ~15 px breathing
                           space above and below adjacent notes
                           panels. */
                        height: 100,
                        boxSizing: "border-box",
                        background: "#1A1A1A",
                        border: "1px solid #2D2D2D",
                        borderRadius: 10,
                        padding: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        textAlign: "left",
                        boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "rgba(255, 255, 255, 0.5)",
                        }}
                      >
                        Internal note
                      </div>
                      <textarea
                        value={item.notes}
                        onChange={(e) => updateItem(idx, "notes", e.target.value)}
                        placeholder="Anything we shouldn't show the customer …"
                        style={{
                          flex: 1,
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          resize: "none",
                          color: "rgba(255, 255, 255, 0.85)",
                          fontFamily: "inherit",
                          fontSize: 11,
                          lineHeight: 1.45,
                          fontWeight: 400,
                        }}
                      />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
          {/* Items-table summary footer. Renders on the LAST page
              that holds item rows so the totals sit immediately
              below the final row — not repeated on every page,
              and not orphaned on the footer-only summary page. */}
          {isLastItemPage && (
            <tfoot>
              <tr>
                <td
                  colSpan={5}
                  style={{
                    background: T.surface,
                    padding: "8px 10px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textAlign: "right",
                    borderTop: `1px solid ${T.border}`,
                    borderBottomLeftRadius: 12,
                  }}
                >
                  Total
                </td>
                <td
                  style={{
                    background: T.surface,
                    padding: "8px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: "center",
                    fontVariantNumeric: "tabular-nums",
                    borderTop: `1px solid ${T.border}`,
                    borderLeft: `1px solid ${T.border}`,
                  }}
                >
                  {totalQty}
                </td>
                <td
                  style={{
                    background: T.surface,
                    padding: "8px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    borderTop: `1px solid ${T.border}`,
                    borderLeft: `1px solid ${T.border}`,
                    borderBottomRightRadius: 12,
                  }}
                >
                  US$ {fmt(subTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        )}

        {isLastPage && (<>
        {/* Add-row + From-catalog buttons. Empty row is the manual
            entry path; the catalog picker fills model, name, unit
            price and image in one click. */}
        <div className="no-print" style={{ display: "flex", gap: 8, margin: "10px 0 16px" }}>
          <button
            type="button"
            onClick={addItem}
            className="pq-add-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 28,
              padding: "0 14px",
              border: `1px solid ${T.border}`,
              background: "#fff",
              color: T.inkSoft,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            + Add row
          </button>
          {onPickFromCatalog && (
            <button
              type="button"
              onClick={onPickFromCatalog}
              className="pq-add-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 28,
                padding: "0 14px",
                border: `1px solid ${T.black}`,
                background: T.black,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              + From catalog
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            (g) BOTTOM ROW — totals (left) + terms (right)

            Flex (not a table) so the terms card on the right stretches
            to match the totals stack on the left even though the two
            sides have different content lengths. `align-items: stretch`
            (the flex default) makes both children equal height; the
            terms body uses `flex: 1` further down to fill whatever the
            taller side measures.
            ═══════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 16, marginTop: 4 }}>
          {/* LEFT: Totals stack. Subtotal + Tax + Shipping + Other +
              Grand Total + Total-in-Letters all live inside ONE rounded
              wrapper so the bottom-left corner curves under the
              in-letters row and the top-right curves over the
              Grand-Total bar. The two tables inside have their own
              borders stripped. */}
          <div className="pq-bot-l" style={{ width: "44%" }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <table cellSpacing={0} style={{ width: "100%", borderCollapse: "collapse", border: "none" }}>
                  <tbody>
                    <TotalsRow label="Subtotal" value={`US$ ${fmt(subTotal)}`} muted />
                    <TotalsRow
                      label="Tax"
                      editable
                      rawValue={current.tax}
                      onCommit={(v) => setMeta("tax", v)}
                    />
                    <TotalsRow
                      label="Shipping"
                      editable
                      rawValue={current.shipping}
                      onCommit={(v) => setMeta("shipping", v)}
                    />
                    <TotalsRow
                      label="Other"
                      editable
                      rawValue={current.others}
                      onCommit={(v) => setMeta("others", v)}
                    />
                    {/* Grand total */}
                    <tr className="pq-grand">
                      <td
                        className="pq-tl"
                        style={{
                          background: T.black,
                          borderColor: T.black,
                          padding: "8px 12px",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fff",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        Total
                      </td>
                      <td
                        className="pq-tv"
                        style={{
                          background: T.black,
                          borderColor: T.black,
                          padding: "8px 12px",
                          fontSize: 14,
                          fontWeight: 700,
                          textAlign: "right",
                          color: "#fff",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        US$ {fmt(grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Total in Letters — borders stripped, lives inside
                    the same rounded wrapper as the totals stack. */}
                <table
                  className="pq-tots"
                  cellSpacing={0}
                  style={{ width: "100%", borderCollapse: "collapse", border: "none" }}
                >
                  <tbody>
                    <tr>
                      <td
                        className="pq-tl"
                        style={{
                          fontWeight: 700,
                          background: T.surface,
                          width: 90,
                          fontSize: 9,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          borderTop: `1px solid ${T.border}`,
                          borderRight: `1px solid ${T.border}`,
                          padding: "6px 12px",
                        }}
                      >
                        Total in Letters
                      </td>
                      <td
                        className="pq-tv pq-tv-words"
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          textAlign: "right",
                          borderTop: `1px solid ${T.border}`,
                          padding: "6px 12px",
                        }}
                      >
                        {numberToWords(grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>

              {/* RIGHT: Terms & Conditions. Flex column so the header
                  stays its natural height and the body grows to fill
                  whatever vertical space the totals card on the left
                  consumes — keeping the two cards visually balanced
                  even when the totals stack adds tax / shipping rows. */}
              <div className="pq-bot-r" style={{ width: "56%", display: "flex", flexDirection: "column" }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
                  <div
                    className="pq-terms-label"
                    style={{
                      background: T.black,
                      padding: "6px 12px",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#fff",
                    }}
                  >
                    Terms &amp; Conditions
                  </div>
                  {/* Quick-fill row — Apple-pill dropdowns that write
                      formatted lines into the rich-text terms below
                      AND save the FK id on the doc so it re-opens
                      with the same selection. .no-print so the
                      exported PDF only shows the resulting text, not
                      the dropdowns themselves. */}
                  <QuickFillBar
                    paymentTermId={current.paymentTermId}
                    incotermId={current.incotermId}
                    incotermLocation={current.incotermLocation}
                    shippingMethodId={current.shippingMethodId}
                    onChange={(patch) => {
                      const next = { ...current, ...patch.fields };
                      if (patch.termsLineUpdates) {
                        next.terms = applyQuickFillToTerms(
                          current.terms,
                          patch.termsLineUpdates,
                        );
                      }
                      setCurrent(next);
                      /* Force the rich-text terms area to re-sync
                         even if the operator had it focused when
                         they used the dropdown. Without this bump
                         the visible text would lag until the
                         150 ms blur-grace window fired. */
                      setTermsRevision((v) => v + 1);
                    }}
                  />
                  <div className="pq-terms-value" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <TermsArea
                      terms={current.terms}
                      totalQty={totalQty}
                      onCommit={(v) => setMeta("terms", v)}
                      externalRevision={termsRevision}
                    />
                  </div>
                </div>
              </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            (h) AUTHORISED STAMP | AUTHORISED SIGNATURE — two separate
            cards side by side, mirroring the Totals + Terms row above
            them. Splitting them into a 2-column grid makes the last
            page read as two clean rows of paired cards (financial /
            commitment + stamp / signature) rather than a stacked
            mess with a right-aligned card and empty space on the
            left. Same design tokens as the rest of the document.
            ═══════════════════════════════════════════════════════════════ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 12,
          }}
        >
          {/* ── Authorised Stamp ── */}
          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: T.black,
                color: "#fff",
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Authorised Stamp
            </div>
            <div style={{ padding: 12 }}>
              {/* Stamp area — 150 px square ≈ 40 mm at 96 dpi which is
                  the standard Egyptian/Chinese corporate-stamp size.
                  When current.stampUrl is set we render the image
                  centred inside the same box at object-fit: contain
                  so the stamp keeps its aspect ratio at real size. */}
              <StampSignatureBox
                imageUrl={current.stampUrl}
                placeholder="Affix Stamp Here"
                onClear={onClearStamp}
                isEditable={!!isSuperAdmin}
                aspectSquare
              >
                {!current.stampUrl && isSuperAdmin && (
                  <StampSignatureActions
                    label="stamp"
                    savedUrl={savedStampUrl ?? null}
                    onUseSaved={onAttachSavedStamp}
                    onUpload={onUploadStamp}
                  />
                )}
              </StampSignatureBox>
            </div>
          </div>

          {/* ── Authorised Signature ── */}
          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                background: T.black,
                color: "#fff",
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Authorised Signature
            </div>
            <div
              style={{
                padding: 12,
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Signature area — full width, same 150 px height so the
                  card matches the stamp card. Renders the signature
                  image at object-fit: contain so the operator's
                  handwriting keeps its real proportions. */}
              <StampSignatureBox
                imageUrl={current.signatureUrl}
                placeholder="Sign Here"
                onClear={onClearSignature}
                isEditable={!!isSuperAdmin}
              >
                {!current.signatureUrl && isSuperAdmin && (
                  <StampSignatureActions
                    label="signature"
                    savedUrl={savedSignatureUrl ?? null}
                    onUseSaved={onAttachSavedSignature}
                    onUpload={onUploadSignature}
                  />
                )}
              </StampSignatureBox>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            (i) BANK DETAILS — black bar + 6-row ladder, wrapped in a
            single rounded container so the black "RECEIVING USD …"
            strip curves at the top corners and the last bank row
            curves at the bottom corners.
            ═══════════════════════════════════════════════════════════════ */}
        <div
          style={{
            marginTop: 16,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            className="pq-bank-bar"
            style={{
              padding: "6px 12px",
              background: T.black,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#fff",
            }}
          >
            Receiving U.S Dollar Payment At
          </div>
          <table
            className="pq-bank"
            cellSpacing={0}
            style={{ width: "100%", borderCollapse: "collapse", border: "none" }}
          >
            <tbody>
              <BankRow label="Beneficiary Bank" value="AGRICULTURAL BANK OF CHINA, ZHEJIANG BRANCH" />
              <BankRow label="SWIFT Code" value="ABOCCNBJ110" mono />
              <BankRow label="Beneficiary Name" value="KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO. LTD." />
              <BankRow label="Beneficiary A/C No." value="19905814040007205" mono />
              <BankRow label="Bank Address" value="100 JIANGJIN ROAD, SHANGCHENG DISTRICT, HANGZHOU, ZHEJIANG, CHINA" />
              <BankRow
                label="Beneficiary Address"
                value="ROOM 206, BUILDING 88, WEST FEIYUE TECHNOLOGICAL INNOVATIVE PARK, JINGSHUI AN COMMUNITY, XIACHEN STREET, JIAOJIANG DISTRICT, TAIZHOU CITY, ZHEJIANG PROVINCE, CHINA"
              />
            </tbody>
          </table>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            (j) FOOTER
            ═══════════════════════════════════════════════════════════════ */}
        <div
          className="pq-footer"
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: `1px solid ${T.border}`,
            textAlign: "center",
            fontSize: 10,
            lineHeight: 1.7,
            color: T.inkSoft,
          }}
        >
          If you have any questions regarding this quotation, please contact
          <br />
          <strong style={{ fontWeight: 700, color: T.ink }}>Mr. Kamal Shafei</strong> · info@koleexgroup.com · +86 130 7380 0720
          <br />
          <span
            style={{
              display: "inline-block",
              marginTop: 4,
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: T.inkGhost,
            }}
          >
            Thank you for choosing Koleex
          </span>
        </div>
        </>)}

        {/* Page number badge — bottom-right of every page, no-print
            (the @page CSS handles the print version). Lets the user
            see "Page 2 of 5" while editing on screen. */}
        {totalPages > 1 && (
          <div
            className="no-print"
            style={{
              position: "absolute",
              right: 32,
              bottom: 12,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.inkGhost,
              fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
            }}
          >
            Page {pageIdx + 1} of {totalPages}
          </div>
        )}
      </div>
    </div>
      );
    })}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function RoundedTable({ width, children }: { width?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: width ?? "auto",
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/* Terms & Conditions box — rich-text WYSIWYG.
   ──────────────────────────────────────────────────────
   The terms field is a contentEditable surface with a compact
   formatting toolbar (Bold / Italic / Underline / Font size / Font
   colour) that appears whenever the area is focused. The user can
   style any portion of the text; the doc preview and the printed
   PDF render the HTML as-is.

   "Total Qty: <N>" auto-management:
     · The parent recomputes `totalQty` whenever items change.
     · `displayedTerms` runs an HTML-tolerant regex that replaces
       the existing number (or appends a fresh line if the label
       isn't there at all) — the regex skips over any formatting
       tags wrapped around "Total Qty:".
     · We mirror the result into the contentEditable's innerHTML
       via a ref + useEffect, ONLY when the box is not focused —
       otherwise the caret would jump mid-keystroke.
     · `onBlur` saves the full innerHTML (preserving formatting)
       back to current.terms.

   Backward compatibility:
     · Older quotes stored plain text with "\n" newlines. On first
       render we detect the absence of HTML tags and convert "\n"
       to "<br>" so the legacy content displays correctly. */

const FONT_SIZE_OPTIONS = [
  { label: "9", value: "9px" },
  { label: "10", value: "10px" },
  { label: "11", value: "11px" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
];

const FONT_COLOR_OPTIONS = [
  "#000000", "#374151", "#6b7280",
  "#dc2626", "#ea580c", "#ca8a04",
  "#16a34a", "#0891b2", "#2563eb",
  "#7c3aed", "#c026d3", "#db2777",
];

function injectTotalQty(rawTerms: string, totalQty: number): string {
  /* Detect whether the stored value is plain text (legacy) or HTML.
     We treat anything with an angle-bracket tag as HTML. Plain text
     gets its "\n" line breaks converted to <br> for display. */
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(rawTerms);
  const html = looksLikeHtml ? rawTerms : rawTerms.replace(/\n/g, "<br>");

  /* Match the "Total Qty:" label tolerant to formatting tags wrapped
     around it (<b>, <span style=...>, etc.) and to existing digits
     after the colon. Captures the label + any whitespace/inline tags
     between the colon and the number so we can preserve them. <br>
     and block tags are EXCLUDED from the gap — otherwise a stored
     "Total Qty: <br>Shipping marks…" gets the number wedged in front
     of the next line ("Total Qty: <br>185Shipping marks…"). */
  const labelRe =
    /(Total Qty:)((?:\s|&nbsp;|<(?!br\b|\/?(?:div|p|li|ul|ol)\b)\/?[^>]+>)*)\d*/i;
  if (labelRe.test(html)) {
    return html.replace(labelRe, (_m, label: string, between: string) => {
      const gap = between.trim() === "" ? " " : between;
      return `${label}${gap}${totalQty}`;
    });
  }

  /* No "Total Qty:" found — append a fresh line at the very end. */
  const trimmed = html.replace(/(?:<br\s*\/?>\s*|\s)+$/i, "");
  const sep = trimmed ? "<br>" : "";
  return `${trimmed}${sep}Total Qty: ${totalQty}`;
}

function TermsArea({
  terms,
  totalQty,
  onCommit,
  externalRevision = 0,
}: {
  terms: string;
  totalQty: number;
  onCommit: (next: string) => void;
  /* Bumped by the parent whenever something OTHER than the user
     typing changes the terms (Quick Fill pick, customer-defaults
     apply, etc.). When this number changes we force-sync the
     innerHTML even if the area still thinks it's focused — the
     dropdown click moved keyboard focus away momentarily but the
     blurTimer hasn't fired, so without this we'd swallow the
     external update for 150 ms. */
  externalRevision?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  /* Toolbar visibility is sticky for ~150 ms after blur so clicking a
     toolbar button (which momentarily moves focus to the button)
     doesn't make the bar flicker out before the command runs. */
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const displayedTerms = useMemo(
    () => injectTotalQty(terms, totalQty),
    [terms, totalQty],
  );

  /* Track the last externalRevision we synced so we only force-sync
     on a NEW external change, not every render. */
  const lastSyncedRevision = useRef<number>(-1);

  useEffect(() => {
    if (!ref.current) return;
    /* External revision changed — force-sync even if focused. After
       syncing, move the caret to the end so the operator can
       immediately continue typing after the inserted line. */
    if (externalRevision !== lastSyncedRevision.current) {
      lastSyncedRevision.current = externalRevision;
      if (ref.current.innerHTML !== displayedTerms) {
        ref.current.innerHTML = displayedTerms;
        if (focused) {
          /* Restore caret to end of content. */
          const range = document.createRange();
          range.selectNodeContents(ref.current);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
      return;
    }
    /* Normal path — only sync when not actively editing, so a
       user keystroke doesn't get clobbered by an auto-rerender from
       the parent (e.g. Total Qty auto-injection during typing). */
    if (focused) return;
    if (ref.current.innerHTML !== displayedTerms) {
      ref.current.innerHTML = displayedTerms;
    }
  }, [displayedTerms, focused, externalRevision]);

  /* Save the live HTML into the parent. Called on blur and after
     every formatting command so an in-flight edit doesn't get lost
     if the user clicks Save without first blurring the area. */
  const commit = () => {
    if (!ref.current) return;
    onCommit(ref.current.innerHTML);
  };

  /* `document.execCommand` is officially deprecated but remains the
     simplest cross-browser path for contentEditable formatting. It
     still works in every shipping browser; the alternative (custom
     range manipulation) is several hundred lines for the same UX. */
  const exec = (cmd: string, value?: string) => {
    if (!ref.current) return;
    /* Make sure the selection is still inside our editor — clicking a
       toolbar button moves focus, but execCommand operates on the
       active document selection, which we restored just by re-focusing
       the editor. */
    ref.current.focus();
    document.execCommand(cmd, false, value);
    commit();
  };

  const applyFontSize = (px: string) => {
    /* execCommand("fontSize") only takes the legacy 1–7 size keyword.
       To get pixel-perfect sizing we tag the selection with a class-
       free <span style="font-size:Npx"> instead. Steps:
         1) Use a sentinel size of 7 to wrap the selection in <font>.
         2) Walk those <font> elements and rewrite them as <span> with
            the desired inline font-size.  */
    if (!ref.current) return;
    ref.current.focus();
    document.execCommand("fontSize", false, "7");
    const fonts = ref.current.querySelectorAll('font[size="7"]');
    fonts.forEach((f) => {
      const span = document.createElement("span");
      span.style.fontSize = px;
      span.innerHTML = f.innerHTML;
      f.replaceWith(span);
    });
    commit();
    setShowSizePicker(false);
  };

  const applyColor = (color: string) => {
    exec("foreColor", color);
    setShowColorPicker(false);
  };

  const handleBlur = () => {
    /* Defer blur so a toolbar-button click can run exec() before the
       toolbar collapses. The button's onMouseDown calls preventDefault
       to avoid yanking the selection, and we clear this timer if the
       editor regains focus. */
    blurTimer.current = setTimeout(() => {
      setFocused(false);
      setToolbarOpen(false);
      setShowSizePicker(false);
      setShowColorPicker(false);
      commit();
    }, 150);
  };

  const handleFocus = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setFocused(true);
    setToolbarOpen(true);
  };

  /* The toolbar's mousedown handler — used by every button. Prevents
     the default selection-clearing behaviour so the editor's current
     selection survives the click. */
  const swallow = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      style={{ display: "flex", flexDirection: "column", flex: 1 }}
      onMouseLeave={() => {
        setShowSizePicker(false);
        setShowColorPicker(false);
      }}
    >
      {/* Toolbar — only rendered while the area has focus. `no-print`
          keeps it off the exported PDF. */}
      {toolbarOpen && (
        <div
          className="no-print pq-tc-toolbar"
          onMouseDown={swallow}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderBottom: `1px solid ${T.border}`,
            background: T.surface,
            fontSize: 11,
            position: "relative",
            flexWrap: "wrap",
          }}
        >
          <TermsToolbarButton title="Bold" onClick={() => exec("bold")}>
            <BoldIcon className="h-3.5 w-3.5" />
          </TermsToolbarButton>
          <TermsToolbarButton title="Italic" onClick={() => exec("italic")}>
            <ItalicIcon className="h-3.5 w-3.5" />
          </TermsToolbarButton>
          <TermsToolbarButton title="Underline" onClick={() => exec("underline")}>
            <UnderlineIcon className="h-3.5 w-3.5" />
          </TermsToolbarButton>

          <span style={{ width: 1, height: 14, background: T.border, margin: "0 2px" }} />

          <TermsToolbarButton
            title="Font size"
            onClick={() => {
              setShowSizePicker((v) => !v);
              setShowColorPicker(false);
            }}
            active={showSizePicker}
          >
            <TypeIcon className="h-3.5 w-3.5" />
          </TermsToolbarButton>
          {showSizePicker && (
            <div
              onMouseDown={swallow}
              style={{
                position: "absolute",
                top: "100%",
                left: 96,
                marginTop: 2,
                background: T.paper,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: 4,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                display: "flex",
                gap: 2,
                zIndex: 5,
              }}
            >
              {FONT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => applyFontSize(opt.value)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 5,
                    fontSize: 11,
                    border: "none",
                    background: "transparent",
                    color: T.ink,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.surface)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <TermsToolbarButton
            title="Text colour"
            onClick={() => {
              setShowColorPicker((v) => !v);
              setShowSizePicker(false);
            }}
            active={showColorPicker}
          >
            <PaletteIcon className="h-3.5 w-3.5" />
          </TermsToolbarButton>
          {showColorPicker && (
            <div
              onMouseDown={swallow}
              style={{
                position: "absolute",
                top: "100%",
                left: 132,
                marginTop: 2,
                background: T.paper,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                display: "grid",
                gridTemplateColumns: "repeat(6, 18px)",
                gap: 4,
                zIndex: 5,
              }}
            >
              {FONT_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => applyColor(c)}
                  title={c}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `1px solid ${T.border}`,
                    background: c,
                    cursor: "pointer",
                    padding: 0,
                  }}
                />
              ))}
            </div>
          )}

          <span style={{ width: 1, height: 14, background: T.border, margin: "0 2px" }} />

          <TermsToolbarButton title="Clear formatting" onClick={() => exec("removeFormat")}>
            <CrossIcon className="h-3.5 w-3.5" />
          </TermsToolbarButton>
        </div>
      )}
      <div
        ref={ref}
        className="pq-tc-area"
        contentEditable
        suppressContentEditableWarning
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={() => {
          /* Live-save while typing keeps current.terms in sync so a
             save click before blur captures the latest text. We only
             commit here when the structure is stable; format commands
             also call commit() directly. */
          commit();
        }}
        style={{
          width: "100%",
          fontSize: 11,
          fontWeight: 400,
          lineHeight: 1.65,
          border: "none",
          padding: "10px 12px",
          /* flex:1 grows the editable area to fill the rounded card so
             the right side matches the totals card height; minHeight is
             a floor for the edge case where the totals card is somehow
             shorter than 90 px. */
          flex: 1,
          minHeight: 90,
          outline: "none",
          whiteSpace: "pre-wrap",
        }}
      />
    </div>
  );
}

/* Tiny toolbar button reused by every Terms-area formatting control.
   Mousedown is swallowed so the click doesn't blur the editor and
   wipe the active selection before exec() can act on it. */
function TermsToolbarButton({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        width: 24,
        height: 22,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: active ? "rgba(0,0,0,0.08)" : "transparent",
        color: "#1f2937",
        borderRadius: 5,
        cursor: "pointer",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Quick-fill bar — three Apple-pill dropdowns above the Terms editor:

     [Payment Term ▾]   [Price Type ▾]   [Sent by ▾]

   Each dropdown pulls from the matching Workspace master list
   (/api/payment-terms, /api/incoterms, /api/shipping-methods). On
   pick, the parent gets two things:
     · `fields`  — { paymentTermId?, incotermId?, shippingMethodId? }
                   to persist the FK on the doc so re-opening rehydrates.
     · `termsLineUpdates` — keyed text rewrites that get spliced into
                   the rich-text terms by `applyQuickFillToTerms` below.

   `.no-print` keeps the bar off the exported PDF — the printed doc
   only shows the final terms text, not the picker chrome.
   ───────────────────────────────────────────────────────────────────── */

interface QuickFillPatch {
  fields: {
    paymentTermId?: string;
    incotermId?: string;
    incotermLocation?: string;
    shippingMethodId?: string;
  };
  termsLineUpdates?: Record<string, string>;
}

interface PaymentTermLite {
  id: string;
  label: string;
  short_label: string | null;
  category_id: string;
}
interface PaymentCatLite {
  id: string;
  short_name: string | null;
  name: string;
  terms: PaymentTermLite[];
}
interface IncotermLite {
  id: string;
  code: string;
  name: string;
  named_location_label: string | null;
  includes_main_carriage: boolean;
  includes_insurance: boolean;
}
interface ShippingMethodLite {
  id: string;
  name: string;
  short_name: string | null;
  mode: string;
  typical_transit_days_min: number | null;
  typical_transit_days_max: number | null;
}

/* Rewrites a single "Key: value" line in the rich-text terms HTML.
   The terms field is HTML (post the rich-text upgrade), so we walk
   <br>-separated segments, find one starting with the key (tolerating
   inline formatting tags), and replace its trailing content. If no
   matching line exists we append one. The Total-Qty injection in
   TermsArea uses the same line-by-line convention. */
function applyQuickFillToTerms(termsHtml: string, updates: Record<string, string>): string {
  /* Strip tags only when checking — keep them when rewriting so any
     bolding the operator did survives. We split on <br> (HTML line
     breaks the rich-text editor uses) and on "\n" for legacy
     plain-text values. */
  const hasHtml = /<[a-z][\s\S]*>/i.test(termsHtml);
  const html = hasHtml ? termsHtml : termsHtml.replace(/\n/g, "<br>");
  /* Split into "lines" — keep the <br> separators around so we can
     reassemble with the same structure. */
  const segments = html.split(/(<br\s*\/?>)/i);

  const keyMatches = (segText: string, key: string): boolean => {
    /* segment text → strip inline tags, lowercase, compare prefix. */
    const plain = segText.replace(/<[^>]+>/g, "").trim().toLowerCase();
    return plain.startsWith(key.toLowerCase() + ":");
  };

  const rewriteSegment = (segment: string, key: string, value: string): string => {
    /* Replace whatever follows the colon (possibly inside formatting
       tags) with the new value. Preserve the leading "Key:" exactly
       as the operator typed it (capitalisation, surrounding bold/etc). */
    return segment.replace(
      /^([\s\S]*?:[\s ]*)([\s\S]*)$/,
      (_m, prefix) => `${prefix}${value}`,
    );
  };

  const usedKeys = new Set<string>();
  const out = segments.map((seg) => {
    if (/^<br/i.test(seg)) return seg;
    for (const key of Object.keys(updates)) {
      if (!usedKeys.has(key) && keyMatches(seg, key)) {
        usedKeys.add(key);
        return rewriteSegment(seg, key, updates[key]);
      }
    }
    return seg;
  });
  /* Append lines for keys that weren't already present. */
  const missing = Object.keys(updates).filter((k) => !usedKeys.has(k));
  let result = out.join("");
  for (const k of missing) {
    const sep = result && !/<br\s*\/?>\s*$/i.test(result) ? "<br>" : "";
    result += `${sep}${k}: ${updates[k]}`;
  }
  return result;
}

function QuickFillBar({
  paymentTermId,
  incotermId,
  incotermLocation,
  shippingMethodId,
  onChange,
}: {
  paymentTermId?: string;
  incotermId?: string;
  incotermLocation?: string;
  shippingMethodId?: string;
  onChange: (patch: QuickFillPatch) => void;
}) {
  const [payCats, setPayCats] = useState<PaymentCatLite[]>([]);
  const [incoterms, setIncoterms] = useState<IncotermLite[]>([]);
  const [methods, setMethods] = useState<ShippingMethodLite[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/payment-terms",   { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/incoterms",       { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/shipping-methods",{ credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ]).then(([pt, ic, sm]) => {
      if (cancelled) return;
      setPayCats((pt?.categories as PaymentCatLite[] | undefined) ?? []);
      setIncoterms((ic?.rows as IncotermLite[] | undefined) ?? []);
      setMethods((sm?.rows as ShippingMethodLite[] | undefined) ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  const allPaymentTerms = useMemo(
    () => payCats.flatMap((c) => c.terms.map((t) => ({ ...t, catName: c.short_name ?? c.name }))),
    [payCats],
  );
  const selectedPayment = useMemo(
    () => allPaymentTerms.find((t) => t.id === paymentTermId),
    [allPaymentTerms, paymentTermId],
  );
  const selectedIncoterm = useMemo(
    () => incoterms.find((t) => t.id === incotermId),
    [incoterms, incotermId],
  );
  const selectedMethod = useMemo(
    () => methods.find((t) => t.id === shippingMethodId),
    [methods, shippingMethodId],
  );

  const onPickPayment = (id: string) => {
    const term = allPaymentTerms.find((t) => t.id === id);
    if (!term) {
      onChange({ fields: { paymentTermId: undefined }, termsLineUpdates: { "Payment terms": "" } });
      return;
    }
    onChange({
      fields: { paymentTermId: id },
      termsLineUpdates: { "Payment terms": term.label },
    });
  };

  const onPickIncoterm = (id: string) => {
    const term = incoterms.find((t) => t.id === id);
    if (!term) {
      onChange({ fields: { incotermId: undefined }, termsLineUpdates: { "Price Type": "" } });
      return;
    }
    const value = `${term.code} (${term.name})${incotermLocation ? ` — ${incotermLocation}` : ""}`;
    onChange({
      fields: { incotermId: id },
      termsLineUpdates: { "Price Type": value },
    });
  };

  const onChangeLocation = (loc: string) => {
    const term = selectedIncoterm;
    if (!term) {
      onChange({ fields: { incotermLocation: loc } });
      return;
    }
    onChange({
      fields: { incotermLocation: loc },
      termsLineUpdates: {
        "Price Type": `${term.code} (${term.name})${loc ? ` — ${loc}` : ""}`,
      },
    });
  };

  const onPickMethod = (id: string) => {
    const m = methods.find((t) => t.id === id);
    if (!m) {
      onChange({ fields: { shippingMethodId: undefined }, termsLineUpdates: { "Sent by": "" } });
      return;
    }
    const transit =
      m.typical_transit_days_min != null && m.typical_transit_days_max != null
        ? ` (${m.typical_transit_days_min}–${m.typical_transit_days_max} days)`
        : "";
    onChange({
      fields: { shippingMethodId: id },
      termsLineUpdates: { "Sent by": `${m.name}${transit}` },
    });
  };

  /* Compact dropdown styles. Matches Apple-pill aesthetic the rest of
     the Workspace uses. */
  const selectStyle: React.CSSProperties = {
    fontSize: 10,
    padding: "3px 6px",
    borderRadius: 5,
    border: `1px solid ${T.border}`,
    background: T.surface,
    color: T.ink,
    outline: "none",
    minWidth: 100,
    maxWidth: 160,
    cursor: "pointer",
  };

  return (
    <div
      className="no-print pq-tc-quickfill"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, color: T.inkGhost, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 2 }}>
        Quick fill
      </span>

      {/* Payment term */}
      <select
        value={paymentTermId ?? ""}
        onChange={(e) => onPickPayment(e.target.value)}
        style={selectStyle}
        title={selectedPayment ? `Payment: ${selectedPayment.label}` : "Pick a payment term"}
      >
        <option value="">Payment…</option>
        {payCats.map((cat) => (
          <optgroup key={cat.id} label={cat.short_name ?? cat.name}>
            {cat.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.short_label ?? t.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Incoterm / price type */}
      <select
        value={incotermId ?? ""}
        onChange={(e) => onPickIncoterm(e.target.value)}
        style={selectStyle}
        title={selectedIncoterm ? `${selectedIncoterm.code} — ${selectedIncoterm.name}` : "Pick a price type"}
      >
        <option value="">Price type…</option>
        {incoterms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.code} — {t.name}
          </option>
        ))}
      </select>
      {selectedIncoterm && (
        <input
          type="text"
          value={incotermLocation ?? ""}
          onChange={(e) => onChangeLocation(e.target.value)}
          placeholder={selectedIncoterm.named_location_label ?? "Named place"}
          style={{
            ...selectStyle,
            cursor: "text",
            minWidth: 90,
            maxWidth: 140,
          }}
        />
      )}

      {/* Shipping method */}
      <select
        value={shippingMethodId ?? ""}
        onChange={(e) => onPickMethod(e.target.value)}
        style={selectStyle}
        title={selectedMethod ? `Sent by ${selectedMethod.name}` : "Pick a shipping method"}
      >
        <option value="">Sent by…</option>
        {methods.map((m) => (
          <option key={m.id} value={m.id}>
            {m.short_name ?? m.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/* Picture cell for a quotation item row. Owns its drag-over state
   so each row highlights independently. Three input paths:

     1. Click → opens the hidden file picker (legacy behaviour).
     2. Drop a file from Finder / Desktop / Photos → file dropped
        on dataTransfer.files, fed straight to onUpload.
     3. Drop an image URL from another browser tab → dataTransfer
        carries a "text/uri-list" or "text/plain" entry. We fetch
        the URL, convert the response to a File, then upload. If
        the source server blocks CORS, the fetch throws and we
        fall back to a friendly alert telling the user to download
        the image first.

   .no-print on the remove button so the exported PDF doesn't show
   the × chip. The drag-highlight uses a darker dashed border + a
   subtle blue tint so the operator can see exactly which row will
   receive the drop. */
function PictureCell({
  idx,
  image,
  fileInputRefs,
  onUpload,
  onClear,
}: {
  idx: number;
  image: string;
  fileInputRefs: MutableRefObject<{ [key: number]: HTMLInputElement | null }>;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  /* dragenter fires for every child element the cursor enters, so
     we use a counter to know when the cursor has truly left the
     cell. Without it the highlight flickers as the cursor moves
     between the inner <img> and the wrapper. */
  const dragDepth = useRef(0);

  const acceptDropped = async (e: React.DragEvent<HTMLDivElement>) => {
    /* 1) File drop from disk. */
    const file = e.dataTransfer.files?.[0];
    if (file && /^image\//.test(file.type)) {
      onUpload(file);
      return;
    }
    /* 2) URL drop from another browser tab. dataTransfer surfaces
       the linked image's URL on a few keys depending on the source
       browser. */
    const url =
      e.dataTransfer.getData("text/uri-list")?.split("\n")[0]?.trim() ||
      e.dataTransfer.getData("text/plain")?.trim() ||
      "";
    if (!url || !/^https?:\/\//i.test(url)) return;
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const blob = await res.blob();
      if (!/^image\//.test(blob.type)) {
        alert("Dropped link doesn't look like an image.");
        return;
      }
      const name = url.split("/").pop()?.split("?")[0] || "image.jpg";
      onUpload(new File([blob], name, { type: blob.type }));
    } catch {
      /* CORS-blocked cross-origin fetch is the typical failure
         mode. Tell the user how to recover. */
      alert(
        "Couldn't fetch the dragged image. Save it to your desktop first, then drag the file in.",
      );
    }
  };

  return (
    <div
      className={`quot-img-cell${image ? " has-img" : ""}`}
      onClick={() => fileInputRefs.current[idx]?.click()}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setIsDragOver(true);
      }}
      onDragOver={(e) => {
        /* Critical: prevent the browser's default of navigating to
           the dropped file. Without preventDefault the page would
           open the image in place of the editor. */
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setIsDragOver(false);
        void acceptDropped(e);
      }}
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: image
          ? isDragOver
            ? `2px dashed ${T.ink}`
            : "none"
          : `1px dashed ${isDragOver ? T.ink : T.inkGhost}`,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        background: isDragOver
          ? "rgba(59,130,246,0.08)"
          : image
            ? "transparent"
            : "#FAFAFA",
        margin: "0 auto",
        maxWidth: 88,
        transition: "background 0.15s ease, border 0.15s ease",
      }}
    >
      {image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
        />
      ) : (
        <span
          style={{
            fontSize: 22,
            color: T.inkGhost,
            fontWeight: 300,
            pointerEvents: "none",
          }}
        >
          +
        </span>
      )}
      {/* Drop-overlay hint — only renders mid-drag so it doesn't
          clutter the cell. pointerEvents:none keeps the underlying
          drop target reachable. */}
      {isDragOver && (
        <div
          className="no-print"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          Drop
        </div>
      )}
      {image && (
        <button
          type="button"
          className="no-print quot-img-remove"
          title="Remove photo"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 18,
            height: 18,
            borderRadius: 9,
            border: "none",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            fontSize: 12,
            lineHeight: 1,
            fontWeight: 600,
          }}
        >
          ×
        </button>
      )}
      <input
        type="file"
        accept="image/*"
        ref={(el) => { fileInputRefs.current[idx] = el; }}
        style={{ position: "absolute", left: -9999, width: 0, height: 0 }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

/* Shared box for the stamp + signature areas on the last page. When
   `imageUrl` is set, renders the saved image at object-fit: contain
   inside the 150 px box (preserves the real stamp's circular shape
   without stretching). Otherwise renders its `children` (the
   action buttons + placeholder text). The little × clear button
   only appears when an image is set AND the viewer is allowed to
   edit (super admin). It's no-print so it never appears in the
   exported PDF. */
function StampSignatureBox({
  imageUrl,
  placeholder,
  onClear,
  isEditable,
  aspectSquare,
  children,
}: {
  imageUrl?: string;
  placeholder: string;
  onClear?: () => void;
  isEditable?: boolean;
  aspectSquare?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 150,
        maxWidth: aspectSquare ? 150 : undefined,
        margin: aspectSquare ? "0 auto" : undefined,
        border: imageUrl ? "none" : `1px dashed ${T.inkGhost}`,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imageUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 9,
            color: T.inkGhost,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          <span>{placeholder}</span>
          {children}
        </div>
      )}
      {imageUrl && isEditable && onClear && (
        <button
          type="button"
          className="no-print"
          title="Remove"
          onClick={onClear}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 20,
            height: 20,
            borderRadius: 10,
            border: "none",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            fontSize: 13,
            lineHeight: 1,
            fontWeight: 600,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/* Tiny inline button group for the stamp / signature placeholder.
   "Use saved" — only rendered when the tenant has a saved asset.
   "Upload" — always available to super-admins; opens the OS file
   picker, then hands the file back to the parent which uploads it
   to /api/quotations/saved-assets (which both saves it tenant-wide
   AND fills it onto this quote). Wrapped in .no-print so the PDF
   never captures the buttons. */
function StampSignatureActions({
  label,
  savedUrl,
  onUseSaved,
  onUpload,
}: {
  label: string;
  savedUrl: string | null;
  onUseSaved?: () => void;
  onUpload?: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
      {savedUrl && onUseSaved && (
        <button
          type="button"
          onClick={onUseSaved}
          style={{
            background: T.black,
            color: "#fff",
            border: "none",
            padding: "4px 10px",
            borderRadius: 6,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Use Saved {label}
        </button>
      )}
      {onUpload && (
        <>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            style={{
              background: "transparent",
              color: T.ink,
              border: `1px solid ${T.border}`,
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Upload {label}
          </button>
          <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ position: "absolute", left: -9999, width: 0, height: 0 }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.currentTarget.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}

/* Single column of the 4-column meta strip at the top of page 1.
   Renders as a tiny stack: black uppercase label on top, value
   below. Vertical-divider on the right side of each cell EXCEPT
   the last one — that gives the strip a clean "newspaper column"
   look while keeping the wrapper border for outer rounding. */
function MetaStripCell({
  label,
  children,
  isFirst,
  isLast,
}: {
  label: string;
  children: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  void isFirst;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRight: isLast ? "none" : `1px solid ${T.border}`,
        minWidth: 0,
      }}
    >
      <div
        style={{
          background: T.black,
          color: "#fff",
          padding: "5px 12px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: "8px 12px",
          minHeight: 24,
          display: "flex",
          alignItems: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MetaTableRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        className="pq-ml"
        style={{
          fontWeight: 700,
          color: "#fff",
          background: T.black,
          width: 90,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
          border: `1px solid ${T.border}`,
          padding: "4px 12px",
          verticalAlign: "middle",
          height: 28,
        }}
      >
        {label}
      </td>
      <td
        className="pq-mv"
        style={{
          border: `1px solid ${T.border}`,
          padding: "4px 12px",
          verticalAlign: "middle",
        }}
      >
        {children}
      </td>
    </tr>
  );
}

function Th({
  children,
  width,
  align,
  isFirst,
  isLast,
}: {
  children: React.ReactNode;
  width: string;
  align?: "left" | "center" | "right";
  isFirst?: boolean;
  isLast?: boolean;
}) {
  /* Note: only right + bottom borders are drawn per cell. The
     table's own border supplies the outer top + left + right + bottom
     edges. CSS pseudo-selectors (in PRINT_AND_DOC_STYLES) suppress
     the right-border on the last column. This keeps the grid one
     px thick everywhere, without doubling under
     `border-collapse: separate`.

     The first and last <th> get matching corner radii so the black
     header strip follows the table's outer rounded corners (12 px)
     instead of bleeding past them as a sharp rectangle. */
  return (
    <th
      style={{
        width,
        background: T.black,
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "8px 8px",
        textAlign: align ?? "center",
        borderRight: isLast ? "none" : "1px solid #333",
        borderBottom: "1px solid #333",
        borderTopLeftRadius: isFirst ? 12 : 0,
        borderTopRightRadius: isLast ? 12 : 0,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  style,
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "10px 10px",
        fontSize: 11,
        borderRight: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        verticalAlign: "middle",
        textAlign: align ?? "left",
        position: "relative",
        ...(style ?? {}),
      }}
    >
      {children}
    </td>
  );
}

function TotalsRow({
  label,
  value,
  rawValue,
  muted,
  editable,
  onCommit,
}: {
  label: string;
  value?: string;
  rawValue?: number;
  muted?: boolean;
  editable?: boolean;
  onCommit?: (val: number) => void;
}) {
  return (
    <tr className={muted ? "pq-tfoot-row" : undefined}>
      <td
        className="pq-tl"
        style={{
          fontWeight: 700,
          background: muted ? T.surface : "#fff",
          width: 110,
          fontSize: 10,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          border: `1px solid ${T.border}`,
          padding: "6px 12px",
          color: muted ? "#444" : T.ink,
        }}
      >
        {label}
      </td>
      <td
        className="pq-tv"
        style={{
          fontSize: 11,
          textAlign: "right",
          border: `1px solid ${T.border}`,
          padding: "6px 12px",
          fontWeight: muted ? 700 : 400,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {editable ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end", width: "100%" }}>
            <span style={{ color: T.inkGhost, fontWeight: 400 }}>US$</span>
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const val = parseFloat((e.currentTarget.textContent || "0").replace(/[^0-9.]/g, "")) || 0;
                onCommit?.(val);
              }}
              style={{ outline: "none", minWidth: 40, textAlign: "right" }}
            >
              {rawValue && rawValue > 0 ? rawValue : "0"}
            </span>
          </span>
        ) : (
          value
        )}
      </td>
    </tr>
  );
}

/* Single button inside the row-action pill. Uses real icons (not
   characters) to match the Hub icon set, transparent background with
   a soft hover, and a destructive (red) variant for the trash. */
/* Row action button — rendered as <div role="button"> so it bypasses
   Safari's native <button> chrome that was squishing buttons into
   narrow rectangles. Solid 32 × 32 square with clearly visible idle
   state (subtle surface background) — no more transparent hover-only
   buttons that disappear when not focused. */
function RowActionBtn({
  icon,
  title,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const [hover, setHover] = useState(false);
  /* Solid colours — every state has a real visible fill so the
     buttons are clearly clickable. */
  const idleBg    = destructive ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.06)";
  const hoverBg   = destructive ? "rgba(239, 68, 68, 0.28)" : "rgba(255, 255, 255, 0.18)";
  const idleColor = destructive ? "#F87171" : "rgba(255, 255, 255, 0.92)";
  const hoverColor= destructive ? "#FCA5A5" : "#FFFFFF";
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      title={title}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        minWidth: 28,
        minHeight: 28,
        flexShrink: 0,
        borderRadius: 7,
        background: disabled ? "rgba(255,255,255,0.02)" : (hover ? hoverBg : idleBg),
        color: disabled
          ? (destructive ? "rgba(248,113,113,0.35)" : "rgba(255,255,255,0.30)")
          : (hover ? hoverColor : idleColor),
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        margin: 0,
        boxSizing: "border-box",
        userSelect: "none",
        transition: "background-color 120ms ease, color 120ms ease",
      }}
    >
      {icon}
    </div>
  );
}

/* ─── Rich text toolbar ────────────────────────────────────────────
   A small floating control that appears just above the focused item
   description cell. Uses `document.execCommand` to apply Bold,
   Italic, Underline, Foreground color, and Font Size to the current
   text selection. The contentEditable retains focus across button
   presses because each control's `onMouseDown` calls
   `preventDefault()` — the browser's default "blur the current
   element when another control receives the click" behaviour is
   what would otherwise drop the selection. */

const COLOR_SWATCHES: { name: string; hex: string }[] = [
  { name: "Black",  hex: "#0A0A0A" },
  { name: "Red",    hex: "#DC2626" },
  { name: "Green",  hex: "#16A34A" },
  { name: "Blue",   hex: "#2563EB" },
  { name: "Purple", hex: "#9333EA" },
  { name: "Amber",  hex: "#D97706" },
];

const SIZE_OPTIONS: { label: string; value: string }[] = [
  { label: "S",  value: "2" },
  { label: "M",  value: "3" },  // default
  { label: "L",  value: "5" },
  { label: "XL", value: "6" },
];

function RichTextToolbar({ exec }: { exec: (cmd: string, value?: string) => void }) {
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes]   = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* Close the color / size sub-pickers when focus moves out of the
     toolbar (e.g. user clicks back into a description cell). */
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (!rootRef.current?.contains(ev.target as Node)) {
        setShowColors(false);
        setShowSizes(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Critical: preventDefault on every mouseDown so the focused
     contentEditable doesn't lose its selection when we click. */
  const stop = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      ref={rootRef}
      className="no-print"
      onMouseDown={stop}
      style={{
        position: "absolute",
        top: -44,
        left: -4,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 4,
        background: "rgba(20, 20, 20, 0.96)",
        border: "1px solid rgba(255, 255, 255, 0.10)",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(8px)",
        zIndex: 60,
      }}
    >
      <ToolBtn title="Bold (⌘B)"      onClick={() => exec("bold")}><BoldIcon size={13} /></ToolBtn>
      <ToolBtn title="Italic (⌘I)"    onClick={() => exec("italic")}><ItalicIcon size={13} /></ToolBtn>
      <ToolBtn title="Underline (⌘U)" onClick={() => exec("underline")}><UnderlineIcon size={13} /></ToolBtn>

      <ToolSep />

      {/* Color picker */}
      <div style={{ position: "relative" }}>
        <ToolBtn title="Text color" onClick={() => { setShowColors((v) => !v); setShowSizes(false); }}>
          <PaletteIcon size={13} />
        </ToolBtn>
        {showColors && (
          <div
            onMouseDown={stop}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 4,
              padding: 6,
              background: "rgba(20, 20, 20, 0.98)",
              border: "1px solid rgba(255, 255, 255, 0.10)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
            }}
          >
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.name}
                onMouseDown={stop}
                onClick={() => { exec("foreColor", c.hex); setShowColors(false); }}
                style={{
                  width: 20, height: 20,
                  background: c.hex,
                  border: c.hex === "#0A0A0A" ? "1px solid rgba(255,255,255,0.18)" : "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Size picker */}
      <div style={{ position: "relative" }}>
        <ToolBtn title="Text size" onClick={() => { setShowSizes((v) => !v); setShowColors(false); }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.03em" }}>Aa</span>
        </ToolBtn>
        {showSizes && (
          <div
            onMouseDown={stop}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              display: "flex",
              gap: 2,
              padding: 4,
              background: "rgba(20, 20, 20, 0.98)",
              border: "1px solid rgba(255, 255, 255, 0.10)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
            }}
          >
            {SIZE_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                title={`Size ${s.label}`}
                onMouseDown={stop}
                onClick={() => { exec("fontSize", s.value); setShowSizes(false); }}
                style={{
                  minWidth: 32,
                  height: 26,
                  border: "none",
                  background: "transparent",
                  color: "rgba(255, 255, 255, 0.85)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "0 8px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ToolSep />

      <ToolBtn title="Clear formatting" onClick={() => exec("removeFormat")}>
        <CrossIcon size={13} />
      </ToolBtn>
    </div>
  );
}

function ToolBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        border: "none",
        background: hover ? "rgba(255, 255, 255, 0.10)" : "transparent",
        color: "rgba(255, 255, 255, 0.85)",
        borderRadius: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        transition: "background-color 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

function ToolSep() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: "rgba(255, 255, 255, 0.12)",
        margin: "0 4px",
      }}
    />
  );
}


function BankRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  /* Bank rows fall on the standard 10 (label) / 11 (value) ladder
     used everywhere else in the document — earlier they were a
     bespoke 9.5 / 10 that broke the rhythm. */
  return (
    <tr>
      <td
        className="pq-bl"
        style={{
          fontWeight: 700,
          background: T.surface,
          width: 150,
          textTransform: "uppercase",
          fontSize: 10,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          border: `1px solid ${T.border}`,
          padding: "6px 12px",
        }}
      >
        {label}
      </td>
      <td
        className="pq-bv"
        style={{
          fontSize: 11,
          border: `1px solid ${T.border}`,
          padding: "6px 12px",
          fontFamily: mono ? T.mono : undefined,
          letterSpacing: mono ? "0.04em" : undefined,
        }}
      >
        {value}
      </td>
    </tr>
  );
}
