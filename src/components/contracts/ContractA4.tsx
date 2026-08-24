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
}

function ContractA4Inner(props: ContractA4Props) {
  const frozen = props.snapshot ?? null;
  const band = BANDS[props.status];

  const terms = (frozen?.terms ?? props.terms) as ContractTerms;
  const articles: RenderedArticle[] = frozen?.articles ?? articlesFor(terms);
  const buyer = (frozen?.buyer ?? terms.buyer ?? {}) as Record<string, string | undefined>;

  const items: ScheduleItem[] = frozen ? frozen.schedule.items : invoiceItems(props.invoice);
  const currency = frozen?.currency ?? props.currency ?? props.invoice?.currency ?? "";
  const total = frozen?.total ?? props.total ?? props.invoice?.total ?? 0;
  const invoiceNo = frozen?.schedule.invoiceNo ?? props.invoice?.inv_no ?? null;
  const contractDate = frozen?.contractDate ?? props.contractDate;

  return (
    <div
      className="quot-a4-doc"
      style={{
        width: "210mm",
        minHeight: "297mm",
        background: "#fff",
        color: T.ink,
        padding: "0 16mm 18mm",
        fontFamily: "inherit",
        fontSize: 11,
        lineHeight: 1.5,
        margin: "0 auto",
        boxShadow: "0 2px 24px rgba(0,0,0,0.28)",
      }}
    >
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
                    <div style={{ fontWeight: 600 }}>{it.name || it.description || "—"}</div>
                    {it.description && it.name ? (
                      <div style={{ color: T.inkSoft, fontSize: 9.5 }}>{it.description}</div>
                    ) : null}
                  </Td>
                  <Td style={{ fontFamily: T.mono, fontSize: 9.5 }}>{(it as { model?: string }).model ?? "—"}</Td>
                  <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.qty ?? "—"}</Td>
                  <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(it.price, currency)}</Td>
                  <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {money(Number(it.qty ?? 0) * Number(it.price ?? 0), currency)}
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

      {/* ── The facts a reader checks first ── */}
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

      {/* ── Articles ── */}
      <SectionBar>General Terms and Conditions</SectionBar>
      <ol style={{ margin: "0 0 14px", padding: 0, listStyle: "none" }}>
        {articles.map((a) => (
          <li key={a.key ?? a.n} style={{ marginBottom: 9, breakInside: "avoid" }}>
            <div style={{ fontWeight: 700, fontSize: 10.5, color: T.black }}>
              {a.n}. {a.title}
            </div>
            <div style={{ whiteSpace: "pre-wrap", textAlign: "justify", fontSize: 10, color: T.ink }}>{a.body}</div>
          </li>
        ))}
      </ol>

      {/* Anything negotiated for this deal alone outranks the general terms,
          so it prints after them and says so. */}
      {(terms.specialConditions ?? []).length > 0 && (
        <>
          <SectionBar>Special Conditions</SectionBar>
          <p style={{ margin: "0 0 6px", fontSize: 9.5, color: T.inkSoft }}>
            Where these conflict with the General Terms above, these prevail.
          </p>
          <ol style={{ margin: "0 0 14px", paddingInlineStart: 18, fontSize: 10 }}>
            {(terms.specialConditions ?? []).map((c, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {c}
              </li>
            ))}
          </ol>
        </>
      )}

      {/* ── Signatures ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18, breakInside: "avoid" }}>
        <SignBlock role="For and on behalf of the SELLER" party={KOLEEX_COMPANY.en} />
        <SignBlock role="For and on behalf of the BUYER" party={buyer.company || buyer.name || "—"} />
      </div>

      {frozen ? (
        <div style={{ marginTop: 14, fontFamily: T.mono, fontSize: 8, color: T.inkGhost, textAlign: "center" }}>
          Executed {dmy(frozen.frozenAt)} · terms edition {frozen.termsVersion} · this text is fixed and no longer
          follows later changes.
        </div>
      ) : null}
    </div>
  );
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

function SignBlock({ role, party }: { role: string; party: string }) {
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
        <div style={{ fontSize: 10.5, fontWeight: 700, marginBottom: 28 }}>{party}</div>
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
