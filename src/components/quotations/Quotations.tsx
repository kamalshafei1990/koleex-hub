"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useReducer, useRef, useMemo } from "react";
import { statusTone } from "@/lib/doc-status";
import AuroraShell from "@/components/ui/AuroraShell";
import { useConfirm } from "@/components/kds/useConfirm";
import { useToast } from "@/components/kds/useToast";
import { docLabels } from "@/lib/doc-labels";
import Link from "next/link";
import dynamic from "next/dynamic";
import QuotationIcon from "@/components/icons/QuotationIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PrintIcon from "@/components/icons/ui/PrintIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import TableIcon from "@/components/icons/ui/TableIcon";
import { downloadDocXlsx, money } from "@/lib/excel-export";
import { cdnImage } from "@/lib/cdn";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import { useTranslation } from "@/lib/i18n";
import { docsT } from "@/lib/translations/docs";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import KpiCard from "@/components/ui/KpiCard";
import { EmptyState, Modal as KdsModal, Pagination, SearchInput, StatusPill } from "@/components/kds";
import ChevronDownIcon from "@/components/icons/ui/ChevronDownIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import Undo2Icon from "@/components/icons/ui/Undo2Icon";
import Redo2Icon from "@/components/icons/ui/Redo2Icon";
import { isPreloadAllowed, readNetworkContext } from "@/lib/app-prefetch";
import { dialog } from "@/lib/ui-dialog";
import QuotationPreviewSkeleton from "./QuotationPreviewSkeleton";
import { type PickResult } from "./ProductPickerModal";
import { type CustomerPickResult } from "./CustomerPickerModal";
import { record, event } from "@/lib/perf/client";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  QUOTATIONS_SYNC,
  fetchDocList,
  fetchDocOne,
  upsertDoc,
  deleteDoc,
  convertQuotationToInvoice,
  DocConflictError,
  type RemoteDocRow,
} from "@/lib/docs-sync";
import { useQuotationCollab } from "@/lib/quotation-collab";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DocTitlePicker from "@/components/quotations/DocTitlePicker";

/* ON DEMAND, not on arrival. These two open when someone clicks "add product"
   or "pick customer" — most visits to the list never do either, and a static
   import made every one of them download 679 lines to show a list of
   documents. Same move as the Settings tabs: creating the element does not
   invoke the component, and next/dynamic fetches on MOUNT. */
const ProductPickerModal = dynamic(() => import("./ProductPickerModal"), { ssr: false });
const CustomerPickerModal = dynamic(() => import("./CustomerPickerModal"), { ssr: false });

/* QuotationA4Preview is ~9k LOC (+ large embedded port-geo data tables)
   and only renders inside the editor view, so load it lazily on the
   client to keep the Quotations list/initial bundle small. Props and
   behavior are unchanged once the chunk loads. The print/PDF route
   (src/app/quotations/[id]/print) imports it eagerly and is untouched,
   so export output is unaffected. */
const QuotationA4Preview = dynamic(() => import("./QuotationA4Preview"), {
  ssr: false,
  loading: () => <QuotationPreviewSkeleton />,
});

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface QuotationItem {
  description: string;
  model: string;
  image: string;
  unitPrice: number;
  qty: number;
  notes: string;
  /* "header" → a full-width section band (title held in `description`);
     no price/qty, never affects totals. */
  kind?: "header";
  /* Section-band background colour (hex); defaults to black when unset. */
  headerColor?: string;
  /* INTERNAL cost tracking (never printed — lives in the editor's left
     gutter, mirroring the Internal-note panel on the right).
     `costHead` is the supplier cost of the machine head alone.
     `costMode`:
       "head"     → quoting head only; cost = costHead
       "complete" → head + stand & table; cost = costHead + the doc-level
                    standTablePrice (S&T cost is the same for every
                    machine, so it's set once per quotation)
       "full"     → full machine / device — no stand & table applies */
  costHead?: number;
  costMode?: "head" | "complete" | "full";
  /* INTERNAL selling-price automation (editor gutter only — never printed).
     `sellMethod` "margin" → unitPrice = (costRMB×(1+sellValue/100))÷fxRate;
     "fixed" → unitPrice = (costRMB÷fxRate)+sellValue. Stored so the chosen
     method/value reload with the quote; they do NOT recalc historical
     unitPrice — only the "Apply Price" button writes unitPrice. */
  sellMethod?: "margin" | "fixed";
  sellValue?: number;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

/** Every transition the UI's status menu allows. "expired" is mostly
 *  derived (validTill < today) but we also let the operator force-set
 *  it manually for quotes that never had a hard expiry on them. */
export const QUOTE_STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: "draft",    label: "Draft" },
  { value: "sent",     label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired",  label: "Expired" },
];

export interface Quotation {
  id: string;
  customerName: string;
  companyName: string;
  invoiceNo: string;
  date: string;
  clientNo: string;
  validTill: string;
  /* Legacy free-form field — superseded by toAddress / toAcid /
     toEmail but kept on the type for older saved docs. */
  quotTo: string;
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
  /* Document currency code (ISO 4217-ish). Drives the unit-price
     column subtitle, the currency symbol on every money cell, and the
     amount-in-words line. Optional for back-compat — older docs
     without it render as USD, which is also the default for new
     quotes. */
  currency?: string;
  /** Document language — fixed template labels render in this (en default). */
  docLang?: "en" | "zh";
  /* INTERNAL: shared Stand & Table cost used by every line whose
     costMode is "complete". One machine stand/table costs the same
     regardless of the head on it, so the operator sets this once per
     quotation. Editor-gutter only — never printed. */
  standTablePrice?: number;
  /* INTERNAL: quotation-level RMB→quote-currency exchange rate for the cost
     panel's price math. Per-quotation; missing = 7.20 default. Editor only. */
  fxRate?: number;
  terms: string;
  /* Optional stamp + signature URLs stamped on this quote. Both
     stored as public Supabase Storage URLs. The doc-builder lets a
     super-admin attach the tenant's saved stamp/signature with one
     click (see /api/quotations/saved-assets). Older quotes have
     these undefined; the editor falls back to the dashed-placeholder
     in that case. */
  stampUrl?: string;
  signatureUrl?: string;
  /* Contact-table id of the linked CRM customer. The editor's
     "Link Customer" picker stores this when the user picks from
     the CRM; the QUOTATION TO fields below are auto-filled at the
     same time. Optional — historic quotes have this undefined. */
  customerContactId?: string;
  /* Master-data references for the Terms quick-fill row. The
     editor's quick-fill picks store the FK id here so a saved
     quote can be re-opened with the dropdowns pre-selected; the
     formatted text is also baked into `terms` for the printed doc.
     All optional — legacy quotes have these undefined. */
  paymentTermId?: string;
  /* Heading this document prints under — see DocTitlePicker. Stored on the
     doc so the same record can go out as a Proforma Invoice now and a
     Commercial Invoice later. */
  docTitleId?: string;
  docTitleText?: string;
  docTitleNoun?: string;
  /* The chosen title's stable code (e.g. "proforma_invoice"). Read for
     behaviour; docTitleText is only ever for printing. */
  docTitleCode?: string;
  docTitleValidity?: boolean;
  incotermId?: string;
  /* Picked Incoterm's short code (FOB, CIF, DDP, ...). Stored
     alongside incotermId so the items-table header can show the
     'UNIT PRICE (FOB Ningbo, USD)' subtitle without fetching the
     full Incoterm row. */
  incotermCode?: string;
  /* DEPRECATED — kept for back-compat with quotes saved before the
     port-pair split. Newer docs use loadingPort + dischargePort. */
  incotermLocation?: string;
  /* Shipment route — loading port (origin) and discharge port
     (destination). Free-text so the operator can include the
     country ('Ningbo, China' / 'Alexandria, Egypt'). Both can be
     blank; whichever is set drives the Loading port: / Discharge
     port: lines in the terms. */
  loadingPort?: string;
  dischargePort?: string;
  shippingMethodId?: string;
  /* Shipping marks pick — three standard options in international
     trade. 'As per buyer's instruction' is the most common (buyer
     supplies exact marks before shipment). */
  shippingMarks?: string;
  /* Cargo + legal fields surfaced as structured rows in the Terms
     card. Quick Fill writes here, doc renders the value next to the
     matching bold label. Optional — historic quotes have these
     undefined. */
  containerType?: string;
  bankCharges?: string;
  cancellationPolicy?: string;
  governingLaw?: string;
  documentsProvided?: string[];        // array of short_name labels
  /* Global discount as a percentage (0-100). Applied to
     (subtotal + tax + shipping + others) on the totals card —
     reduces the Grand Total live. Stored as a number, not a
     fraction; 5 means 5%. */
  discountPct?: number;
  /* Tax as a PERCENTAGE (0-100) of the subtotal. 10 means 10%, which
     adds subtotal*10% to the bill. Replaces the old flat `tax` value;
     `tax` is kept on the type only for back-compat with old payloads. */
  taxPct?: number;
  /* Timing block — Lead Time + auto-computed ETD/ETA. The picker
     writes 'Lead time: 30 days after receipt of deposit' + an ETD/
     ETA chip into the terms. The basis is one of 'after_deposit',
     'after_order', 'after_lc_opening'; the picker dropdown maps it
     to readable text. */
  leadTimeDays?: number;
  leadTimeBasis?: "after_deposit" | "after_order" | "after_lc_opening";
  /* Lifecycle:
       draft     — being edited internally; not yet customer-facing.
       sent      — emailed / handed over to the customer.
       accepted  — customer signed off on it (the deal is on).
       rejected  — customer declined.
       expired   — validity date passed without a decision.

     "final" is a legacy alias for "sent" — older rows in the DB use
     it; fromRow() maps them forward. New transitions always use the
     new vocabulary. */
  status: QuoteStatus;
  /* Audit trail of state changes. Optional — historic quotes have
     this missing. Each entry is { status, at, by? } where `at` is
     an ISO timestamp and `by` is the account id that performed the
     change. Used by the editor's status menu to show "Sent on …",
     "Accepted on …" and (later) by a forthcoming activity feed. */
  statusHistory?: { status: QuoteStatus; at: string; by?: string }[];
  createdAt: string;
  updatedAt: string;
  /* Server-side grand total from the quotations.total column. The
     list endpoint strips items from the doc payload to keep responses
     small, so a local recomputation from items always returns 0 for
     rows fetched in the list view. Use this for the per-row badge
     and the TOTAL VALUE KPI tile. Undefined for unsaved drafts. */
  serverTotal?: number;
  /* Quotation-level DEFAULT pricing (global). Applied by "Apply To All" to
     rows WITHOUT a product-level override (item.sellMethod). Persists in doc;
     missing = margin / 0 (old quotes unaffected). */
  defaultPricingMethod?: "margin" | "fixed";
  defaultPricingValue?: number;
  /* Optimistic-lock revision the editor loaded this row at. Sent back as
     base_version on save; the server rejects (409) if the DB moved past it.
     Undefined for never-saved local drafts (treated as no-guard). */
  version?: number;
  /* Last saver (denormalized) — used for the conflict / "updated by" UX. */
  updatedByName?: string;
}

/* ══════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════ */

/* Editor surface geometry (screen only — see the fit-to-width note in the
   component). Module constants: they never change and were being re-declared
   on every render. */
const QUOT_PAPER_W = 794;    // 210mm at 96dpi
const QUOT_GUTTERS_W = 720;  // .quot-a4-stack padding-inline: 360px × 2

/* Status → KDS StatusPill tone, the same reading as doc-status's colour
   ladder (amber draft, blue sent, green accepted, red rejected, quiet
   expired) expressed in the pill's own vocabulary. */
const PILL_TONE: Record<QuoteStatus, "neutral" | "brand" | "success" | "warning" | "error"> = {
  draft: "warning", sent: "brand", accepted: "success", rejected: "error", expired: "neutral",
};

/* How many list rows one page shows. The list used to render every
   quotation as a card at once; past a few hundred that is seconds of
   layout on a phone for rows nobody scrolls to. */
const LIST_PAGE_SIZE = 40;

/* Symbol for the currencies the document is issued in. Anything unmapped
   prints as its ISO code, which is still unambiguous — the old list bolted
   a "$" onto every total regardless of the quote's currency. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", CNY: "¥", JPY: "¥", AED: "AED ", SAR: "SAR ",
  EGP: "E£", TRY: "₺", INR: "₹", AUD: "A$", CAD: "C$",
};
function fmtMoney(n: number, currency: string | undefined): string {
  const code = (currency || "USD").toUpperCase();
  const sym = CURRENCY_SYMBOLS[code];
  return sym ? `${sym}${fmt(n)}` : `${code} ${fmt(n)}`;
}

/* D/M/Y with the time — the one place this file shows a timestamp (the
   conflict dialog). The house rule is D/M/Y everywhere; toLocaleString()
   gave every operator their browser's own order. */
function fmtDateTimeDMY(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* The dirty check compares the working copy with the last saved snapshot.
   A full JSON.stringify of the quotation ran on EVERY keystroke, and the
   items carry base64 photos — megabytes of string serialised per character
   typed. Long strings are replaced by a cheap stand-in (length plus their
   two ends), which still changes whenever a photo is swapped, cleared or
   uploaded, and costs nothing. */
function fingerprint(q: Quotation): string {
  return JSON.stringify(q, (_k, v) =>
    typeof v === "string" && v.length > 256 ? `~${v.length}:${v.slice(0, 24)}:${v.slice(-24)}` : v,
  );
}

/* Thrown instead of returning null when a save is REFUSED locally (the
   hydration guard below) — the caller can tell "the server said no" from
   "we never asked", and say so. */
class SaveRefusedError extends Error {
  constructor() { super("save refused: document not hydrated yet"); this.name = "SaveRefusedError"; }
}

/* ── Undo / redo ──
   Snapshots of the whole document, taken from the state BEFORE each edit.
   Snapshots share structure with each other (an edit replaces one row, the
   other rows are the same objects), so a hundred of them cost little. A
   burst of edits to the same field within COALESCE_MS is one step, so one
   Undo takes back a typed word or a dragged number, not one character. */
const HISTORY_MAX = 100;
const COALESCE_MS = 1200;
/* Which top-level field changed between two snapshots — "items:3" when
   exactly row 3 changed, so consecutive edits to different rows stay
   separate steps. */
function changeKey(prev: Quotation, next: Quotation): string {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const k of keys) {
    const a = (prev as unknown as Record<string, unknown>)[k];
    const b = (next as unknown as Record<string, unknown>)[k];
    if (a !== b) changed.push(k);
  }
  if (changed.length === 1 && changed[0] === "items" && prev.items.length === next.items.length) {
    let idx = -1;
    let count = 0;
    for (let i = 0; i < next.items.length; i++) {
      if (prev.items[i] !== next.items[i]) { idx = i; count++; }
    }
    if (count === 1) return `items:${idx}`;
  }
  return changed.join(",");
}
/* The server owns these; an undo must never resurrect an older version
   number or quote number, or the next save would report a conflict that
   never happened. */
function withServerFields(snapshot: Quotation, live: Quotation): Quotation {
  return {
    ...snapshot,
    id: live.id,
    invoiceNo: live.invoiceNo || snapshot.invoiceNo,
    version: live.version,
    createdAt: live.createdAt,
    updatedAt: live.updatedAt,
    updatedByName: live.updatedByName,
    serverTotal: live.serverTotal,
  };
}
type DocUpdater = Quotation | null | ((prev: Quotation | null) => Quotation | null);
type HistCommand =
  | { __hist: "raw"; next: DocUpdater }
  | { __hist: "reset" }
  | { __hist: "undo" }
  | { __hist: "redo" };
type HistAction = DocUpdater | HistCommand;
interface HistState { current: Quotation | null; past: Quotation[]; future: Quotation[]; lastKey: string | null; lastAt: number }
const EMPTY_HIST: HistState = { current: null, past: [], future: [], lastKey: null, lastAt: 0 };
/** Replace the document without recording a step (server truth, not an edit). */
const histRaw = (next: DocUpdater): HistCommand => ({ __hist: "raw", next });
/** Forget the stacks — a different document is on screen now. */
const HIST_RESET: HistCommand = { __hist: "reset" };
const HIST_UNDO: HistCommand = { __hist: "undo" };
const HIST_REDO: HistCommand = { __hist: "redo" };
const isHistCommand = (a: HistAction): a is HistCommand => !!a && typeof a === "object" && "__hist" in a;
const resolveDoc = (u: DocUpdater, prev: Quotation | null): Quotation | null => (typeof u === "function" ? u(prev) : u);
function histReducer(s: HistState, a: HistAction): HistState {
  if (isHistCommand(a)) {
    switch (a.__hist) {
      case "raw":
        return { ...s, current: resolveDoc(a.next, s.current) };
      case "reset":
        return { ...EMPTY_HIST, current: s.current };
      case "undo": {
        const prev = s.past[s.past.length - 1];
        if (!prev || !s.current) return s;
        return { current: withServerFields(prev, s.current), past: s.past.slice(0, -1), future: [...s.future, s.current], lastKey: null, lastAt: 0 };
      }
      case "redo": {
        const next = s.future[s.future.length - 1];
        if (!next || !s.current) return s;
        return { current: withServerFields(next, s.current), past: [...s.past, s.current], future: s.future.slice(0, -1), lastKey: null, lastAt: 0 };
      }
    }
  }
  const value = resolveDoc(a, s.current);
  if (!(s.current && value && value !== s.current && value.id === s.current.id)) {
    return { ...s, current: value };
  }
  const key = changeKey(s.current, value);
  const now = Date.now();
  const coalesce = s.lastKey === key && now - s.lastAt < COALESCE_MS && s.past.length > 0;
  return {
    current: value,
    past: coalesce ? s.past : [...s.past, s.current].slice(-HISTORY_MAX),
    future: coalesce ? s.future : [],
    lastKey: key,
    lastAt: now,
  };
}

/* ── Opening a quotation before it is asked for ──
   The list carries no items, so every open fetched the full document and
   showed a one-row placeholder until it arrived. The row the cursor is on is
   almost certainly the one about to be opened: fetch it on hover / focus and
   hand it to the editor the instant the click lands. Sixty seconds is long
   enough for the hover-then-click gap and short enough that a colleague's
   save in between is caught by the silent refetch the editor still runs. */
const DOC_WARM_TTL_MS = 60_000;
const docWarm = new Map<string, { row: RemoteDocRow; at: number }>();
const docWarmInflight = new Set<string>();
function warmDoc(id: string): void {
  if (id.length !== 36 || docWarmInflight.has(id)) return;
  const have = docWarm.get(id);
  if (have && Date.now() - have.at < DOC_WARM_TTL_MS) return;
  docWarmInflight.add(id);
  fetchDocOne(QUOTATIONS_SYNC, id)
    .then((row) => { if (row) docWarm.set(id, { row, at: Date.now() }); })
    .catch(() => { /* the open will fetch normally */ })
    .finally(() => docWarmInflight.delete(id));
}
function readWarmDoc(id: string): RemoteDocRow | null {
  const have = docWarm.get(id);
  return have && Date.now() - have.at < DOC_WARM_TTL_MS ? have.row : null;
}

/* Line photos live in the media bucket; the document keeps the URL. The
   compressed data URL is still shown at once (and kept as the fallback if
   the upload fails, e.g. offline) so the operator never waits on a round
   trip to see the picture. */
async function uploadItemImage(dataUrl: string): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append("file", blob, "item.jpg");
    const res = await fetch("/api/quotations/item-images", { method: "POST", credentials: "include", body: form });
    if (!res.ok) return null;
    const j = (await res.json()) as { url?: string };
    return typeof j.url === "string" ? j.url : null;
  } catch {
    return null;
  }
}

/* Default terms shell for a fresh quotation. Each labelled row is
   its own <div> with a dashed bottom border so the rows visually
   separate from one another and read as a tidy checklist. Quick
   Fill picks land on the matching row; manual edits work inline.
   Order is by negotiation priority — payment first, then price
   formula, then route, then logistics, then cargo specs, then
   admin / legal. The trailing <div> is the free-text 'additional
   notes' area. */
const TERMS_ROW_STYLE =
  `border-bottom: 1px dashed rgba(0,0,0,0.12); padding: 3px 0; min-height: 22px;`;
const TERMS_NOTES_STYLE = `padding: 6px 0; min-height: 28px;`;
const DEFAULT_TERMS =
  `<div style="${TERMS_ROW_STYLE}"><strong>Payment terms:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Price Type:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Loading port:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Discharge port:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Sent by:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Container type:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Lead time:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Delivery time:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Shipping marks:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Packing:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Country of Origin:</strong> Made in China</div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Net Weight:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Gross Weight:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>CBM:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Number of Packages:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Documents Provided:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>All prices include tax:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Bank Charges:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Cancellation Policy:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Governing Law:</strong> </div>` +
  `<div style="${TERMS_ROW_STYLE}"><strong>Total Qty:</strong> </div>` +
  `<div style="${TERMS_NOTES_STYLE}"><br></div>`;

const EMPTY_ITEM: QuotationItem = {
  description: "",
  model: "",
  image: "",
  unitPrice: 0,
  qty: 1,
  notes: "",
};

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayDDMMYYYY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;
  const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  d.setDate(d.getDate() + days);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Map a server row back into the Quotation shape the UI uses. The
 * server treats `doc` as an opaque JSON blob — that's our UI snapshot.
 */
export function fromRow(row: RemoteDocRow): Quotation {
  const doc = row.doc as Partial<Quotation>;
  return {
    id: row.id,
    customerName: doc.customerName ?? "",
    companyName: doc.companyName ?? "",
    invoiceNo: (row.quote_no as string | null) ?? doc.invoiceNo ?? "",
    date: doc.date ?? todayDDMMYYYY(),
    clientNo: doc.clientNo ?? "",
    validTill: doc.validTill ?? addDays(todayDDMMYYYY(), 30),
    quotTo: doc.quotTo ?? "",
    toAddress: doc.toAddress ?? "",
    toAcid: doc.toAcid ?? "",
    toPhone: doc.toPhone ?? "",
    toMobile: doc.toMobile ?? "",
    toEmail: doc.toEmail ?? "",
    toWebsite: doc.toWebsite ?? "",
    items: Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : [{ ...EMPTY_ITEM }],
    tax: Number(doc.tax ?? 0),
    shipping: Number(doc.shipping ?? 0),
    others: Number(doc.others ?? 0),
    /* Doc payload wins; fall back to the row column (older docs were
       always saved with row.currency = USD), then USD. */
    currency: doc.currency ?? ((row as { currency?: string | null }).currency || "USD"),
    /* Hydration here is FIELD-BY-FIELD (not a spread) — a field missing from
       this list silently vanishes on reload even though it saved fine. */
    docLang: doc.docLang === "zh" ? "zh" : undefined,
    standTablePrice: Number(doc.standTablePrice ?? 0),
    fxRate: typeof doc.fxRate === "number" ? doc.fxRate : undefined,
    defaultPricingMethod: doc.defaultPricingMethod === "fixed" ? "fixed" : doc.defaultPricingMethod === "margin" ? "margin" : undefined,
    defaultPricingValue: typeof doc.defaultPricingValue === "number" ? doc.defaultPricingValue : undefined,
    terms: doc.terms ?? DEFAULT_TERMS,
    stampUrl: doc.stampUrl,
    signatureUrl: doc.signatureUrl,
    customerContactId: doc.customerContactId,
    paymentTermId: doc.paymentTermId,
    docTitleId: doc.docTitleId,
    docTitleText: doc.docTitleText,
    docTitleNoun: doc.docTitleNoun,
    docTitleCode: doc.docTitleCode,
    docTitleValidity: doc.docTitleValidity,
    incotermId: doc.incotermId,
    incotermCode: doc.incotermCode,
    incotermLocation: doc.incotermLocation,
    loadingPort: doc.loadingPort,
    dischargePort: doc.dischargePort,
    shippingMethodId: doc.shippingMethodId,
    shippingMarks: doc.shippingMarks,
    containerType: doc.containerType,
    bankCharges: doc.bankCharges,
    cancellationPolicy: doc.cancellationPolicy,
    governingLaw: doc.governingLaw,
    documentsProvided: Array.isArray(doc.documentsProvided) ? doc.documentsProvided : undefined,
    discountPct: typeof doc.discountPct === "number" ? doc.discountPct : undefined,
    taxPct: typeof doc.taxPct === "number" ? doc.taxPct : undefined,
    leadTimeDays: doc.leadTimeDays,
    leadTimeBasis: doc.leadTimeBasis,
    /* Status normalisation. "final" is the legacy name for "sent" —
       rows minted before the workflow expansion stored it that way.
       Anything else unknown falls back to "draft" so the row at
       least opens; the editor can then move it through the new
       lifecycle. */
    status: ((): QuoteStatus => {
      const s = row.status as string | null;
      if (s === "final") return "sent";
      if (
        s === "draft" || s === "sent" || s === "accepted" ||
        s === "rejected" || s === "expired"
      ) return s;
      return "draft";
    })(),
    statusHistory: Array.isArray(doc.statusHistory)
      ? (doc.statusHistory as Quotation["statusHistory"])
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    serverTotal: typeof row.total === "number" ? row.total : (row.total != null ? Number(row.total) : undefined),
    version: typeof row.version === "number" ? row.version : 1,
    updatedByName: typeof row.updated_by_name === "string" ? row.updated_by_name : undefined,
  };
}

/** Compute the grand total the same way the UI renders it. Mirrors the
 *  GRAND TOTAL row so the list can show totals without re-rendering.
 *  Order of operations:
 *    (subtotal + tax + shipping + others)  → pre-discount base
 *    base * (1 - discountPct/100)          → after-discount grand total
 *  This matches industry practice: the discount applies to the whole
 *  bill, not just the line items. */
function computeGrandTotal(q: Quotation): number {
  const subtotal = q.items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0), 0);
  const taxAmt = subtotal * (Math.max(0, Math.min(100, Number(q.taxPct) || 0)) / 100);
  const base = subtotal + taxAmt + (Number(q.shipping) || 0) + (Number(q.others) || 0);
  const pct = Math.max(0, Math.min(100, Number(q.discountPct) || 0));
  return +(base * (1 - pct / 100)).toFixed(2);
}

/** Parse a DD/MM/YYYY (or DD-MM-YYYY) string into ISO. Best-effort. */
function ddmmyyyyToISO(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/* Warm-start mirror (same pattern as Contacts kx_contacts_v1): the last
   fetched SLIM list (items already stripped server-side) paints instantly
   on the next open while the network refresh runs. `kx_` prefix → wiped on
   sign-out by session-caches.ts. Refreshed on EVERY list fetch (mount,
   post-delete, post-save) since they all come through here. */
const QUOT_SNAP_KEY = "kx_quot_snap_v1";
function readQuotSnap(): Quotation[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(QUOT_SNAP_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as Quotation[];
    return Array.isArray(list) ? list : null;
  } catch { return null; }
}

async function loadQuotationsRemote(opts: { fresh?: boolean } = {}): Promise<Quotation[]> {
  const rows = await fetchDocList(QUOTATIONS_SYNC, opts);
  const list = rows.map(fromRow);
  try {
    window.localStorage.setItem(QUOT_SNAP_KEY, JSON.stringify(list.slice(0, 200)));
  } catch { /* quota — mirror is best-effort */ }
  return list;
}

/** Upsert a single quotation. Returns the server echo (canonical
 *  id + updatedAt) so the UI can reconcile optimistic state. */
async function saveQuotationRemote(q: Quotation): Promise<Quotation | null> {
  /* ── WIPE PROTECTION ──
     The list endpoint strips `items` to keep the payload small, so a
     row sourced from the list view always starts in the editor with
     items=[EMPTY_ITEM]. The full doc hydrates async via /api/quotations/:id.
     If any save (Export PDF, manual Save, status change) fires BEFORE
     hydration lands, the editor would persist the stripped state — a
     50-item quote silently flattens to one empty row.
     This happened twice to KL2026-1520 ($303k, 50 items). Both times
     a click on Export PDF / Save raced the hydration fetch.
     Hard guard: if the doc has a server UUID AND the outgoing items
     look like the default-blank placeholder, refuse the save. The refusal
     is a typed error so the caller can tell the operator to wait + retry
     instead of reporting a server failure that never happened. */
  const looksLikeEmptyPlaceholder =
    Array.isArray(q.items) &&
    q.items.length === 1 &&
    !q.items[0]?.description?.trim() &&
    !q.items[0]?.model?.trim() &&
    !q.items[0]?.image?.trim() &&
    (Number(q.items[0]?.unitPrice) || 0) === 0;
  if (q.id.length === 36 && looksLikeEmptyPlaceholder) {
    if (typeof window !== "undefined") {
      console.warn(
        "[saveQuotationRemote] refused — outgoing items match the empty placeholder shape on a server doc. This means hydration hasn't completed yet. Wait a second and try again.",
        { id: q.id, quote_no: q.invoiceNo },
      );
    }
    throw new SaveRefusedError();
  }
  const row = await upsertDoc(QUOTATIONS_SYNC, {
    id: q.id.length === 36 ? q.id : undefined, // if it's our old local hex id, let server mint a new UUID
    quote_no: q.invoiceNo || undefined,
    status: q.status,
    currency: q.currency || "USD",
    issue_date: ddmmyyyyToISO(q.date),
    valid_till: ddmmyyyyToISO(q.validTill),
    total: computeGrandTotal(q),
    doc: q, // stash the whole UI snapshot
    /* Optimistic lock: guard against the version we loaded. Omitted for a
       brand-new local row (no server UUID) so the insert path is unaffected.
       upsertDoc throws DocConflictError on a 409 — callers handle it. */
    base_version: q.id.length === 36 ? q.version : undefined,
  });
  return row ? fromRow(row) : null;
}

/** Save as a brand-new copy (used to escape a conflict without losing the
 *  user's edits). Strips the server id + version so the server mints a fresh
 *  row, and tags the quote number so it's recognizable as a copy. */
async function saveQuotationAsCopy(q: Quotation): Promise<Quotation | null> {
  const copy: Quotation = {
    ...q,
    id: "local-" + Math.random().toString(36).slice(2),
    version: undefined,
    invoiceNo: q.invoiceNo ? `${q.invoiceNo}-COPY` : "",
  };
  const row = await upsertDoc(QUOTATIONS_SYNC, {
    id: undefined, // force insert → new UUID + fresh quote_no if blank
    quote_no: copy.invoiceNo || undefined,
    status: copy.status,
    currency: copy.currency || "USD",
    issue_date: ddmmyyyyToISO(copy.date),
    valid_till: ddmmyyyyToISO(copy.validTill),
    total: computeGrandTotal(copy),
    doc: copy,
  });
  return row ? fromRow(row) : null;
}

async function deleteQuotationRemote(id: string): Promise<boolean> {
  // Skip server call if the id isn't a real UUID (local-only legacy row).
  if (id.length !== 36) return true;
  return deleteDoc(QUOTATIONS_SYNC, id);
}

/* Smart money formatter. Drops the trailing '.00' when the value is
   a round number ('285' instead of '285.00') but preserves the
   decimals when there are real cents ('301,460.20'). Thousands
   separators are kept. The '$' suffix is appended at the call site
   so non-monetary callers (qty, days) can still use this for the
   number-only formatting. */
function fmt(n: number): string {
  const fixed = n.toFixed(2);
  const hasCents = !fixed.endsWith(".00");
  return n.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img");
      img.onload = () => {
        const MAX_W = 300;
        let w = img.width;
        let h = img.height;
        if (w > MAX_W) {
          h = (h * MAX_W) / w;
          w = MAX_W;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No canvas context"));
          return;
        }
        // Paint the canvas WHITE before drawing. The output format
        // is JPEG (which has no alpha channel) — without this fill
        // any transparent pixels in the source PNG get flattened to
        // BLACK on the canvas → JPEG conversion. Product photos are
        // commonly PNGs with transparent backgrounds, so the bug
        // shows up as a black halo / fill behind every uploaded
        // photo on the Quotation document.
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Spell the currency out in full for the amount-in-words line
   ("Chinese Yuan" reads better than "CNY"). Falls back to the raw
   code for anything unmapped. */
const CURRENCY_WORD: Record<string, string> = {
  USD: "US Dollars", EUR: "Euros", GBP: "Pounds Sterling", CNY: "Chinese Yuan",
  JPY: "Japanese Yen", AED: "UAE Dirhams", SAR: "Saudi Riyals",
  EGP: "Egyptian Pounds", TRY: "Turkish Lira",
};
export function numberToWords(num: number, currency: string = "USD"): string {
  const unit = CURRENCY_WORD[currency.toUpperCase()] || currency;
  if (!num || num === 0) return `ZERO ${unit} ONLY`.toUpperCase();
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const scales = ["", "Thousand", "Million", "Billion"];
  const n = Math.floor(Math.abs(num));
  if (n === 0) return `ZERO ${unit} ONLY`.toUpperCase();
  function chunk(c: number): string {
    if (c === 0) return "";
    if (c < 20) return ones[c];
    if (c < 100)
      return tens[Math.floor(c / 10)] + (c % 10 ? " " + ones[c % 10] : "");
    return (
      ones[Math.floor(c / 100)] +
      " Hundred" +
      (c % 100 ? " " + chunk(c % 100) : "")
    );
  }
  let str = "",
    s = 0,
    rem = n;
  while (rem > 0) {
    const c = rem % 1000;
    if (c > 0) {
      str =
        chunk(c) +
        (scales[s] ? " " + scales[s] : "") +
        (str ? " " + str : "");
    }
    rem = Math.floor(rem / 1000);
    s++;
  }
  const cents = Math.round((Math.abs(num) - n) * 100);
  let result = str.trim() + " " + unit;
  if (cents > 0) result += " AND " + chunk(cents) + " CENTS";
  result += " ONLY";
  return result.toUpperCase();
}

/* ══════════════════════════════════════════════════════════
   PRINT + A4 STYLES
   ══════════════════════════════════════════════════════════ */

export const PRINT_AND_DOC_STYLES = `
/* ── A4 document base ── */
/* On-screen styling for the A4 page. Print sizing is handled
   exclusively by @media print below — DO NOT set height here, only
   min-height (so screen view fills A4 height but print pipeline can
   override cleanly via !important without competing with inline). */
/* Doc sized to fit BOTH A4 (297 mm) AND US Letter (279 mm) so the
   print pipeline never overflows onto a phantom blank sheet. 270 mm
   tall x 210 mm wide sits inside both paper sizes' printable area.
   The editor renders at the SAME 270 mm height so what you see is
   exactly what the PDF produces (WYSIWYG).
   overflow:visible (set below) so the row-action floating cluster
   (sits at right: -88 px past the page edge) stays clickable in
   the editor. In print the cluster has .no-print so it is hidden;
   overflow:hidden inside @media print takes care of any spill. */
.quot-a4-doc {
  box-sizing: border-box;
  width: 210mm;
  height: 270mm;
  min-height: 270mm;
  max-height: 270mm;
  padding: 24px 28px 18px;
  background: #fff;
  color: #000;
  margin: 0 auto 40px;
  box-shadow: 0 0 16px rgba(0,0,0,0.10);
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  font-size: 11px;
  line-height: 1.4;
}
.quot-doc-inner { padding: 0; }

/* On-screen, the editor surface reserves symmetric gutter space on BOTH
   sides of the A4 paper so the off-paper editor cards — Cost Price on the
   left, Document Settings + Internal notes on the right — always have room
   and sit the same distance from the page. fit-content + min-width:100%
   keeps the paper centred when the window is wide, and lets the whole
   stack scroll horizontally (instead of clipping a gutter) when it's
   narrow. The @media print block below resets this to 0. */
.quot-a4-stack {
  width: fit-content;
  min-width: 100%;
  margin-inline: auto;
  padding-inline: 360px;
  box-sizing: border-box;
}
/* Fit-to-width host (SCREEN ONLY). The A4 doc and its stack keep every
   dimension the owner set; this box only carries the visual scale and
   catches any residual overflow so the PAGE never drags sideways again —
   at worst the paper scrolls inside its own box, never the whole app.
   Neutralised entirely under @media print below, and invisible to the PDF
   export (separate iframe, separate document). */
.quot-fit-host { overflow-x: auto; overflow-y: hidden; }

/* Pinch-to-inspect host (rendered by QuotationA4Preview, so this rule serves
   the invoice editor too via its own copy). pan-x pan-y keeps one-finger
   scrolling native — the component only claims the gesture on a second
   finger. A transform contributes to scrollable overflow on the right/bottom,
   which is what lets a magnified sheet be panned inside this box instead of
   dragging the app. NOTE: this block is a template literal — no backticks. */
.quot-pinch-host { overflow-x: auto; touch-action: pan-x pan-y; }

/* Focus view — the header toggle hides every editor-only gutter card
   (Cost Price + Internal notes share .pq-row-note; Document Settings +
   Cost Price share .pq-gutter-card) so only the A4 document shows. */
.quot-a4-stack.gutters-hidden .pq-row-note,
.quot-a4-stack.gutters-hidden .pq-gutter-card { display: none !important; }

/* Force black text on white for all children */
/* Set a sensible default text colour on the A4 surface, but do NOT
   use a wildcard !important rule here — the multi-page editor relies
   on inline color styles for every black-strip header (meta strip,
   From / Quotation To, stamp / signature, bank bar, totals) and a
   wildcard !important would obliterate them. */
.quot-a4-doc { color: #000; }
.quot-a4-doc .pq-stamp-box { color: #aaa !important; }
.quot-a4-doc .pq-footer { color: #555 !important; }
.quot-a4-doc .pq-strip-gray { color: #333 !important; }
.quot-a4-doc input,
.quot-a4-doc textarea {
  color: #000 !important;
  -webkit-text-fill-color: #000 !important;
  opacity: 1 !important;
}
.quot-a4-doc input::placeholder,
.quot-a4-doc textarea::placeholder {
  color: #aaa !important;
  -webkit-text-fill-color: #aaa !important;
}
/* Internal-notes panel lives OUTSIDE the printed A4 paper in the
   dark editor area, so its textarea needs WHITE text instead of
   the black-on-white forced above. Same exemption for its
   placeholder so the hint reads as light gray on dark. */
.quot-a4-doc .quot-row-notes textarea {
  color: rgba(255, 255, 255, 0.92) !important;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.92) !important;
}
.quot-a4-doc .quot-row-notes textarea::placeholder {
  color: rgba(255, 255, 255, 0.40) !important;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.40) !important;
}
/* Gutter cards (Cost Price + Document Settings) also live OUTSIDE the
   printed A4 in the dark editor area, so their inputs/selects need WHITE
   text — the .quot-a4-doc input rule above otherwise forces them black
   and they become invisible on the dark card. */
.quot-a4-doc .pq-gutter-card input,
.quot-a4-doc .pq-gutter-card select,
.pq-cost-modal input,
.pq-cost-modal select {
  color: rgba(255, 255, 255, 0.92) !important;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.92) !important;
}
/* The pricing modal renders as a fixed overlay; its inputs need the same
   white-on-dark text as the gutter cards (the .quot-a4-doc input rule above
   otherwise forces them black and invisible on the dark modal). */
.pq-cost-modal input::placeholder {
  color: rgba(255, 255, 255, 0.40) !important;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.40) !important;
}
/* Cost Management card width — wider on desktop for a roomier Head Cost
   input + Configuration dropdown; a touch narrower on tablet. Height stays
   driven by content (≈ one quotation row). Overrides the component's inline
   width via !important. */
.pq-cost-card { width: 320px !important; }
@media (max-width: 1180px) { .pq-cost-card { width: 264px !important; } }
.quot-a4-doc .pq-gutter-card input::placeholder {
  color: rgba(255, 255, 255, 0.40) !important;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.40) !important;
}
.quot-a4-doc .pq-grand input {
  color: #fff !important;
  -webkit-text-fill-color: #fff !important;
}

/* Shared input */
.pq-in,
.quot-a4-doc input,
.quot-a4-doc input[type="text"],
.quot-a4-doc input[type="number"],
.quot-a4-doc input[type="date"] {
  border: none;
  padding: 0;
  font-size: 11px !important;
  font-family: inherit;
  color: #000;
  width: 100%;
  background: transparent;
  outline: none;
}
.pq-in::placeholder { color: #aaa; }
.pq-in:focus { background: #f4f6ff; }

/* Cell wrap (contentEditable) */
.pq-cell-wrap {
  min-height: 16px;
  width: 100%;
  font-size: 11px;
  font-family: inherit;
  color: #000;
  outline: none;
  line-height: 1.4;
  padding: 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
}
.pq-cell-wrap:empty::before {
  content: attr(data-placeholder);
  color: #aaa;
  pointer-events: none;
}
.pq-cell-wrap:focus { background: #f4f6ff; border-radius: 2px; }

/* Rich text item cell */
.quot-item-rich {
  min-height: 32px;
  width: 100%;
  font-size: 11px;
  font-family: inherit;
  color: #000;
  outline: none;
  line-height: 1.5;
  padding: 2px 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 100%;
}
.quot-item-rich:empty::before {
  content: attr(data-placeholder);
  color: #aaa;
  pointer-events: none;
}
.quot-item-rich:focus { background: #f4f6ff; border-radius: 2px; }

/* Image cell */
.quot-img-cell {
  width: 100%;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #ccc;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: #fafafa;
}
.quot-img-cell:hover { border-color: #888; }
.quot-img-cell img { width: 100%; height: 100%; object-fit: contain; }
.quot-img-cell .quot-img-plus { font-size: 18px; color: #bbb; }
.quot-img-cell input[type="file"] {
  position: absolute;
  top: -9999px;
  left: -9999px;
  width: 0;
  height: 0;
  overflow: hidden;
}
.quot-img-cell.has-img { border: none; background: transparent; }

/* The row-action cluster (.quot-row-del-btn) is now positioned and
   styled inline by QuotationA4Preview — no screen styles here. The
   print rule below still hides it on the printed page; the screen
   rule is intentionally omitted so it doesn't clobber the new inline
   width / height / transform. */

/* Hide number spinners */
.quot-a4-doc input[type="number"]::-webkit-outer-spin-button,
.quot-a4-doc input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.quot-a4-doc input[type="number"] { -moz-appearance: textfield; }

/* Textarea in quotation-to */
.pq-in-area {
  resize: vertical;
  min-height: 40px;
  font-size: 11px;
  line-height: 1.5;
}

/* Terms area */
.pq-tc-area {
  width: 100%;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.6;
  border: none;
  padding: 8px 10px;
  font-family: inherit;
  min-height: 80px;
  outline: none;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}
.pq-tc-area:focus { background: #f8f8ff; }

/* ── PRINT ──
   Strategy (rewritten — the previous visibility:hidden +
   position:absolute combo collapsed the multi-page document into
   2 print pages because absolutely-positioned content doesn't
   paginate across sheets):

   1. Hide chrome with DISPLAY:NONE so it occupies zero space:
        · <header>, <aside>  → MainHeader + Sidebar
        · .fixed              → FloatingPanel
        · .no-print           → editor toolbar
   2. Reset the Hub layout wrappers (pt-14, shell-content-offset,
      min-h-screen) so the .quot-a4-stack flows from the top of
      the page with no leftover header offset / scrollable shell.
   3. Each .quot-a4-doc is a normal in-flow A4 page with a hard
      page-break-after — Chrome / Safari / Firefox honour that
      because the parent is no longer position:absolute.
   4. @page { size: A4; margin: 0 } so the browser doesn't add
      print gutters that would shrink the usable width below the
      doc's 210 mm and force a scale-to-fit. */
@media print {
  /* @page size: auto so the page-box follows whatever paper the
     operator's printer is set to (A4 OR US Letter). Hard-coding
     A4 here would force a 297 mm page-box even when the printer
     is on Letter (279 mm), producing every-other-blank physical
     sheet because each logical A4 page overflows by 18 mm.
     Doc content is 270 mm tall (set below) — fits both papers. */
  @page { size: auto; margin: 0; }

  /* Reset page chrome */
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
    height: auto !important;
    width: auto !important;
  }

  /* Hide every known piece of Hub chrome that should NOT print. */
  header, aside, .no-print, .fixed { display: none !important; }
  .quot-row-del-btn { display: none !important; }
  .pq-add-btn { display: none !important; }

  /* NUKE the Tailwind h-screen / overflow-hidden wrappers from
     the Hub shell so the multi-page doc stack can render its
     full height without being clipped to one viewport. Scoped
     to those specific wrappers -- we previously used a *
     wildcard that also blanketed every descendant of the docs
     with overflow:visible and max-height:none, which made
     Safari compute the doc's intrinsic content height and
     reserve TWO A4 sheets per doc (one with content, one
     blank). The targeted Tailwind reset achieves the same
     unblock without touching the docs themselves. */
  [class*="h-screen"],
  [class*="h-[calc"],
  [class*="min-h-screen"],
  [class*="min-h-full"],
  [class*="h-full"],
  [class*="min-h-0"],
  [class*="overflow-hidden"] {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  /* The screen-only fit box: drop the scale, the reclaiming negative margin
     and the clipping, so print gets the document at its true 210mm. Inline
     styles carry the transform, so these need !important to win. */
  .quot-fit-host, .quot-fit-box,
  .quot-pinch-host, .quot-pinch-box {
    overflow: visible !important;
    width: auto !important;
    height: auto !important;
    margin: 0 !important;
    transform: none !important;
  }
  [class~="pt-14"] { padding-top: 0 !important; }
  .shell-content-offset { padding: 0 !important; }

  /* Stack flows naturally — NO position:absolute. */
  .quot-a4-stack {
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm !important;
    overflow: visible !important;
  }

  /* Doc sized to fit both A4 and US Letter printable areas
     (270 mm height). Editor on-screen uses the same 270 mm
     height (see .quot-a4-doc above) so the printed PDF is
     bit-for-bit identical to what the operator sees in the
     editor. Hard page-break-after on every doc except the
     last so the printer doesn't merge a doc's tail with the
     next doc's head. */
  .quot-a4-doc {
    box-sizing: border-box !important;
    display: block !important;
    position: static !important;
    width: 210mm !important;
    height: 270mm !important;
    min-height: 270mm !important;
    max-height: 270mm !important;
    margin: 0 !important;
    padding: 24px 28px 18px !important;
    box-shadow: none !important;
    border: none !important;
    background: #fff !important;
    overflow: hidden !important;
    page-break-after: always !important;
    break-after: page !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .quot-a4-doc:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }

  /* Image cells with no uploaded photo — render as completely
     blank on the PDF (drop the dashed placeholder border AND the
     "+" upload-affordance glyph). On screen the dashed box with
     the "+" stays visible so the operator knows they can click
     to upload; in the printed/PDF output it would just look like
     a confusing empty box with a plus sign. */
  .quot-img-cell:not(.has-img) {
    border: none !important;
    background: transparent !important;
  }
  .quot-img-cell:not(.has-img) > span {
    display: none !important;
  }

  /* Items table — never split a single row across sheets. Without
     these guards, a row whose ITEM description wraps to 6-7 lines
     (e.g. the "Flatbed Steam Iron Press" spec sheet) can be ~280
     px tall and force the browser to break inside it at the page
     boundary, producing an extra mostly-blank physical sheet
     containing only the tail of the row's last line. */
  .pq-tbl,
  .pq-tbl thead,
  .pq-tbl tbody,
  .pq-tbl tfoot,
  .pq-tbl tr,
  .pq-tbl thead tr,
  .pq-tbl tbody tr,
  .pq-tbl tfoot tr,
  .pq-tbl td,
  .pq-tbl th {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    -webkit-column-break-inside: avoid !important;
  }

  input, textarea, [contenteditable] {
    background: transparent !important;
    border: transparent !important;
  }

  .pq-ml { background: #000 !important; color: #fff !important; }
  .pq-tbl thead th { background: #000 !important; color: #fff !important; }
  .pq-bank-bar { background: #000 !important; color: #fff !important; }
  .pq-terms-label { background: #000 !important; color: #fff !important; }
  .pq-to-label { background: #000 !important; color: #fff !important; }
  .pq-grand td { background: #000 !important; color: #fff !important; }
  .pq-strip-black { background: #000 !important; color: #fff !important; }
  .pq-strip-black * { color: #fff !important; }
  .pq-strip-gray { background: #e0e0e0 !important; color: #333 !important; }
  .pq-tfoot-row td { background: #f5f5f5 !important; }
  .pq-bl { background: #f5f5f5 !important; }
  /* Force the items-table header strip + tfoot summary row to
     keep their dark backgrounds when printed (Chrome and Safari
     otherwise strip backgrounds on print). */
  .pq-tbl thead th,
  .pq-tbl tfoot td {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
/* Force all browsers to print exact colors so the black header
   strips don't drop to white. */
.quot-a4-doc, .quot-a4-doc * {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
`;

/* ══════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════ */

export default function Quotations() {
  const { t } = useTranslation(docsT);
  const { askConfirm, confirmDialog } = useConfirm();
  const { showToast, toastElement } = useToast();

  /* Warm-start: seed from the localStorage mirror so a returning user sees
     the list on the FIRST paint; the mount fetch below replaces it. */
  const [snap] = useState(readQuotSnap);
  const [quotations, setQuotations] = useState<Quotation[]>(snap ?? []);
  const [view, setView] = useState<"list" | "editor">("list");
  /* The document plus its undo / redo stacks live in one reducer, so every
     edit — `setCurrent(next)`, exactly as before — records the snapshot it
     replaces, and loads / saves / document switches say so explicitly with
     histRaw() and HIST_RESET (not the operator's edits, never undoable).
     A reducer rather than a ref: the dispatch is stable, the history is
     state React owns, and queued functional updates each see the latest
     document instead of the one committed before the event. */
  const [hist, setCurrent] = useReducer(histReducer, EMPTY_HIST);
  const current = hist.current;
  const histSize = { past: hist.past.length, future: hist.future.length };
  const [loaded, setLoaded] = useState(snap !== null);
  /* Save state for the Save Draft / Save Final buttons. "idle" is the
     resting state; "saving" while the POST is in flight; "saved" for a
     brief confirmation flash; "error" if the request failed. Without
     this, the buttons gave NO visual feedback — users couldn't tell
     whether a click was registered or whether the save succeeded. */
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string>("");
  /* ── Collaboration safety ──
     `conflict` holds the latest server version info when a save was rejected
     because another user saved first (optimistic-lock 409). Drives the
     "updated by another user" blocking dialog (Load Latest / Save as Copy).
     `hydrating` is true while the full doc (with items) is being fetched on
     open, so we can show a loading state instead of a half-empty document. */
  const [conflict, setConflict] = useState<null | { version: number | null; updated_by_name: string | null; updated_at: string | null }>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  /* announceSaved comes from the realtime hook (declared lower, after `dirty`),
     but handleSave (declared above it) needs to call it on a successful save.
     A ref breaks the ordering cycle without re-creating handleSave. */
  const announceSavedRef = useRef<(version: number) => void>(() => {});
  /* Unsaved-changes guard. `baselineRef` holds a JSON snapshot of the quote
     as it was last loaded / saved; the working copy is "dirty" once it
     diverges. Drives both the in-app exit confirm modal and the native
     beforeunload prompt (tab close / refresh). */
  const baselineRef = useRef<string>("");
  const markSaved = useCallback((q: Quotation | null) => {
    baselineRef.current = q ? fingerprint(q) : "";
  }, []);
  /* The committed `current`, readable from async code (the late hydration
     fetch) without reaching into a state updater — updaters must stay pure. */
  const currentRef = useRef<Quotation | null>(null);
  currentRef.current = current;

  /* Ctrl/Cmd+Z and Ctrl+Y / Ctrl+Shift+Z — outside text fields only. Inside
     a field the browser's own undo is what the operator expects, and each
     field commits one history step when it blurs anyway. */
  useEffect(() => {
    if (view !== "editor") return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      setCurrent(k === "y" || e.shiftKey ? HIST_REDO : HIST_UNDO);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view]);
  /* Why the list could not load, when it could not. Drives the retry state;
     a failed mount fetch used to leave "Loading…" on screen forever. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /* When set, the "unsaved changes" modal is open and this callback runs
     once the user chooses to leave (after an optional save). */
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  /* Focus view — hides the editor-only gutter cards (cost price,
     internal notes, document settings). Editor-only, never persisted. */
  const [hidePanels, setHidePanels] = useState(false);
  /* Set the moment the operator uses the Hide/Show panels button, so the
     narrow-screen auto-default below never overrides a deliberate choice. */
  const panelsTouched = useRef(false);

  /* ── FIT-TO-WIDTH (screen only — the A4 geometry is NEVER touched) ──
     .quot-a4-doc is 210mm (794px) and .quot-a4-stack adds 360px of gutter on
     each side for the editor cards, so the editor surface is intrinsically
     1514px wide. On anything narrower the OVERFLOW WAS THE PAGE'S: the whole
     app — toolbar included — dragged sideways (iPad portrait has 964px of app
     width, a phone 375). Hence "floating".

     The paper itself is left exactly as the owner set it: 210mm × 270mm, and
     the gutter cards keep their absolute per-row anchoring. We only scale the
     finished surface visually with a transform, which does NOT re-lay-out the
     document — so what is on screen still matches the PDF line for line. Do
     NOT swap this for `zoom`: zoom re-flows at the scaled size and would let
     text re-wrap, which is exactly the WYSIWYG guarantee this editor sells.

     PDF export is untouched either way: it renders /quotations/[id]/print in
     a separate hidden iframe with its own stylesheet, so nothing here can
     reach it. Browser print is neutralised in the @media print block. */
  const [fitHost, setFitHost] = useState<HTMLDivElement | null>(null);
  const fitHostRef = useCallback((n: HTMLDivElement | null) => setFitHost(n), []);
  const [fitInner, setFitInner] = useState<HTMLDivElement | null>(null);
  const fitInnerRef = useCallback((n: HTMLDivElement | null) => setFitInner(n), []);
  const [fitW, setFitW] = useState(0);
  const [stackH, setStackH] = useState(0);
  useLayoutEffect(() => {
    if (!fitHost) return;
    const read = () => setFitW(fitHost.getBoundingClientRect().width);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(fitHost);
    return () => ro.disconnect();
  }, [fitHost]);
  useLayoutEffect(() => {
    if (!fitInner) return;
    /* Unscaled height of the doc stack — the transform doesn't shrink the
       layout box, so we reclaim the leftover with a negative margin below. */
    const read = () => setStackH(fitInner.offsetHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(fitInner);
    return () => ro.disconnect();
  }, [fitInner]);
  const fitNeeded = (hidePanels ? QUOT_PAPER_W : QUOT_PAPER_W + QUOT_GUTTERS_W) + 24;
  const fitScale = fitW > 0 ? Math.min(1, fitW / fitNeeded) : 1;
  /* Narrow screens open in focus view: with the gutter cards shown, a phone
     would scale the surface to ~0.24 and nothing would be legible. This only
     picks the DEFAULT — the toolbar's Show panels button still works, and
     showing them just scales the whole surface down instead of overflowing. */
  useEffect(() => {
    if (panelsTouched.current || fitW === 0) return;
    setHidePanels(fitW < QUOT_PAPER_W + QUOT_GUTTERS_W + 24);
  }, [fitW]);

  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  /* "+ From catalog" picker. Owned by the parent so the modal can
     stay mounted across A4-page renders without each page mounting
     its own copy. */
  const [pickerOpen, setPickerOpen] = useState(false);
  /* When the catalog picker is opened from a row's "+ → Product from catalog",
     this holds the row index to insert AFTER. null = append at the end. */
  const [insertAtIdx, setInsertAtIdx] = useState<number | null>(null);
  /* "Link customer" picker — same pattern as the product picker:
     parent owns the modal, the preview triggers it via prop. */
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  /* Tenant-wide saved stamp + signature. Loaded once on editor
     mount; refreshed after the operator uploads a new one so the
     "Use saved" button appears immediately. Null until the fetch
     resolves so the editor doesn't flash a "missing saved asset"
     state during initial load. */
  const [savedStampUrl, setSavedStampUrl] = useState<string | null>(null);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null);
  /* Read the super-admin flag straight from the /api/me/bootstrap
     cache rather than useScopeContext. The latter has a fallback
     path that re-queries the `accounts` table via the browser anon
     client, which RLS strips to is_super_admin=false; the bootstrap
     payload comes from a server route that already knows the truth. */
  const { data: meBootstrap } = useMeBootstrap();
  const isSuperAdmin = meBootstrap?.auth?.is_super_admin ?? false;

  /* ── Load from Supabase on mount (and on Retry) ── */
  const loadGen = useRef(0);
  const loadList = useCallback(async () => {
    const gen = ++loadGen.current;
    setLoadError(null);
    try {
      const list = await loadQuotationsRemote();
      if (gen !== loadGen.current) return;
      setQuotations(list);
      setLoaded(true);
    } catch (e) {
      if (gen !== loadGen.current) return;
      setLoadError(humanizeError(e));
    }
  }, []);
  /* No cleanup needed: a load that lands after a newer one started is
     discarded by the generation check inside loadList. */
  useEffect(() => { void loadList(); }, [loadList]);

  /* ── Create new quotation. Kept as optimistic local-only until the
        user hits Save; the server mints the real UUID + quote_no at
        that point. This keeps "New" instant even on slow connections. */
  const handleNew = useCallback(() => {
    const today = todayDDMMYYYY();
    const q: Quotation = {
      id: generateId(),          // temp; replaced by UUID on first save
      customerName: "",
      companyName: "",
      invoiceNo: "",             // server assigns when first saved
      date: today,
      clientNo: "",
      validTill: addDays(today, 30),
      quotTo: "",
      toAddress: "",
      toAcid: "",
      toPhone: "",
      toMobile: "",
      toEmail: "",
      toWebsite: "",
      items: [{ ...EMPTY_ITEM }],
      tax: 0,
      shipping: 0,
      others: 0,
      currency: "USD",
      standTablePrice: 0,
      fxRate: 7.2,
      terms: DEFAULT_TERMS,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrent(histRaw(q));
    setCurrent(HIST_RESET);
    markSaved(q);            // a pristine new quote isn't "dirty" until edited
    setView("editor");
  }, [markSaved]);

  /* ── Deep link ──
     /quotations?doc=<id> opens that quotation straight into the editor, so
     an order's "KL2026-1520" is a link rather than an instruction to go and
     find it in a list.

     Fires ONCE via a ref, reading the id rather than watching it, so Back
     returns to the list instead of pulling the reader straight back in.
     markSaved sets the dirty baseline — without it the editor would think
     the freshly-loaded quotation had unsaved edits. */
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current) return;
    const id = new URLSearchParams(window.location.search).get("doc");
    if (!id || id.length !== 36) return;
    deepLinkedRef.current = true;
    void (async () => {
      try {
        const row = await fetchDocOne(QUOTATIONS_SYNC, id);
        if (!row) return;
        const loaded = fromRow(row);
        setCurrent(histRaw(loaded));
        setCurrent(HIST_RESET);
        markSaved(loaded);
        setView("editor");
      } catch (e) {
        showToast(t("toast.loadFail").replace("{err}", humanizeError(e)), "error");
      }
    })();
  }, [markSaved, showToast, t]);

  /* ── Open existing ──
     The list endpoint strips `items` from the doc payload to keep the
     response small, so the row coming from the list view has no items.
     Re-fetch the full quotation by id before mounting the editor —
     otherwise the items table renders as a single empty placeholder. */
  const handleOpen = useCallback(async (q: Quotation) => {
    /* Warmed on hover? Mount the FULL document at once — no placeholder
       row, no loading bar. The silent refetch below still runs so a
       colleague's save in the last minute is picked up. */
    const warm = readWarmDoc(q.id);
    const optimistic = warm
      ? (() => { const h = fromRow(warm); return { ...h, items: h.items.map((i) => ({ ...i })) }; })()
      : { ...q, items: q.items.map((i) => ({ ...i })) };
    setCurrent(histRaw(optimistic));
    setCurrent(HIST_RESET);
    markSaved(optimistic);   // baseline = loaded state (not dirty yet)
    setView("editor");
    // …then hydrate the full doc (with items) from the detail endpoint.
    if (q.id.length === 36) {
      const requestedId = q.id;
      if (!warm) setHydrating(true);
      let full: RemoteDocRow | null = null;
      try {
        full = await fetchDocOne(QUOTATIONS_SYNC, q.id);
        if (full) docWarm.set(q.id, { row: full, at: Date.now() });
      } catch (e) {
        /* The editor stays open on the header data; the operator sees why
           the items did not arrive instead of a one-row document with no
           explanation (the save guard refuses to persist that state). */
        if (!warm) showToast(t("toast.loadFail").replace("{err}", humanizeError(e)), "error");
      } finally {
        if (!warm) setHydrating(false);
      }
      /* Guard against a late response overwriting a NEWER open.
         If the operator clicked row A then quickly clicked row B,
         A's fetch can resolve after B's setCurrent — without this
         check the editor would silently revert to A's data. */
      if (full) {
        const hydrated = fromRow(full);
        const prev = currentRef.current;
        if (prev?.id && prev.id !== requestedId) return;
        const serverView = { ...hydrated, items: hydrated.items.map((i) => ({ ...i })) };
        /* Did the operator edit anything during the hydration window?
           The optimistic mount set baselineRef to the list-row snapshot,
           so any divergence means a live edit (e.g. switching the
           currency the instant the editor opened). Without this check the
           late detail-fetch clobbered that edit back to the saved value —
           the currency would visibly snap back to USD and never reach a
           save or the exported PDF. Preserve the operator's in-flight
           scalar edits and only fill in the field the list view strips
           (items). Baseline stays the server truth so the edit still
           registers as unsaved (dirty). Decided OUTSIDE the state updater:
           an updater that writes a ref is not pure, and React may run it
           more than once. */
        const userTouched =
          !!prev && !!baselineRef.current && fingerprint(prev) !== baselineRef.current;
        /* Nothing to do when the warm copy already was the server copy. */
        if (!userTouched && prev && fingerprint(prev) === fingerprint(serverView)) return;
        markSaved(serverView);
        /* Server truth arriving is not an edit: raw, and the steps taken
           since the open stay undoable only while they are still on top. */
        setCurrent(histRaw(userTouched && prev ? { ...serverView, ...prev, items: serverView.items } : serverView));
        if (!userTouched) setCurrent(HIST_RESET);
      }
    }
  }, [markSaved, showToast, t]);

  /* ── Delete from list ── */
  /* Track which row's Duplicate button is in flight so the icon can
     show a small spinner. The full-quote fetch + save round-trip on a
     long quote (Omar's 50+ items) can take a second on a slow link;
     without feedback the user double-clicks and ends up with two
     copies. */
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  /* ── Duplicate from the list view ──
     The list endpoint strips `items` from the doc to keep the
     response small, so we MUST re-fetch the full quote before
     cloning. Then we build a fresh draft (new client id, empty
     quote_no so the server mints a new KL{YYYY}-{MMDD}, today's
     date, 30-day validity), save it, refresh the list, and drop
     the user into the editor on the new copy so they can adjust
     customer fields straight away. */
  const handleDuplicateFromList = useCallback(
    async (id: string) => {
      if (duplicatingId) return;
      setDuplicatingId(id);
      try {
        const full = await fetchDocOne(QUOTATIONS_SYNC, id);
        if (!full) {
          showToast(t("toast.dupLoadFail"), "error");
          return;
        }
        const source = fromRow(full);
        const today = todayDDMMYYYY();
        const copy: Quotation = {
          ...source,
          id: generateId(),
          invoiceNo: "",
          date: today,
          validTill: addDays(today, 30),
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          serverTotal: undefined,
          items: source.items.map((it) => ({ ...it })),
        };
        const saved = await saveQuotationRemote(copy);
        const next = saved ?? copy;
        const list = await loadQuotationsRemote({ fresh: true });
        setQuotations(list);
        /* Open the new draft in the editor — the operator almost
           always wants to tweak the customer name / address right
           after duplicating, so the extra click would be friction. */
        setCurrent(histRaw(next));
        setCurrent(HIST_RESET);
        markSaved(next);     // the duplicate is persisted → not dirty yet
        setView("editor");
      } catch (e) {
        showToast(t("toast.dupFail").replace("{err}", humanizeError(e)), "error");
      } finally {
        setDuplicatingId(null);
      }
    },
    [duplicatingId, markSaved, showToast, t],
  );

  const handleDeleteFromList = useCallback(
    async (id: string) => {
      if (!(await dialog.confirm({ message: t("quot.deleteConfirm"), destructive: true, confirmLabel: t("btn.delete") }))) return;
      // Optimistic: remove from local state immediately so the user
      // sees the row disappear even if the browser HTTP cache is still
      // holding the pre-delete list.
      setQuotations((prev) => prev.filter((q) => q.id !== id));
      try {
        await deleteQuotationRemote(id);
        // `fresh: true` bypasses both the in-memory and browser HTTP
        // cache so the reconciliation read reflects the post-delete state.
        const list = await loadQuotationsRemote({ fresh: true });
        setQuotations(list);
      } catch (e) {
        showToast(humanizeError(e), "error");
      }
    },
    [showToast, t]
  );

  /* ── Delete current (from editor) ── */
  const handleDeleteCurrent = useCallback(async () => {
    if (!current) return;
    if (!(await dialog.confirm({ message: t("quot.deleteConfirm"), destructive: true, confirmLabel: t("btn.delete") }))) return;
    const id = current.id;
    setQuotations((prev) => prev.filter((q) => q.id !== id));
    setCurrent(null);
    setView("list");
    try {
      await deleteQuotationRemote(id);
      const list = await loadQuotationsRemote({ fresh: true });
      setQuotations(list);
    } catch (e) {
      showToast(humanizeError(e), "error");
    }
  }, [current, showToast, t]);

  /* ── Save current ──
     The status parameter is overloaded: callers passing "final" want
     legacy "save as final" semantics (now mapped to "sent"). Everyone
     else passes a current QuoteStatus — usually "draft" — and we
     persist it as-is. The statusHistory audit log only grows when the
     status actually changes; idle saves don't pollute it with
     duplicate "draft" rows. */
  /* Editor first-usable timing (Phase 4 Wave 2B.3). Records mount→first-frame
     so an operator can watch that opening the editor stays fast. Privacy-safe
     — only a duration is emitted, never quotation content. */
  const editorT0 = useRef(
    typeof performance !== "undefined" ? performance.now() : 0,
  );
  useEffect(() => {
    if (
      typeof performance === "undefined" ||
      typeof requestAnimationFrame === "undefined"
    )
      return;
    const raf = requestAnimationFrame(() => {
      record("quotations.editor.first_usable_ms", performance.now() - editorT0.current);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleSave = useCallback(
    async (status: QuoteStatus | "final") => {
      if (!current) return;
      setSaveState("saving");
      setSaveError("");
      const nextStatus: QuoteStatus = status === "final" ? "sent" : status;
      const history = current.statusHistory ?? [];
      const last = history[history.length - 1];
      const isTransition = !last || last.status !== nextStatus;
      const intent: Quotation = {
        ...current,
        status: nextStatus,
        statusHistory: isTransition
          ? [...history, { status: nextStatus, at: new Date().toISOString() }]
          : history,
        updatedAt: new Date().toISOString(),
      };
      const saveT0 =
        typeof performance !== "undefined" ? performance.now() : 0;
      try {
        const saved = await saveQuotationRemote(intent);
        if (saved) {
          // Privacy-safe: only the round-trip duration leaves the browser —
          // never the quotation number, customer, totals, or line contents.
          if (typeof performance !== "undefined") {
            record("quotations.save.ack_ms", performance.now() - saveT0);
          }
          setCurrent(histRaw(saved));   // the server echo is not an edit
          docWarm.delete(saved.id);
          markSaved(saved);   // clears the dirty flag — editor matches server
          // Tell anyone else viewing this quotation that it just changed.
          if (typeof saved.version === "number") announceSavedRef.current(saved.version);
          const list = await loadQuotationsRemote({ fresh: true });
          setQuotations(list);
          setSaveState("saved");
          // Reset the "Saved ✓" flash after 2.5 s so the button returns
          // to its idle label.
          setTimeout(() => setSaveState("idle"), 2500);
          return true;
        } else {
          // saveQuotationRemote returns null when the POST returned non-OK.
          // upsertDoc swallows the error so we have no detail; surface a
          // generic message and keep the editor unchanged.
          event("quotations.save.error");
          setSaveState("error");
          setSaveError(t("toast.saveFail"));
          showToast(t("toast.saveFail"), "error");
          setTimeout(() => setSaveState("idle"), 4000);
          return false;
        }
      } catch (e) {
        /* Optimistic-lock conflict — another user saved since we loaded. NEVER
           overwrite: show the blocking dialog so the user can Load Latest or
           Save as Copy. This is the core data-loss prevention. */
        if (e instanceof DocConflictError) {
          setConflict(e.current);
          setSaveState("idle");
          return false;
        }
        /* The hydration guard refused the save: nothing reached the server,
           the document simply has not finished loading. Say that, not
           "save failed". */
        const msg = e instanceof SaveRefusedError ? t("toast.saveRefused") : humanizeError(e);
        setSaveState("error");
        setSaveError(msg);
        showToast(msg, "error");
        setTimeout(() => setSaveState("idle"), 4000);
        return false;
      }
    },
    [current, markSaved, showToast, t]
  );

  /* ── Convert current to invoice. Uses the server-side helper which
        clones the doc JSON + mints a fresh INV<year>-NNNN number, then
        takes the user straight to the Invoices app. ── */
  const handleConvertToInvoice = useCallback(async () => {
    if (!current) return;
    // Make sure latest edits are on the server first.
    if (current.id.length !== 36 || current.status === "draft") {
      await handleSave("final");
    }
    const saved = await loadQuotationsRemote();
    const match = saved.find(
      (q) => q.invoiceNo === current.invoiceNo || q.id === current.id,
    );
    const quotationId = match?.id ?? current.id;
    if (quotationId.length !== 36) {
      showToast(t("alert.saveFirstConvert"), "error");
      return;
    }
    try {
      const invoice = await convertQuotationToInvoice(quotationId);
      if (invoice) {
        window.location.href = "/invoices";
      } else {
        showToast(t("toast.convertFail"), "error");
      }
    } catch (e) {
      showToast(humanizeError(e), "error");
    }
  }, [current, handleSave, showToast, t]);

  /* ── Create delivery project from an accepted quote ── */
  const handleCreateProject = useCallback(async () => {
    if (!current || current.id.length !== 36) {
      showToast(t("toast.saveFirstProject"), "error");
      return;
    }
    try {
      const res = await fetch("/api/projects/from-quotation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotation_id: current.id }),
      });
      const json = (await res.json().catch(() => null)) as
        | { project?: { id: string }; already?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.project) {
        showToast(t("toast.projectFail").replace("{err}", json?.error ?? `HTTP ${res.status}`), "error");
        return;
      }
      window.location.assign("/projects");
    } catch (err) {
      showToast(t("toast.projectFail").replace("{err}", humanizeError(err)), "error");
    }
  }, [current, showToast, t]);

  /* ── Print ── */
  const handlePrint = useCallback(() => {
    if (!current) return;
    const prev = document.title;
    document.title = `${current.customerName} - ${current.companyName} - ${current.invoiceNo}`;
    /* Use `afterprint` to restore the title; Safari's window.print()
       is non-blocking, so the previous synchronous restore was
       sometimes running BEFORE the print dialog read the title --
       resulting in the default app name appearing in the saved
       PDF filename. The listener fires once and removes itself. */
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }, [current]);

  /* "saving" | "loading" state during the brief moment between click
     and the new window receiving focus. Used to disable the button
     so a frantic double-click doesn't open two print dialogs. */
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "error">("idle");

  /* ── Export PDF ──
     Opens /quotations/<id>/print?auto=1 in a new window. That page
     renders the same A4 layout the server-side Puppeteer pipeline
     uses (210×297 mm, page-break-after each doc) and auto-fires
     window.print() once every image decodes. The operator picks
     "Save as PDF" in the native dialog.

     Why not the server-side /api/quotations/<id>/pdf route any
     more: Vercel cold-start on the Puppeteer function regularly
     ran ~30 s and occasionally hit the 60 s wall, leaving the
     user staring at "Rendering…" with no feedback. The new-window
     route is instant on every device, has no function-timeout
     failure mode, and produces an identical-quality PDF because
     the heavy lifting (the A4-fitted print page) is exactly the
     same. The /api/...pdf endpoint stays in the codebase for a
     future "email this quote" feature where we genuinely need a
     server-rendered buffer to attach. */
  /* Export the active quotation as a real .xlsx spreadsheet. Numbers stay
     numeric so the recipient can re-sum / re-format in Excel. Section-band
     rows ("header" kind) become a labelled separator row; only priced lines
     feed the totals — mirroring computeGrandTotal exactly. */
  const [excelBusy, setExcelBusy] = useState(false);
  const handleExportExcel = useCallback(async () => {
    if (!current || excelBusy) return;
    setExcelBusy(true);
    try {
      await exportExcel(current);
    } catch (e) {
      showToast(t("toast.excelFail").replace("{err}", humanizeError(e)), "error");
    } finally {
      setExcelBusy(false);
    }
  }, [current, excelBusy, showToast, t]);
  async function exportExcel(current: Quotation) {
    /* Structured cells ONLY. The old "pixel-perfect first" path rendered the
       print page with html2canvas and pasted ONE PNG into the sheet — an
       "Excel" file that was really a screenshot: nothing selectable, nothing
       summable, huge, and fragile (fonts/CORS). That was the reported
       "messy / disorganized" export. A spreadsheet's job is cells. */
    const q = current;
    const cur = q.currency || "USD";
    const priced = q.items.filter((i) => i.kind !== "header");
    const subtotal = priced.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0), 0);
    const taxPct = Math.max(0, Math.min(100, Number(q.taxPct) || 0));
    const taxAmt = subtotal * (taxPct / 100);
    const discPct = Math.max(0, Math.min(100, Number(q.discountPct) || 0));
    const base = subtotal + taxAmt + (Number(q.shipping) || 0) + (Number(q.others) || 0);
    const grand = +(base * (1 - discPct / 100)).toFixed(2);

    const rows: (string | number | null)[][] = [];
    const images: (string | null)[] = [];
    let n = 0;
    for (const it of q.items) {
      if (it.kind === "header") {
        rows.push(["", `▸ ${it.description || ""}`, "", "", "", "", ""]);
        images.push(null);
        continue;
      }
      n += 1;
      const lineTotal = money((Number(it.unitPrice) || 0) * (Number(it.qty) || 0));
      // Column order matches the document: NO. · ITEM · MODEL · PICTURE · UNIT PRICE · QTY · TOTAL
      rows.push([n, it.description || "", it.model || "", "", money(it.unitPrice), Number(it.qty) || 0, lineTotal]);
      images.push(it.image ? cdnImage(it.image, { width: 256, quality: 75 }) : null);
    }

    const TL = docLabels(q.docLang);
    const totals = [
      { label: TL("sum.subtotal"), value: subtotal },
      ...(taxPct ? [{ label: `${TL("sum.tax")} (${taxPct}%)`, value: taxAmt }] : []),
      ...(Number(q.shipping) ? [{ label: TL("sum.shipping"), value: Number(q.shipping) }] : []),
      ...(Number(q.others) ? [{ label: "Others", value: Number(q.others) }] : []),
      ...(discPct ? [{ label: `${TL("sum.discount")} (${discPct}%)`, value: -(base * discPct) / 100 }] : []),
      { label: `${TL("sum.total").toUpperCase()} (${cur})`, value: grand, strong: true },
    ];

    const incoterm = q.incotermCode
      ? `${q.incotermCode}${q.loadingPort ? ` · ${q.loadingPort}` : ""}${q.dischargePort ? ` → ${q.dischargePort}` : ""}`
      : "";
    const toLines = [
      q.companyName || q.customerName || "",
      q.toAddress || "",
      q.customerName && q.companyName ? `Attn:  ${q.customerName}` : "",
      q.toPhone ? `Phone:  ${q.toPhone}` : "",
      q.toMobile ? `Mobile:  ${q.toMobile}` : "",
      q.toEmail ? `Email:  ${q.toEmail}` : "",
      q.toWebsite ? `Web:  ${q.toWebsite}` : "",
      incoterm ? `Incoterm:  ${incoterm}` : "",
    ].filter((l) => l.trim() !== "");

    const fileBase = `quotation-${(q.invoiceNo || q.id).replace(/[^\w-]+/g, "_")}`;
    /* Sheet labels follow the DOCUMENT's language (docLang), same as print. */
    const XL = docLabels(q.docLang);
    await downloadDocXlsx(fileBase, {
      docTitle: XL("title.quotation"),
      number: q.invoiceNo || q.id,
      metaStrip: [
        [XL("meta.date").toUpperCase(), q.date || ""],
        [XL("meta.quotationNo").toUpperCase(), q.invoiceNo || ""],
        [XL("meta.clientNo").toUpperCase(), q.clientNo || ""],
        [XL("meta.validTill").toUpperCase(), q.validTill || ""],
      ],
      fromLabel: XL("party.from").toUpperCase(),
      toLabel: XL("party.quotationTo").toUpperCase(),
      termsTitle: XL("terms.title").toUpperCase(),
      toLines,
      columns: [
        { header: XL("col.no"), width: 5, align: "center" },
        { header: XL("col.item"), width: 40 },
        { header: XL("col.model"), width: 16 },
        { header: XL("col.picture"), width: 12, align: "center", image: true },
        { header: `${XL("col.unitPrice")} (${incoterm ? incoterm + ", " : ""}${cur})`, width: 15, money: true },
        { header: XL("col.qty"), width: 7, align: "center" },
        { header: `${XL("col.total")} (${cur})`, width: 15, money: true },
      ],
      rows,
      images,
      totals,
      terms: q.terms,
    });
  }

  const handleExportPdf = useCallback(async () => {
    /* One save at a time: Export saves first, and a Save click racing it
       would carry the same base_version and 409 into the conflict dialog
       for no reason. */
    if (!current || pdfState === "loading" || saveState === "saving") return;
    /* Print via a HIDDEN IFRAME pointing at the dedicated
       /quotations/<id>/print page. The dedicated page is a
       standalone route with NO Hub shell -- its print CSS is
       minimal and known-correct, producing one clean A4 sheet
       per logical doc page.

       The editor's own @media print CSS has to suppress the
       entire Hub layout (nav, sidebars, scroll wrappers,
       Tailwind h-screen + overflow-hidden, etc.), and on Safari
       16+ that interaction was reliably producing every-other-
       sheet-blank in the saved PDF. Using an iframe sidesteps
       all of it: we print exactly what the standalone print
       page renders, without leaving the editor window. */
    setPdfState("loading");
    try {
      /* ── Hydration guard ──
         If `current` looks like the optimistic stripped state from
         the list view (single empty placeholder item on a server
         UUID doc), the user clicked Export PDF before hydration
         landed. Re-fetch the full doc from /api/quotations/:id and
         use THAT for the save → export sequence. Without this, the
         save guard inside saveQuotationRemote would refuse the
         save and the operator would see "Save failed before
         export" even though the underlying data is fine. */
      let working: Quotation = current;
      const stripped =
        working.id.length === 36 &&
        Array.isArray(working.items) &&
        working.items.length === 1 &&
        !working.items[0]?.description?.trim() &&
        !working.items[0]?.model?.trim() &&
        !working.items[0]?.image?.trim() &&
        (Number(working.items[0]?.unitPrice) || 0) === 0;
      if (stripped) {
        const full = await fetchDocOne(QUOTATIONS_SYNC, working.id);
        if (full) {
          working = fromRow(full);
          setCurrent(histRaw(working));
          setCurrent(HIST_RESET);
        }
      }

      /* ALWAYS save first so the print page fetches the freshest
         server state. Bypass handleSave (which swallows errors
         and just flashes a status pill) and call saveQuotation-
         Remote directly -- if the save fails we MUST abort the
         export, otherwise the iframe would render a stale or
         empty copy of the doc and the operator would think the
         PDF is broken when really the save just didn't happen.
         Preserve the current status so we never demote a Sent
         quote back to Draft. */
      const intent: Quotation = {
        ...working,
        updatedAt: new Date().toISOString(),
      };
      const saved = await saveQuotationRemote(intent);
      if (!saved) {
        setPdfState("error");
        showToast(t("toast.exportSaveFail"), "error");
        setTimeout(() => setPdfState("idle"), 2_500);
        return;
      }
      setCurrent(histRaw(saved));
      docWarm.delete(saved.id);
      /* The save just landed, so the editor is clean — without this the
         "Unsaved" pill lit up right after a successful export. */
      markSaved(saved);
      if (typeof saved.version === "number") announceSavedRef.current(saved.version);
      const refreshed = await loadQuotationsRemote({ fresh: true });
      setQuotations(refreshed);
      const match = refreshed.find(
        (q) => q.id === saved.id || q.invoiceNo === saved.invoiceNo,
      );
      const quotationId = match?.id ?? saved.id;
      if (quotationId.length !== 36) {
        setPdfState("error");
        showToast(t("toast.saveBeforeExport"), "error");
        setTimeout(() => setPdfState("idle"), 2_000);
        return;
      }
      /* Build / reuse a hidden iframe. We re-use a single iframe
         across multiple exports so the first export pays the
         cost; subsequent exports reload the same iframe. */
      const IFRAME_ID = "koleex-pdf-export-frame";
      let iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = IFRAME_ID;
        iframe.style.position = "fixed";
        iframe.style.left = "-10000px";
        iframe.style.top = "0";
        iframe.style.width = "210mm";
        iframe.style.height = "297mm";
        iframe.style.border = "none";
        /* NOT visibility:hidden -- some browsers (and some
           printer drivers) skip invisible iframes during print,
           producing blank output. position:fixed with negative
           left keeps it offscreen for the user while staying
           rendered for the print pipeline. */
        document.body.appendChild(iframe);
      }
      /* The dedicated print page sets window.__quotation_pdf_ready__
         once images + fonts have loaded. We watch for it, then
         invoke the iframe's print(). */
      const prevTitle = document.title;
      /* Clean filename: skip empty parts so a draft (no company / no quote no)
         doesn't produce "Customer -  - ". Order: quote-no first when present. */
      document.title =
        [working.invoiceNo, working.customerName || working.companyName]
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .join(" - ") || "Quotation";
      const restore = () => {
        document.title = prevTitle;
        window.removeEventListener("afterprint", restore);
      };
      window.addEventListener("afterprint", restore);

      /* Cache-bust the iframe URL so a second export of the
         same doc always re-fetches fresh server state (and so
         the iframe's `load` event reliably fires even when
         the URL is otherwise identical to the previous export). */
      /* Listener first, then the navigation, so a fast (cached) load can
         never fire before anyone is listening. Any previous export's
         listener is dropped so repeated exports do not stack them. */
      const prevOnLoad = (iframe as HTMLIFrameElement & { __kxOnLoad?: () => void }).__kxOnLoad;
      if (prevOnLoad) iframe.removeEventListener("load", prevOnLoad);
      /* The print page signals readiness by setting a flag; if it never
         does (404, image that never decodes, a script error) the poll used
         to run ten times a second for the life of the tab with the Export
         button disabled forever. A deadline turns that into a message. */
      const DEADLINE_MS = 20_000;
      const startedAt = Date.now();
      const onLoad = () => {
        iframe!.removeEventListener("load", onLoad);
        const checkReady = () => {
          const win = iframe!.contentWindow as
            | (Window & { __quotation_pdf_ready__?: boolean })
            | null;
          if (win?.__quotation_pdf_ready__) {
            try {
              win.focus();
              win.print();
            } catch (err) {
              showToast(t("toast.printFail").replace("{err}", humanizeError(err)), "error");
            }
            setPdfState("idle");
          } else if (Date.now() - startedAt > DEADLINE_MS) {
            setPdfState("idle");
            showToast(t("toast.exportTimeout"), "error");
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      };
      (iframe as HTMLIFrameElement & { __kxOnLoad?: () => void }).__kxOnLoad = onLoad;
      iframe.addEventListener("load", onLoad);
      iframe.src = `/quotations/${encodeURIComponent(quotationId)}/print?_t=${Date.now()}`;
    } catch (e) {
      /* A conflict during the pre-export save: don't export a stale doc —
         surface the conflict dialog so the user resolves it first. */
      if (e instanceof DocConflictError) {
        setConflict(e.current);
        setPdfState("idle");
        return;
      }
      setPdfState("error");
      const msg = e instanceof SaveRefusedError ? t("toast.saveRefused") : t("toast.exportFail").replace("{err}", humanizeError(e));
      showToast(msg, "error");
      setTimeout(() => setPdfState("idle"), 2_000);
    }
  }, [current, markSaved, pdfState, saveState, showToast, t]);

  /* ── Send by email ──
     Opens a print window so the operator can "Save as PDF" the
     attachment, AND fires a mailto: with To/Subject/Body pre-
     filled from the quote. We deliberately don't try to attach
     the PDF programmatically — mailto can't carry binary
     attachments and rigging up a real SMTP path means adding
     Resend / SendGrid + an env-var dance. The two-window flow
     (print tab + Mail composer) gives a near-one-click experience
     on every platform without that infrastructure.

     Marks the quote as Sent on the way out so the status pill +
     audit log reflect the action. Skips that side-effect if the
     quote is already past Sent (Accepted / Rejected). */
  const handleSendEmail = useCallback(async () => {
    if (!current) return;
    const to = (current.toEmail || "").trim();
    if (!to) {
      showToast(t("toast.emailMissing"), "error");
      return;
    }
    /* Same popup-blocker workaround as handleExportPdf: open the
       print window NOW (inside the click's user-gesture stack)
       and navigate it to the real URL once the save/refetch
       resolves. window.open() called after async awaits is
       silently blocked by every modern browser.
       No "noopener" here: with it, window.open RETURNS NULL by spec, so
       every Send used to land in the popup-blocked branch — and the
       window has to be navigated below, which needs the handle. Same
       origin, so there is nothing to protect against. */
    const win = window.open("about:blank", "_blank");
    if (!win) {
      showToast(t("toast.popupBlocked"), "error");
      return;
    }
    try {
      /* Save first so the print window pulls the latest doc. */
      const targetStatus: QuoteStatus =
        current.status === "accepted" ||
        current.status === "rejected" ||
        current.status === "expired"
          ? current.status
          : "sent";
      if (current.id.length !== 36 || current.status !== targetStatus) {
        const ok = await handleSave(targetStatus);
        if (!ok) { win.close(); return; }   // handleSave already said why
      }
      const refreshed = await loadQuotationsRemote({ fresh: true });
      const match = refreshed.find(
        (q) => q.id === current.id || q.invoiceNo === current.invoiceNo,
      );
      const quotationId = match?.id ?? current.id;
      if (quotationId.length !== 36) {
        win.close();
        showToast(t("toast.saveBeforeSend"), "error");
        return;
      }

      /* Build a friendly cover-email skeleton. The operator can
         tweak it in their mail client before pressing send. The mail is
         customer-facing and stays in English like the printed document. */
      const greetingName = current.customerName?.trim() || "there";
      const grandTotalNum =
        current.serverTotal != null && current.serverTotal > 0
          ? current.serverTotal
          : computeGrandTotal(current);
      const subject = `Quotation ${current.invoiceNo || "from Koleex"}${
        current.companyName ? ` — ${current.companyName}` : ""
      }`;
      const body = [
        `Dear ${greetingName},`,
        "",
        `Please find attached our quotation ${current.invoiceNo || ""} ` +
          `for your review. The total amount is ${(current.currency || "USD").toUpperCase()} ${fmt(grandTotalNum)}, ` +
          `valid until ${current.validTill || "the date noted on the quote"}.`,
        "",
        "We're happy to discuss any of the items, prices, or delivery terms — just reply to this email or give us a call.",
        "",
        "Best regards,",
        "Koleex Group",
      ].join("\n");

      /* Navigate the already-opened print window to the real URL
         (we opened a blank tab earlier inside the user gesture). */
      const printUrl = `/quotations/${encodeURIComponent(quotationId)}/print?auto=1`;
      win.location.href = printUrl;

      /* Fire the mailto on a small delay so the print window grabs
         focus first — otherwise some OS mail handlers steal it
         immediately and the print-as-PDF dialog never opens. */
      setTimeout(() => {
        const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
          subject,
        )}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
      }, 600);
    } catch (e) {
      try { win.close(); } catch { /* already closed */ }
      showToast(t("toast.sendFail").replace("{err}", humanizeError(e)), "error");
    }
  }, [current, handleSave, showToast, t]);

  /* ── Duplicate ──
     Clones the current quote into a fresh draft and drops the user
     straight into the editor. The new draft gets:
       · A brand-new client-side id so React treats it as a new row.
       · An empty invoiceNo so the server mints a fresh
         KL{YYYY}-{MMDD} (date-based) number on first save.
       · Today's date as the new issue date + a 30-day validity.
       · Deep-cloned items so edits on the copy don't bleed back
         into the source quote's state. */
  const handleDuplicate = useCallback(() => {
    if (!current) return;
    const today = todayDDMMYYYY();
    const copy: Quotation = {
      ...current,
      id: generateId(),
      invoiceNo: "",
      date: today,
      validTill: addDays(today, 30),
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      serverTotal: undefined,
      items: current.items.map((it) => ({ ...it })),
    };
    setCurrent(histRaw(copy));
    setCurrent(HIST_RESET);
    setView("editor");
  }, [current]);

  /* ── Item helpers ── */
  const updateItem = useCallback(
    (idx: number, field: keyof QuotationItem, value: string | number) => {
      if (!current) return;
      const items = current.items.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      );
      setCurrent({ ...current, items });
    },
    [current]
  );

  const addItem = useCallback(() => {
    if (!current) return;
    setCurrent({ ...current, items: [...current.items, { ...EMPTY_ITEM }] });
  }, [current]);

  /* Append a section-header row — a full-width black band used to
     group the quote into sections. Carries no price/qty (0/0) so it
     never affects any total; its title lives in `description`. */
  const addHeader = useCallback(() => {
    if (!current) return;
    setCurrent({
      ...current,
      items: [...current.items, { ...EMPTY_ITEM, kind: "header", description: "", qty: 0, unitPrice: 0 }],
    });
  }, [current]);

  /* Duplicate a row — insert an identical copy directly below it. Works for
     product rows and section headers alike. */
  const duplicateItem = useCallback((idx: number) => {
    if (!current) return;
    const items = current.items.slice();
    if (idx < 0 || idx >= items.length) return;
    items.splice(idx + 1, 0, { ...items[idx] });
    setCurrent({ ...current, items });
  }, [current]);

  /* Insert a fresh blank row DIRECTLY BELOW a given row, so the user can
     add a line exactly where they want instead of appending at the end and
     dragging it up. */
  const insertItemBelow = useCallback((idx: number) => {
    if (!current) return;
    const items = current.items.slice();
    const at = Math.min(Math.max(idx + 1, 0), items.length);
    items.splice(at, 0, { ...EMPTY_ITEM });
    setCurrent({ ...current, items });
  }, [current]);

  /* Insert a section-header band directly below a given row. */
  const insertHeaderBelow = useCallback((idx: number) => {
    if (!current) return;
    const items = current.items.slice();
    const at = Math.min(Math.max(idx + 1, 0), items.length);
    items.splice(at, 0, { ...EMPTY_ITEM, kind: "header", description: "", qty: 0, unitPrice: 0 });
    setCurrent({ ...current, items });
  }, [current]);

  /* Open the catalog picker targeting an insert position (below row idx). */
  const openCatalogAt = useCallback((idx: number) => {
    setInsertAtIdx(idx);
    setPickerOpen(true);
  }, []);

  /* Clear a row's contents in place — keeps the row, resets it to blank. A
     section header clears back to an empty header band. */
  const clearItem = useCallback((idx: number) => {
    if (!current) return;
    const items = current.items.slice();
    if (idx < 0 || idx >= items.length) return;
    const wasHeader = items[idx]?.kind === "header";
    items[idx] = wasHeader
      ? { ...EMPTY_ITEM, kind: "header", description: "", qty: 0, unitPrice: 0 }
      : { ...EMPTY_ITEM };
    setCurrent({ ...current, items });
  }, [current]);

  /* Apply a CRM customer pick to the QUOTATION TO card. Fills the
     editor's company / contact / phone / mobile / email / website
     fields and stores customerContactId in the doc so we can show
     a "Linked" indicator on reload. Doesn't touch the legacy
     schema-level customer_id FK (that targets a different table) —
     just keeps the link in the doc payload. */
  const applyCustomerPick = useCallback(
    (pick: CustomerPickResult) => {
      if (!current) return;
      setCurrent({
        ...current,
        customerContactId: pick.id,
        customerName: pick.displayName || current.customerName,
        companyName: pick.companyName || current.companyName,
        toAddress: pick.address || current.toAddress,
        toPhone: pick.phone || current.toPhone,
        toMobile: pick.mobile || current.toMobile,
        toEmail: pick.email || current.toEmail,
        toWebsite: pick.website || current.toWebsite,
      });
    },
    [current],
  );

  /* Save the typed party details as a CRM customer.

     A details card filled by hand is a dead end otherwise: the buyer exists
     on this one document and the operator retypes them on the next. Creating
     the customer also earns them a permanent code (BD-100 …), which is what
     makes the same buyer recognisable across every document afterwards.

     The new customer is linked straight back onto the document, so the button
     disappears and the card behaves exactly as if it had been picked from the
     CRM in the first place. */
  const [savingCustomer, setSavingCustomer] = useState(false);
  const saveCurrentPartyAsCustomer = useCallback(async () => {
    if (!current || savingCustomer) return;
    const name = (current.customerName || current.companyName || "").trim();
    if (!name) return;

    setSavingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company_name: current.companyName?.trim() || null,
          email: current.toEmail?.trim() || null,
          phone: current.toPhone?.trim() || null,
          /* The card holds a free-text address; the country is parsed out of
             its last line, which is where an export address puts it. A wrong
             guess only costs an XX- prefix, never a failed save. */
          country: (current.toAddress || "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean).pop() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { customer?: { id: string; customer_code: string | null }; error?: string }
        | null;
      if (!res.ok || !json?.customer) {
        showToast(json?.error ? humanizeError(json.error) : t("toast.customerSaveFail"), "error");
        return;
      }
      setCurrent((q) => (q ? { ...q, customerContactId: json.customer!.id } : q));
      showToast(t("toast.customerSaved"));
    } catch (e) {
      showToast(e instanceof Error ? humanizeError(e) : t("toast.customerSaveFail"), "error");
    } finally {
      setSavingCustomer(false);
    }
  }, [current, savingCustomer, showToast, t]);

  /* Append a new item pre-filled from the catalog picker. If the
     bottom-most row is still completely blank (typical right after
     a "+ Add row"), replace it instead of appending — keeps the
     items list tidy when the user clicks "From catalog" first. */
  const addItemFromCatalog = useCallback(
    (pick: PickResult) => {
      if (!current) return;
      const fresh: QuotationItem = {
        ...EMPTY_ITEM,
        description: pick.description,
        model: pick.model,
        image: pick.imageUrl,
        /* Do NOT auto-fill the product's saved price. Quotation prices must be
           entered deliberately — auto-copying a price produced "surprise" totals
           on quotes the user thought were unpriced. Start at 0; the salesperson
           types the price to quote. */
        unitPrice: 0,
        qty: 1,
      };
      const items = current.items.slice();
      if (insertAtIdx != null && insertAtIdx >= 0 && insertAtIdx < items.length) {
        /* Targeted insert: drop the picked product directly below that row. */
        items.splice(insertAtIdx + 1, 0, fresh);
      } else {
        const last = items[items.length - 1];
        const lastIsEmpty =
          last &&
          !last.description &&
          !last.model &&
          !last.image &&
          !last.unitPrice &&
          last.qty === 1;
        if (lastIsEmpty) items[items.length - 1] = fresh;
        else items.push(fresh);
      }
      setCurrent({ ...current, items });
      setInsertAtIdx(null);
    },
    [current, insertAtIdx],
  );

  /* ── Stamp + Signature handlers ──
     The editor renders the stamp/signature cards on the last page.
     A super-admin can either (a) attach the tenant's saved asset
     with one click or (b) upload a new file (the API replaces the
     saved asset AND returns the URL we stamp on this quote). All
     four flows are gated client-side on isSuperAdmin AND server-
     side on auth.is_super_admin so the UI gate is a hint, not the
     security perimeter. */
  /* ONCE, ON MOUNT — not per editor, and not per document.
     ---------------------------------------------------------------------
     This used to read `if (view !== "editor") return;` with
     `[view, current?.id]` deps, which cost twice over:

       · it sat BEHIND the document fetch. Opening a quotation was two
         sequential round-trips — the document, then this — even though the
         stamp and signature have nothing to do with which document is open.
       · it re-ran on `current?.id`, so opening five quotations fetched the
         same tenant assets five times.

     They belong to the TENANT, not the quotation. Fetching once when the app
     mounts puts it alongside the list load instead of after the document, and
     the editor finds it already there. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/quotations/saved-assets", {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          stampUrl: string | null;
          signatureUrl: string | null;
        };
        if (cancelled) return;
        setSavedStampUrl(json.stampUrl);
        setSavedSignatureUrl(json.signatureUrl);
      } catch { /* non-fatal — buttons just degrade to upload-only */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const attachSavedStamp = useCallback(() => {
    if (!current || !savedStampUrl) return;
    setCurrent({ ...current, stampUrl: savedStampUrl });
  }, [current, savedStampUrl]);
  const attachSavedSignature = useCallback(() => {
    if (!current || !savedSignatureUrl) return;
    setCurrent({ ...current, signatureUrl: savedSignatureUrl });
  }, [current, savedSignatureUrl]);
  const clearStamp = useCallback(() => {
    if (!current) return;
    setCurrent({ ...current, stampUrl: undefined });
  }, [current]);
  const clearSignature = useCallback(() => {
    if (!current) return;
    setCurrent({ ...current, signatureUrl: undefined });
  }, [current]);

  const uploadAsset = useCallback(
    async (kind: "stamp" | "signature", file: File) => {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      try {
        const res = await fetch("/api/quotations/saved-assets", {
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          showToast(t("toast.uploadFail").replace("{err}", humanizeError(j.error)), "error");
          return;
        }
        const json = (await res.json()) as { kind: string; url: string };
        if (kind === "stamp") {
          setSavedStampUrl(json.url);
          if (current) setCurrent({ ...current, stampUrl: json.url });
        } else {
          setSavedSignatureUrl(json.url);
          if (current) setCurrent({ ...current, signatureUrl: json.url });
        }
      } catch (e) {
        showToast(t("toast.uploadFail").replace("{err}", humanizeError(e)), "error");
      }
    },
    [current, showToast, t],
  );

  const removeItem = useCallback(
    (idx: number) => {
      if (!current || current.items.length <= 1) return;
      setCurrent({
        ...current,
        items: current.items.filter((_, i) => i !== idx),
      });
    },
    [current]
  );

  /* Reorder a row up/down by one slot. Caps at the array bounds so
     callers don't have to bounds-check before firing. */
  const moveItem = useCallback(
    (idx: number, direction: -1 | 1) => {
      if (!current) return;
      const target = idx + direction;
      if (target < 0 || target >= current.items.length) return;
      const next = current.items.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      setCurrent({ ...current, items: next });
    },
    [current]
  );

  const handleImageUpload = useCallback(
    async (idx: number, file: File) => {
      let base64 = "";
      try {
        base64 = await compressImage(file);
        updateItem(idx, "image", base64);
      } catch (e) {
        console.error("Image compression failed", e);
        return;
      }
      /* Then move it to storage. The swap targets the row that still holds
         this exact data URL (the operator may have moved rows meanwhile),
         and is not an undo step of its own — the upload was. */
      const url = await uploadItemImage(base64);
      if (!url) return;
      setCurrent(histRaw((q) => {
        if (!q) return q;
        const i = q.items.findIndex((it) => it.image === base64);
        if (i < 0) return q;
        const items = q.items.slice();
        items[i] = { ...items[i], image: url };
        return { ...q, items };
      }));
    },
    [updateItem]
  );

  /* ── Computed totals ──
     Pre-discount base = subtotal + tax + shipping + others
     Grand total       = base * (1 - discountPct/100)
     Discount is a global, whole-bill reduction applied last. */
  /* Number-coerce because legacy rows (saved before fromRow's
     Number() coercion) can carry strings in unitPrice / qty; a
     string concatenation would produce "01.5" etc. and break
     the editor totals + the printed PDF. */
  const subTotal = useMemo(
    () =>
      current
        ? current.items.reduce(
            (s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0),
            0,
          )
        : 0,
    [current],
  );
  const grandTotal = useMemo(() => {
    if (!current) return 0;
    const taxAmt = subTotal * (Math.max(0, Math.min(100, Number(current.taxPct) || 0)) / 100);
    const base = subTotal + taxAmt + current.shipping + current.others;
    const pct = Math.max(0, Math.min(100, Number(current.discountPct) || 0));
    return +(base * (1 - pct / 100)).toFixed(2);
  }, [current, subTotal]);

  /* ── Unsaved-changes guard ──────────────────────────────────────
     `dirty` = the working copy diverged from the last loaded/saved
     snapshot. Drives the native tab-close prompt + the styled in-app
     confirm modal shown when the operator presses Back. */
  /* Memoized, and computed on the fingerprint rather than the full
     serialisation (see fingerprint): the editor re-renders on every
     keystroke / collab-presence tick, and the base64 photos in items[]
     made each of those a multi-megabyte stringify. */
  const dirty = useMemo(
    () =>
      view === "editor" && current
        ? fingerprint(current) !== baselineRef.current
        : false,
    [view, current],
  );

  /* ── Realtime collaboration (presence + save broadcast) ──
     Identity for presence + updated_by display comes from the bootstrap
     cache. Status is "editing" when there are unsaved edits, else "viewing".
     The hook no-ops for unsaved local drafts (id is not a server UUID). */
  const collabMe = useMemo(() => {
    const a = meBootstrap?.auth as { account_id?: string; username?: string } | undefined;
    if (!a?.account_id) return null;
    const person = (meBootstrap as { header?: { person?: { full_name?: string } } } | undefined)?.header?.person;
    const name = person?.full_name || a.username || "User";
    return { id: a.account_id, name };
  }, [meBootstrap]);

  const { peers, saveNotice, announceSaved, clearNotice } = useQuotationCollab({
    quotationId: view === "editor" ? current?.id ?? null : null,
    me: collabMe,
    status: dirty ? "editing" : "viewing",
  });
  // Expose announceSaved to handleSave (declared earlier) via the ref.
  useEffect(() => { announceSavedRef.current = announceSaved; }, [announceSaved]);

  /* Pull the latest server version into the editor without losing edits.
     Used by the "Load Latest" actions in the conflict dialog + save notice. */
  const loadLatest = useCallback(async () => {
    if (!current || current.id.length !== 36) return null;
    const full = await fetchDocOne(QUOTATIONS_SYNC, current.id);
    if (!full) return null;
    const fresh = fromRow(full);
    const serverView = { ...fresh, items: fresh.items.map((i) => ({ ...i })) };
    setCurrent(histRaw(serverView));
    setCurrent(HIST_RESET);
    markSaved(serverView);
    return serverView;
  }, [current, markSaved]);

  /* ── Live collaboration: apply a peer's save in real time, no refresh ──
     When another user saves this quotation and we have NO unsaved edits,
     pull their version straight into the editor so the change appears
     instantly. If we DO have unsaved edits we leave the notice + buttons so
     the user decides (auto-applying would replace their own work). The ref
     keys on the specific notice so loadLatest re-renders don't re-apply or
     loop. The pill self-dismisses a few seconds after applying. */
  const appliedNoticeRef = useRef<string>("");
  useEffect(() => {
    if (!saveNotice || dirty) return;
    const key = `${saveNotice.by}:${saveNotice.version}:${saveNotice.at}`;
    if (appliedNoticeRef.current === key) return;
    appliedNoticeRef.current = key;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void loadLatest().finally(() => {
      if (!alive) return;
      timer = setTimeout(() => clearNotice(), 3500);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [saveNotice, dirty, loadLatest, clearNotice]);

  useEffect(() => {
    if (!dirty) return;
    /* Browser-native "Leave site?" prompt for tab close / refresh /
       hard navigation. The dialog chrome is browser-controlled (can't be
       themed) — the styled modal below covers the in-app Back button. */
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const leaveEditor = useCallback(() => {
    setExitPromptOpen(false);
    baselineRef.current = "";
    setView("list");
  }, []);

  /* Back button → if there are unsaved edits, ask first; otherwise leave. */
  const requestExit = useCallback(() => {
    if (dirty) setExitPromptOpen(true);
    else setView("list");
  }, [dirty]);

  const saveAndExit = useCallback(async () => {
    const ok = await handleSave("draft");
    if (ok) leaveEditor();
    // On failure the modal stays open; the Save-state pill shows why.
  }, [handleSave, leaveEditor]);

  /* ── Sorted list, then the operator's search / status filter / page ──
     The list used to be every quotation as one unpaged card wall with no
     way to find a quote except scrolling. Filtering runs on the fields the
     slim list payload carries (number, customer, company, client no). */
  const sortedQuotations = useMemo(
    () =>
      [...quotations].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [quotations],
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [page, setPage] = useState(1);
  const filteredQuotations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortedQuotations.filter((r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (!needle ||
        [r.invoiceNo, r.customerName, r.companyName, r.clientNo].some((s) =>
          (s || "").toLowerCase().includes(needle))),
    );
  }, [sortedQuotations, query, statusFilter]);
  const statusCounts = useMemo(() => {
    const c: Record<QuoteStatus | "all", number> = { all: quotations.length, draft: 0, sent: 0, accepted: 0, rejected: 0, expired: 0 };
    for (const q of quotations) c[q.status] = (c[q.status] ?? 0) + 1;
    return c;
  }, [quotations]);
  const pages = Math.max(1, Math.ceil(filteredQuotations.length / LIST_PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRows = filteredQuotations.slice((safePage - 1) * LIST_PAGE_SIZE, safePage * LIST_PAGE_SIZE);

  /* While the list is being read: pull in the document editor's chunk (it
     is loaded on demand, and the first open used to pay for its download)
     and warm the two most recent quotations, which are the ones opened
     most. Gated like every other idle preload — never on Save-Data or 2G. */
  useEffect(() => {
    if (view !== "list" || !loaded) return;
    if (!isPreloadAllowed(readNetworkContext())) return;
    const timer = window.setTimeout(() => {
      void import("./QuotationA4Preview");
      for (const q of sortedQuotations.slice(0, 2)) warmDoc(q.id);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [view, loaded, sortedQuotations]);

  /* One-off housekeeping, super-admins only: quotations saved before line
     photos moved to storage still carry them inline and open slowly. The
     count is fetched once per list visit; the button loops the server
     endpoint a few documents at a time until none are left. */
  const [compactPending, setCompactPending] = useState(0);
  const [compacting, setCompacting] = useState<number | null>(null);
  useEffect(() => {
    if (view !== "list" || !isSuperAdmin) return;
    let alive = true;
    fetch("/api/quotations/compact-images", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { pending?: number } | null) => { if (alive && j) setCompactPending(Number(j.pending) || 0); })
      .catch(() => {});
    return () => { alive = false; };
  }, [view, isSuperAdmin]);
  const runCompaction = useCallback(async () => {
    if (compacting !== null) return;
    setCompacting(compactPending);
    let total = 0;
    try {
      for (let round = 0; round < 60; round++) {
        const res = await fetch("/api/quotations/compact-images", { method: "POST", credentials: "include" });
        const j = (await res.json().catch(() => ({}))) as { done?: number; remaining?: number; error?: string };
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        total += Number(j.done) || 0;
        const remaining = Number(j.remaining) || 0;
        setCompacting(remaining);
        if (remaining === 0 || !(Number(j.done) > 0)) break;
      }
      setCompactPending(0);
      docWarm.clear();
      showToast(t("toast.compactDone").replace("{n}", String(total)));
    } catch (e) {
      showToast(t("toast.compactFail").replace("{err}", humanizeError(e)), "error");
    } finally {
      setCompacting(null);
    }
  }, [compacting, compactPending, showToast, t]);

  if (!loaded) {
    return (
      /* min-h-full, never min-h-screen: the Hub scroller is already
         100svh − var(--kx-header-h), so 100vh here is a phantom scroll the
         exact height of the header on every quotations screen. */
      <AuroraShell className="flex items-center justify-center px-4">
        {loadError ? (
          <EmptyState
            className="w-full max-w-md"
            icon={<DocumentIcon size={36} className="opacity-40" />}
            title={t("list.loadError")}
            hint={loadError}
            action={<Button variant="secondary" size="sm" onClick={() => void loadList()}>{t("btn.retry")}</Button>}
          />
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-[var(--text-dim)]" role="status" aria-live="polite">
            <SpinnerIcon size={16} />
            {t("list.loading")}
          </div>
        )}
        {toastElement}
      </AuroraShell>
    );
  }

  /* ══════════════════════════════════════════════════════════
     LIST VIEW
     ══════════════════════════════════════════════════════════ */
  if (view === "list") {
    return (
      <AuroraShell className="text-[var(--text-primary)]">
        {/* Top bar — canonical Hub PageHeader */}
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pt-6 pb-2">
          <PageHeader
            title={t("quot.title")}
            subtitle={`${quotations.length} ${quotations.length === 1 ? t("quot.singular") : t("quot.plural")}`}
            icon={<QuotationIcon size={16} />}
            showTabs={false}
            action={
              <div className="flex items-center gap-2">
                {/* Link, not <a>. A plain anchor to an internal route is a FULL
                    PAGE RELOAD — the whole shell, every provider, the account
                    request and the ground all torn down and rebuilt to move
                    between two screens of the same app. */}
                <Link
                  href="/quotations/preorder"
                  className="inline-flex items-center h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]"
                  title={t("list.preorderHint")}
                >
                  {t("list.preorder")}
                </Link>
                {isSuperAdmin && compactPending > 0 && (
                  <Button
                    variant="secondary"
                    onClick={runCompaction}
                    disabled={compacting !== null}
                    loading={compacting !== null}
                    title={t("list.compactHint")}
                  >
                    {compacting !== null
                      ? t("list.compacting").replace("{n}", String(compacting))
                      : t("list.compact").replace("{n}", String(compactPending))}
                  </Button>
                )}
                <Button onClick={handleNew} icon={<PlusIcon size={12} />}>
                  {t("quot.new")}
                </Button>
              </div>
            }
          />
        </div>

        {/* The snapshot painted the list; the refresh behind it failed. */}
        {loadError && (
          <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pt-3">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-[12.5px] text-rose-400" role="alert">
              <span className="flex-1 min-w-[200px]">{t("list.loadError")} {loadError}</span>
              <Button variant="secondary" size="sm" onClick={() => void loadList()}>{t("btn.retry")}</Button>
            </div>
          </div>
        )}

        {/* KPI strip */}
        {/* Same px-4 md:px-6 lg:px-8 as the header above and the list below.
            MEASURED: the header resolved to 32px of padding and these two to
            16px, so the title sat 16px inboard of every card under it. */}
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pt-4">
          {(() => {
            /* The money tile is a USD figure, so only USD quotes feed it —
               a EUR quote added to a USD sum is not a total of anything.
               The hint says how many were left out. */
            let total = 0;
            let otherCurrencies = 0;
            for (const q of quotations) {
              if ((q.currency || "USD").toUpperCase() !== "USD") { otherCurrencies++; continue; }
              total += q.serverTotal != null && q.serverTotal > 0 ? q.serverTotal : computeGrandTotal(q);
            }
            /* Day granularity: a quote valid until TODAY is still expiring
               soon, and "now" with a clock time excluded it after midnight. */
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const soon = new Date(today); soon.setDate(today.getDate() + 7);
            const expiringSoon = quotations.filter((q) => {
              if (q.status !== "sent") return false;
              const iso = ddmmyyyyToISO(q.validTill);
              if (!iso) return false;
              const d = new Date(iso);
              return d >= today && d <= soon;
            }).length;
            const hints = [
              expiringSoon > 0 ? t("kpi.expiringSoon").replace("{n}", String(expiringSoon)) : "",
              otherCurrencies > 0 ? t("kpi.otherCurrencies").replace("{n}", String(otherCurrencies)) : "",
            ].filter(Boolean);
            return (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label={t("kpi.total")}    value={String(quotations.length)}      icon="document"     tone="info"     />
                <KpiCard label={t("kpi.drafts")}   value={String(statusCounts.draft)}    icon="file"         tone="warning"  />
                <KpiCard label={t("kpi.sent")}     value={String(statusCounts.sent)}     icon="paper-plane"  tone="info"     />
                <KpiCard label={t("kpi.accepted")} value={String(statusCounts.accepted)} icon="check"        tone="positive" />
                {/* The money tile spans both mobile columns. KpiCard renders its
                    value at a fixed 26px and a formatted total is ONE unbreakable
                    token (comma separators are not break opportunities), so at a
                    173px card the text measured 163px of ink inside a 141px
                    content box and simply painted past the border — no wrapping,
                    no clipping, no scrollWidth to catch it. As the 5th tile in a
                    2-column grid it was alone on its row with an empty 173px slot
                    beside it, so spanning costs nothing and keeps every digit at
                    full size. */}
                <KpiCard
                  className="col-span-2 md:col-span-1"
                  label={t("kpi.totalValue")}
                  value={fmt(total)}
                  icon="balance-scale-left"
                  hint={hints.length ? hints.join(" · ") : undefined}
                />
              </div>
            );
          })()}
        </div>

        {/* Search + status filter */}
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={query}
              onChange={(v) => { setQuery(v); setPage(1); }}
              placeholder={t("list.searchPh")}
              className="w-full sm:w-80"
            />
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("quot.title")}>
              {(["all", ...QUOTE_STATUS_OPTIONS.map((o) => o.value)] as const).map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${
                      active
                        ? s === "all"
                          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                          : statusTone(s)
                        : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {s === "all" ? t("list.allStatuses") : t(`stl.${s}`)}
                    <span className="tabular-nums opacity-60">{statusCounts[s]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-5">
          {sortedQuotations.length === 0 ? (
            <EmptyState
              icon={<DocumentIcon size={40} className="opacity-40" />}
              title={t("quot.none")}
              hint={t("quot.createFirst")}
              action={<Button onClick={handleNew} icon={<PlusIcon size={12} />}>{t("quot.new")}</Button>}
            />
          ) : filteredQuotations.length === 0 ? (
            <EmptyState
              icon={<DocumentIcon size={40} className="opacity-40" />}
              title={t("list.noMatch")}
              action={
                <Button variant="secondary" size="sm" onClick={() => { setQuery(""); setStatusFilter("all"); setPage(1); }}>
                  {t("list.clearFilters")}
                </Button>
              }
            />
          ) : (
            <>
            {/* grid-cols-1 is NOT cosmetic here. A bare `grid` leaves the
               implicit column at `auto`, whose minimum is the item's
               min-content — and a card full of `truncate` (nowrap) text has a
               min-content of ~518px. MEASURED at 390px viewport: the column
               computed to 517.8px inside a 358px container, the cards ran
               160px past their parent and the Hub scroller gained 144px of
               horizontal scroll, so the whole app slid sideways under the
               finger. Tailwind's grid-cols-1 emits repeat(1, minmax(0, 1fr));
               that explicit 0 minimum is what lets the column shrink.
               Re-measured after: overflow 144px → 0. */}
            <div className="grid grid-cols-1 gap-3">
              {pageRows.map((q) => {
                /* The list endpoint strips items from the doc payload
                   to keep responses small, so recomputing here gives 0.
                   Prefer the server-side `serverTotal` (the row's total
                   column). Fall back to the SAME formula every other
                   surface uses (computeGrandTotal: tax %, shipping,
                   others, whole-bill discount) for unsaved drafts —
                   the old inline sum used the legacy flat tax field and
                   ignored the discount, so a draft showed one total in
                   the list and another on its own document. */
                const gt = q.serverTotal != null && q.serverTotal > 0 ? q.serverTotal : computeGrandTotal(q);
                const busy = duplicatingId === q.id;
                /* Row actions used to be hover-only: invisible on touch
                   and to keyboard users tabbing onto a focusable they could
                   not see. Shown on hover, on focus within the row, and
                   always on devices without hover. */
                const rowAction =
                  "p-2 rounded-lg transition opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:opacity-40 disabled:cursor-not-allowed";
                return (
                  <div
                    key={q.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t("list.openHint")}: ${q.invoiceNo || t("list.unnamedCustomer")}`}
                    className="kx-glass kx-hover-card bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 sm:p-5 hover:border-[var(--border-strong)] transition cursor-pointer group focus-visible:outline-none focus-visible:border-[var(--border-focus)]"
                    onClick={() => handleOpen(q)}
                    onPointerEnter={() => warmDoc(q.id)}
                    onFocus={() => warmDoc(q.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void handleOpen(q); }
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-sm font-mono text-emerald-400 font-semibold">
                            {q.invoiceNo}
                          </span>
                          <StatusPill tone={PILL_TONE[q.status]}>{t(`stl.${q.status}`)}</StatusPill>
                        </div>
                        <p className="text-[var(--text-primary)] font-medium truncate">
                          {q.customerName || t("list.unnamedCustomer")}
                          {q.companyName ? ` - ${q.companyName}` : ""}
                        </p>
                        <p className="text-xs text-[var(--text-dim)] mt-0.5">
                          {q.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                          {fmtMoney(gt, q.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDuplicateFromList(q.id);
                          }}
                          disabled={busy}
                          className={`${rowAction} text-[var(--text-dim)] hover:text-emerald-400 hover:bg-emerald-500/10`}
                          title={t("list.duplicateHint")}
                          aria-label={t("list.duplicateHint")}
                        >
                          {busy ? <SpinnerIcon className="h-4 w-4" /> : <CopyIcon size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteFromList(q.id);
                          }}
                          className={`${rowAction} text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10`}
                          title={t("list.delete")}
                          aria-label={t("list.delete")}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {pages > 1 && (
              <Pagination
                className="mt-4"
                page={safePage}
                pages={pages}
                summary={`${(safePage - 1) * LIST_PAGE_SIZE + 1}–${Math.min(safePage * LIST_PAGE_SIZE, filteredQuotations.length)} / ${filteredQuotations.length}`}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(pages, p + 1))}
              />
            )}
            </>
          )}
        </div>
        {toastElement}
        {confirmDialog}
      </AuroraShell>
    );
  }

  /* ══════════════════════════════════════════════════════════
     EDITOR VIEW
     ══════════════════════════════════════════════════════════ */
  if (!current) return null;

  return (
    <AuroraShell className="text-[var(--text-primary)]">
      <style>{PRINT_AND_DOC_STYLES}</style>
      {/* ── ONE EDGE, NOT THREE ────────────────────────────────────────────
          Owner, on Product Data and again here: "you are using three blur edge
          and this is wrong, you only can use one but more longer." Glassing
          each bar on its own gave exactly that — the toolbar frosted, the
          status row frosted, the customer row frosted, three translucent
          strips stacked under the Hub header.

          One host, one progressive ramp, and the bars inside carry no frost of
          their own. --kx-ramp-top is 0 because nothing sits above this host
          inside it; the reach it needs is DOWNWARD, into the document, which
          is --kx-ramp-ext. The four <i> are the ramp — the class alone renders
          nothing. */}
      <div className="no-print relative kx-bar-host [--kx-ramp-top:0rem] [--kx-ramp-ext:2.5rem] [--kx-ramp-fade:1.25rem]">
        <div aria-hidden className="kx-glass-bar kx-bar-prog"><i /><i /><i /><i /></div>
        <div className="relative z-[1]">

      {/* ── Toolbar (dark bar above A4) ── */}
      <div
        className="no-print"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
        }}
      >
        {/* KDS buttons throughout — the toolbar used to carry ten copies of
            one hand-rolled class string with a raw text-gray-300 that never
            flipped in the light skin. Labels fold to icons under 640px so
            fifteen actions do not wrap into six rows of chrome on a phone. */}
        <Button variant="secondary" size="sm" onClick={requestExit} icon={<ArrowLeftIcon size={15} />}>
          {t("btn.back")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { panelsTouched.current = true; setHidePanels((v) => !v); }}
          title={hidePanels ? t("tb.showPanelsHint") : t("tb.hidePanelsHint")}
          icon={hidePanels ? <EyeIcon size={15} /> : <EyeOffIcon size={15} />}
        >
          <span className="hidden sm:inline">{hidePanels ? t("tb.showPanels") : t("tb.hidePanels")}</span>
        </Button>
        <div className="inline-flex items-center gap-1" role="group" aria-label={`${t("tb.undo")} / ${t("tb.redo")}`}>
          <Button variant="secondary" size="sm" onClick={() => setCurrent(HIST_UNDO)} disabled={histSize.past === 0} title={t("tb.undo")} aria-label={t("tb.undo")} icon={<Undo2Icon size={14} />} />
          <Button variant="secondary" size="sm" onClick={() => setCurrent(HIST_REDO)} disabled={histSize.future === 0} title={t("tb.redo")} aria-label={t("tb.redo")} icon={<Redo2Icon size={14} />} />
        </div>
        {/* Document heading — a top-level decision, so it sits in the
            toolbar rather than inside Quick Fill. */}
        <DocTitlePicker
          titleId={current.docTitleId}
          titleText={current.docTitleText}
          fallbackLabel="QUOTATION"
          onPick={({ id, text, noun, validity, code }) =>
            setCurrent((q) =>
              q ? { ...q, docTitleId: id, docTitleText: text, docTitleNoun: noun, docTitleValidity: validity, docTitleCode: code } : q,
            )
          }
        />
        <div style={{ flex: 1 }} />
        {/* ── Presence — who else is on this quotation right now ── */}
        {peers.length > 0 && (
          <div title={t("tb.peersTitle")} className="flex items-center gap-1.5 me-0.5" aria-live="polite">
            {peers.slice(0, 3).map((p) => (
              <StatusPill key={p.id} tone="neutral">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.status === "editing" ? "bg-amber-400" : "bg-emerald-400"}`} />
                {p.name.split(" ")[0]} {p.status === "editing" ? t("tb.editing") : t("tb.viewing")}
              </StatusPill>
            ))}
            {peers.length > 3 && (
              <span className="text-[11px] text-[var(--text-dim)]">+{peers.length - 3}</span>
            )}
          </div>
        )}
        {/* Unsaved-changes indicator (calm, only when idle + dirty). */}
        {dirty && saveState === "idle" && (
          <span title={t("tb.unsavedHint")}>
            <StatusPill tone="warning">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {t("tb.unsaved")}
            </StatusPill>
          </span>
        )}
        {/* Clickable status pill — opens a menu of transitions. The
            colour map mirrors the list-view row badge so the same
            quote reads the same in both views. */}
        <StatusMenu
          status={current.status}
          onChange={async (next) => {
            if (next === current.status) return;
            /* Transition + save in one round-trip. We reuse
               handleSave because it appends to statusHistory and
               updates updatedAt — duplicating that logic would
               drift over time. */
            await handleSave(next);
          }}
        />
        {/* Save state pill — gives the user explicit feedback that
            the save click was registered and what happened. Without
            this, both Save buttons did their network call silently
            and the user couldn't tell if anything was happening. */}
        {saveState !== "idle" && (
          <span title={saveError || undefined} role="status" aria-live="polite">
            <StatusPill tone={saveState === "saving" ? "brand" : saveState === "saved" ? "success" : "error"}>
              {saveState === "saving" && <><SpinnerIcon size={11} /> {t("quot.saving")}</>}
              {saveState === "saved" && <><CheckIcon size={10} /> {t("tb.saved")}</>}
              {saveState === "error" && <><CrossIcon size={10} /> {t("tb.saveFailed")}</>}
            </StatusPill>
          </span>
        )}
        <Button variant="secondary" size="sm" onClick={() => handleSave("draft")} disabled={saveState === "saving"}>
          {t("btn.saveDraft")}
        </Button>
        <Button variant="primary" size="sm" onClick={() => handleSave("final")} disabled={saveState === "saving"} loading={saveState === "saving"}>
          {t("btn.saveFinal")}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleDuplicate} title={t("tb.duplicateHint")} icon={<CopyIcon size={14} />}>
          <span className="hidden sm:inline">{t("btn.duplicate")}</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={handleConvertToInvoice} title={t("tip.convert")} icon={<DocumentIcon size={14} />}>
          <span className="hidden sm:inline">{t("btn.convertToInvoice")}</span>
        </Button>
        {current.status === "accepted" && (
          <Button variant="secondary" size="sm" onClick={handleCreateProject} title={t("tb.createProjectHint")} icon={<BriefcaseIcon size={14} />}>
            <span className="hidden sm:inline">{t("btn.createProject")}</span>
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportPdf}
          disabled={pdfState === "loading"}
          loading={pdfState === "loading"}
          title={t("tb.exportPdfHint")}
          icon={<DownloadIcon size={14} />}
        >
          <span className="hidden sm:inline">{pdfState === "loading" ? t("btn.opening") : t("btn.exportPDF")}</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExportExcel} disabled={excelBusy} loading={excelBusy} title={t("tb.exportExcelHint")} icon={<TableIcon size={14} />}>
          <span className="hidden sm:inline">{t("btn.exportExcel")}</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={handleSendEmail} title={t("tb.sendHint")} icon={<PaperPlaneIcon size={14} />}>
          <span className="hidden sm:inline">{t("btn.send")}</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={handlePrint} icon={<PrintIcon size={14} />}>
          <span className="hidden sm:inline">{t("btn.print")}</span>
        </Button>
        <Button variant="danger" size="sm" onClick={handleDeleteCurrent} icon={<TrashIcon size={14} />} title={t("btn.delete")} aria-label={t("btn.delete")} />
      </div>

      {/* ── Loading bar — full doc (items) is hydrating from the server ── */}
      {hydrating && (
        <div
          className="no-print"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 16px",             borderBottom: "1px solid var(--border-subtle)",
            fontSize: 12, color: "rgba(255,255,255,0.6)",
          }}
        >
          <SpinnerIcon size={14} />
          {t("tb.hydrating")}
        </div>
      )}

      {/* ── Realtime "updated by another user" notice ──
          When we have no unsaved edits the peer's save is applied live (see
          the auto-apply effect) and this pill is just a brief confirmation.
          When we DO have unsaved edits we never clobber them — the user
          chooses Load Latest or dismiss. */}
      {saveNotice && (
        <div
          className="no-print"
          style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            padding: "10px 16px",
            background: dirty ? "rgba(255,204,0,0.10)" : "rgba(51,133,255,0.10)",
            borderBottom: `1px solid ${dirty ? "rgba(255,204,0,0.30)" : "rgba(51,133,255,0.30)"}`,
            fontSize: 13, color: "rgba(255,255,255,0.88)",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dirty ? "#FFCC00" : "#3385FF", flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 180 }}>
            {(dirty ? t("collab.updatedDirty") : t("collab.applied")).split("{name}").map((part, i, arr) => (
              <span key={i}>{part}{i < arr.length - 1 && <b>{saveNotice.byName}</b>}</span>
            ))}
          </span>
          {dirty && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => askConfirm(t("collab.loadLatestConfirm"), async () => {
                  await loadLatest();
                  clearNotice();
                }, { confirmLabel: t("collab.loadLatest"), tone: "neutral" })}
              >
                {t("collab.loadLatest")}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearNotice}>
                {t("collab.ignore")}
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── Customer fields (dark row, above A4, not inside document) ── */}
      <div
        className="no-print"
        style={{
          display: "flex",
          gap: 12,
          padding: "12px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
              display: "block",
            }}
          >
            {t("field.customerName")}
          </label>
          <input
            type="text"
            value={current.customerName}
            onChange={(e) =>
              setCurrent({ ...current, customerName: e.target.value })
            }
            placeholder={t("field.customerPh")}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-white/40 transition"
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
              display: "block",
            }}
          >
            {t("field.companyName")}
          </label>
          <input
            type="text"
            value={current.companyName}
            onChange={(e) =>
              setCurrent({ ...current, companyName: e.target.value })
            }
            placeholder={t("field.companyPh")}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-white/40 transition"
          />
        </div>
      </div>
        </div>
      </div>

      {/* ── A4 Document (multi-page editor surface) ──
          The A4 paper, pagination, items table, action buttons,
          rich-text toolbar, notes panel, and footer (stamp /
          signature / bank / terms) all live in QuotationA4Preview. */}
      <div ref={fitHostRef} className="quot-fit-host">
      <div
        className="quot-fit-box"
        style={
          fitScale < 1
            ? {
                width: fitNeeded,
                transform: `scale(${fitScale})`,
                transformOrigin: "top left",
                /* The transform doesn't shrink the layout box, so without this
                   the editor would end with a tall band of empty page. */
                marginBottom: stackH ? -(stackH * (1 - fitScale)) : undefined,
              }
            : undefined
        }
      >
      <div ref={fitInnerRef}>
      <QuotationA4Preview
        current={current}
        /* The parent's Quotation type adds two fields the preview
           doesn't know about (statusHistory, customerContactId) and
           the preview's local type doesn't list them either, but the
           preview never modifies state — it only renders. Cast to
           bypass the structural-equality check on setState. */
        setCurrent={setCurrent as never}
        updateItem={updateItem}
        addItem={addItem}
        addHeader={addHeader}
        onPickFromCatalog={() => setPickerOpen(true)}
        onPickCustomer={() => setCustomerPickerOpen(true)}
        onSaveCustomer={saveCurrentPartyAsCustomer}
        savingCustomer={savingCustomer}
        savedStampUrl={savedStampUrl}
        savedSignatureUrl={savedSignatureUrl}
        isSuperAdmin={isSuperAdmin}
        onAttachSavedStamp={attachSavedStamp}
        onAttachSavedSignature={attachSavedSignature}
        onUploadStamp={(f) => uploadAsset("stamp", f)}
        onUploadSignature={(f) => uploadAsset("signature", f)}
        onClearStamp={clearStamp}
        onClearSignature={clearSignature}
        removeItem={removeItem}
        moveItem={moveItem}
        duplicateItem={duplicateItem}
        insertItemBelow={insertItemBelow}
        insertHeaderBelow={insertHeaderBelow}
        onInsertProductBelow={openCatalogAt}
        clearItem={clearItem}
        handleImageUpload={handleImageUpload}
        fileInputRefs={fileInputRefs}
        subTotal={subTotal}
        grandTotal={grandTotal}
        hidePanels={hidePanels}
        fmt={fmt}
        numberToWords={numberToWords}
      />
      </div>
      </div>
      </div>
      <ProductPickerModal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setInsertAtIdx(null); }}
        onPick={addItemFromCatalog}
      />
      <CustomerPickerModal
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onPick={applyCustomerPick}
      />

      {/* Unsaved-changes confirm — shown when the operator presses Back with
          pending edits. The elected KDS Modal: Escape and backdrop close it,
          primary action first. */}
      <KdsModal open={exitPromptOpen} onClose={() => setExitPromptOpen(false)} title={t("quot.unsavedTitle")}>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{t("quot.unsavedBody")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="md" disabled={saveState === "saving"} loading={saveState === "saving"} onClick={saveAndExit}>
            {t("quot.saveLeave")}
          </Button>
          <Button variant="danger" size="md" onClick={leaveEditor}>{t("quot.discardLeave")}</Button>
          <Button variant="ghost" size="md" onClick={() => setExitPromptOpen(false)}>{t("btn.cancel")}</Button>
        </div>
      </KdsModal>

      {/* ── Conflict dialog — save was BLOCKED because the quotation changed
            on the server since we loaded it. The stale write was rejected
            (never overwrote newer data). User chooses how to proceed. ── */}
      <KdsModal
        open={!!conflict}
        onClose={() => { if (!conflictBusy) setConflict(null); }}
        title={
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
            {t("conflict.title")}
          </span>
        }
      >
        {conflict && (
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {conflict.updated_by_name
              ? t("conflict.newerBy").split("{name}").map((part, i, arr) => (
                  <span key={i}>{part}{i < arr.length - 1 && <b className="text-[var(--text-primary)]">{conflict.updated_by_name}</b>}</span>
                ))
              : t("conflict.newer")}
            {conflict.updated_at ? ` (${fmtDateTimeDMY(conflict.updated_at)})` : ""}. {t("conflict.body")}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="md"
            disabled={conflictBusy}
            loading={conflictBusy}
            onClick={async () => {
              setConflictBusy(true);
              try { await loadLatest(); setConflict(null); }
              catch (e) { showToast(humanizeError(e), "error"); }
              finally { setConflictBusy(false); }
            }}
          >
            {t("conflict.loadLatest")}
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled={conflictBusy}
            onClick={async () => {
              if (!current) return;
              setConflictBusy(true);
              try {
                const copy = await saveQuotationAsCopy(current);
                if (copy) {
                  setCurrent(histRaw(copy));
                  setCurrent(HIST_RESET);
                  markSaved(copy);
                  if (typeof copy.version === "number") announceSavedRef.current(copy.version);
                  const list = await loadQuotationsRemote({ fresh: true });
                  setQuotations(list);
                }
                setConflict(null);
              } catch (e) {
                showToast(humanizeError(e), "error");
              } finally { setConflictBusy(false); }
            }}
          >
            {t("conflict.saveCopy")}
          </Button>
          <Button variant="ghost" size="md" disabled={conflictBusy} onClick={() => setConflict(null)}>
            {t("btn.cancel")}
          </Button>
        </div>
      </KdsModal>
      {/* Toast + confirm hosts, once per view. They used to sit inside the
          collab notice — which only renders while a peer has just saved AND
          the doc is dirty — so sixteen showToast() calls in this file had no
          element to render into and every failure was silent. */}
      {toastElement}
      {confirmDialog}
    </AuroraShell>
  );
}

/** Clickable status pill on the editor toolbar. Click to open a tiny
 *  dropdown of transitions; pick one to fire `onChange`. The colour
 *  map mirrors the list-view row badge so the same quote reads the
 *  same in both surfaces. */
function StatusMenu({
  status,
  onChange,
}: {
  status: QuoteStatus;
  onChange: (next: QuoteStatus) => void;
}) {
  const { t } = useTranslation(docsT);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* Colours come from doc-status's one ladder — this menu carried a
     byte-for-byte copy of it, which is how the two surfaces drift apart. */
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 h-[22px] ps-2 pe-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${statusTone(status)}`}
        title={t("stl.hint")}
      >
        {t(`stl.${status}`)}
        <ChevronDownIcon size={11} className="opacity-70" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-30 mt-1 flex min-w-[150px] flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1 shadow-xl shadow-black/40"
        >
          {QUOTE_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onChange(opt.value);
              }}
              disabled={opt.value === status}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-start text-xs font-medium ${
                opt.value === status
                  ? "opacity-50 cursor-default text-[var(--text-primary)]"
                  : "cursor-pointer text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full border ${statusTone(opt.value)}`} />
              {t(`stl.${opt.value}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
