"use client";

/* ---------------------------------------------------------------------------
   The printed sales contract.

   ── Why this looks like the quotation and the invoice ──────────────────────
   It did not, and that was the defect. The first version was set in Georgia
   with hairline grey rules — a perfectly reasonable contract, and a document
   that announced it came from somewhere else. Three papers from one company,
   often sent in the same email, have to be recognisably the same company.

   So it uses the house language exactly: the KOLEEX wordmark, the black
   company strip over the grey tagline, the 12px radii, rich-black uppercase
   labels on hairline #E5E7EB borders, the meta grid, the party cards, a
   black table head and a black total bar.

   ── Why it is its own memoised file ────────────────────────────────────────
   It redraws twenty articles of prose. The editor beside it changes on every
   keystroke, and sharing a component would re-lay-out the whole contract to
   type one character into a port name.

   Reads either the LIVE terms (draft) or the frozen `snapshot` (signed).
   Never both: a signed contract must not consult anything that can still
   change, and a draft must follow corrections made to the invoice.
   --------------------------------------------------------------------------- */

import { memo } from "react";
import { articlesFor, type RenderedArticle } from "@/lib/contracts/general-terms";
import KoleexWordmark from "@/components/brand/KoleexWordmark";
import DocumentBrandStrips, { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
/* The same seal and signature boxes the quotation and invoice print — a 40mm
   square for the Chinese company seal, the signature beside it. Reused rather
   than redrawn so all three documents seal identically. */
import { StampSignatureBox, StampSignatureActions } from "@/components/quotations/QuotationA4Preview";
import type { ContractTerms, InvoiceLite, ScheduleItem, SnapshotShape } from "./types";

/* The same tokens the quotation and invoice use. */
const T = {
  black: "#0A0A0A",
  ink: "#1A1A1A",
  inkSoft: "#4B5563",
  inkGhost: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F5F5F5",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/* What the document stamps across its own face, by state. `signed` is absent
   deliberately: an executed contract carries no band at all. */
const BANDS: Record<string, { text: string; colour: string } | undefined> = {
  draft: { text: "DRAFT — NOT FOR SIGNATURE", colour: "#b45309" },
  ready: { text: "AWAITING SIGNATURE", colour: "#b45309" },
  signed: undefined,
  superseded: { text: "SUPERSEDED — REPLACED BY A LATER CONTRACT", colour: "#6b7280" },
  cancelled: { text: "CANCELLED", colour: "#b91c1c" },
};

/** Day/Month/Year — the house rule, and the only unambiguous reading for a
    document crossing between markets. */
function dmy(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function money(v: unknown, currency?: string | null): string {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${currency ?? ""} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

/** Item descriptions carry editor markup. A contract is read by a buyer and
    their bank, not by a browser — the live document was printing
    "MachineBrand:KOLEEX<div>Warranty:5 YEARS</div>" onto the page.

    Every tag becomes a SPACE, not nothing: deleting them welds words
    together ("MachineBrand"). */
function plainText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** The invoice writes `unitPrice`; older frozen snapshots wrote `price`. */
function unitPriceOf(it: ScheduleItem): number {
  const n = Number(it.unitPrice ?? it.price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function basisWords(b?: string): string {
  if (b === "after_lc_opening") return "after receipt of the operative credit";
  if (b === "after_order") return "from the date of this Contract";
  return "after receipt of the advance payment";
}

export interface ContractA4Props {
  contractNo: string;
  status: string;
  dealNo?: number | null;
  contractDate?: string | null;
  placeOfSigning?: string | null;
  currency?: string | null;
  total?: number | null;
  terms: ContractTerms;
  invoice: InvoiceLite | null;
  /** Present only once signed. When present it wins over everything above. */
  snapshot?: SnapshotShape | null;
  /** The contract this one replaces, when it is an amendment. */
  amendsNo?: string | null;

  /* Seal + signature. The tenant's saved pair, and the actions to attach,
     upload or clear them. Absent on the print route, which renders read-only
     and must show no controls. */
  savedStampUrl?: string | null;
  savedSignatureUrl?: string | null;
  onAttachSavedStamp?: () => void;
  onAttachSavedSignature?: () => void;
  onUploadStamp?: (file: File) => void;
  onUploadSignature?: (file: File) => void;
  onClearStamp?: () => void;
  onClearSignature?: () => void;
  /** False on a signed contract and on the print route. */
  isEditable?: boolean;
}

/* ── Paging ────────────────────────────────────────────────────────────────
   The house sheet is 210 × 270 mm, NOT 210 × 297. 270 is deliberate: it fits
   A4 *and* US Letter without the every-other-blank-sheet overflow the invoice
   hit, and `.quot-a4-doc` in globals.css fixes every sheet to it.

   This document used to be one box with `minHeight: 297mm` and three sheets'
   worth of prose inside it — 840 mm of content spilling 543 mm past its own
   paper. On screen `overflow: visible` hid the problem; on paper the browser
   cut it wherever it liked, and pages 2 and 3 came out carrying no logo, no
   company name and no page number. For a contract that is not cosmetic: a
   page can be pulled from the set and nothing on the remaining paper says so.

   So the articles are measured and dealt onto real sheets, every sheet
   carries the contract number and "Page X of Y", and every sheet after the
   first repeats a compact identity strip.

   Heights are ESTIMATED from character counts rather than measured in the
   DOM. A measuring pass would be exact and would also mean a layout read on
   every keystroke of the editor beside it. The budget below leaves enough
   slack to absorb the error, and `breakInside: avoid` on each article stops
   the browser splitting one mid-sentence if an estimate runs short. */
/* ── Measured on the live sheet, not guessed ─────────────────────────────
   The cover used to be assumed to fit: header, parties, schedule and key
   terms all went on sheet one and nothing checked. With five goods lines it
   came to 294 mm inside a 270 mm box, and `.quot-a4-doc`'s `overflow: hidden`
   swallowed the last 24 mm IN SILENCE — the Documents row of Key Terms was
   sliced through the middle and simply did not print.

   Silent truncation is the worst failure mode a contract can have: the page
   looks finished. So every block on the cover is now costed and the ones that
   do not fit move to the next sheet. */
const COVER_HEAD_PX = 118;       // wordmark + document title
const BRAND_STRIPS_PX = 51;      // company line + tagline
const STATUS_BAND_PX = 26;       // DRAFT / SUPERSEDED / CANCELLED band
const META_STRIP_PX = 56;        // date · contract no · invoice no · client no
const PARTIES_PX = 157;          // the two party cards
const PREAMBLE_PX = 32;          // "This Contract is made on …"
const SECTION_BAR_PX = 25;       // one black section heading
const TABLE_HEAD_PX = 34;        // the goods table's own head row
const TABLE_TOTAL_PX = 32;       // the black total bar
const GOODS_ROW_PX = 30;         // one goods line
const KEY_TERM_ROW_PX = 28;      // one Key Terms row
const BLOCK_GAP_PX = 13;         // the margin under each block

const SHEET_INNER_PX = 978;      // 270mm less the 24/18px vertical padding
const CONT_HEAD_PX = 58;         // identity strip on sheets 2..N
const FOOT_PX = 26;              // page-number footer on every sheet
/* The two signature cards. The seller's now carries a 40mm seal and a
   signature box, which is ~150px taller than the bare rules it replaced —
   budgeted, or the signatures get pushed past the sheet edge and clipped the
   way Key Terms were. */
const SIGN_BLOCK_PX = 400;
const CHARS_PER_LINE = 148;      // 10px text across ~738px of inner width
const LINE_PX = 15;
const ART_TITLE_PX = 16;
const ART_GAP_PX = 9;

function articleHeight(body: string): number {
  const paras = body.split("\n\n");
  let lines = 0;
  for (const para of paras) lines += Math.max(1, Math.ceil(para.length / CHARS_PER_LINE));
  return ART_TITLE_PX + lines * LINE_PX + (paras.length - 1) * 6 + ART_GAP_PX;
}

interface Sheet {
  articles: RenderedArticle[];
  /** The cover — header, parties, preamble, and the schedule. */
  isFirst: boolean;
  /** The last sheet carries the special conditions and the signatures. */
  isLast: boolean;
  /** Key Terms ride on whichever sheet has room for them, cover or not. */
  keyTerms?: boolean;
}

/** Deal the articles onto sheets. The first sheet is the cover — it holds the
    schedule and key terms and no articles at all, because those two blocks
    already fill it. */
function paginate(
  articles: RenderedArticle[],
  specialCount: number,
  opts: { goodsCount: number; keyTermRows: number; hasBand: boolean },
): Sheet[] {
  /* ── Does the cover actually fit? ──────────────────────────────────────
     Costed block by block instead of assumed. Key Terms are the movable
     part: if the schedule has left no room for them they go to the next
     sheet rather than being clipped away. */
  const coverFixed =
    COVER_HEAD_PX +
    BRAND_STRIPS_PX +
    (opts.hasBand ? STATUS_BAND_PX : 0) +
    META_STRIP_PX +
    PARTIES_PX +
    PREAMBLE_PX +
    SECTION_BAR_PX +
    TABLE_HEAD_PX +
    TABLE_TOTAL_PX +
    opts.goodsCount * GOODS_ROW_PX +
    8 * BLOCK_GAP_PX;

  const keyTermsCost = SECTION_BAR_PX + opts.keyTermRows * KEY_TERM_ROW_PX + BLOCK_GAP_PX;
  const coverAvailable = SHEET_INNER_PX - FOOT_PX;
  const keyTermsOnCover = coverFixed + keyTermsCost <= coverAvailable;

  const sheets: Sheet[] = [{ articles: [], isFirst: true, isLast: false, keyTerms: keyTermsOnCover }];

  let budget = SHEET_INNER_PX - CONT_HEAD_PX - FOOT_PX;
  /* Key Terms pushed off the cover take their space from the first articles
     sheet instead. */
  let pendingKeyTerms = !keyTermsOnCover;
  if (pendingKeyTerms) budget -= keyTermsCost;
  let current: RenderedArticle[] = [];
  const flush = () => {
    sheets.push({ articles: current, isFirst: false, isLast: false, keyTerms: pendingKeyTerms });
    pendingKeyTerms = false;
    current = [];
    budget = SHEET_INNER_PX - CONT_HEAD_PX - FOOT_PX;
  };

  for (const a of articles) {
    const h = articleHeight(a.body);
    if (current.length > 0 && h > budget) flush();
    current.push(a);
    budget -= h;
  }
  if (current.length > 0 || pendingKeyTerms) flush();

  /* BALANCE — the same rule the quotation and invoice now use. A trailing
     sheet holding one article above a page of white is the defect the owner
     reported on the invoice; a contract can produce it just as easily when
     the article count lands a little past a boundary. If the last articles
     sheet came out less than half full and there is an earlier sheet to
     borrow from, spread them evenly instead.

     Only ever moves articles LATER, and the first articles sheet is checked
     against the same budget it was filled with, so nothing can end up over. */
  const articleSheets = sheets.filter((sh) => !sh.isFirst);
  if (articleSheets.length > 1) {
    const heights = articles.reduce<Record<string, number>>((acc, a) => {
      acc[a.key] = articleHeight(a.body);
      return acc;
    }, {});
    const lastHeight = articleSheets[articleSheets.length - 1].articles.reduce(
      (n, a) => n + (heights[a.key] ?? 0),
      0,
    );
    const perSheet = SHEET_INNER_PX - CONT_HEAD_PX - FOOT_PX;
    if (lastHeight < perSheet / 2) {
      const flat = articleSheets.flatMap((sh) => sh.articles);
      const per = Math.ceil(flat.length / articleSheets.length);
      const rebalanced: RenderedArticle[][] = [];
      for (let i = 0; i < flat.length; i += per) rebalanced.push(flat.slice(i, i + per));
      const allFit = rebalanced.every(
        (group) => group.reduce((n, a) => n + (heights[a.key] ?? 0), 0) <= perSheet,
      );
      if (allFit && rebalanced.length === articleSheets.length) {
        articleSheets.forEach((sh, i) => {
          sh.articles = rebalanced[i] ?? [];
        });
      }
    }
  }

  /* The signatures must not be marooned on a sheet of their own with nothing
     above them — a signature page that carries no terms is the classic way a
     signed page gets attached to a document nobody agreed to. Keep them with
     the last articles when there is room; otherwise give them their own
     sheet, which then still repeats the identity strip and the page number. */
  const last = sheets[sheets.length - 1];
  const needed = SIGN_BLOCK_PX + (specialCount > 0 ? 40 + specialCount * 18 : 0);
  if (last.isFirst || budget < needed) {
    sheets.push({ articles: [], isFirst: false, isLast: true });
  } else {
    last.isLast = true;
  }
  return sheets;
}

/** The strip that identifies sheets 2..N. Not the full brand header — that
    would eat a third of every continuation sheet — but enough that a loose
    page can be placed: whose contract, which number, which deal. */
function ContinuationHead({ contractNo, buyer }: { contractNo: string; buyer: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: T.black,
        color: "#fff",
        borderRadius: 8,
        padding: "6px 14px",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 12,
      }}
    >
      <span>Sales Contract · {contractNo}</span>
      <span style={{ fontWeight: 600, letterSpacing: "0.04em" }}>{buyer}</span>
    </div>
  );
}

function SheetFooter({ contractNo, n, of }: { contractNo: string; n: number; of: number }) {
  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: 8,
        borderTop: `1px solid ${T.border}`,
        display: "flex",
        justifyContent: "space-between",
        fontFamily: T.mono,
        fontSize: 8,
        color: T.inkSoft,
        letterSpacing: "0.04em",
      }}
    >
      <span>{contractNo}</span>
      {/* Initialling each page is what stops a sheet being swapped after
          signature. The box is printed whether or not anyone uses it. */}
      <span>Buyer&rsquo;s initials ________</span>
      <span>
        Page {n} of {of}
      </span>
    </div>
  );
}

function ContractA4Inner(props: ContractA4Props) {
  const frozen = props.snapshot ?? null;
  const band = BANDS[props.status];

  const terms = (frozen?.terms ?? props.terms) as ContractTerms;
  const articles: RenderedArticle[] = frozen?.articles ?? articlesFor(terms);
  /* ── The buyer, from the LIVE invoice while this is a draft ──────────────
     The header of this file already promised it: "a draft must follow
     corrections made to the invoice". The goods did. The BUYER did not — it
     was copied into `terms` at creation and never looked at again, so a
     contract drafted before the invoice's buyer block was corrected kept the
     old name, the old address and the old client number forever.

     Caught on live data: the invoice reads "Freeland Industries Ltd. /
     BD-1250 / MIR MANSION … Bakalia, Chattogram", the contract printed
     "Freeland Industry / 1250 / Rajakhali, Chittagong", and an AMENDMENT
     raised four minutes after the invoice was corrected inherited the stale
     copy too, because it starts from the contract it amends.

     Signed still wins from the snapshot — that is the whole point of
     freezing. `terms.buyer` stays as the last-resort fallback for a contract
     whose invoice has since been deleted. */
  const invoiceBuyer = liveBuyer(props.invoice);
  const buyer = (frozen?.buyer ?? invoiceBuyer ?? terms.buyer ?? {}) as Record<string, string | undefined>;

  const items: ScheduleItem[] = frozen ? frozen.schedule.items : invoiceItems(props.invoice);
  const currency = frozen?.currency ?? props.currency ?? props.invoice?.currency ?? "";
  const total = frozen?.total ?? props.total ?? props.invoice?.total ?? 0;
  const invoiceNo = frozen?.schedule.invoiceNo ?? props.invoice?.inv_no ?? null;
  const contractDate = frozen?.contractDate ?? props.contractDate;

  /* Six fixed Key Terms rows, plus Documents when there are any — counted
     the same way the JSX below renders them, so the cost cannot drift from
     what is actually drawn. */
  const keyTermRows = 6 + ((terms.documents ?? []).length > 0 ? 1 : 0);
  const sheets = paginate(articles, (terms.specialConditions ?? []).length, {
    goodsCount: items.length,
    keyTermRows,
    hasBand: !!band,
  });
  const buyerName = buyer.company || buyer.name || "—";

  return (
    <>
      {/* ── Why this rule exists ────────────────────────────────────────────
          The sheet is a flex column so the page-number footer can sit at the
          bottom with `margin-top: auto`. Flex children default to
          `flex-shrink: 1`, so when a sheet's content came close to full the
          browser started SQUEEZING blocks to make them fit — and the first
          thing to give was the grey tagline strip, which printed with
          "SHAPING THE FUTURE." sliced off along the bottom.

          Nothing on a contract may be compressed to fit; if it does not fit,
          it belongs on the next sheet. */}
      <style>{`.kx-contract-sheet > * { flex-shrink: 0; }`}</style>
      {sheets.map((sheet, i) => (
        <div
          key={i}
          className="quot-a4-doc kx-contract-sheet"
          /* Geometry comes from `.quot-a4-doc` in globals.css — 210 × 270 mm
             fixed, the same sheet the quotation and invoice print on. Nothing
             here overrides height: a document that sets its own paper size is
             how this ended up 840 mm tall. */
          style={{
            display: "flex",
            flexDirection: "column",
            color: T.ink,
            fontSize: 11,
            lineHeight: 1.5,
            boxShadow: "0 2px 24px rgba(0,0,0,0.28)",
          }}
        >
          {sheet.isFirst ? (
            <>
      {/* ── (a) Header: wordmark + document title ── */}
      <div
        className="pq-top-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "36px 0 32px",
        }}
      >
        <KoleexWordmark />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.black, letterSpacing: "0.08em" }}>
            SALES CONTRACT
          </div>
          {props.amendsNo ? (
            <div style={{ fontSize: 9, letterSpacing: "0.1em", color: T.inkSoft, marginTop: 3 }}>
              AMENDMENT TO {props.amendsNo}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── (b + c) Brand strips ── */}
      <DocumentBrandStrips black={T.black} surface={T.surface} />

      {/* A document says on its face what it is. A superseded contract must
          never be stamped "DRAFT": it is executed history, and printing it as
          a draft would misrepresent a document the parties actually signed. */}
      {band ? (
        <div
          style={{
            border: `1px dashed ${band.colour}`,
            borderRadius: 8,
            color: band.colour,
            fontFamily: T.mono,
            fontSize: 9,
            letterSpacing: "0.14em",
            textAlign: "center",
            padding: "5px 0",
            marginBottom: 12,
          }}
        >
          {band.text}
        </div>
      ) : null}

      {/* ── (d) Meta strip ── */}
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
        <MetaCell label="Date" isFirst value={dmy(contractDate)} mono />
        <MetaCell label="Contract No" value={props.contractNo} mono />
        <MetaCell label="Invoice No" value={invoiceNo ?? "—"} mono />
        <MetaCell label="Client No" isLast value={buyer.clientNo || "—"} mono />
      </div>

      {/* ── Party cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <PartyCard
          label="Seller"
          name={KOLEEX_COMPANY.en}
          lines={[KOLEEX_COMPANY.address, `Tel ${KOLEEX_COMPANY.tel}`, KOLEEX_COMPANY.web]}
        />
        <PartyCard
          label="Buyer"
          name={buyer.company || buyer.name || "—"}
          lines={[
            buyer.company && buyer.name ? `Attn: ${buyer.name}` : "",
            buyer.address || "",
            [buyer.phone, buyer.email].filter(Boolean).join("  ·  "),
            /* Bangladesh clears against an ACID number; it belongs on the
               contract for the same reason it belongs on the invoice. */
            buyer.acid ? `ACID No: ${buyer.acid}` : "",
          ].filter(Boolean)}
        />
      </div>

      <p style={{ margin: "0 0 14px", fontSize: 10.5 }}>
        This Contract is made on <b>{dmy(contractDate)}</b>
        {(frozen?.placeOfSigning ?? props.placeOfSigning)
          ? ` at ${frozen?.placeOfSigning ?? props.placeOfSigning}`
          : ""}{" "}
        between the Seller and the Buyer named above, who agree to the sale and purchase of the Goods described below
        on the terms that follow.
        {props.amendsNo ? (
          <>
            {" "}
            <b>This Contract amends and replaces Contract No. {props.amendsNo} in its entirety.</b>
          </>
        ) : null}
      </p>

      {/* ── Commercial schedule ── */}
      <SectionBar>Commercial Schedule</SectionBar>
      <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: T.black, color: "#fff" }}>
              <Th style={{ width: 28, textAlign: "center" }}>#</Th>
              <Th>Description of goods</Th>
              <Th style={{ width: 96 }}>Model</Th>
              <Th style={{ width: 46, textAlign: "right" }}>Qty</Th>
              <Th style={{ width: 82, textAlign: "right" }}>Unit price</Th>
              <Th style={{ width: 94, textAlign: "right" }}>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <Td colSpan={6} style={{ textAlign: "center", color: T.inkGhost, padding: "16px 6px" }}>
                  No goods on the linked invoice.
                </Td>
              </tr>
            ) : (
              items.map((it, i) => (
                <tr key={i}>
                  <Td style={{ textAlign: "center", fontFamily: T.mono, color: T.inkSoft }}>{i + 1}</Td>
                  <Td>
                    <div style={{ fontWeight: 600 }}>{plainText(it.name) || plainText(it.description) || "—"}</div>
                    {it.description && it.name ? (
                      <div style={{ color: T.inkSoft, fontSize: 9.5 }}>{plainText(it.description)}</div>
                    ) : null}
                  </Td>
                  <Td style={{ fontFamily: T.mono, fontSize: 9.5 }}>{it.model ?? "—"}</Td>
                  <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.qty ?? "—"}</Td>
                  <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {money(unitPriceOf(it), currency)}
                  </Td>
                  <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {money(Number(it.qty ?? 0) * unitPriceOf(it), currency)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Black total bar — the same closing gesture the invoice uses. */}
        <div
          style={{
            background: T.black,
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          <span>
            TOTAL CONTRACT VALUE
            {terms.incoterm ? ` — ${terms.incoterm} ${terms.incotermPlace ?? ""}`.trimEnd().toUpperCase() : ""}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(total, currency)}</span>
        </div>
      </div>

            </>
          ) : (
            <ContinuationHead contractNo={props.contractNo} buyer={buyerName} />
          )}

          {/* ── The facts a reader checks first ──
              Rides the cover when the schedule left room, otherwise the next
              sheet. It used to be nailed to the cover and clipped away when
              it did not fit. */}
          {sheet.keyTerms && (
            <>

        <SectionBar>Key Terms</SectionBar>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
          <FactRow k="Price basis" v={terms.incoterm ? `${terms.incoterm} ${terms.incotermPlace ?? ""}`.trim() + " (Incoterms® 2020)" : "—"} />
          <FactRow k="Payment" v={terms.paymentLabel ?? "—"} />
          <FactRow k="Port of loading" v={terms.loadingPort ?? "—"} />
          <FactRow k="Port of discharge" v={terms.dischargePort ?? "—"} />
          <FactRow
            k="Delivery time"
            v={terms.leadTimeDays ? `${terms.leadTimeDays} days ${basisWords(terms.leadTimeBasis)}` : "—"}
          />
          <FactRow k="Warranty" v={terms.warrantyMonths ? `${terms.warrantyMonths} months` : "—"} />
          {(terms.documents ?? []).length > 0 ? (
            <FactRow k="Documents" v={(terms.documents ?? []).join(" · ")} last />
          ) : null}
        </div>
            </>
          )}

          {/* ── Articles ──
              The first sheet carries none: the schedule and key terms fill
              it. Numbering is continuous across sheets because the numbers
              come from articlesFor(), not from the position on the page. */}
          {sheet.articles.length > 0 && (
            <>
              {sheet.isFirst || sheets[i - 1]?.isFirst ? (
                <SectionBar>General Terms and Conditions</SectionBar>
              ) : null}
              <ol style={{ margin: "0 0 10px", padding: 0, listStyle: "none" }}>
                {sheet.articles.map((a) => (
                  <li key={a.key ?? a.n} style={{ marginBottom: 9, breakInside: "avoid" }}>
                    <div style={{ fontWeight: 700, fontSize: 10.5, color: T.black }}>
                      {a.n}. {a.title}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", textAlign: "justify", fontSize: 10, color: T.ink }}>
                      {a.body}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          {sheet.isLast && (
            <>
              {/* Anything negotiated for this deal alone outranks the general
                  terms, so it prints after them and says so. */}
              {(terms.specialConditions ?? []).length > 0 && (
                <>
                  <SectionBar>Special Conditions</SectionBar>
                  <p style={{ margin: "0 0 6px", fontSize: 9.5, color: T.inkSoft }}>
                    Where these conflict with the General Terms above, these prevail.
                  </p>
                  <ol style={{ margin: "0 0 14px", paddingInlineStart: 18, fontSize: 10 }}>
                    {(terms.specialConditions ?? []).map((c, j) => (
                      <li key={j} style={{ marginBottom: 4 }}>
                        {c}
                      </li>
                    ))}
                  </ol>
                </>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginTop: 14,
                  breakInside: "avoid",
                }}
              >
                <SignBlock role="For and on behalf of the SELLER" party={KOLEEX_COMPANY.en}>
                  {/* The seal sits INSIDE the seller's block, over the rule it
                      is signed above — where a company chop actually goes. */}
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 6 }}>
                    <StampSignatureBox
                      imageUrl={terms.stampUrl}
                      placeholder="Company seal"
                      aspectSquare
                      isEditable={props.isEditable && !!props.onClearStamp}
                      onClear={props.onClearStamp}
                    />
                    <StampSignatureBox
                      imageUrl={terms.signatureUrl}
                      placeholder="Signature"
                      isEditable={props.isEditable && !!props.onClearSignature}
                      onClear={props.onClearSignature}
                    />
                  </div>
                  {props.isEditable && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <StampSignatureActions
                        label="Seal"
                        savedUrl={props.savedStampUrl ?? null}
                        onUseSaved={props.onAttachSavedStamp}
                        onUpload={props.onUploadStamp}
                      />
                      <StampSignatureActions
                        label="Signature"
                        savedUrl={props.savedSignatureUrl ?? null}
                        onUseSaved={props.onAttachSavedSignature}
                        onUpload={props.onUploadSignature}
                      />
                    </div>
                  )}
                </SignBlock>
                <SignBlock role="For and on behalf of the BUYER" party={buyerName} />
              </div>

              {frozen ? (
                <div
                  style={{
                    marginTop: 12,
                    fontFamily: T.mono,
                    fontSize: 8,
                    color: T.inkGhost,
                    textAlign: "center",
                  }}
                >
                  Executed {dmy(frozen.frozenAt)} · terms edition {frozen.termsVersion} · this text is fixed and no
                  longer follows later changes.
                </div>
              ) : null}
            </>
          )}

          <SheetFooter contractNo={props.contractNo} n={i + 1} of={sheets.length} />
        </div>
      ))}
    </>
  );
}

/** The buyer as the invoice states them RIGHT NOW. Returns null when the
    invoice is gone or carries no buyer, so the caller can fall back. */
function liveBuyer(inv: InvoiceLite | null): Record<string, string | undefined> | null {
  const doc = (inv?.doc ?? null) as Record<string, unknown> | null;
  if (!doc) return null;
  const str = (k: string) => (typeof doc[k] === "string" ? (doc[k] as string).trim() || undefined : undefined);
  const buyer = {
    name: str("customerName"),
    company: str("companyName"),
    address: str("toAddress"),
    email: str("toEmail"),
    phone: str("toPhone") || str("toMobile"),
    website: str("toWebsite"),
    acid: str("toAcid"),
    clientNo: str("clientNo"),
  };
  return Object.values(buyer).some(Boolean) ? buyer : null;
}

function invoiceItems(inv: InvoiceLite | null): ScheduleItem[] {
  const raw = (inv?.doc as { items?: unknown } | undefined)?.items;
  return Array.isArray(raw) ? (raw as ScheduleItem[]) : [];
}

/* ── House components ─────────────────────────────────────────────────────── */

function MetaCell({
  label,
  value,
  isFirst,
  isLast,
  mono,
}: {
  label: string;
  value: string;
  isFirst?: boolean;
  isLast?: boolean;
  mono?: boolean;
}) {
  return (
    <div style={{ borderLeft: isFirst ? "none" : `1px solid ${T.border}` }}>
      <div
        style={{
          background: T.black,
          color: "#fff",
          padding: "5px 12px",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          borderTopLeftRadius: isFirst ? 12 : 0,
          borderTopRightRadius: isLast ? 12 : 0,
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: "7px 12px",
          minHeight: 26,
          fontSize: 11,
          fontFamily: mono ? T.mono : undefined,
          letterSpacing: mono ? "0.02em" : undefined,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PartyCard({ label, name, lines }: { label: string; name: string; lines: string[] }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
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
        {label}
      </div>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 4 }}>{name}</div>
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: 9.5, color: T.inkSoft, lineHeight: 1.5 }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: T.black,
        color: "#fff",
        borderRadius: 8,
        padding: "5px 14px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

const Th = ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
  <th
    style={{
      padding: "7px 8px",
      textAlign: "left",
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      ...style,
    }}
  >
    {children}
  </th>
);

const Td = ({
  children,
  style,
  colSpan,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  colSpan?: number;
}) => (
  <td
    colSpan={colSpan}
    style={{ borderTop: `1px solid ${T.border}`, padding: "7px 8px", verticalAlign: "top", ...style }}
  >
    {children}
  </td>
);

function FactRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        borderBottom: last ? "none" : `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          background: T.surface,
          padding: "7px 12px",
          fontSize: 9.5,
          fontWeight: 700,
          color: T.ink,
          letterSpacing: "0.04em",
        }}
      >
        {k}
      </div>
      <div style={{ padding: "7px 12px", fontSize: 10 }}>{v}</div>
    </div>
  );
}

function SignBlock({
  role,
  party,
  children,
}: {
  role: string;
  party: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div
        style={{
          background: T.black,
          color: "#fff",
          padding: "6px 12px",
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {role}
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, marginBottom: children ? 8 : 28 }}>{party}</div>
        {children}
        <div style={{ borderTop: `1px solid ${T.ink}`, paddingTop: 5, fontSize: 9.5, color: T.inkSoft }}>
          Name / Title
        </div>
        <div style={{ marginTop: 14, borderTop: `1px solid ${T.ink}`, paddingTop: 5, fontSize: 9.5, color: T.inkSoft }}>
          Date &amp; company stamp
        </div>
      </div>
    </div>
  );
}

/* The editor beside this changes on every keystroke; the contract only needs
   to redraw when something it actually prints has changed. */
export default memo(ContractA4Inner);
