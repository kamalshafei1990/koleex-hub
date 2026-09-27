"use client";

/* Chapters 50–54: typefaces, type scale & hierarchy, Arabic, Chinese,
   multilingual layouts & RTL.

   Owner decisions (27/09/2026): Latin = Inter (Display cut, tight, for
   headlines); Arabic = Noto Sans Arabic (the book loads it); Chinese =
   Noto Sans SC. Scale: few sizes, big jumps — 80/64/48 · 32 · 17 · 12. */

import type { CSSProperties, ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  AR_FONT, B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table, ZH_FONT,
} from "../kit";
import { SILVER } from "@/lib/brand-book/tokens";
import { Wordmark } from "../marks";

const AR: CSSProperties = AR_FONT;
const ZH: CSSProperties = ZH_FONT;
const MONO: CSSProperties = { fontFamily: "ui-monospace,'SF Mono',Menlo,Consolas,monospace" };

function Ar({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <p dir="rtl" lang="ar" className={className} style={{ ...AR, ...style }}>{children}</p>;
}
function Zh({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <p lang="zh-Hans" className={className} style={{ ...ZH, ...style }}>{children}</p>;
}

/* ── 50 · Typefaces ────────────────────────────────────────────────────── */

export function Typefaces() {
  return (
    <Chapter
      n={50}
      lead={<p>One type system, three scripts. Inter for Latin, Noto Sans Arabic, Noto Sans SC — clean, modern, and free for anyone who makes KOLEEX material.</p>}
      toc={[
        { id: "inter", title: "Inter" },
        { id: "arabic", title: "Noto Sans Arabic" },
        { id: "chinese", title: "Noto Sans SC" },
        { id: "mono", title: "Numbers and codes" },
        { id: "office", title: "When the fonts are missing" },
      ]}
    >
      <Section id="inter" title="Inter">
        <Stage bg="#000000" h="auto" pad={48}>
          <div className="w-full text-center">
            <p className="text-[120px] font-semibold leading-none tracking-[-0.04em]" style={{ backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Aa</p>
            <p className="mt-6 text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#F5F5F7]">Built for the line.</p>
            <p className="mx-auto mt-4 max-w-[46ch] text-[17px] leading-[1.5] text-[#A1A1A6]">Inter was drawn for screens. Its Display cut, set tight, gives headlines the calm precision of the machines.</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Headlines", "Inter Display, SemiBold 600, letter-spacing −2.5% to −3.5%"],
          ["Text", "Inter, Regular 400 and Medium 500"],
          ["Licence", "SIL Open Font License — free for every use, including print"],
          ["Get it", <a key="l" href="https://rsms.me/inter/" target="_blank" rel="noreferrer" className="text-[var(--bk-link)] hover:underline underline-offset-2">rsms.me/inter</a>],
        ]} />
      </Section>

      <Section id="arabic" title="Noto Sans Arabic">
        <Stage bg="#FFFFFF" h="auto" pad={40}>
          <div className="w-full text-[#1D1D1F]">
            <Ar className="text-[72px] font-semibold leading-tight">غرزة مثالية.</Ar>
            <Ar className="mt-3 text-[22px] leading-[1.8] text-[#424245]">أوفرلوك 4 فتلة يقص ويخيط في خطوة واحدة، ويوصلك مركّب ومضبوط.</Ar>
          </div>
        </Stage>
        <Specs rows={[
          ["Typeface", "Noto Sans Arabic — Regular 400, SemiBold 600"],
          ["Why", "A modern sans that sits beside Inter with the same calm, even color"],
          ["Get it", <a key="l" href="https://fonts.google.com/noto/specimen/Noto+Sans+Arabic" target="_blank" rel="noreferrer" className="text-[var(--bk-link)] hover:underline underline-offset-2">fonts.google.com</a>],
        ]} />
        <P>Full Arabic rules: <Ref n={52} />.</P>
      </Section>

      <Section id="chinese" title="Noto Sans SC">
        <Stage bg="#FFFFFF" h="auto" pad={40}>
          <div className="w-full text-[#1D1D1F]">
            <Zh className="text-[72px] font-semibold leading-tight">每一针，都精准。</Zh>
            <Zh className="mt-3 text-[22px] leading-[1.7] text-[#424245]">四线包缝机，一次完成切边与缝合。</Zh>
            <Zh className="mt-3 text-[15px] text-[#6E6E73]">{KOLEEX_COMPANY.zh}</Zh>
          </div>
        </Stage>
        <Specs rows={[
          ["Typeface", "Noto Sans SC — Regular, Medium, SemiBold (PingFang SC on Apple devices is an accepted match)"],
          ["Get it", <a key="l" href="https://fonts.google.com/noto/specimen/Noto+Sans+SC" target="_blank" rel="noreferrer" className="text-[var(--bk-link)] hover:underline underline-offset-2">fonts.google.com</a>],
        ]} />
        <P>Full Chinese rules: <Ref n={53} />.</P>
      </Section>

      <Section id="mono" title="Numbers and codes">
        <Stage bg="#F5F5F7" h="auto" pad={32}>
          <div className="w-full space-y-1 text-[20px] text-[#1D1D1F]" style={MONO}>
            <p>KL-QU-12349</p>
            <p>XSO-7800-4</p>
            <p>USD 12,500.00 · 27/09/2026</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Family", <Code key="f">SF Mono · Menlo · Consolas · ui-monospace</Code>],
          ["Use for", "Document numbers, model codes, amounts and dates in tables, serial numbers"],
          ["In running text", "Inter with tabular figures"],
        ]} />
      </Section>

      <Section id="office" title="When the fonts are missing">
        <Table
          head={["Script", "Fallback — Windows", "Fallback — Mac"]}
          rows={[
            ["Latin", "Arial", "Helvetica Neue"],
            ["Arabic", "Segoe UI", "Geeza Pro"],
            ["Chinese", "Microsoft YaHei", "PingFang SC"],
            ["Numbers and codes", "Consolas", "Menlo"],
          ]}
        />
        <Note>Install Inter, Noto Sans Arabic and Noto Sans SC on every KOLEEX computer that makes documents or designs. Emails use the fallbacks, so they look the same for every recipient.</Note>
      </Section>
    </Chapter>
  );
}

/* ── 51 · Type Scale & Hierarchy ───────────────────────────────────────── */

const SCREEN_SCALE: Array<[string, number, number, number, string, string]> = [
  ["Hero", 80, 84, 600, "-0.035em", "Website heroes, launch films, covers"],
  ["Hero M", 64, 68, 600, "-0.03em", "Ads, posters, section openers"],
  ["Hero S", 48, 52, 600, "-0.03em", "Phones, slides"],
  ["Headline", 32, 38, 600, "-0.02em", "Section titles"],
  ["Body", 17, 27, 400, "-0.005em", "All text"],
  ["Caption", 12, 16, 400, "0", "Captions, legal lines, labels"],
];

export function TypeScale() {
  return (
    <Chapter
      n={51}
      lead={<p>Few sizes, big jumps. A headline is much bigger than the text — nothing in between competes for attention.</p>}
      toc={[
        { id: "screen", title: "Screen scale" },
        { id: "print", title: "Print scale" },
        { id: "setting", title: "Setting text" },
        { id: "two-line", title: "The two-line headline" },
        { id: "type-donts", title: "What never to do" },
      ]}
    >
      <Section id="screen" title="Screen scale">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="w-full space-y-4 text-[#1D1D1F]">
            {SCREEN_SCALE.map(([name, size, lh, w, ls]) => (
              <div key={name} className="flex items-baseline gap-5 border-b border-[#E8E8ED] pb-3 last:border-0">
                <span className="w-24 shrink-0 font-mono text-[12px] text-[#6E6E73]">{size}/{lh}</span>
                <span className="min-w-0 truncate" style={{ fontSize: size, lineHeight: `${lh}px`, fontWeight: w, letterSpacing: ls }}>{name}</span>
              </div>
            ))}
          </div>
        </Stage>
        <Table
          head={["Style", "Size / line (px)", "Weight", "Tracking", "Use"]}
          rows={SCREEN_SCALE.map(([n, s, l, w, ls, u]) => [<B key="n">{n}</B>, `${s} / ${l}`, String(w), ls === "0" ? "0" : ls.replace("em", " em"), u])}
        />
      </Section>

      <Section id="print" title="Print scale">
        <Table
          head={["Style", "Size (pt)", "Leading (pt)", "Weight", "Use"]}
          rows={[
            [<B key="a">Hero</B>, "48", "50", "600", "Catalog and profile covers, posters"],
            [<B key="a">Headline</B>, "24", "27", "600", "Page titles"],
            [<B key="a">Body</B>, "9.5", "14", "400", "Default text"],
            [<B key="a">Caption</B>, "7", "10", "400", "Captions, table cells, legal lines"],
          ]}
        />
        <Note>House documents (quotations, invoices, contracts) keep the document scale built into Koleex Hub — <Ref n={94} />.</Note>
      </Section>

      <Section id="setting" title="Setting text">
        <Specs rows={[
          ["Headlines", "Short — three to six words, SemiBold, tight tracking, balanced lines — or the two-line headline below"],
          ["Alignment", "Centered for heroes and short statements; start-aligned for everything longer"],
          ["Line length", "45–70 characters"],
          ["Weights per piece", "SemiBold or Bold for headlines, Light only for the second line of a two-line headline, Regular for text"],
          ["Labels", "Sentence case in Gray — no letter-spaced capitals"],
        ]} />
      </Section>

      <Section id="two-line" title="The two-line headline">
        <P>The headline KOLEEX uses most: a Bold line that names the thing, and a Light line under it that says what it does.</P>
        <Examples cols={2}>
          <Example tone="do" caption="Product: the model code Bold, the name Light." bg="#000000" h={170}>
            <div className="text-white"><p className="text-[40px] font-bold leading-none tracking-[-0.02em]">XSL-L9</p><p className="mt-2 text-[24px] font-light leading-tight">Double-Stepper Lockstitch</p></div>
          </Example>
          <Example tone="do" caption="Message: a Bold line, a Light line." bg="#000000" h={170}>
            <div className="text-white"><p className="text-[30px] font-bold leading-tight tracking-[-0.02em]">Built for Change</p><p className="text-[30px] font-light leading-tight tracking-[-0.01em]">Powered by Vision</p></div>
          </Example>
        </Examples>
        <Specs rows={[
          ["First line", "Inter Bold (700) — the model code, or the claim"],
          ["Second line", "Inter Light (300) — the same size, or about 60% of it under a model code"],
          ["Case", "Model codes in capitals; everything else in the case it is written in"],
          ["Never", "A closing square or dot after the line; a third line"],
        ]} />
      </Section>

      <Section id="type-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="Long headlines." h={150}>
            <p className="max-w-[240px] text-[17px] font-semibold leading-snug text-[#1D1D1F]">Our new high-speed industrial overlock sewing machine is now available for all factories</p>
          </Example>
          <Example tone="dont" caption="Sizes that are all similar." h={150}>
            <div className="space-y-1 text-[#1D1D1F]"><p className="text-[19px] font-semibold">Overlock</p><p className="text-[17px] font-semibold">Four threads</p><p className="text-[16px]">One pass</p></div>
          </Example>
          <Example tone="dont" caption="Many weights, italics and capitals." h={150}>
            <p className="text-[#1D1D1F]"><span className="text-[22px] font-black">Fast</span> <span className="text-[14px] font-light">and</span> <span className="text-[18px] font-medium italic">reliable</span> <span className="text-[11px] font-bold">SEWING</span></p>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 52 · Arabic Typography ────────────────────────────────────────────── */

export function ArabicType() {
  return (
    <Chapter
      n={52}
      lead={
        <p>
          Arabic is read right to left, has no capitals and looks smaller than Latin at the same size. These
          rules make Arabic text sit next to English with equal weight — and read naturally to Arabic
          customers.
        </p>
      }
      toc={[
        { id: "size-weight", title: "Size and weight" },
        { id: "spacing", title: "Line spacing" },
        { id: "never", title: "What Arabic never gets" },
        { id: "latin-in-arabic", title: "Latin names inside Arabic" },
        { id: "digits", title: "Digits" },
      ]}
    >
      <Section id="size-weight" title="Size and weight">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="grid w-full grid-cols-1 gap-4 text-[#1D1D1F] md:grid-cols-2">
            <div>
              <p className="text-[11px] text-[#6E6E73]">Same size and weight — the Arabic looks weak</p>
              <p className="mt-2 text-[18px]">Industrial garment machinery</p>
              <Ar className="text-[18px] font-normal">ماكينات صناعية للملابس</Ar>
            </div>
            <div>
              <p className="text-[11px] text-[#059669]">Arabic +12% size, one weight heavier — balanced</p>
              <p className="mt-2 text-[18px]">Industrial garment machinery</p>
              <Ar className="text-[20px] font-medium">ماكينات صناعية للملابس</Ar>
            </div>
          </div>
        </Stage>
        <Specs rows={[
          ["Size", "10–15% larger than the Latin text it sits beside"],
          ["Weight", "One step heavier: Latin 400 → Arabic 500; Latin 600 → Arabic 700"],
          ["Lightest weight", "400 — never Light or Thin"],
        ]} />
      </Section>

      <Section id="spacing" title="Line spacing">
        <Specs rows={[
          ["Body text", "Line height 1.7–1.8 × the size (English uses 1.5–1.6)"],
          ["Headings", "Line height 1.3–1.4"],
          ["Why", "Arabic letters rise and fall further than Latin; tight lines make dots and marks collide"],
        ]} />
      </Section>

      <Section id="never" title="What Arabic never gets">
        <Examples cols={3}>
          <Example tone="dont" caption="Letter-spacing — it breaks the joined letters." h={120}>
            <Ar className="text-[20px]" style={{ letterSpacing: "0.3em" }}>ماكينات</Ar>
          </Example>
          <Example tone="dont" caption="Italic or slanted text." h={120}>
            <Ar className="text-[20px]" style={{ transform: "skewX(-12deg)" }}>ماكينات صناعية</Ar>
          </Example>
          <Example tone="dont" caption="Stretching words (kashida) to fill a line." h={120}>
            <Ar className="text-[20px]">مـــاكيـــنـــات</Ar>
          </Example>
        </Examples>
      </Section>

      <Section id="latin-in-arabic" title="Latin names inside Arabic">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <Ar className="w-full text-[18px] leading-9 text-[#1D1D1F]">تقدّم KOLEEX ماكينات صناعية للملابس منذ 2012، مع دعم فني باللغة العربية.</Ar>
        </Stage>
        <Bullets items={[
          <>Brand names, model codes and units stay in <B>Latin letters</B> inside Arabic text: KOLEEX, model codes, SPM, mm.</>,
          <>Each Latin run keeps its own left-to-right order; set text direction on the paragraph, never by hand-reversing characters.</>,
          <>Where the logo appears on an Arabic page, it is the normal logo — never mirrored, never rewritten in Arabic letters.</>,
        ]} />
      </Section>

      <Section id="digits" title="Digits">
        <Rule why="Prices, model codes and dates are copied between systems, invoices and chats. One digit system avoids mistakes.">
          KOLEEX uses Western digits (0–9) in Arabic text — on documents, in the Hub and in marketing. Dates
          stay day-first: 27/09/2026.
        </Rule>
      </Section>
    </Chapter>
  );
}

/* ── 53 · Chinese Typography ───────────────────────────────────────────── */

export function ChineseType() {
  return (
    <Chapter
      n={53}
      lead={
        <p>
          Chinese is set in Simplified characters for our customers, partners and team in mainland China.
          The characters are square and dense, so Chinese needs a little more line space, full-width
          punctuation — and no Latin-style styling.
        </p>
      }
      toc={[
        { id: "setting-zh", title: "Setting Chinese" },
        { id: "punctuation", title: "Punctuation" },
        { id: "mixed", title: "Chinese with Latin and numbers" },
        { id: "names", title: "Names" },
        { id: "zh-never", title: "What Chinese never gets" },
      ]}
    >
      <Section id="setting-zh" title="Setting Chinese">
        <Specs rows={[
          ["Characters", "Simplified Chinese (简体中文), language tag zh-Hans"],
          ["Size", "The same as the Latin text beside it, or up to 5% smaller"],
          ["Weights", "Regular for body, Medium or Semibold for headings"],
          ["Line height", "1.6–1.7 for body text"],
          ["Alignment", "Start-aligned; justified text only in long printed paragraphs"],
        ]} />
      </Section>

      <Section id="punctuation" title="Punctuation">
        <Examples cols={2}>
          <Example tone="do" caption="Full-width Chinese punctuation." h={110}>
            <Zh className="text-[20px] text-[#1D1D1F]">出货前检验，提供技术支持。</Zh>
          </Example>
          <Example tone="dont" caption="Latin punctuation inside Chinese text." h={110}>
            <Zh className="text-[20px] text-[#1D1D1F]">出货前检验, 提供技术支持.</Zh>
          </Example>
        </Examples>
      </Section>

      <Section id="mixed" title="Chinese with Latin and numbers">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <Zh className="w-full text-[18px] leading-9 text-[#1D1D1F]">KOLEEX 于 2017 年将总部迁至浙江台州，产品出口 70 多个国家。</Zh>
        </Stage>
        <Bullets items={[
          <>Leave a <B>small space</B> between Chinese characters and Latin words or numbers.</>,
          <>Model codes, units and the brand name stay in Latin letters.</>,
          <>Numbers use Western digits, with a thousands comma: 5,000.</>,
        ]} />
      </Section>

      <Section id="names" title="Names">
        <Specs rows={[
          ["Legal name", <span key="n" lang="zh-Hans" style={ZH}>{KOLEEX_COMPANY.zh}</span>],
          ["Brand", "KOLEEX — the logo is never translated or transliterated"],
          ["Tagline", <span key="t" lang="zh-Hans" style={ZH}>塑造未来。</span>],
        ]} />
        <Note tone="warn">
          Chinese advertising law forbids superlatives such as 最佳, 第一 and 国家级 in marketing. The full
          writing rules for Chinese are in <Ref n={29} />.
        </Note>
      </Section>

      <Section id="zh-never" title="What Chinese never gets">
        <Examples cols={3}>
          <Example tone="dont" caption="Letter-spacing." h={110}><Zh className="text-[20px]" style={{ letterSpacing: "0.4em" }}>工业服装机械</Zh></Example>
          <Example tone="dont" caption="Italic or slanted." h={110}><Zh className="text-[20px]" style={{ transform: "skewX(-12deg)" }}>工业服装机械</Zh></Example>
          <Example tone="dont" caption="Very light weights." h={110}><Zh className="text-[20px] font-extralight text-[#6E6E73]">工业服装机械</Zh></Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 54 · Multilingual Layouts & RTL ───────────────────────────────────── */

export function Multilingual() {
  return (
    <Chapter
      n={54}
      lead={
        <p>
          KOLEEX works in English, Chinese and Arabic — often on the same page. This chapter sets the order
          of the languages, how they share a layout, and how an Arabic layout mirrors without touching the
          logo.
        </p>
      }
      toc={[
        { id: "order", title: "Order of languages" },
        { id: "patterns", title: "Three ways to combine languages" },
        { id: "mirroring", title: "Mirroring for Arabic" },
        { id: "stays", title: "What never mirrors" },
      ]}
    >
      <Section id="order" title="Order of languages">
        <Specs rows={[
          ["Default", "English → 中文 → العربية"],
          ["Documents", "English and Chinese (the legal name line); Arabic added for Arabic-speaking customers"],
          ["Material made for one market", "That market's language first, English second"],
        ]} />
      </Section>

      <Section id="patterns" title="Three ways to combine languages">
        <Examples cols={3}>
          <Example tone="do" caption={<><B>Stacked</B> — short labels and titles.</>} bg="#FFFFFF" h={190}>
            <div className="w-full space-y-1 text-[#1D1D1F]">
              <p className="text-[15px] font-semibold">Spare parts</p>
              <Zh className="text-[14px]">配件</Zh>
              <Ar className="text-[16px] font-medium">قطع الغيار</Ar>
            </div>
          </Example>
          <Example tone="do" caption={<><B>Side by side</B> — two languages, mirrored columns.</>} bg="#FFFFFF" h={190}>
            <div className="grid w-full grid-cols-2 gap-3 text-[#1D1D1F]">
              <p className="text-[11px] leading-5">Tested before shipping. Supported in your language.</p>
              <Ar className="text-[12px] leading-6">مفحوصة قبل الشحن. ودعم فني بلغتك.</Ar>
            </div>
          </Example>
          <Example tone="do" caption={<><B>Separate versions</B> — long texts: one file per language.</>} bg="#F5F5F7" h={190}>
            <div className="flex gap-2">
              {["EN", "中文", "عربي"].map((l) => (
                <div key={l} className="flex h-[110px] w-[64px] flex-col justify-between rounded bg-white p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
                  <Wordmark color="#000000" width={40} />
                  <span className="text-[11px] font-semibold text-[#1D1D1F]">{l}</span>
                </div>
              ))}
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="mirroring" title="Mirroring for Arabic">
        <Examples cols={2}>
          <Example tone="do" caption="English: reads left to right." bg="#F5F5F7" h={220}>
            <div className="w-[240px] rounded-lg bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between"><Wordmark color="#000000" width={70} /><span className="text-[9px] font-bold tracking-wider">SPEC SHEET</span></div>
              <div className="mt-4 space-y-1.5 text-[10px] text-[#1D1D1F]">
                <div className="flex justify-between"><span>Voltage</span><span style={MONO}>220 V · 50 Hz</span></div>
                <div className="flex justify-between"><span>Power</span><span style={MONO}>550 W</span></div>
              </div>
              <p className="mt-3 text-[10px] text-[#3E6796]">Next →</p>
            </div>
          </Example>
          <Example tone="do" caption="Arabic: the layout mirrors — logo top-right, arrows reversed, numbers unchanged." bg="#F5F5F7" h={220}>
            <div dir="rtl" className="w-[240px] rounded-lg bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between"><span dir="ltr"><Wordmark color="#000000" width={70} /></span><span className="text-[11px] font-bold" style={AR}>ورقة المواصفات</span></div>
              <div className="mt-4 space-y-1.5 text-[11px] text-[#1D1D1F]" style={AR}>
                <div className="flex justify-between"><span>الجهد</span><span dir="ltr" style={MONO}>220 V · 50 Hz</span></div>
                <div className="flex justify-between"><span>القدرة</span><span dir="ltr" style={MONO}>550 W</span></div>
              </div>
              <p className="mt-3 text-[11px] text-[#3E6796]" style={AR}>← التالي</p>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="stays" title="What never mirrors">
        <Table
          head={["Mirrors in Arabic", "Never mirrors"]}
          rows={[
            ["Page layout, columns, alignment", <B key="a">The KOLEEX logo</B>],
            ["Direction arrows, back/next, progress", "Numbers, prices, dates, phone numbers"],
            ["Icons that point (arrows, reply, send)", "Model codes, file names, email and web addresses"],
            ["Position of the logo (to top-right)", "Photos of machines, charts' number axes, clocks"],
          ]}
        />
        <P>Websites and the Hub mirror with the text direction setting, never by hand-built second layouts — see <Ref n={75} />.</P>
      </Section>
    </Chapter>
  );
}
