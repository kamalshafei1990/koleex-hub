"use client";

/* ---------------------------------------------------------------------------
   The printed sales contract.

   Kept in its own file, and memoised, because it re-renders the entire
   document — twenty articles of prose plus the schedule — and the editor
   beside it changes on every keystroke. Sharing a component would mean
   re-laying-out the whole contract to type one character into a port name.

   Reads either the LIVE terms (draft) or the frozen `snapshot` (signed).
   Never both: a signed contract must not consult anything that can still
   change, and a draft must follow corrections made to the invoice.
   --------------------------------------------------------------------------- */

import { memo } from "react";
import { articlesFor, type RenderedArticle } from "@/lib/contracts/general-terms";
import type { ContractTerms, InvoiceLite, SnapshotShape } from "./types";

const SELLER = {
  name: "Koleex International Corporation Taizhou Co., Ltd.",
  address: "Taizhou, Zhejiang, China",
};

/** Day/Month/Year everywhere — the house rule, and the only unambiguous
    reading for a document crossing between markets. */
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

const T = {
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
};

export interface ContractA4Props {
  contractNo: string;
  status: string;
  contractDate?: string | null;
  placeOfSigning?: string | null;
  currency?: string | null;
  total?: number | null;
  terms: ContractTerms;
  invoice: InvoiceLite | null;
  /** Present only once signed. When present it wins over everything above. */
  snapshot?: SnapshotShape | null;
}

function ContractA4Inner(props: ContractA4Props) {
  const frozen = props.snapshot ?? null;

  const terms = (frozen?.terms ?? props.terms) as ContractTerms;
  const articles: RenderedArticle[] = frozen?.articles ?? articlesFor(terms);
  const buyer = (frozen?.buyer ?? terms.buyer ?? {}) as Record<string, string | undefined>;

  const items = frozen
    ? frozen.schedule.items
    : (invoiceItems(props.invoice));
  const currency = frozen?.currency ?? props.currency ?? props.invoice?.currency ?? "";
  const total = frozen?.total ?? props.total ?? props.invoice?.total ?? 0;
  const invoiceNo = frozen?.schedule.invoiceNo ?? props.invoice?.inv_no ?? null;

  return (
    <div
      className="quot-a4-doc"
      style={{
        width: "210mm",
        minHeight: "297mm",
        background: "#fff",
        color: "#111",
        padding: "18mm 16mm",
        fontFamily: T.serif,
        fontSize: 11,
        lineHeight: 1.55,
        margin: "0 auto",
        boxShadow: "0 2px 24px rgba(0,0,0,0.28)",
      }}
    >
      {/* ── Heading ── */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #111", paddingBottom: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.14em" }}>SALES CONTRACT</div>
        <div style={{ marginTop: 6, fontFamily: T.mono, fontSize: 11, letterSpacing: "0.04em" }}>
          {props.contractNo}
          <span style={{ margin: "0 10px", color: "#999" }}>|</span>
          Date: {dmy(frozen?.contractDate ?? props.contractDate)}
          {invoiceNo ? (
            <>
              <span style={{ margin: "0 10px", color: "#999" }}>|</span>
              Invoice: {invoiceNo}
            </>
          ) : null}
        </div>
      </div>

      {/* A draft says so on its face. Nothing is worse than a buyer signing
          a version that was still being edited. */}
      {props.status !== "signed" && (
        <div
          style={{
            border: "1px dashed #b45309",
            color: "#b45309",
            fontFamily: T.mono,
            fontSize: 9,
            letterSpacing: "0.14em",
            textAlign: "center",
            padding: "4px 0",
            marginBottom: 14,
          }}
        >
          {props.status === "ready" ? "AWAITING SIGNATURE" : "DRAFT — NOT FOR SIGNATURE"}
        </div>
      )}

      {/* ── Parties ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 16 }}>
        <Party label="SELLER" lines={[SELLER.name, SELLER.address]} />
        <Party
          label="BUYER"
          lines={[
            buyer.company || buyer.name || "—",
            buyer.company && buyer.name ? buyer.name : "",
            buyer.address || "",
            [buyer.email, buyer.phone].filter(Boolean).join("  ·  "),
            buyer.acid ? `ACID No: ${buyer.acid}` : "",
          ].filter(Boolean) as string[]}
        />
      </div>

      <p style={{ margin: "0 0 16px" }}>
        This Contract is made on {dmy(frozen?.contractDate ?? props.contractDate)}
        {(frozen?.placeOfSigning ?? props.placeOfSigning) ? ` at ${frozen?.placeOfSigning ?? props.placeOfSigning}` : ""} between
        the Seller and the Buyer named above, who agree to the sale and purchase of the Goods described in the
        Commercial Schedule below on the terms that follow.
      </p>

      {/* ── Commercial schedule ── */}
      <SectionTitle>Commercial Schedule</SectionTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, fontSize: 10 }}>
        <thead>
          <tr style={{ background: "#f2f2f2" }}>
            <Th style={{ width: 26 }}>#</Th>
            <Th>Description</Th>
            <Th style={{ width: 54, textAlign: "right" }}>Qty</Th>
            <Th style={{ width: 76, textAlign: "right" }}>Unit price</Th>
            <Th style={{ width: 86, textAlign: "right" }}>Amount</Th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <Td colSpan={5} style={{ textAlign: "center", color: "#888", padding: "14px 6px" }}>
                No goods on the linked invoice.
              </Td>
            </tr>
          ) : (
            items.map((it, i) => (
              <tr key={i}>
                <Td style={{ textAlign: "center", fontFamily: T.mono }}>{i + 1}</Td>
                <Td>
                  <div style={{ fontWeight: 600 }}>{it.name || it.description || "—"}</div>
                  {it.description && it.name ? (
                    <div style={{ color: "#555", fontSize: 9.5 }}>{it.description}</div>
                  ) : null}
                </Td>
                <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.qty ?? "—"}</Td>
                <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(it.price, currency)}</Td>
                <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {money(Number(it.qty ?? 0) * Number(it.price ?? 0), currency)}
                </Td>
              </tr>
            ))
          )}
          <tr>
            <Td colSpan={4} style={{ textAlign: "right", fontWeight: 700, borderTop: "2px solid #111" }}>
              TOTAL CONTRACT VALUE
            </Td>
            <Td
              style={{
                textAlign: "right",
                fontWeight: 700,
                borderTop: "2px solid #111",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {money(total, currency)}
            </Td>
          </tr>
        </tbody>
      </table>

      {/* The facts a reader checks first, pulled out of the prose. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 18px", marginBottom: 16, fontSize: 10 }}>
        <Fact k="Delivery term" v={terms.incoterm ? `${terms.incoterm} ${terms.incotermPlace ?? ""}`.trim() : "—"} />
        <Fact k="Payment" v={terms.paymentLabel ?? "—"} />
        <Fact k="Port of loading" v={terms.loadingPort ?? "—"} />
        <Fact k="Port of discharge" v={terms.dischargePort ?? "—"} />
        <Fact
          k="Delivery time"
          v={terms.leadTimeDays ? `${terms.leadTimeDays} days ${basisWords(terms.leadTimeBasis)}` : "—"}
        />
        <Fact k="Warranty" v={terms.warrantyMonths ? `${terms.warrantyMonths} months` : "—"} />
      </div>

      {/* ── Articles ── */}
      <SectionTitle>General Terms and Conditions</SectionTitle>
      <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {articles.map((a) => (
          <li key={a.key ?? a.n} style={{ marginBottom: 9, breakInside: "avoid" }}>
            <div style={{ fontWeight: 700, fontSize: 10.5 }}>
              {a.n}. {a.title}
            </div>
            <div style={{ whiteSpace: "pre-wrap", textAlign: "justify", fontSize: 10 }}>{a.body}</div>
          </li>
        ))}
      </ol>

      {/* Anything negotiated for this deal alone outranks the general terms,
          so it prints after them and says so. */}
      {(terms.specialConditions ?? []).length > 0 && (
        <>
          <SectionTitle>Special Conditions</SectionTitle>
          <p style={{ margin: "0 0 6px", fontSize: 9.5, color: "#555" }}>
            Where these conflict with the General Terms above, these prevail.
          </p>
          <ol style={{ margin: "0 0 14px", paddingInlineStart: 18, fontSize: 10 }}>
            {(terms.specialConditions ?? []).map((c, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{c}</li>
            ))}
          </ol>
        </>
      )}

      {/* ── Signatures ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 22, breakInside: "avoid" }}>
        <SignBlock role="For and on behalf of the SELLER" party={SELLER.name} />
        <SignBlock role="For and on behalf of the BUYER" party={buyer.company || buyer.name || "—"} />
      </div>

      {frozen ? (
        <div style={{ marginTop: 14, fontFamily: T.mono, fontSize: 8, color: "#888", textAlign: "center" }}>
          Executed {dmy(frozen.frozenAt)} · terms edition {frozen.termsVersion} · this text is fixed and no longer
          follows later changes.
        </div>
      ) : null}
    </div>
  );
}

function invoiceItems(inv: InvoiceLite | null) {
  const raw = (inv?.doc as { items?: unknown } | undefined)?.items;
  return Array.isArray(raw) ? (raw as SnapshotShape["schedule"]["items"]) : [];
}

function basisWords(b?: string): string {
  if (b === "after_lc_opening") return "after receipt of the operative credit";
  if (b === "after_order") return "from the date of this Contract";
  return "after receipt of the advance payment";
}

const Party = ({ label, lines }: { label: string; lines: string[] }) => (
  <div style={{ border: "1px solid #ddd", padding: "8px 10px" }}>
    <div style={{ fontFamily: T.mono, fontSize: 8.5, letterSpacing: "0.14em", color: "#666", marginBottom: 4 }}>
      {label}
    </div>
    {lines.map((l, i) => (
      <div key={i} style={{ fontWeight: i === 0 ? 700 : 400, fontSize: i === 0 ? 11 : 10 }}>
        {l}
      </div>
    ))}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontFamily: T.mono,
      fontSize: 9,
      letterSpacing: "0.18em",
      color: "#111",
      borderBottom: "1px solid #111",
      paddingBottom: 3,
      marginBottom: 8,
      marginTop: 4,
    }}
  >
    {String(children).toUpperCase()}
  </div>
);

const Th = ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
  <th style={{ border: "1px solid #ccc", padding: "5px 6px", textAlign: "left", fontSize: 9.5, ...style }}>{children}</th>
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
  <td colSpan={colSpan} style={{ border: "1px solid #ddd", padding: "5px 6px", verticalAlign: "top", ...style }}>
    {children}
  </td>
);

const Fact = ({ k, v }: { k: string; v: string }) => (
  <div style={{ display: "flex", gap: 8 }}>
    <span style={{ color: "#666", minWidth: 108 }}>{k}</span>
    <span style={{ fontWeight: 600 }}>{v}</span>
  </div>
);

const SignBlock = ({ role, party }: { role: string; party: string }) => (
  <div>
    <div style={{ fontSize: 9.5, color: "#555", marginBottom: 30 }}>{role}</div>
    <div style={{ borderTop: "1px solid #111", paddingTop: 4, fontSize: 9.5 }}>
      <div style={{ fontWeight: 700 }}>{party}</div>
      <div style={{ color: "#666", marginTop: 12 }}>Name / Title: ______________________</div>
      <div style={{ color: "#666", marginTop: 8 }}>Date: ______________________</div>
    </div>
  </div>
);

/* The editor beside this changes on every keystroke; the contract only needs
   to redraw when something it actually prints has changed. */
export default memo(ContractA4Inner);
