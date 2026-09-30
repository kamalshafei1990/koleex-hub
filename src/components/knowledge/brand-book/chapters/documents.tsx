"use client";

/* Chapters 94–101: sales documents, contracts, shipping documents,
   purchase orders, finance documents, certificates, official letters &
   invitations, HR documents.

   These are not designs waiting to be built: Koleex Hub already produces
   the quotation, invoice, contract, packing list and purchase order in the
   house style. The chapters describe that system so anyone making a
   document outside the Hub makes it the same way. Values on the sheets are
   samples; numbers follow the Hub's real scheme (KL-QU-12349 …). */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  B, Bullets, Chapter, Code, Note, P, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { ItemsTable, Lines, Meta, Parties, Sheet, SignatureBlock, Strips } from "../mockups";

function Sheets({ children }: { children: ReactNode }) {
  return <Stage bg="#F5F5F7" h="auto" pad={24}><div className="flex flex-wrap items-start justify-center gap-6">{children}</div></Stage>;
}

const SELLER: [string, string[]] = ["Seller", [KOLEEX_COMPANY.en, "Taizhou, Zhejiang, China", KOLEEX_COMPANY.email]];
const BUYER: [string, string[]] = ["Buyer", ["Customer company", "City, Country", "Contact person"]];

/* ── 94 · Sales Documents ──────────────────────────────────────────────── */

export function SalesDocuments() {
  return (
    <Chapter
      n={94}
      lead={
        <p>
          Quotation, proforma invoice, commercial invoice: the three papers every customer receives. They
          share one sheet, one header, one deal number — so they read as one conversation with one company.
        </p>
      }
      toc={[
        { id: "house-sheet", title: "The house sheet" },
        { id: "quotation", title: "The quotation" },
        { id: "numbering", title: "Numbers and dates" },
        { id: "doc-rules", title: "Rules for every document" },
      ]}
    >
      <Section id="house-sheet" title="The house sheet">
        <Rule why="210 × 270 mm fits both A4 and US Letter without blank second pages — customers in Egypt, the Gulf and the Americas print the same file.">
          Every KOLEEX business document is set on the 210 × 270 mm house sheet, made in Koleex Hub.
        </Rule>
        <Specs rows={[
          ["Header", "Logo at the start, 45 mm; document title at the end, capitals"],
          ["Legal lockup", "Black line with the legal name in English and Chinese over the grey tagline strip (ch. 43)"],
          ["Blocks", "12 px corners, hairline borders, black uppercase labels over white values"],
          ["Tables", "Black head, hairline rows, numbers right-aligned in monospace, black total bar (ch. 62)"],
          ["Footer", "\"Page N of M\" on every sheet; later sheets repeat a compact header"],
          ["Colors", "Black #000000, Graphite #1D1D1F, Gray #6E6E73, Mist #D2D2D7, Cloud #F5F5F7 — no Hub Blue on documents"],
        ]} />
      </Section>

      <Section id="quotation" title="The quotation">
        <Sheets>
          <Sheet w={300} title="QUOTATION">
            <Meta items={[["Quotation no.", "KL-QU-12349"], ["Date", "27/09/2026"], ["Valid until", "27/10/2026"], ["Incoterm", "FOB Shanghai"]]} />
            <Parties left={SELLER} right={BUYER} />
            <ItemsTable
              head={["#", "Description", "Qty", "Unit price", "Amount"]}
              rows={[["1", "Machine model — description", "10", "USD 0.00", "USD 0.00"], ["2", "Spare parts kit", "10", "USD 0.00", "USD 0.00"]]}
              total={["", "Total (sample)", "20", "", "USD 0.00"]}
            />
            <div className="grid grid-cols-2 gap-1">
              <Meta cols={1} items={[["Payment terms", "30% deposit, 70% before shipment"], ["Delivery time", "35 days after deposit"]]} />
              <Meta cols={1} items={[["Loading port", "Shanghai"], ["Packing", "Export wooden case"]]} />
            </div>
            <SignatureBlock labels={["For KOLEEX"]} />
          </Sheet>
        </Sheets>
        <Note>All values shown are samples. Terms and prices are set per deal in Koleex Hub.</Note>
      </Section>

      <Section id="numbering" title="Numbers and dates">
        <Table
          head={["Document", "Number"]}
          rows={[
            ["Quotation", <Code key="a">KL-QU-12349</Code>],
            ["Proforma / commercial invoice", <Code key="a">KL-IN-12349</Code>],
            ["Sales contract", <Code key="a">KL-CN-12349</Code>],
            ["Packing list", <Code key="a">KL-PL-12349</Code>],
            ["Purchase order", <Code key="a">KL-PO-12349</Code>],
          ]}
        />
        <P>One deal, one number: every document of the same deal carries it. Dates are always DD/MM/YYYY; amounts carry the currency code before the number (USD 12,500.00).</P>
      </Section>

      <Section id="doc-rules" title="Rules for every document">
        <Bullets items={[
          <><B>Made in Koleex Hub.</B> Never rebuild a quotation or invoice in Word or Excel — the Hub keeps the numbers, the terms and the history right.</>,
          "The registered legal name, exactly — never a trading name on a legal document.",
          "No Hub Blue, no gradients, no photographs of people on business documents.",
          "PDF for sending; the file name is the document number.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 95 · Contracts ────────────────────────────────────────────────────── */

export function Contracts() {
  return (
    <Chapter
      n={95}
      lead={
        <p>
          The sales contract is built from the same sheet as the invoice beside it. Because it carries
          signatures, it adds three protections: initials on every page, signatures kept with the last terms,
          and a signed contract that can no longer be changed.
        </p>
      }
      toc={[
        { id: "contract", title: "The contract" },
        { id: "protections", title: "Three protections" },
      ]}
    >
      <Section id="contract" title="The contract">
        <Sheets>
          <Sheet w={260} title="SALES CONTRACT" page="Page 1 of 3">
            <Meta items={[["Contract no.", "KL-CN-12349"], ["Date", "27/09/2026"], ["Place", "Taizhou"], ["Currency", "USD"]]} />
            <Parties left={SELLER} right={BUYER} />
            <Lines n={10} />
            <div className="flex justify-end"><div className="rounded-[3px] border border-[#000000] px-2 py-1 text-[4px] uppercase tracking-[0.08em]">Initials · Seller / Buyer</div></div>
          </Sheet>
          <Sheet w={260} title="SALES CONTRACT" page="Page 3 of 3">
            <Lines n={6} />
            <Meta cols={2} items={[["Governing law", "As agreed"], ["Disputes", "As agreed"]]} />
            <SignatureBlock />
            <div className="flex justify-end"><div className="rounded-[3px] border border-[#000000] px-2 py-1 text-[4px] uppercase tracking-[0.08em]">Initials · Seller / Buyer</div></div>
          </Sheet>
        </Sheets>
      </Section>

      <Section id="protections" title="Three protections">
        <Table
          head={["Protection", "Why"]}
          rows={[
            [<B key="a">An initials box on every page</B>, "A page that can be swapped with nothing on it to show it is a risk"],
            [<B key="a">Signatures on the page with the last terms</B>, "A signature page with no terms on it can be attached to terms nobody agreed to"],
            [<B key="a">Signed means frozen</B>, "Once signed in the Hub, the contract cannot be edited; changes are a new amendment"],
          ]}
        />
        <Note tone="warn">Chinese documents are also sealed with the company seal (公章). Koleex Hub places the seal at its real size — 40 mm — where the document needs it. The seal image is never copied, resized or pasted into other files by hand, and only authorised staff release sealed documents.</Note>
      </Section>
    </Chapter>
  );
}

/* ── 96 · Shipping Documents ───────────────────────────────────────────── */

export function ShippingDocuments() {
  return (
    <Chapter
      n={96}
      lead={
        <p>
          The packing list travels with the goods and is read by customs officers, forwarders and the
          customer’s warehouse. It is built to be checked quickly: every carton, every weight, every
          total.
        </p>
      }
      toc={[
        { id: "packing-list", title: "The packing list" },
        { id: "ship-rules", title: "Rules" },
      ]}
    >
      <Section id="packing-list" title="The packing list">
        <Sheets>
          <Sheet w={300} title="PACKING LIST">
            <Meta items={[["Packing list no.", "KL-PL-12349"], ["Date", "27/09/2026"], ["Invoice no.", "KL-IN-12349"], ["Container", "1 × 40' HQ"]]} />
            <Parties left={["Shipper", [KOLEEX_COMPANY.en, "Taizhou, Zhejiang, China"]]} right={["Consignee", ["Customer company", "City, Country"]]} />
            <ItemsTable
              head={["#", "Description", "Qty", "N.W. kg", "G.W. kg"]}
              rows={[["1/12", "Machine head", "1", "38.0", "45.5"], ["2/12", "Table and stand", "1", "32.5", "36.0"], ["3/12", "Motor and accessories", "1", "6.8", "8.2"]]}
              total={["", "Total (sample)", "3", "77.3", "89.7"]}
            />
            <Meta cols={3} items={[["Packages", "12 cartons"], ["Volume", "2.85 CBM"], ["Origin", "China"]]} />
          </Sheet>
        </Sheets>
      </Section>

      <Section id="ship-rules" title="Rules">
        <Bullets items={[
          "The packing list follows the order in Koleex Hub — it is linked to the deal, never retyped.",
          "Carton numbers as \"n/N\"; the same numbers appear on the cartons (ch. 111).",
          "Weights in kg with one decimal; volume in CBM with two.",
          "Shipping marks, cartons and labels: Part 6 (ch. 110–111).",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 97 · Purchase Orders ──────────────────────────────────────────────── */

export function PurchaseOrders() {
  return (
    <Chapter
      n={97}
      lead={
        <p>
          A purchase order is our instruction to a supplier. It goes to China, so it is bilingual — English
          and Chinese — and it is as exact as the documents we send to customers.
        </p>
      }
      toc={[
        { id: "po", title: "The purchase order" },
        { id: "po-rules", title: "Rules" },
      ]}
    >
      <Section id="po" title="The purchase order">
        <Sheets>
          <Sheet w={280} title="PURCHASE ORDER 采购订单">
            <Meta items={[["PO no. 订单号", "KL-PO-12349"], ["Date 日期", "27/09/2026"], ["Delivery 交期", "30/10/2026"], ["Currency 币种", "CNY"]]} />
            <Parties left={["Buyer 买方", [KOLEEX_COMPANY.en, KOLEEX_COMPANY.zh]]} right={["Supplier 供应商", ["Supplier name", "City"]]} />
            <ItemsTable head={["#", "Item 品名", "Qty 数量", "Unit 单价", "Amount 金额"]} rows={[["1", "Machine head 机头", "10", "CNY 0.00", "CNY 0.00"]]} total={["", "Total 合计", "10", "", "CNY 0.00"]} />
            <Meta cols={1} items={[["Requirements 要求", "KOLEEX nameplate and packing per KOLEEX specifications 按照 KOLEEX 规范贴铭牌及包装"]]} />
          </Sheet>
        </Sheets>
      </Section>

      <Section id="po-rules" title="Rules">
        <Bullets items={[
          "Labels in English and Chinese; the Chinese legal name of KOLEEX appears in full.",
          "The PO states KOLEEX branding and packing requirements, so machines arrive ready to sell as KOLEEX.",
          "A purchase order is confidential: never forwarded to customers, and supplier names never appear on customer documents.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 98 · Finance Documents ────────────────────────────────────────────── */

export function FinanceDocuments() {
  return (
    <Chapter
      n={98}
      lead={
        <p>
          Receipts, statements of account and credit notes follow the house sheet. Because they carry money
          and bank details, they carry extra care too.
        </p>
      }
      toc={[
        { id: "finance-docs", title: "Documents" },
        { id: "bank", title: "Bank details" },
      ]}
    >
      <Section id="finance-docs" title="Documents">
        <Table
          head={["Document", "Shows"]}
          rows={[
            [<B key="a">Receipt</B>, "Amount received, date, method, the deal number it belongs to"],
            [<B key="a">Statement of account</B>, "Every invoice and payment for one customer, running balance, date range"],
            [<B key="a">Credit note</B>, "What is credited, why, and the invoice it refers to"],
          ]}
        />
      </Section>

      <Section id="bank" title="Bank details">
        <Rule why="Invoice fraud usually starts with changed bank details. One source, never retyped, protects our customers and us.">
          Bank details appear only on invoices and statements produced by Koleex Hub, and are never sent
          in a chat message or changed by email.
        </Rule>
        <Bullets items={[
          "Account numbers are shown in full only on the document the customer pays from; everywhere else only the last four digits.",
          "If a customer is told that our bank details have changed, they must confirm by phone with a person they know.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 99 · Certificates ─────────────────────────────────────────────────── */

export function Certificates() {
  return (
    <Chapter
      n={99}
      lead={
        <p>
          Warranty and training certificates are documents people keep. They are formal, landscape, and
          quietly branded — the logo, a clear title, the facts, a real signature.
        </p>
      }
      toc={[
        { id: "certificate", title: "The certificate" },
        { id: "cert-rules", title: "Rules" },
      ]}
    >
      <Section id="certificate" title="The certificate">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="relative w-[340px] overflow-hidden rounded bg-white p-5 text-center text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "297 / 210" }}>
            <div className="flex justify-center"><Wordmark color="#000000" width={70} /></div>
            <p className="mt-4 text-[7px] font-semibold uppercase tracking-[0.3em] text-[#6E6E73]">Certificate of Training</p>
            <p className="mt-2 text-[15px] font-bold">Full Name</p>
            <p className="mt-1 text-[6.5px] text-[#6E6E73]">has completed the operation and maintenance training for overlock machines</p>
            <div className="mt-4 flex justify-center gap-8 text-[5.5px]"><div><div className="h-3 w-16 border-b border-[#000000]" /><p className="mt-0.5">Trainer</p></div><div><p className="font-mono">27/09/2026</p><p className="mt-0.5 text-[#6E6E73]">Date</p></div><div><p className="font-mono">KL-TC-0001</p><p className="mt-0.5 text-[#6E6E73]">Certificate no.</p></div></div>
            <div className="absolute inset-x-0 bottom-0"><Strips /></div>
          </div>
        </Stage>
      </Section>

      <Section id="cert-rules" title="Rules">
        <Bullets items={[
          "A4 landscape; logo centered at the top; the legal lockup at the foot.",
          "Every certificate has a number and is recorded, so it can be verified.",
          "A warranty certificate states the machine model, serial number, start date and terms — nothing it does not cover.",
          "No gold, ribbons, seals or decorations that imitate official documents — no seal around the logo (ch. 40; owner, 01/10/2026). A fine double frame is allowed (owner's choice, 28/09/2026).",
          "Made in Brand Center → Templates → Certificate: seven kinds with their own wording in English, Chinese or Arabic, eight styles, one or two signatures, and the legal name of the issue date at the foot.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 100 · Official Letters & Invitations ──────────────────────────────── */

export function Letters() {
  return (
    <Chapter
      n={100}
      lead={
        <p>
          Some letters carry legal weight: a visa invitation, a confirmation of employment, an authorisation.
          They use the letterhead (ch. 92) and follow the formal rules of the country that will read them.
        </p>
      }
      toc={[
        { id: "invitation", title: "Invitation letters" },
        { id: "letter-rules", title: "Rules" },
      ]}
    >
      <Section id="invitation" title="Invitation letters">
        <P>Koleex Hub produces visa invitation letters for customers visiting us in China, in English and Chinese, with the company’s registered address exactly as on the business licence.</P>
        <Specs rows={[
          ["Language", "English and Chinese; the Chinese text is the reference for Chinese authorities"],
          ["Company details", "The legal name and the licence address, verbatim"],
          ["Visitor details", "Full name as in the passport, passport number, dates of the visit, purpose"],
          ["Signature", "The legal representative or an authorised signatory, with the company seal"],
        ]} />
      </Section>

      <Section id="letter-rules" title="Rules">
        <Bullets items={[
          "Only the Hub's templates are used for letters with legal force — never an old letter edited.",
          "The company seal (公章) is placed by the Hub at its real 40 mm size, across the signature line — never pasted into a file by hand.",
          "Dates in words and numbers where a government form asks for it; otherwise DD/MM/YYYY.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 101 · HR Documents ────────────────────────────────────────────────── */

export function HrDocuments() {
  return (
    <Chapter
      n={101}
      lead={
        <p>
          Offer letters, employment contracts, payslips, ID badges and experience certificates tell our own
          people who we are. They get the same care as anything a customer sees — and more privacy.
        </p>
      }
      toc={[
        { id: "hr-docs", title: "Documents" },
        { id: "badge", title: "The ID badge" },
        { id: "hr-privacy", title: "Privacy" },
      ]}
    >
      <Section id="hr-docs" title="Documents">
        <Table
          head={["Document", "Format"]}
          rows={[
            [<B key="a">Offer letter</B>, "Letterhead (ch. 92), in the employee's language plus English"],
            [<B key="a">Employment contract</B>, "House sheet with initials and signatures like the sales contract (ch. 95)"],
            [<B key="a">Payslip</B>, "Produced by Koleex Hub; amounts right-aligned, month and dates DD/MM/YYYY"],
            [<B key="a">Experience certificate</B>, "Letterhead, signed by HR, with the company seal"],
          ]}
        />
      </Section>

      <Section id="badge" title="The ID badge">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex h-[200px] w-[127px] flex-col items-center overflow-hidden rounded-lg bg-white text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">
            <div className="flex h-12 w-full items-center justify-center bg-[#000000]"><Wordmark color="#FFFFFF" width={64} /></div>
            <div className="mt-3 h-16 w-14 rounded bg-[#D2D2D7]" />
            <p className="mt-2 text-[9px] font-bold">Full Name</p>
            <p className="text-[7px] text-[#6E6E73]">Job Title</p>
            <p className="mt-auto mb-2 font-mono text-[6px] text-[#6E6E73]">ID 0001</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Size", "54 × 86 mm, portrait (standard card)"],
          ["Photo", "The team portrait (ch. 66)"],
          ["Content", "Name, job title, staff number — no personal data beyond that"],
        ]} />
      </Section>

      <Section id="hr-privacy" title="Privacy">
        <Bullets items={[
          "Salary and personal data appear only on documents addressed to that employee.",
          "HR documents are never used as examples, templates or screenshots with real data.",
        ]} />
      </Section>
    </Chapter>
  );
}
