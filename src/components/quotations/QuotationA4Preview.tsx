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
  /* Structured QUOTATION TO fields. Each maps to one labelled row
     in the card (COMPANY NAME / ADDRESS / ACID NUMBER / CONTACT
     PERSON + email). All optional so older docs still render. */
  toAddress?: string;
  toAcid?: string;
  toEmail?: string;
  items: QuotationItem[];
  tax: number;
  shipping: number;
  others: number;
  terms: string;
  status: "draft" | "final";
  createdAt: string;
  updatedAt: string;
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
       · A4 inner content height: 1059 px (297 mm minus 32 px top + 24 px
         bottom padding).
       · Row height: 123 px (driven by the 96×96 square picture cell).
       · Page 1 header section (logo + brand strip + tagline + Date/
         Invoice/Valid Till/Client No card + Customer/Company card +
         Quotation To + items table header): 405 px → 654 px left
         for items → 5 rows fit.
       · Middle page (items table header only): 1023 px left → 8 rows.
       · Last page (items table header + totals + terms + stamp +
         bank + footer): 380 px left → 3 rows fit alongside the
         footer block.
     If items.length ≤ ITEMS_LAST the whole document collapses to a
     single page. */
  /* Page 1 capacity went back to 5 after the layout cleanup. The
     old 5-section page-1 header (meta + customer + contact card +
     Quotation To) consumed ~555 px; the new 3-section From / Bill
     To / Meta strip layout is ~360 px so an extra item row fits. */
  const ITEMS_FIRST  = 5;
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
        width: "210mm",
        minHeight: "297mm",
        background: T.paper,
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        margin: pageIdx === 0 ? "0 auto" : "32px auto 0",
        padding: "32px 32px 24px",
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
            padding: "8px 0 12px",
          }}
        >
          {/* Koleex wordmark logo */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="170"
            height="25.4"
            viewBox="0 0 719.83 107.57"
            style={{ display: "block" }}
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
            QUOTATION
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
          <MetaStripCell label="Quotation No">
            <span style={{ fontSize: 11, fontFamily: T.mono, letterSpacing: "0.02em" }}>
              {current.invoiceNo || "—"}
            </span>
          </MetaStripCell>
          <MetaStripCell label="Valid Till">
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
              }}
            >
              Quotation To
            </div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Company name — prominent at the top */}
              <input
                value={current.companyName}
                onChange={(e) => setMeta("companyName", e.target.value)}
                placeholder="Company name"
                style={{ ...inputResetStyle, fontSize: 12, fontWeight: 700, color: T.ink, letterSpacing: "0.01em" }}
              />
              {/* Address — full width line under the company name */}
              <textarea
                rows={2}
                value={current.toAddress ?? ""}
                onChange={(e) => setMeta("toAddress", e.target.value)}
                placeholder="Address"
                style={{
                  ...inputResetStyle,
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: T.inkSoft,
                  resize: "none",
                  minHeight: 28,
                }}
              />
              {/* Inline label-value grid for the remaining structured
                  fields. 55 px label column matches the FROM card's
                  left-column rhythm so the two cards feel symmetric. */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr",
                  rowGap: 3,
                  columnGap: 8,
                  fontSize: 10,
                }}
              >
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>ACID</span>
                <input
                  value={current.toAcid ?? ""}
                  onChange={(e) => setMeta("toAcid", e.target.value)}
                  placeholder="—"
                  style={{ ...inputResetStyle, fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }}
                />
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact</span>
                <input
                  value={current.customerName}
                  onChange={(e) => setMeta("customerName", e.target.value)}
                  placeholder="Contact person"
                  style={{ ...inputResetStyle, fontWeight: 700, color: T.ink }}
                />
                <span style={{ color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</span>
                <input
                  value={current.toEmail ?? ""}
                  onChange={(e) => setMeta("toEmail", e.target.value)}
                  placeholder="email@example.com"
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
                <tr key={idx} style={{ minHeight: 60, height: "auto", position: "relative" }}>
                  <Td align="center" style={{ color: T.inkSoft, fontVariantNumeric: "tabular-nums" }}>
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
                    <div
                      className={`quot-img-cell${item.image ? " has-img" : ""}`}
                      onClick={() => fileInputRefs.current[idx]?.click()}
                      style={{
                        width: "100%",
                        /* Lock to a square via aspectRatio rather than a
                           fixed height — the cell scales with the A4
                           regardless of zoom level or pixel-ratio. */
                        aspectRatio: "1 / 1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: item.image ? "none" : `1px dashed ${T.inkGhost}`,
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                        background: item.image ? "transparent" : "#FAFAFA",
                        margin: "0 auto",
                        maxWidth: 110,
                      }}
                    >
                      {item.image ? (
                        <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: 22, color: T.inkGhost, fontWeight: 300 }}>+</span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        ref={(el) => { fileInputRefs.current[idx] = el; }}
                        style={{ position: "absolute", left: -9999, width: 0, height: 0 }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(idx, f);
                        }}
                      />
                    </div>
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
                    <div
                      className="no-print"
                      style={{
                        position: "absolute",
                        /* Pin to vertical centre of the row so the
                           cluster always tracks the row's height,
                           even when long descriptions push the row
                           taller than a single line. */
                        top: "50%",
                        transform: "translateY(-50%)",
                        /* A4 has 32 px right padding; -56 puts the
                           cluster ~24 px past the paper edge with a
                           comfortable gap between paper and buttons.
                           36 px button + 24 px gap = 60 px total
                           reach from the paper edge. */
                        right: -56,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        zIndex: 2,
                      }}
                    >
                      <RowActionBtn
                        title="Move row up"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, -1)}
                        icon={<ArrowUpIcon size={16} />}
                      />
                      <RowActionBtn
                        title="Move row down"
                        disabled={idx === current.items.length - 1}
                        onClick={() => moveItem(idx, 1)}
                        icon={<ArrowDownIcon size={16} />}
                      />
                      <RowActionBtn
                        title="Remove row"
                        disabled={current.items.length <= 1}
                        onClick={() => removeItem(idx)}
                        icon={<TrashIcon size={15} />}
                        destructive
                      />
                    </div>

                    {/* Internal notes — same trick, further out
                        sitting outside the A4 with a clean gap. The
                        8 px radius matches every other rounded block
                        in the document so the rhythm stays
                        consistent. */}
                    <div
                      className="quot-row-notes no-print"
                      style={{
                        position: "absolute",
                        top: 4,
                        bottom: 4,
                        right: -300,
                        width: 220,
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 12,
                        padding: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        textAlign: "left",
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
        {/* Add-row button */}
        <button
          type="button"
          onClick={addItem}
          className="pq-add-btn no-print"
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
            margin: "10px 0 16px",
          }}
        >
          + Add row
        </button>

        {/* ═══════════════════════════════════════════════════════════════
            (g) BOTTOM ROW — totals (left) + terms (right)
            ═══════════════════════════════════════════════════════════════ */}
        <table cellSpacing={0} style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
          <tbody>
            <tr>
              {/* LEFT: Totals stack. Subtotal + Tax + Shipping +
                  Other + Grand Total + Total-in-Letters all live
                  inside ONE rounded wrapper so the bottom-left corner
                  curves under the in-letters row and the top-right
                  curves over the Grand-Total bar. The two tables
                  inside have their own borders stripped. */}
              <td className="pq-bot-l" style={{ width: "44%", verticalAlign: "top" }}>
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
              </td>

              {/* RIGHT: Terms & Conditions, wrapped in a rounded
                  container that matches the totals card on the left. */}
              <td className="pq-bot-r" style={{ width: "56%", paddingLeft: 16, verticalAlign: "top" }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", height: "100%" }}>
                <table
                  className="pq-terms-tbl"
                  cellSpacing={0}
                  style={{ width: "100%", borderCollapse: "collapse", border: "none", height: "100%" }}
                >
                  <tbody>
                    <tr>
                      <td
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
                      </td>
                    </tr>
                    <tr>
                      <td className="pq-terms-value" style={{ padding: 0, verticalAlign: "top" }}>
                        <TermsArea
                          terms={current.terms}
                          totalQty={totalQty}
                          onCommit={(v) => setMeta("terms", v)}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

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
            <div style={{ padding: 10 }}>
              <div
                className="pq-stamp-box"
                style={{
                  width: "100%",
                  height: 86,
                  border: `1px dashed ${T.inkGhost}`,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  color: T.inkGhost,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Affix Stamp Here
              </div>
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
                padding: "10px 12px 8px",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Signature line — taller so a real signature fits */}
              <div
                style={{
                  height: 48,
                  borderBottom: `1px solid ${T.inkSoft}`,
                  marginBottom: 6,
                }}
              />
              {/* Field labels under the line — Name / Title / Date */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 4,
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.inkGhost,
                  textAlign: "center",
                }}
              >
                <span>Name</span>
                <span>Title</span>
                <span>Date</span>
              </div>
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

/* Terms & Conditions box with auto-injected Total Qty.
   ──────────────────────────────────────────────────────
   The terms field is a normal contentEditable so the user can write
   anything (Payment terms, Shipping, Delivery Time, etc.). On top
   of that we keep one line in sync with the running sum of every
   item's qty: "Total Qty: <N>".

   How it works:
     · `totalQty` is recomputed every time items change (in the
       parent useMemo).
     · `displayedTerms` runs a regex over the stored terms string
       and replaces (or appends, if missing) the "Total Qty:" line
       with the latest computed value.
     · We mirror that into the contentEditable's innerHTML through
       a ref + useEffect — BUT only when the box is NOT focused, so
       the user's caret doesn't jump while they're typing.
     · `onBlur` saves whatever the user typed (which now includes
       the latest computed total) back to current.terms.
*/
function TermsArea({
  terms,
  totalQty,
  onCommit,
}: {
  terms: string;
  totalQty: number;
  onCommit: (next: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);

  const displayedTerms = useMemo(() => {
    /* Regex: "Total Qty:" + optional spaces/tabs + anything up to
       (but not including) the line break. Case-insensitive. */
    const re = /Total Qty:[ \t]*[^\n\r]*/i;
    if (re.test(terms)) {
      return terms.replace(re, `Total Qty: ${totalQty}`);
    }
    /* No existing line — append it on a new line (trim handles the
       case where terms is empty or already ends with a newline). */
    const trimmed = terms.replace(/\s+$/, "");
    return trimmed + (trimmed ? "\n" : "") + `Total Qty: ${totalQty}`;
  }, [terms, totalQty]);

  /* Sync the contentEditable's innerHTML when displayedTerms changes
     and the user is not editing. Skipping the sync while focused
     prevents the caret from jumping in the middle of a keystroke. */
  useEffect(() => {
    if (!ref.current) return;
    if (focused) return;
    const next = displayedTerms.replace(/\n/g, "<br>");
    if (ref.current.innerHTML !== next) {
      ref.current.innerHTML = next;
    }
  }, [displayedTerms, focused]);

  return (
    <div
      ref={ref}
      className="pq-tc-area"
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        setFocused(false);
        onCommit(e.currentTarget.innerText || e.currentTarget.textContent || "");
      }}
      style={{
        width: "100%",
        fontSize: 11,
        fontWeight: 400,
        lineHeight: 1.65,
        border: "none",
        padding: "10px 12px",
        minHeight: 90,
        outline: "none",
        whiteSpace: "pre-wrap",
      }}
    />
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
/* Row action button — Hub design system pill. Surface background,
   subtle border, rounded-xl, clear hover. The cluster sits in the
   dark area outside the A4 paper so the surface tokens hit a dark
   backdrop naturally. */
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
  /* Base palette pulls from the Hub design tokens that ship with
     the dark theme — same look as the toolbar buttons on top of
     the editor (Back / Save Draft / Convert to Invoice). */
  const idleBg     = "rgba(255, 255, 255, 0.06)";
  const hoverBg    = destructive ? "rgba(239, 68, 68, 0.18)" : "rgba(255, 255, 255, 0.14)";
  const idleBorder = "rgba(255, 255, 255, 0.10)";
  const hoverBorder= destructive ? "rgba(239, 68, 68, 0.45)" : "rgba(255, 255, 255, 0.22)";
  const idleColor  = destructive ? "rgba(248, 113, 113, 0.95)" : "rgba(255, 255, 255, 0.92)";
  const hoverColor = destructive ? "#FCA5A5" : "#FFFFFF";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        border: `1px solid ${disabled ? "rgba(255,255,255,0.06)" : (hover ? hoverBorder : idleBorder)}`,
        background: disabled ? "rgba(255,255,255,0.03)" : (hover ? hoverBg : idleBg),
        color: disabled
          ? (destructive ? "rgba(248,113,113,0.35)" : "rgba(255,255,255,0.30)")
          : (hover ? hoverColor : idleColor),
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        boxShadow: disabled
          ? "none"
          : (hover ? "0 4px 14px rgba(0,0,0,0.35)" : "0 2px 6px rgba(0,0,0,0.25)"),
        transition: "background-color 120ms ease, color 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
      }}
    >
      {icon}
    </button>
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
