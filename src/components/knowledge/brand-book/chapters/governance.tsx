"use client";

/* Chapters 132–135 and 137–140: legal & claims, using CE & ISO 9001,
   approvals, file naming, the templates library, pre-publish checklists,
   FAQ, versions & contact. (136, Downloads, lives in downloads.tsx.)

   Governance is what keeps 140 chapters true after the day they are
   written: who approves, how files are named and found, what may be
   claimed, and where to ask. */

import { useState, type ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import {
  B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { Strips } from "../mockups";
import { BOOK_CHAPTERS, BOOK_VERSION } from "@/lib/brand-book/chapters";
import { LEGAL_NAME_EN } from "@/lib/legal-name";

const MONO = { fontFamily: "ui-monospace,'SF Mono',Menlo,Consolas,monospace" } as const;

/* ── 132 · Legal & Claims ──────────────────────────────────────────────── */

export function LegalClaims() {
  return (
    <Chapter
      n={132}
      lead={
        <p>
          Everything KOLEEX says in public is a promise someone can hold us to — a customer, a competitor or a
          regulator. So we claim only what is true, what we can prove, and what the law of that market allows.
        </p>
      }
      toc={[
        { id: "names", title: "Names and trademark symbols" },
        { id: "claims", title: "Claims" },
        { id: "china-ads", title: "Advertising in China" },
        { id: "lines", title: "Standard legal lines" },
      ]}
    >
      <Section id="names" title="Names and trademark symbols">
        <Specs rows={[
          ["Legal name (English)", `${LEGAL_NAME_EN} — formal documents only, from 01/10/2026`],
          ["Legal name (Chinese)", KOLEEX_COMPANY.zh],
          ["Trading name", "KOLEEX International Group — the everyday name"],
          ["Trademark", "KOLEEX, registration No. 74343050"],
          ["In running text", "KOLEEX — always in capitals; the logo is never typed (ch. 36)"],
        ]} />
        <Rule why="Marking an unregistered name as registered is illegal in China and counts as misleading advertising in many other markets.">
          Use ® only in the countries where KOLEEX is registered, and only once per page, at the first mention.
          Where you are not sure, use no symbol.
        </Rule>
        <P>Contracts, invoices and official letters use the legal name; marketing uses the trading name. The full rules for names are in <Ref n={19} />.</P>
      </Section>

      <Section id="claims" title="Claims">
        <Table
          head={["Say", "Never say"]}
          rows={[
            ["Up to 5,000 stitches per minute (from our test report)", "The fastest machine in the world"],
            ["Serving customers in more than N countries (from our records)", "Trusted everywhere"],
            ["Since 1955", "The oldest name in the industry"],
            ["Built for knitwear", "Perfect for every fabric"],
            ["Compared with our previous model: 20% less noise (measured)", "Quieter than Juki, Brother or Jack"],
          ]}
        />
        <Bullets items={[
          "Every number has a source we can show: a test report, our sales records, a customer’s own figure.",
          "Competitors are never named in marketing. Comparisons are with our own machines.",
          "“Free”, “guaranteed”, “lifetime” only when the contract says exactly that.",
          <>Customer names only with written permission (<Ref n={131} />).</>,
        ]} />
      </Section>

      <Section id="china-ads" title="Advertising in China">
        <Note tone="warn">
          China’s Advertising Law forbids absolute words such as <span lang="zh-Hans">最佳</span> (best),{" "}
          <span lang="zh-Hans">第一</span> (No. 1), <span lang="zh-Hans">最高级</span> (highest) and{" "}
          <span lang="zh-Hans">国家级</span> (national-level) in advertising. Chinese copy on Douyin, WeChat, our Chinese
          website and printed material is checked for them before it is published.
        </Note>
      </Section>

      <Section id="lines" title="Standard legal lines">
        <Table
          head={["Where", "Line"]}
          rows={[
            ["Website footer, catalogs, presentations", <span key="a" style={MONO}>© 2026 KOLEEX International Group. All rights reserved.</span>],
            ["Spec sheets, catalogs", <span key="a" style={MONO}>Specifications may change without notice. DD/MM/YYYY</span>],
            ["Where a drawing or rendering stands in for a photo", <span key="a" style={MONO}>Illustration. The product may differ.</span>],
          ]}
        />
        <P>Music, fonts, photos and footage are used only with a license we hold — including in short videos (<Ref n={70} />).</P>
      </Section>
    </Chapter>
  );
}

/* ── 133 · Using CE & ISO 9001 ─────────────────────────────────────────── */

export function CertificationMarks() {
  return (
    <Chapter
      n={133}
      lead={
        <p>
          CE and ISO 9001 tell customers that our machines and our way of working meet recognized standards.
          They are not decorations: each says something precise, and using one where it does not apply is
          misleading — and in the EU, illegal.
        </p>
      }
      toc={[
        { id: "difference", title: "What each one means" },
        { id: "ce", title: "The CE marking" },
        { id: "iso", title: "ISO 9001" },
        { id: "band", title: "Showing them" },
      ]}
    >
      <Section id="difference" title="What each one means">
        <Table
          head={["", "CE", "ISO 9001"]}
          rows={[
            [<B key="a">About</B>, "A machine model", "Our quality management system"],
            [<B key="a">Says</B>, "This model meets the EU’s safety, electrical and EMC requirements", "This company is certified to manage quality to ISO 9001"],
            [<B key="a">Goes on</B>, "The machine (nameplate), its manual, its Declaration of Conformity", "Stationery, website, catalogs, the company profile"],
            [<B key="a">Never on</B>, "Models it does not cover, company material in general", "A machine, a nameplate, a carton — it does not certify products"],
          ]}
        />
      </Section>

      <Section id="ce" title="The CE marking">
        <Rule why="The CE marking is a legal declaration by the manufacturer. On a model that is not covered, it is a false declaration.">
          CE appears only on models covered by a valid EU Declaration of Conformity, and only in its official
          form: the official artwork, at least 5 mm tall, never redrawn, never joined to the KOLEEX logo.
        </Rule>
        <Bullets items={[
          "Its place is the nameplate (ch. 108), the manual and the Declaration of Conformity.",
          "Catalogs and spec sheets may state “CE marked” for the covered models only.",
          "The EU Machinery Regulation 2023/1230 replaces the Machinery Directive from 20 January 2027 — Declarations are renewed under it.",
          "Take the official artwork from the European Commission — never from a website or another product.",
        ]} />
      </Section>

      <Section id="iso" title="ISO 9001">
        <Rule why="ISO does not allow its own logo to be used by certified companies; the certificate is issued by a certification body with its own mark and rules.">
          Say it in the words of our certificate — the company, the standard and its year, the certificate
          number and the certification body — and show only the certification body’s mark, under its rules.
        </Rule>
        <Bullets items={[
          "Never the ISO organization’s logo.",
          "Never on a machine, a nameplate or packaging, and never “ISO 9001 certified machine”.",
          "Check the expiry date: an expired certificate is removed from every page the same day.",
        ]} />
      </Section>

      <Section id="band" title="Showing them">
        <Examples cols={2}>
          <Example tone="do" caption="A band at the foot of the page, apart from the logo, in plain words." bg="#FFFFFF" h={200}>
            <div className="w-[260px] rounded-[3px] bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-between"><Wordmark color="#000000" width={62} /><span className="text-[7px] font-bold tracking-[0.08em]">COMPANY PROFILE</span></div>
              <Strips />
              <div className="mt-8 flex items-center gap-2 border-t border-[#D2D2D7] pt-2">
                <span className="flex h-7 w-10 items-center justify-center rounded-[2px] border border-dashed border-[#98989D] text-[5px] font-semibold text-[#6E6E73]">CB MARK</span>
                <p className="text-[6.5px] leading-tight text-[#6E6E73]">Quality management system certified to ISO 9001 · Certificate no. — · Certification body —</p>
              </div>
            </div>
          </Example>
          <Example tone="dont" caption="Marks locked to the logo, badges and seals invented for decoration." bg="#FFFFFF" h={200}>
            <div className="flex items-center gap-2">
              <Wordmark color="#000000" width={110} />
              <span className="flex h-12 w-12 items-center justify-center rounded-full text-[6px] font-bold text-white" style={{ background: "#B8860B" }}>ISO 9001 CERTIFIED</span>
              <span className="text-[16px] font-black">CE</span>
            </div>
          </Example>
        </Examples>
        <P>Certification marks and partner logos follow the same separation rule as every other logo (<Ref n={44} />).</P>
      </Section>
    </Chapter>
  );
}

/* ── 134 · Approvals ───────────────────────────────────────────────────── */

const STEPS: Array<[string, string]> = [
  ["Brief", "What it is, where it goes, who it is for, the deadline — before any design starts"],
  ["First review", "The Marketing Manager checks it against this book and returns notes"],
  ["Final approval", "The Founder & CEO approves anything new, printed, large or public-facing"],
  ["Proof and file", "Physical proof for print; the approved final is saved under the file-naming rules"],
];

export function Approvals() {
  return (
    <Chapter
      n={134}
      lead={
        <p>
          One review before anything goes out is how a brand stays one brand across three countries, three
          languages and many hands. This is the route — short, predictable, the same for everyone.
        </p>
      }
      toc={[
        { id: "route", title: "The route" },
        { id: "what", title: "What needs approval" },
        { id: "how", title: "How to ask" },
      ]}
    >
      <Section id="route" title="The route">
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
              <span className="text-[26px] font-bold tabular-nums leading-none text-[var(--text-ghost)]">{i + 1}</span>
              <p className="mt-2 text-[14.5px] font-semibold text-[var(--text-primary)]">{t}</p>
              <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="what" title="What needs approval">
        <Table
          head={["Work", "Approved by", "Allow"]}
          rows={[
            ["A post made from an approved template", "Marketing Manager", "1 working day"],
            ["A new post design, video or ad campaign", "Marketing Manager → Founder & CEO", "2 working days"],
            ["Anything printed: cards, catalogs, flyers, signs, uniforms, gifts", "Marketing Manager → Founder & CEO, on a physical proof", "5 working days"],
            ["Booth, showroom, vehicle, office signage", "Founder & CEO", "10 working days"],
            ["An agent’s or supplier’s use of the brand", "Marketing Manager → Founder & CEO", "5 working days"],
            ["Documents made in Koleex Hub", "No approval — the Hub applies the house style", "—"],
          ]}
        />
        <Note>Replies to customers on WhatsApp and email use the ready replies (<Ref n={34} />) and need no approval.</Note>
      </Section>

      <Section id="how" title="How to ask">
        <Bullets items={[
          "Send the file itself (PDF or image), not a photo of a screen.",
          "Say where it will be used, in which size and language, and the date it is needed.",
          "Name the file by the rules of ch. 135 — the approval follows the file.",
          <>Questions go to the Marketing Manager, or to <span className="font-mono">{KOLEEX_COMPANY.email}</span>.</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 135 · File Naming ─────────────────────────────────────────────────── */

const FORMULA: Array<[string, string]> = [
  ["KOLEEX", "always first"],
  ["Category", "from the list"],
  ["Item", "what it is"],
  ["Description", "which one"],
  ["Language", "EN · AR · ZH"],
  ["Version", "V1, V2…"],
  ["Year", "2026"],
];

export function FileNaming() {
  return (
    <Chapter
      n={135}
      lead={
        <p>
          A file named well can be found by anyone, in any country, years later — and the newest version is
          obvious. This system continues the one in the first brand guidelines, with one addition: the language.
        </p>
      }
      toc={[
        { id: "formula", title: "The formula" },
        { id: "rules", title: "Rules" },
        { id: "categories", title: "Categories" },
        { id: "folders", title: "Folders" },
      ]}
    >
      <Section id="formula" title="The formula">
        <Stage bg="#000000" h="auto" pad={24}>
          <div className="flex flex-wrap items-start justify-center gap-1">
            {FORMULA.map(([seg, hint], i) => (
              <div key={seg} className="flex items-start gap-1">
                <div className="flex flex-col items-center">
                  <span className="rounded-[6px] px-2 py-1 text-[13px] font-semibold" style={{ ...MONO, background: i === 0 ? "#FFFFFF" : "#1D1D1F", color: i === 0 ? "#000000" : "#FFFFFF", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16)" }}>{seg}</span>
                  <span className="mt-1 text-[10px] text-[#98989D]">{hint}</span>
                </div>
                <span className="pt-1 text-[13px] text-[#6E6E73]" style={MONO}>{i < FORMULA.length - 1 ? "-" : ".ext"}</span>
              </div>
            ))}
          </div>
        </Stage>
        <Table
          head={["Right", "Wrong"]}
          rows={[
            [<Code key="a">KOLEEX-Catalog-Overlock-Range-EN-V3-2026.pdf</Code>, <Code key="b">catalog final FINAL (2).pdf</Code>],
            [<Code key="a">KOLEEX-Post-CISMA-Booth-ZH-V1-2026.png</Code>, <Code key="b">cisma post new.png</Code>],
            [<Code key="a">KOLEEX-Rollup-Coverstitch-850x2000mm-AR-V2-2026.pdf</Code>, <Code key="b">rollup ahmed edit.pdf</Code>],
            [<Code key="a">KOLEEX-Logo-Primary-Black-V2-2026.svg</Code>, <Code key="b">logo_new_USE THIS.svg</Code>],
          ]}
        />
      </Section>

      <Section id="rules" title="Rules">
        <Bullets items={[
          "English and Latin letters only; words joined by hyphens; no spaces or symbols.",
          "The language code only when the file contains text: EN, AR or ZH.",
          "Print files carry their size: 850x2000mm, A4, 90x54mm.",
          "Never: final, new, last, copy, edit, draft, updated, use-this — the version number says which is newest.",
          "Files served on the web (the website, Koleex Hub) are all lowercase: koleex-logo-black-1000.png.",
        ]} />
      </Section>

      <Section id="categories" title="Categories">
        <div className="flex flex-wrap gap-2">
          {["Logo", "Color", "Font", "Icon", "Template", "Photo", "Video", "Post", "Story", "Ad", "Presentation", "Catalog", "Brochure", "Flyer", "SpecSheet", "Poster", "Rollup", "Booth", "Sign", "Card", "Letterhead", "Document", "Manual", "Label", "Carton", "Uniform", "Gift", "Badge", "Profile", "Guidelines"].map((c) => (
            <span key={c} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[12px] text-[var(--text-secondary)]" style={MONO}>{c}</span>
          ))}
        </div>
      </Section>

      <Section id="folders" title="Folders">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <pre className="text-[12px] leading-6 text-[#1D1D1F]" style={MONO}>{`KOLEEX-Brand/
├── 01-Logo/
├── 02-Colors-Fonts/
├── 03-Templates/
├── 04-Photos/        (by year, then event or model)
├── 05-Video/
├── 06-Digital/       (posts, ads, website)
├── 07-Print/         (catalogs, flyers, cards)
├── 08-Places/        (booths, signs, vehicles)
├── 09-Product/       (nameplates, labels, cartons)
└── 10-Archive/       (every replaced version)`}</pre>
        </Stage>
        <P>Nothing is deleted: a replaced version moves to 10-Archive with its name unchanged.</P>
      </Section>
    </Chapter>
  );
}

/* ── 137 · Templates Library ───────────────────────────────────────────── */

type Status = "ready" | "hub" | "made" | "coming";

const STATUS: Record<Status, { label: string; bg: string; fg: string }> = {
  ready: { label: "Available", bg: "rgba(16,185,129,0.14)", fg: "#059669" },
  hub: { label: "In Koleex Hub", bg: "var(--bg-surface-hover)", fg: "var(--text-primary)" },
  made: { label: "Made on request", bg: "var(--bg-surface)", fg: "var(--text-secondary)" },
  coming: { label: "Coming", bg: "var(--bg-surface)", fg: "var(--text-dim)" },
};

function Pill({ s }: { s: Status }) {
  const v = STATUS[s];
  return <span className="inline-flex whitespace-nowrap rounded-full px-2 py-[1px] text-[11px] font-semibold" style={{ background: v.bg, color: v.fg }}>{v.label}</span>;
}

const TEMPLATES: Array<[string, Status, number]> = [
  ["Logo pack, logo tiles, Hub mark", "ready", 136],
  ["Brand colors (CSS, JSON)", "ready", 136],
  ["Email signature (HTML)", "ready", 93],
  ["Quotation, proforma and commercial invoice", "hub", 94],
  ["Sales contract", "hub", 95],
  ["Packing list", "hub", 96],
  ["Purchase order", "hub", 97],
  ["Authorized partner badge", "made", 128],
  ["Nameplate, labels and carton artwork", "made", 108],
  ["Presentation master", "coming", 90],
  ["Business card print file", "coming", 91],
  ["Letterhead", "coming", 92],
  ["Social post templates", "coming", 80],
  ["Catalog and spec sheet pages", "coming", 103],
  ["Roll-up and booth graphics", "coming", 114],
  ["Certificates", "coming", 99],
];

export function TemplatesLibrary() {
  return (
    <Chapter
      n={137}
      lead={
        <p>
          A template is a rule you do not have to remember. Every piece that is made often is made from one —
          so the hundredth post looks like the first, whoever makes it.
        </p>
      }
      toc={[
        { id: "library", title: "The library" },
        { id: "use", title: "Using a template" },
      ]}
    >
      <Section id="library" title="The library">
        <Table
          head={["Template", "Status", "Rules"]}
          rows={TEMPLATES.map(([name, s, n]) => [name, <Pill key="s" s={s} />, <Ref key="r" n={n} />])}
        />
        <Note>
          “In Koleex Hub” means the Hub produces the finished document in the house style — there is no file to
          download. “Coming” templates are added here as they are released.
        </Note>
      </Section>

      <Section id="use" title="Using a template">
        <Bullets items={[
          "Change the words and the picture — never the grid, the type sizes or the logo position.",
          "Start from the latest version in the library every time, not from your last job.",
          "If a template does not fit the job, ask for a new one — do not stretch the old one.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 138 · Pre-Publish Checklists ──────────────────────────────────────── */

function Checklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const all = done.size === items.length;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-2.5">
        <p className="text-[12px] tabular-nums" style={{ color: all ? "#059669" : "var(--text-dim)" }}>{done.size} of {items.length} checked</p>
        <div className="flex items-center gap-3">
          {done.size > 0 && (
            <button type="button" onClick={() => setDone(new Set())} className="text-[11.5px] text-[var(--text-dim)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline">
              Clear
            </button>
          )}
        </div>
      </div>
      <ul className="divide-y divide-[var(--border-faint)]">
        {items.map((it, i) => {
          const on = done.has(i);
          return (
            <li key={it}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setDone((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  })}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:ring-2 peer-focus-visible:ring-[#567FB2]"
                  style={{ borderColor: on ? "#059669" : "var(--text-dim)", background: on ? "#059669" : "transparent", color: "#FFFFFF" }}
                >
                  {on && <CheckIcon size={10} />}
                </span>
                <span className="text-[13.5px] leading-6" style={{ color: on ? "var(--text-dim)" : "var(--text-secondary)" }}>{it}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const LISTS: Array<[string, string[]]> = [
  ["Every piece", [
    "The logo is the master file, one flat color, with its clear space (ch. 36–40)",
    "The group line is the lockup file — never typed again (ch. 43)",
    "Colors are from the palette; silver as the premium touch, Hub Blue on links and buttons only (ch. 45–47)",
    "The piece is in its black or its white version — not half and half (ch. 47)",
    "Type is Inter (or the Arabic and Chinese faces) on the type scale (ch. 50–51)",
    "No prices, costs, supplier names, customer names or unannounced plans",
    "Every number and claim has a source (ch. 132)",
    "Photos are our own; people in them agreed (ch. 63, 66)",
    "Spelling checked; translations checked by a person (ch. 30)",
    "File named by the rules (ch. 135) and approved (ch. 134)",
  ]],
  ["Social post", [
    "Made from a post template: the KOLEEX edge, the logo top-left (or top-right), the same across a series (ch. 38, 57, 80)",
    "The two-line headline, six words or fewer; caption hook under 80 characters (ch. 51)",
    "Event photos: the dark bands, the header and the fixed footer (ch. 80)",
    "Right size for the platform (ch. 81–88)",
    "Three to five hashtags; one clear next step",
    "Tagged people and companies agreed to be tagged",
  ]],
  ["Print job", [
    "CMYK, 3 mm bleed, images at 300 dpi, PDF/X-1a (ch. 48)",
    "Rich black for large dark areas; text in pure black K100",
    "QR codes tested on two phones",
    "Physical proof approved in daylight next to an approved sample",
  ]],
  ["Machine shipment", [
    "White body; the black logo on the arm, straight, durable (ch. 107)",
    "Black engraved nameplate with the right model, serial (KL2609N0001 form, the same on the barcode), voltage and year (ch. 108)",
    "Automatic units: three logos at most, none on the table top (ch. 107)",
    "Safety labels in English and the market’s language (ch. 109)",
    "The model’s own carton (kraft, white or black); marks and labels match the packing list (ch. 110–111)",
    "No supplier name, code or logo anywhere (ch. 130)",
  ]],
];

export function Checklists() {
  return (
    <Chapter
      n={138}
      lead={
        <p>
          The last minute before something goes out is when mistakes are cheapest to catch. Run the checklist —
          every time, even for small things. Tick as you go; nothing is saved when you leave the page.
        </p>
      }
      toc={LISTS.map(([t]) => ({ id: `list-${t.toLowerCase().replace(/\s+/g, "-")}`, title: t }))}
    >
      {LISTS.map(([t, items]) => (
        <Section key={t} id={`list-${t.toLowerCase().replace(/\s+/g, "-")}`} title={t}>
          <Checklist items={items} />
        </Section>
      ))}
    </Chapter>
  );
}

/* ── 139 · FAQ ─────────────────────────────────────────────────────────── */

const FAQ: Array<[string, ReactNode]> = [
  ["Can I change the logo’s color to match a design?", <>No. The logo is black or white — nothing else (<Ref n={39} />).</>],
  ["The logo is too small to read here. What do I do?", <>Give it more space, use the logo tile, or leave it off — there is no smaller mark (<Ref n={41} />).</>],
  ["Can I use a photo I found online?", <>No. Only our own photos, or licensed ones approved by the Marketing Manager (<Ref n={63} />).</>],
  ["Can I use AI to make images?", <>Only abstract backgrounds — never people, machines or places presented as real (<Ref n={69} />).</>],
  ["When do I use Aurora and when Core?", <>Aurora is Koleex Hub only. Everything else — print, posts, signs, documents — is Core (<Ref n={77} />).</>],
  ["Can I post a machine’s price?", "No. Prices are given in quotations, never in public."],
  ["A customer sent a nice message. Can I share it?", <>Only with their written permission for that use (<Ref n={131} />).</>],
  ["Our agent wants to put their logo next to ours.", <>They use the Authorized badge instead (<Ref n={128} />).</>],
  ["Which phone number goes on public material?", "The company numbers on the website — never a personal number."],
  ["Can I write KOLEEX as Koleex?", <>In running text KOLEEX is always in capitals; the product name “Koleex Hub” is the one exception (<Ref n={42} />).</>],
  ["Which slogan do we use?", <>{KOLEEX_COMPANY.tagline} — until the new tagline is approved (<Ref n={20} />).</>],
  ["Something I need is not in the book.", <>Ask the Marketing Manager. The answer is added to the book (<Ref n={140} />).</>],
];

export function Faq() {
  return (
    <Chapter
      n={139}
      lead={<p>The questions people ask most, with the short answer and the chapter that has the full one.</p>}
      toc={[{ id: "questions", title: "Questions" }]}
    >
      <Section id="questions" title="Questions">
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] divide-y divide-[var(--border-faint)]">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-semibold text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="shrink-0 text-[16px] leading-none text-[var(--text-dim)] transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="px-4 pb-3 text-[13.5px] leading-6 text-[var(--text-secondary)]">{a}</div>
            </details>
          ))}
        </div>
      </Section>
    </Chapter>
  );
}

/* ── 140 · Versions & Contact ──────────────────────────────────────────── */

export function VersionsContact() {
  const ready = BOOK_CHAPTERS.filter((c) => c.ready).length;
  return (
    <Chapter
      n={140}
      lead={
        <p>
          This book is kept up to date. Every change is listed here with its date, so anyone can see what is new
          since they last read it — and who to ask when something is missing or wrong.
        </p>
      }
      toc={[
        { id: "versions", title: "Versions" },
        { id: "how-changes", title: "How the book changes" },
        { id: "contact", title: "Contact" },
      ]}
    >
      <Section id="versions" title="Versions">
        <Table
          head={["Version", "Date", "What changed"]}
          rows={[
            [<B key="a">{BOOK_VERSION.label}</B>, BOOK_VERSION.date, "The Apple-style identity, approved by the Founder & CEO: black and white first, one silver gradient, Hub Blue only for links and buttons, the full logo everywhere (no monogram), Inter / Noto Sans Arabic / Noto Sans SC, photographs instead of drawings, the Focus logo animation and the KOLEEX melody."],
            [<B key="a">2.0</B>, "27/09/2026", `The new KOLEEX Brand Guidelines: ${BOOK_CHAPTERS.length} chapters in 10 parts${ready < BOOK_CHAPTERS.length ? `, ${ready} written so far` : ""} — the story and the verbal and visual identity, digital, print and documents, product and packaging, places and events, people, partners and governance.`],
            [<B key="a">1.0</B>, "Before 2.0", <>The first brand guidelines site, 36 sections. Kept online as an archive at <a key="l" href="https://koleex-gl.netlify.app" target="_blank" rel="noreferrer" className="text-[var(--bk-link)] underline underline-offset-2">koleex-gl.netlify.app</a>; where the two differ, this book decides.</>],
          ]}
        />
      </Section>

      <Section id="how-changes" title="How the book changes">
        <Bullets items={[
          <><B>3.x</B> — new chapters, clearer examples and corrections. They apply from the day they are published.</>,
          <><B>4.0</B> — a change to a core rule (logo, colors, type). Announced to every team and partner first.</>,
          "Changes are approved by the Founder & CEO (ch. 134).",
          "Printed or downloaded copies go out of date; this page is always the current one.",
        ]} />
      </Section>

      <Section id="contact" title="Contact">
        <Specs rows={[
          ["Brand questions and approvals", "Marketing Manager"],
          ["Email", <span key="a" className="font-mono">{KOLEEX_COMPANY.email}</span>],
          ["Website", <span key="a" className="font-mono">{KOLEEX_COMPANY.web}</span>],
          ["Headquarters", "Taizhou, Zhejiang, China"],
        ]} />
        <Note>Found a mistake, or something missing? Send the chapter number and what you expected to find. The answer is added to the book.</Note>
      </Section>
    </Chapter>
  );
}
