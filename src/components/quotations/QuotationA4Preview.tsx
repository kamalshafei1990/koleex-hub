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
  incotermCode?: string;
  incotermLocation?: string;
  loadingPort?: string;
  dischargePort?: string;
  shippingMethodId?: string;
  shippingMarks?: string;
  containerType?: string;
  bankCharges?: string;
  cancellationPolicy?: string;
  governingLaw?: string;
  documentsProvided?: string[];
  discountPct?: number;
  leadTimeDays?: number;
  leadTimeBasis?: "after_deposit" | "after_order" | "after_lc_opening";
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

  /* Items-table 'UNIT PRICE' subtitle. Derived from the picked
     Incoterm + the relevant port — FOB/FAS/EXW reference the
     loading port, CFR/CIF/DAP/DPU/DDP/CPT/CIP reference the
     discharge port. Falls back to a plain 'USD' when nothing is
     picked yet so the column still reads sensibly. */
  const priceTypeSubtitle = useMemo(() => {
    const code = current.incotermCode?.toUpperCase();
    if (!code) return "(USD)";
    /* Which port does this term name? */
    const dischargeBased = new Set(["CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]);
    const port = dischargeBased.has(code)
      ? current.dischargePort
      : current.loadingPort;
    const locationPart = port ? ` ${port}` : "";
    return `(${code}${locationPart}, USD)`;
  }, [current.incotermCode, current.loadingPort, current.dischargePort]);

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
                    {priceTypeSubtitle}
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
                      {item.unitPrice > 0 ? `${fmt(item.unitPrice)} $` : "0"}
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
                    {lineTotal > 0 ? `${fmt(lineTotal)} $` : "0"}

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
                  {fmt(subTotal)} $
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
                    <TotalsRow label="Subtotal" value={`${fmt(subTotal)} $`} muted />
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
                    {/* Discount — global %-off applied to
                        (subtotal + tax + shipping + others). The
                        right cell shows the computed discount
                        amount in red so the operator sees the
                        impact of the % they typed. */}
                    <DiscountRow
                      pct={current.discountPct ?? 0}
                      base={subTotal + current.tax + current.shipping + current.others}
                      onCommit={(v) => setMeta("discountPct", v)}
                      fmt={fmt}
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
                        {fmt(grandTotal)} $
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
                          /* Left-aligned so the long uppercase
                             words read naturally from where the
                             label ends. Right-align made the line
                             feel back-to-front when totals were
                             long enough to wrap. */
                          textAlign: "left",
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
                  {/* Compact 'Quick Fill' opener — replaces the
                      cluttered inline picker strip. Clicking opens
                      a modal with every field organised into
                      sections (Payment, Route, Shipping, Timing,
                      Cargo, Documents, Legal). All picks still
                      land in the matching T&C row in real time;
                      the modal just hides the controls behind a
                      single chip until the operator wants them. */}
                  <TermsQuickFillTrigger
                    current={current}
                    onPatch={(patch) => {
                      const next = { ...current, ...patch.fields };
                      if (patch.termsLineUpdates) {
                        next.terms = applyQuickFillToTerms(
                          current.terms,
                          patch.termsLineUpdates,
                        );
                      }
                      setCurrent(next);
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

/* Render-time normalisation. Quotes saved before the structured-
   row upgrade have their terms stored as <br>-separated HTML. We
   wrap each <br>-line in a styled <div> at display time so old
   quotes get the new bordered-rows look without touching the
   stored data. Detection: 'no <div> wrappers anywhere' = legacy. */
function normaliseTermsForDisplay(rawTerms: string): string {
  if (!rawTerms) return rawTerms;
  if (/<div[^>]*>[\s\S]*?<\/div>/i.test(rawTerms)) {
    /* Already div-structured — leave untouched. */
    return rawTerms;
  }
  const rowStyle = "border-bottom: 1px dashed rgba(0,0,0,0.12); padding: 3px 0; min-height: 22px;";
  const notesStyle = "padding: 6px 0; min-height: 28px;";
  /* Split on EITHER <br> (HTML line break) OR \n (legacy plain-text
     newline — older quotes were saved as plain strings before the
     rich-text upgrade and the contentEditable's white-space:pre-wrap
     rendered them as line breaks). Filter trailing empty parts so
     the free-text <div> only gets one trailing slot. */
  const parts = rawTerms.split(/<br\s*\/?>|\n/i);
  while (parts.length > 1 && parts[parts.length - 1].replace(/<[^>]+>/g, "").trim() === "") {
    parts.pop();
  }
  const wrapped = parts.map((p) => {
    const plain = p.replace(/<[^>]+>/g, "").trim();
    if (!plain) {
      /* Empty legacy line → render as a blank styled row so the
         visual rhythm stays consistent. */
      return `<div style="${rowStyle}"><br></div>`;
    }
    /* Heuristic: a 'Label:' line gets the bordered row style; prose
       without a colon goes into the free-text bucket. */
    const looksLikeLabel = /^[A-Za-z][A-Za-z &]*?:/.test(plain);
    return looksLikeLabel
      ? `<div style="${rowStyle}">${p}</div>`
      : `<div style="${notesStyle}">${p}</div>`;
  });
  /* Always end with a free-text slot so the operator can keep
     typing below the last structured row. */
  return wrapped.join("") + `<div style="${notesStyle}"><br></div>`;
}

function injectTotalQty(rawTerms: string, totalQty: number): string {
  /* First normalise legacy <br>-only terms into the new <div>-row
     layout (no-op if already structured). Then route through the
     Quick Fill rewrite pipeline so the Total Qty line gets the same
     canonical bold treatment as every other auto-managed line. */
  const normalised = normaliseTermsForDisplay(rawTerms);
  return applyQuickFillToTerms(normalised, { "Total Qty": String(totalQty) });
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
    incotermCode?: string;
    incotermLocation?: string;
    loadingPort?: string;
    dischargePort?: string;
    shippingMethodId?: string;
    shippingMarks?: string;
    containerType?: string;
    bankCharges?: string;
    cancellationPolicy?: string;
    governingLaw?: string;
    documentsProvided?: string[];
    leadTimeDays?: number;
    leadTimeBasis?: "after_deposit" | "after_order" | "after_lc_opening";
  };
  termsLineUpdates?: Record<string, string>;
}

/* Standard Shipping Marks options used in international machinery
   trade. 'As per buyer's instruction' is the default — buyer sends
   the actual marks (logo, PO ref, destination port) ~1 week before
   shipment and the factory stencils them on the wooden cases. */
const SHIPPING_MARKS_OPTIONS: { value: string; label: string }[] = [
  { value: "As per buyer's instruction", label: "As per buyer's instruction" },
  { value: "No marks",                   label: "No marks" },
];

/* Container types — only relevant when the shipping method is a
   sea-mode that loads into a container (FCL / RoRo / Reefer). The
   Quick Fill picker auto-hides the dropdown for LCL / Air / Road /
   Rail / Courier where 'container type' doesn't apply. */
const CONTAINER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "20' Standard",      label: "20' Standard (≈28 CBM)" },
  { value: "40' Standard",      label: "40' Standard (≈58 CBM)" },
  { value: "40' High Cube",     label: "40' High Cube (≈68 CBM)" },
  { value: "40' HR (Reefer)",   label: "40' HR Reefer" },
  { value: "45' High Cube",     label: "45' High Cube (≈78 CBM)" },
  { value: "20' Open Top",      label: "20' Open Top" },
  { value: "40' Open Top",      label: "40' Open Top" },
  { value: "20' Flat Rack",     label: "20' Flat Rack" },
  { value: "40' Flat Rack",     label: "40' Flat Rack" },
];

/* Container-type only makes sense for these shipping modes / sub-
   types. For anything else (Air, LCL, Road LTL, Courier, etc.) the
   picker stays hidden. */
const CONTAINER_TYPE_APPLIES = new Set([
  "FCL", "RoRo", "Reefer", "Break Bulk",
]);

const BANK_CHARGES_OPTIONS: { value: string; label: string }[] = [
  { value: "All bank charges outside seller's country are for buyer's account",
    label: "Outside seller — buyer pays" },
  { value: "All bank charges for buyer's account",
    label: "All charges — buyer pays" },
  { value: "Each party pays its own bank charges",
    label: "Each side pays its own" },
  { value: "All bank charges for seller's account",
    label: "All charges — seller pays" },
];

const CANCELLATION_OPTIONS: { value: string; label: string }[] = [
  { value: "Deposit is non-refundable once production has started",
    label: "Deposit non-refundable post-production-start" },
  { value: "Deposit refundable in full if cancelled before production starts; non-refundable thereafter",
    label: "Refundable before production / non-refundable after" },
  { value: "50% of deposit refundable if cancelled within 7 days of order confirmation; non-refundable thereafter",
    label: "50% refund within 7 days" },
  { value: "No cancellation accepted after order confirmation",
    label: "No cancellation accepted" },
];

const GOVERNING_LAW_OPTIONS: { value: string; label: string }[] = [
  { value: "Laws of the People's Republic of China; disputes settled by CIETAC arbitration in Beijing",
    label: "PRC — CIETAC Beijing" },
  { value: "Laws of the People's Republic of China; disputes settled by Shanghai International Arbitration Centre (SHIAC)",
    label: "PRC — SHIAC Shanghai" },
  { value: "English law; disputes settled by LCIA arbitration in London",
    label: "English law — LCIA London" },
  { value: "Singapore law; disputes settled by SIAC arbitration in Singapore",
    label: "Singapore law — SIAC" },
  { value: "Hong Kong law; disputes settled by HKIAC arbitration in Hong Kong",
    label: "Hong Kong law — HKIAC" },
  { value: "ICC Rules of Arbitration; seat to be agreed in writing",
    label: "ICC arbitration" },
  { value: "Laws of the Arab Republic of Egypt; jurisdiction of the courts of Cairo",
    label: "Egyptian law — Cairo courts" },
];

const LEAD_TIME_BASIS_LABEL: Record<NonNullable<QuickFillPatch["fields"]["leadTimeBasis"]>, string> = {
  after_deposit:    "after receipt of deposit",
  after_order:      "after order confirmation",
  after_lc_opening: "after L/C opening",
};

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
  sub_type: string | null;
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

  /* Quick-Fill label aliases. Each canonical picker key has a list
     of label variants the operator may have already typed in the
     terms body so a pick replaces an existing line instead of
     appending a duplicate. */
  const aliases: Record<string, string[]> = {
    "Payment terms":      ["Payment terms", "Payment", "Payment term", "Payment method"],
    "Price Type":         ["Price Type", "Price type", "Price", "Incoterm", "Trade term"],
    "Sent by":            ["Sent by", "Sent via", "Shipped by", "Shipping", "Shipping by", "Shipped via", "Mode of transport"],
    "Container type":     ["Container type", "Container", "Container size"],
    "Loading port":       ["Loading port", "Port of loading", "POL", "From port", "Origin port", "Port of shipment", "Port of departure"],
    "Discharge port":     ["Discharge port", "Port of discharge", "POD", "To port", "Destination port", "Port of destination", "Port of arrival"],
    "Lead time":          ["Lead time", "Lead-time", "Production time", "Manufacturing time", "Production lead time"],
    "Delivery time":      ["Delivery time", "ETA", "ETD", "Estimated Time of Arrival", "Estimated Time of Departure", "Estimated arrival", "Estimated departure", "Estimated delivery", "Ready for shipment"],
    "Shipping marks":     ["Shipping marks", "Shipping mark", "Marks", "Marks and Numbers", "Marks & Numbers", "Case marks", "Carton marks"],
    "Packing":            ["Packing", "Packaging", "Packing method", "Packing type"],
    "Country of Origin":  ["Country of Origin", "Country of origin", "Origin", "Made in"],
    "Net Weight":         ["Net Weight", "Net weight", "N.W.", "NW"],
    "Gross Weight":       ["Gross Weight", "Gross weight", "G.W.", "GW"],
    "CBM":                ["CBM", "Volume", "Cubic Meters", "Cubic meters", "M3", "m³"],
    "Number of Packages": ["Number of Packages", "Number of packages", "No. of Packages", "Total Packages", "Packages"],
    "Documents Provided": ["Documents Provided", "Documents provided", "Documents", "Docs Provided", "Docs"],
    "Bank Charges":       ["Bank Charges", "Bank charges", "Banking charges", "Bank Fees"],
    "Cancellation Policy":["Cancellation Policy", "Cancellation policy", "Cancellation", "Cancel Policy"],
    "Governing Law":      ["Governing Law", "Governing law", "Applicable law", "Jurisdiction"],
    "Total Qty":          ["Total Qty", "Total Quantity", "Total qty", "Qty Total"],
  };

  const keyMatches = (segText: string, key: string): boolean => {
    const plain = segText.replace(/<[^>]+>/g, "").trim().toLowerCase();
    const list = aliases[key] ?? [key];
    return list.some((a) => plain.startsWith(a.toLowerCase() + ":"));
  };

  /* Rebuild an existing segment in the canonical bold-label format:
       <strong>Label:</strong> value
     This guarantees:
       · the colon is INSIDE the <strong> tag (visually consistent
         with freshly appended lines)
       · there's exactly one space between the colon and the value
       · any leftover HTML from earlier edits (stray </strong>,
         duplicate spaces, etc.) gets normalised away
     The plain-text label is extracted from whatever the segment
     used to be — so an operator-typed 'Payment:' becomes
     '<strong>Payment:</strong>' on the next pick. */
  const rewriteSegment = (segment: string, _key: string, value: string): string => {
    const m = segment.match(/^([\s\S]*?):[\s\S]*$/);
    if (!m) return segment;
    const label = m[1].replace(/<[^>]+>/g, "").trim();
    if (!label) return segment;
    return `<strong>${label}:</strong> ${value}`;
  };

  /* DIV-wrapped layout path. The new DEFAULT_TERMS wraps each row
     in '<div style="..."><strong>Label:</strong> value</div>' so
     the rows visually separate via border-bottom. We walk each
     <div>…</div> block, match an alias against the inner text, and
     rewrite the inner as '<strong>Key:</strong> value' — preserving
     the outer wrapper (and its style) untouched. Lines that didn't
     find a match get appended as fresh styled <div> blocks at the
     end, just before any free-text notes the operator typed. */
  const divLayout = /<div[^>]*>[\s\S]*?<\/div>/i.test(html);
  if (divLayout) {
    const usedKeys = new Set<string>();
    const divRe = /(<div[^>]*>)([\s\S]*?)(<\/div>)/gi;
    const rewritten = html.replace(divRe, (full, open: string, inner: string, close: string) => {
      for (const key of Object.keys(updates)) {
        if (usedKeys.has(key)) continue;
        if (keyMatches(inner, key)) {
          usedKeys.add(key);
          const value = updates[key] ?? "";
          /* Rebuild the inner content in the canonical bold format
             — '<strong>Label:</strong> value'. The outer <div>
             with its border-bottom styling stays intact. */
          return `${open}<strong>${key}:</strong> ${value}${close}`;
        }
      }
      return full;
    });
    /* Append fresh rows for keys not present anywhere. Inserted
       just before the trailing free-text <div> if one exists so
       structured rows stay grouped at the top. */
    let result = rewritten;
    const missing = Object.keys(updates).filter((k) => !usedKeys.has(k));
    for (const k of missing) {
      if (!updates[k]) continue;
      const row = `<div style="border-bottom: 1px dashed rgba(0,0,0,0.12); padding: 3px 0; min-height: 22px;"><strong>${k}:</strong> ${updates[k]}</div>`;
      /* Try to insert before the last <div>…</div> (the notes
         area) so structured rows stay grouped above free text. */
      const lastDivMatch = result.match(/(<div[^>]*>[\s\S]*<\/div>)\s*$/i);
      if (lastDivMatch) {
        const idx = result.lastIndexOf("<div");
        result = result.slice(0, idx) + row + result.slice(idx);
      } else {
        result += row;
      }
    }
    return result;
  }

  /* Legacy <br>-separated path — same logic as before so older
     quotes without div wrappers keep working without migration. */
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
  const missing = Object.keys(updates).filter((k) => !usedKeys.has(k));
  let result = out.join("");
  for (const k of missing) {
    if (!updates[k]) continue;
    const sep = result && !/<br\s*\/?>\s*$/i.test(result) ? "<br>" : "";
    result += `${sep}<strong>${k}:</strong> ${updates[k]}`;
  }
  return result;
}

/* Compact 'Quick Fill' button + modal wrapper. Single chip on the
   Terms card; click → modal opens with the full QuickFillBar laid
   out as a tidy two-column form instead of a horizontal flex
   strip. Every existing picker keeps its real-time behaviour;
   the modal just hides them behind one button until the operator
   wants to fill the doc. */
function TermsQuickFillTrigger({
  current,
  onPatch,
}: {
  current: Quotation;
  onPatch: (patch: QuickFillPatch) => void;
}) {
  const [open, setOpen] = useState(false);

  /* Quick visual cue of how many fields are already filled so the
     operator can see at a glance whether the modal has been used. */
  const filledCount = useMemo(() => {
    let n = 0;
    if (current.paymentTermId)        n++;
    if (current.incotermId)           n++;
    if (current.loadingPort)          n++;
    if (current.dischargePort)        n++;
    if (current.shippingMethodId)     n++;
    if (current.containerType)        n++;
    if (current.shippingMarks)        n++;
    if (current.leadTimeDays)         n++;
    if (current.bankCharges)          n++;
    if (current.cancellationPolicy)   n++;
    if (current.governingLaw)         n++;
    if ((current.documentsProvided ?? []).length > 0) n++;
    return n;
  }, [current]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 6,
          border: `1px solid ${T.border}`,
          background: T.paper,
          color: T.ink,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
        }}
        title="Open the Quick Fill panel — pick payment terms, route, shipping, cargo, documents, and legal clauses in one place."
      >
        <span>⚡</span>
        <span>Quick Fill</span>
        {filledCount > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 4,
              background: T.black,
              color: "#fff",
              marginLeft: 2,
            }}
          >
            {filledCount} filled
          </span>
        )}
      </button>

      {open && (
        <TermsQuickFillModal
          current={current}
          onPatch={onPatch}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/* The actual modal — Apple-style overlay + a card with every Quick
   Fill control organised into labelled sections. Picks land in
   real time on the doc; the operator clicks Done (or Esc / click-
   outside) to close. The internal layout reuses the same input
   styling as the old inline bar so the controls look familiar. */
function TermsQuickFillModal({
  current,
  onPatch,
  onClose,
}: {
  current: Quotation;
  onPatch: (patch: QuickFillPatch) => void;
  onClose: () => void;
}) {
  const [payCats, setPayCats] = useState<PaymentCatLite[]>([]);
  const [incoterms, setIncoterms] = useState<IncotermLite[]>([]);
  const [methods, setMethods] = useState<ShippingMethodLite[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/payment-terms",    { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/incoterms",        { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/shipping-methods", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([pt, ic, sm]) => {
      if (cancelled) return;
      setPayCats((pt?.categories as PaymentCatLite[] | undefined) ?? []);
      setIncoterms((ic?.rows as IncotermLite[] | undefined) ?? []);
      setMethods((sm?.rows as ShippingMethodLite[] | undefined) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === current.shippingMethodId),
    [methods, current.shippingMethodId],
  );

  const allPaymentTerms = useMemo(
    () => payCats.flatMap((c) => c.terms.map((t) => ({ ...t, catName: c.short_name ?? c.name }))),
    [payCats],
  );

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    height: 32,
    fontSize: 12,
    padding: "0 8px",
    borderRadius: 6,
    border: "1px solid var(--border-color, #374151)",
    background: "var(--bg-primary, #111827)",
    color: "var(--text-primary, #e5e7eb)",
    outline: "none",
  };

  const sectionStyle: React.CSSProperties = {
    paddingTop: 8,
    paddingBottom: 8,
    borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-dim, #9ca3af)",
    marginBottom: 8,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-dim, #9ca3af)",
    marginBottom: 4,
    display: "block",
  };

  // Helpers to package up onPatch calls cleanly per field.
  const onPickPayment = (id: string) => {
    const term = allPaymentTerms.find((t) => t.id === id);
    onPatch({
      fields: { paymentTermId: id || undefined },
      termsLineUpdates: { "Payment terms": term?.label ?? "" },
    });
  };
  const onPickIncoterm = (id: string) => {
    const term = incoterms.find((t) => t.id === id);
    onPatch({
      fields: {
        incotermId: id || undefined,
        incotermCode: term?.code,
      },
      termsLineUpdates: { "Price Type": term ? `${term.code} (${term.name})` : "" },
    });
  };
  const onChangePort = (key: "loadingPort" | "dischargePort", v: string) => {
    onPatch({
      fields: { [key]: v } as QuickFillPatch["fields"],
      termsLineUpdates: { [key === "loadingPort" ? "Loading port" : "Discharge port"]: v },
    });
  };
  const onPickMethod = (id: string) => {
    const m = methods.find((t) => t.id === id);
    const transit =
      m?.typical_transit_days_min != null && m.typical_transit_days_max != null
        ? ` (${m.typical_transit_days_min}–${m.typical_transit_days_max} days)`
        : "";
    onPatch({
      fields: { shippingMethodId: id || undefined },
      termsLineUpdates: { "Sent by": m ? `${m.name}${transit}` : "" },
    });
  };

  const containerVisible = (() => {
    const sub = selectedMethod?.sub_type?.trim();
    return !!(sub && CONTAINER_TYPE_APPLIES.has(sub));
  })();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-secondary, #1f2937)",
          color: "var(--text-primary, #e5e7eb)",
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          borderRadius: 14,
          border: "1px solid var(--border-color, #374151)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-color, #374151)",
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Quick Fill — Terms &amp; Conditions</div>
            <div style={{ fontSize: 11, color: "var(--text-dim, #9ca3af)", marginTop: 2 }}>
              Pick once; values land in the Terms card as you go.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "8px 18px 14px", flex: 1 }}>
          {/* ── Payment & Pricing ── */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Payment &amp; Pricing</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Payment term</label>
                <select value={current.paymentTermId ?? ""} onChange={(e) => onPickPayment(e.target.value)} style={fieldStyle}>
                  <option value="">— Pick a payment term —</option>
                  {payCats.map((cat) => (
                    <optgroup key={cat.id} label={cat.short_name ?? cat.name}>
                      {cat.terms.map((t) => (
                        <option key={t.id} value={t.id}>{t.short_label ?? t.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Price type (Incoterm)</label>
                <select value={current.incotermId ?? ""} onChange={(e) => onPickIncoterm(e.target.value)} style={fieldStyle}>
                  <option value="">— Pick an Incoterm —</option>
                  {incoterms.map((t) => (
                    <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Route ── */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Shipment Route</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Loading port (origin)</label>
                <input type="text" placeholder="e.g. Ningbo, China" value={current.loadingPort ?? ""} onChange={(e) => onChangePort("loadingPort", e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Discharge port (destination)</label>
                <input type="text" placeholder="e.g. Alexandria, Egypt" value={current.dischargePort ?? ""} onChange={(e) => onChangePort("dischargePort", e.target.value)} style={fieldStyle} />
              </div>
            </div>
          </div>

          {/* ── Shipping ── */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Shipping</div>
            <div style={{ display: "grid", gridTemplateColumns: containerVisible ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Sent by</label>
                <select value={current.shippingMethodId ?? ""} onChange={(e) => onPickMethod(e.target.value)} style={fieldStyle}>
                  <option value="">— Pick a shipping method —</option>
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>{m.short_name ?? m.name}</option>
                  ))}
                </select>
              </div>
              {containerVisible && (
                <div>
                  <label style={labelStyle}>Container type</label>
                  <select
                    value={current.containerType ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      onPatch({
                        fields: { containerType: v || undefined },
                        termsLineUpdates: { "Container type": v },
                      });
                    }}
                    style={fieldStyle}
                  >
                    <option value="">— Pick a container —</option>
                    {CONTAINER_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Shipping marks</label>
                <select
                  value={current.shippingMarks ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onPatch({
                      fields: { shippingMarks: v || undefined },
                      termsLineUpdates: { "Shipping marks": v },
                    });
                  }}
                  style={fieldStyle}
                >
                  <option value="">— Pick a rule —</option>
                  {SHIPPING_MARKS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Timing ── */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Timing</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
              <div>
                <label style={labelStyle}>Lead time (days)</label>
                <input
                  type="number" min={0} max={999}
                  value={current.leadTimeDays ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const days = raw === "" ? undefined : Math.max(0, Math.min(999, Number(raw)));
                    const basis = current.leadTimeBasis ?? "after_deposit";
                    const bLabel = LEAD_TIME_BASIS_LABEL[basis];
                    const tMin = selectedMethod?.typical_transit_days_min ?? null;
                    const tMax = selectedMethod?.typical_transit_days_max ?? null;
                    const updates: Record<string, string> = {
                      "Lead time": days ? `${days} days ${bLabel}` : "",
                    };
                    if (days && tMin != null && tMax != null) {
                      const lo = days + tMin;
                      const hi = days + tMax;
                      updates["Delivery time"] = `${lo === hi ? lo : `${lo}-${hi}`} days ${bLabel}`;
                    } else {
                      updates["Delivery time"] = "";
                    }
                    onPatch({ fields: { leadTimeDays: days }, termsLineUpdates: updates });
                  }}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Counted from</label>
                <select
                  value={current.leadTimeBasis ?? "after_deposit"}
                  onChange={(e) => {
                    const basis = e.target.value as "after_deposit" | "after_order" | "after_lc_opening";
                    const bLabel = LEAD_TIME_BASIS_LABEL[basis];
                    const days = current.leadTimeDays ?? 0;
                    const tMin = selectedMethod?.typical_transit_days_min ?? null;
                    const tMax = selectedMethod?.typical_transit_days_max ?? null;
                    const updates: Record<string, string> = {
                      "Lead time": days ? `${days} days ${bLabel}` : "",
                    };
                    if (days && tMin != null && tMax != null) {
                      const lo = days + tMin;
                      const hi = days + tMax;
                      updates["Delivery time"] = `${lo === hi ? lo : `${lo}-${hi}`} days ${bLabel}`;
                    }
                    onPatch({ fields: { leadTimeBasis: basis }, termsLineUpdates: updates });
                  }}
                  style={fieldStyle}
                >
                  <option value="after_deposit">after receipt of deposit</option>
                  <option value="after_order">after order confirmation</option>
                  <option value="after_lc_opening">after L/C opening</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Delivery (auto)</label>
                <div style={{ ...fieldStyle, display: "flex", alignItems: "center", color: "var(--text-dim, #9ca3af)" }}>
                  {current.leadTimeDays && selectedMethod?.typical_transit_days_min != null && selectedMethod.typical_transit_days_max != null
                    ? `${current.leadTimeDays + selectedMethod.typical_transit_days_min}–${current.leadTimeDays + selectedMethod.typical_transit_days_max} days`
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* ── Documents ── */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Documents Provided</div>
            <DocumentsCheckboxList
              value={current.documentsProvided ?? []}
              onChange={(next) => {
                onPatch({
                  fields: { documentsProvided: next.length > 0 ? next : undefined },
                  termsLineUpdates: { "Documents Provided": next.join(", ") },
                });
              }}
            />
          </div>

          {/* ── Legal ── */}
          <div style={{ ...sectionStyle, borderBottom: "none" }}>
            <div style={sectionTitle}>Legal Clauses</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Bank charges</label>
                <select
                  value={current.bankCharges ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onPatch({ fields: { bankCharges: v || undefined }, termsLineUpdates: { "Bank Charges": v } });
                  }}
                  style={fieldStyle}
                >
                  <option value="">— Pick a clause —</option>
                  {BANK_CHARGES_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Cancellation policy</label>
                <select
                  value={current.cancellationPolicy ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onPatch({ fields: { cancellationPolicy: v || undefined }, termsLineUpdates: { "Cancellation Policy": v } });
                  }}
                  style={fieldStyle}
                >
                  <option value="">— Pick a policy —</option>
                  {CANCELLATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Governing law / arbitration</label>
                <select
                  value={current.governingLaw ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onPatch({ fields: { governingLaw: v || undefined }, termsLineUpdates: { "Governing Law": v } });
                  }}
                  style={fieldStyle}
                >
                  <option value="">— Pick a jurisdiction —</option>
                  {GOVERNING_LAW_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 18px",
            borderTop: "1px solid var(--border-color, #374151)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border-color, #374151)",
              background: "transparent",
              color: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* Inline checkbox list for the Documents section of the modal.
   Same data source as the old popover DocumentsPicker, but laid
   out in a grid grouped by category so the operator can see every
   choice without an extra click. */
function DocumentsCheckboxList({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  interface DocLite { id: string; code: string; name: string; short_name: string | null; category: string; }
  const [docs, setDocs] = useState<DocLite[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/shipping-documents", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        setDocs((j?.rows as DocLite[] | undefined) ?? []);
      });
    return () => { cancelled = true; };
  }, []);
  const grouped = useMemo(() => {
    const out: Record<string, DocLite[]> = {};
    for (const d of docs) (out[d.category] ??= []).push(d);
    return out;
  }, [docs]);
  const toggle = (label: string) => {
    const set = new Set(value);
    if (set.has(label)) set.delete(label);
    else set.add(label);
    onChange([...set]);
  };
  if (docs.length === 0) {
    return <div style={{ fontSize: 11, color: "var(--text-dim, #9ca3af)" }}>Loading documents…</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim, #9ca3af)", fontWeight: 700, marginBottom: 2 }}>{cat}</div>
          {list.map((d) => {
            const label = d.short_name ?? d.code;
            const checked = value.includes(label);
            return (
              <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-primary, #e5e7eb)", cursor: "pointer" }} title={d.name}>
                <input type="checkbox" checked={checked} onChange={() => toggle(label)} style={{ margin: 0 }} />
                {label}
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function QuickFillBar({
  paymentTermId,
  incotermId,
  incotermLocation,
  loadingPort,
  dischargePort,
  shippingMethodId,
  shippingMarks,
  containerType,
  bankCharges,
  cancellationPolicy,
  governingLaw,
  documentsProvided,
  leadTimeDays,
  leadTimeBasis,
  onChange,
}: {
  paymentTermId?: string;
  incotermId?: string;
  incotermCode?: string;
  incotermLocation?: string;
  loadingPort?: string;
  dischargePort?: string;
  shippingMethodId?: string;
  shippingMarks?: string;
  containerType?: string;
  bankCharges?: string;
  cancellationPolicy?: string;
  governingLaw?: string;
  documentsProvided?: string[];
  leadTimeDays?: number;
  leadTimeBasis?: "after_deposit" | "after_order" | "after_lc_opening";
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

  /* Incoterm pick — Price Type line uses the official code + name
     only. The route ports are kept on dedicated 'Loading port:' /
     'Discharge port:' lines (see the loading/discharge inputs
     below) so the doc reads cleanly even when the operator hasn't
     filled both ports yet. */
  const onPickIncoterm = (id: string) => {
    const term = incoterms.find((t) => t.id === id);
    if (!term) {
      onChange({
        fields: { incotermId: undefined, incotermCode: undefined },
        termsLineUpdates: { "Price Type": "" },
      });
      return;
    }
    /* Store both the FK id AND the short code on the doc so the
       items-table header can render '(FOB Ningbo, USD)' without
       fetching the incoterms list. */
    onChange({
      fields: { incotermId: id, incotermCode: term.code },
      termsLineUpdates: { "Price Type": `${term.code} (${term.name})` },
    });
  };

  /* Loading + discharge port handlers. Independent of the Incoterm
     pick — operator can fill them in either order. */
  const onChangeLoadingPort = (port: string) => {
    onChange({
      fields: { loadingPort: port },
      termsLineUpdates: { "Loading port": port },
    });
  };
  const onChangeDischargePort = (port: string) => {
    onChange({
      fields: { dischargePort: port },
      termsLineUpdates: { "Discharge port": port },
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
      {/* Loading + discharge port — independent of Incoterm, so the
          operator can capture the China → Egypt route on every quote
          regardless of which trade term applies. Writes two lines
          into the terms ('Loading port: Ningbo, China' and
          'Discharge port: Alexandria, Egypt'). */}
      <input
        type="text"
        value={loadingPort ?? ""}
        onChange={(e) => onChangeLoadingPort(e.target.value)}
        placeholder="From port (e.g. Ningbo, China)"
        style={{
          ...selectStyle,
          cursor: "text",
          minWidth: 130,
          maxWidth: 200,
        }}
        title="Loading port (origin)"
      />
      <input
        type="text"
        value={dischargePort ?? ""}
        onChange={(e) => onChangeDischargePort(e.target.value)}
        placeholder="To port (e.g. Alexandria, Egypt)"
        style={{
          ...selectStyle,
          cursor: "text",
          minWidth: 130,
          maxWidth: 200,
        }}
        title="Discharge port (destination)"
      />

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

      {/* Shipping marks — 'As per buyer's instruction' is the
          industry default. Picker writes a bold 'Shipping marks:'
          line into the terms; the operator can still type a custom
          value directly in the terms body afterwards. */}
      <select
        value={shippingMarks ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            fields: { shippingMarks: v || undefined },
            termsLineUpdates: { "Shipping marks": v },
          });
        }}
        style={selectStyle}
        title={shippingMarks || "Pick a shipping-marks rule"}
      >
        <option value="">Shipping marks…</option>
        {SHIPPING_MARKS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Container type — only shown when the picked shipping
          method is a container-loading mode (Sea FCL / RoRo /
          Reefer / Break Bulk). Stays hidden for Air / LCL / Road
          LTL / Courier etc. where 'container type' doesn't apply. */}
      {(() => {
        const sub = (selectedMethod?.sub_type ?? "").trim();
        const showContainer = sub && CONTAINER_TYPE_APPLIES.has(sub);
        if (!showContainer) return null;
        return (
          <select
            value={containerType ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                fields: { containerType: v || undefined },
                termsLineUpdates: { "Container type": v },
              });
            }}
            style={selectStyle}
            title={containerType || "Pick a container type"}
          >
            <option value="">Container…</option>
            {CONTAINER_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      })()}

      {/* Lead-time + ETD/ETA row — kept on the same flex line so the
          Quick Fill bar stays one strip; wraps on narrow viewports. */}
      <TimingRow
        leadTimeDays={leadTimeDays}
        leadTimeBasis={leadTimeBasis}
        selectedMethod={selectedMethod}
        selectStyle={selectStyle}
        onChange={onChange}
      />

      {/* Bank charges — boilerplate clause picker. */}
      <select
        value={bankCharges ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            fields: { bankCharges: v || undefined },
            termsLineUpdates: { "Bank Charges": v },
          });
        }}
        style={selectStyle}
        title={bankCharges || "Pick a bank-charges clause"}
      >
        <option value="">Bank charges…</option>
        {BANK_CHARGES_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Cancellation policy. */}
      <select
        value={cancellationPolicy ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            fields: { cancellationPolicy: v || undefined },
            termsLineUpdates: { "Cancellation Policy": v },
          });
        }}
        style={selectStyle}
        title={cancellationPolicy || "Pick a cancellation policy"}
      >
        <option value="">Cancellation…</option>
        {CANCELLATION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Governing law / arbitration seat. */}
      <select
        value={governingLaw ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            fields: { governingLaw: v || undefined },
            termsLineUpdates: { "Governing Law": v },
          });
        }}
        style={selectStyle}
        title={governingLaw || "Pick a governing law / arbitration seat"}
      >
        <option value="">Governing law…</option>
        {GOVERNING_LAW_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Documents Provided — multi-select widget that pulls from
          /api/shipping-documents and writes a comma-separated list
          of short_names into the Documents Provided row. */}
      <DocumentsPicker
        value={documentsProvided ?? []}
        selectStyle={selectStyle}
        onChange={(next) => {
          onChange({
            fields: { documentsProvided: next.length > 0 ? next : undefined },
            termsLineUpdates: { "Documents Provided": next.join(", ") },
          });
        }}
      />
    </div>
  );
}

/* DocumentsPicker — multi-select dropdown sourced from /api/
   shipping-documents. Renders a single 'Documents (N)…' chip; on
   click opens a small popover with checkboxes grouped by category.
   Picked rows save as their short_name (or code if no short_name)
   to the doc's documentsProvided[] field. */
function DocumentsPicker({
  value,
  selectStyle,
  onChange,
}: {
  value: string[];
  selectStyle: React.CSSProperties;
  onChange: (next: string[]) => void;
}) {
  interface DocLite {
    id: string;
    code: string;
    name: string;
    short_name: string | null;
    category: string;
  }
  const [docs, setDocs] = useState<DocLite[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shipping-documents", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        setDocs((j?.rows as DocLite[] | undefined) ?? []);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = (label: string) => {
    const set = new Set(value);
    if (set.has(label)) set.delete(label);
    else set.add(label);
    onChange([...set]);
  };

  const grouped = useMemo(() => {
    const out: Record<string, DocLite[]> = {};
    for (const d of docs) {
      (out[d.category] ??= []).push(d);
    }
    return out;
  }, [docs]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...selectStyle, cursor: "pointer", minWidth: 110 }}
        title={value.length > 0 ? value.join(", ") : "Pick documents to provide"}
      >
        {value.length > 0 ? `Documents (${value.length})` : "Documents…"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            background: T.paper,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: 8,
            minWidth: 280,
            maxWidth: 360,
            maxHeight: 360,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50,
          }}
        >
          {Object.keys(grouped).length === 0 && (
            <div style={{ fontSize: 11, color: T.inkGhost, padding: 8 }}>
              Loading documents…
            </div>
          )}
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat} style={{ marginBottom: 6 }}>
              <div
                style={{
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: T.inkGhost,
                  padding: "4px 6px",
                  fontWeight: 700,
                }}
              >
                {cat}
              </div>
              {list.map((d) => {
                const label = d.short_name ?? d.code;
                const checked = value.includes(label);
                return (
                  <label
                    key={d.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 6px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 11,
                      color: T.ink,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.surface)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(label)}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontWeight: 600 }}>{label}</span>
                    <span style={{ color: T.inkGhost, fontSize: 10 }}>
                      — {d.name}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Timing row inside the Quick Fill bar.

   Two inputs:
     [Lead time: __ d]   [from: deposit ▾]

   When both lead time + a Shipping Method are picked, we also write
   an ETD/ETA derived from the method's transit window. Writes three
   lines into the terms:
     · Lead time: 30 days after receipt of deposit
     · ETD:       30 days after receipt of deposit
     · ETA:       48-65 days after receipt of deposit

   The picker doesn't claim concrete calendar dates because the actual
   trigger (deposit / order / L/C) hasn't happened at quote time — but
   the relative window is what the customer always asks about. */
function TimingRow({
  leadTimeDays,
  leadTimeBasis,
  selectedMethod,
  selectStyle,
  onChange,
}: {
  leadTimeDays?: number;
  leadTimeBasis?: "after_deposit" | "after_order" | "after_lc_opening";
  selectedMethod?: ShippingMethodLite;
  selectStyle: React.CSSProperties;
  onChange: (patch: QuickFillPatch) => void;
}) {
  const basis = leadTimeBasis ?? "after_deposit";
  const basisLabel = LEAD_TIME_BASIS_LABEL[basis];

  /* Build the three formatted lines from the current lead time +
     selected shipping method. Each gets routed to its alias slot
     so existing 'Lead time:' / 'ETD:' / 'ETA:' lines are replaced
     in place rather than appended. */
  /* buildLines now writes only two timing lines:
       · 'Lead time:' — the production window the operator typed
       · 'Delivery time:' — combined (lead + transit) when a
         Shipping Method is also picked
     The old separate ETD line is dropped — it duplicated the Lead
     Time value and added noise. The 'Delivery time' canonical key
     replaces an existing 'Delivery time:' / 'ETA:' / 'ETD:' line
     via the alias map. */
  const buildLines = (days?: number, basisKey?: typeof basis): Record<string, string> => {
    const d = days ?? 0;
    const b = basisKey ?? basis;
    const bLabel = LEAD_TIME_BASIS_LABEL[b];
    if (!d) {
      return { "Lead time": "", "Delivery time": "" };
    }
    const out: Record<string, string> = {
      "Lead time": `${d} days ${bLabel}`,
    };
    const tMin = selectedMethod?.typical_transit_days_min ?? null;
    const tMax = selectedMethod?.typical_transit_days_max ?? null;
    if (tMin != null && tMax != null) {
      const lo = d + tMin;
      const hi = d + tMax;
      out["Delivery time"] = `${lo === hi ? lo : `${lo}-${hi}`} days ${bLabel}`;
    } else {
      out["Delivery time"] = "";
    }
    return out;
  };

  return (
    <>
      <input
        type="number"
        min={0}
        max={999}
        value={leadTimeDays ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          const days = raw === "" ? undefined : Math.max(0, Math.min(999, Number(raw)));
          onChange({
            fields: { leadTimeDays: days },
            termsLineUpdates: buildLines(days, basis),
          });
        }}
        placeholder="Lead time"
        style={{
          ...selectStyle,
          cursor: "text",
          minWidth: 70,
          maxWidth: 90,
        }}
        title="Lead time in days (production + ready-for-shipment)"
      />
      {leadTimeDays != null && leadTimeDays > 0 && (
        <span style={{ fontSize: 9, color: T.inkGhost, fontWeight: 600 }}>days</span>
      )}
      <select
        value={basis}
        onChange={(e) => {
          const next = e.target.value as typeof basis;
          onChange({
            fields: { leadTimeBasis: next },
            termsLineUpdates: buildLines(leadTimeDays, next),
          });
        }}
        style={selectStyle}
        title="What triggers the lead-time clock"
      >
        <option value="after_deposit">after deposit</option>
        <option value="after_order">after order</option>
        <option value="after_lc_opening">after L/C opening</option>
      </select>
      {leadTimeDays != null && leadTimeDays > 0 && selectedMethod &&
        selectedMethod.typical_transit_days_min != null && selectedMethod.typical_transit_days_max != null && (
          <span
            style={{
              fontSize: 9,
              color: T.inkSoft,
              fontWeight: 600,
              padding: "2px 6px",
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              background: T.paper,
            }}
            title="Estimated time of arrival — lead time + shipping transit"
          >
            ETA: {leadTimeDays + selectedMethod.typical_transit_days_min}–
            {leadTimeDays + selectedMethod.typical_transit_days_max} d {basisLabel}
          </span>
        )}
    </>
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
  /* Sizing rationale:
       · STAMP (aspectSquare=true) — locked to 40 mm × 40 mm using
         physical mm units. This is the Chinese mainland standard
         for an official company seal (公章) — every legitimate
         Chinese corporate stamp is 40 mm diameter by regulation.
         Using mm (not px) guarantees the rendered + printed size
         is exactly 40 mm regardless of viewport DPI, browser zoom,
         or print scaling. Important: the uploaded image needs to
         be a tight crop of the circular seal (no surrounding
         whitespace), otherwise object-fit:contain shrinks the
         visible circle below 40 mm.
       · SIGNATURE (aspectSquare=false) — handwritten signatures
         have no legal size, so the card uses 40 mm height and
         full card width as a comfortable signing area. */
  return (
    <div
      style={{
        position: "relative",
        width: aspectSquare ? "40mm" : "100%",
        height: aspectSquare ? "40mm" : "40mm",
        maxWidth: aspectSquare ? "40mm" : undefined,
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

/* Discount row in the totals stack.

   Left cell  : 'DISCOUNT' label.
   Right cell : editable percentage on the left of the cell, computed
                discount amount on the right (in red so the operator
                sees the impact at a glance).

   Sample render with pct=5, base=300,000:
     │ DISCOUNT │ 5 %         − US$ 15,000.00 │

   Picks land via onCommit which stores the percentage on the doc
   (current.discountPct). The grand total prop already includes the
   discount because the parent computes it that way. */
function DiscountRow({
  pct,
  base,
  onCommit,
  fmt,
}: {
  pct: number;
  base: number;
  onCommit: (val: number) => void;
  fmt: (n: number) => string;
}) {
  const amount = +(base * (Math.max(0, Math.min(100, pct)) / 100)).toFixed(2);
  return (
    <tr>
      <td
        className="pq-tl"
        style={{
          fontWeight: 700,
          background: "#fff",
          width: 110,
          fontSize: 10,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          border: `1px solid ${T.border}`,
          padding: "6px 12px",
          color: T.ink,
        }}
      >
        Discount
      </td>
      <td
        className="pq-tv"
        style={{
          fontSize: 11,
          textAlign: "right",
          border: `1px solid ${T.border}`,
          padding: "6px 12px",
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => {
              const raw = (e.currentTarget.textContent || "0").replace(/[^0-9.]/g, "");
              const v = Math.max(0, Math.min(100, parseFloat(raw) || 0));
              onCommit(v);
            }}
            style={{ outline: "none", minWidth: 24, textAlign: "right" }}
          >
            {pct > 0 ? pct : "0"}
          </span>
          <span style={{ color: T.inkGhost, fontWeight: 400 }}>%</span>
          <span
            style={{
              minWidth: 90,
              textAlign: "right",
              color: amount > 0 ? "#b91c1c" : T.inkGhost,
              fontWeight: amount > 0 ? 600 : 400,
            }}
          >
            {amount > 0 ? `− ${fmt(amount)} $` : "—"}
          </span>
        </span>
      </td>
    </tr>
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
            <span style={{ color: T.inkGhost, fontWeight: 400 }}>$</span>
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
