"use client";

/* Chapters 50–54: typefaces, type scale & hierarchy, Arabic, Chinese,
   multilingual layouts & RTL.

   The Latin face is Inter — the Hub already loads it (next/font), so the
   specimens below are set in the real font, not a lookalike. Arabic and
   Chinese use the same system families the Hub uses. */

import type { CSSProperties, ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";

const AR: CSSProperties = { fontFamily: "'Helvetica Neue','Geeza Pro','Noto Naskh Arabic','Segoe UI',Tahoma,sans-serif" };
const ZH: CSSProperties = { fontFamily: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Noto Sans SC',sans-serif" };
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
      lead={
        <p>
          One type system for three scripts. Inter sets every Latin word; our Arabic and Chinese families sit
          beside it at the same weight and presence; a monospace carries numbers and codes. All of them are
          free to use, on screen and in print.
        </p>
      }
      toc={[
        { id: "inter", title: "Inter — Latin" },
        { id: "arabic", title: "Arabic" },
        { id: "chinese", title: "Chinese" },
        { id: "mono", title: "Numbers and codes" },
        { id: "office", title: "In Word, PowerPoint and email" },
        { id: "why", title: "Why these typefaces" },
      ]}
    >
      <Section id="inter" title="Inter — Latin">
        <Stage bg="#FFFFFF" h="auto" pad={28}>
          <div className="w-full text-[#0A0A0A]">
            <p className="text-[96px] font-bold leading-none tracking-tight">Aa</p>
            <p className="mt-4 text-[20px] leading-8 tracking-tight">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 &amp; % € $ ¥ — ( ) · / @</p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[18px]">
              <span className="font-normal">Regular 400</span>
              <span className="font-medium">Medium 500</span>
              <span className="font-semibold">SemiBold 600</span>
              <span className="font-bold">Bold 700</span>
            </div>
          </div>
        </Stage>
        <Specs rows={[
          ["Typeface", "Inter"],
          ["Weights", "400 Regular · 500 Medium · 600 SemiBold · 700 Bold"],
          ["Licence", "SIL Open Font License — free for all uses, including commercial and print"],
          ["Get it", <a key="l" href="https://rsms.me/inter/" target="_blank" rel="noreferrer" className="text-[#3E6796] underline underline-offset-2 dark:text-[#7FA9D6]">rsms.me/inter</a>],
        ]} />
      </Section>

      <Section id="arabic" title="Arabic">
        <Stage bg="#FFFFFF" h="auto" pad={28}>
          <div className="w-full text-[#0A0A0A]">
            <Ar className="text-[64px] font-bold leading-tight">أ ب ج</Ar>
            <Ar className="mt-3 text-[22px] leading-10">ماكينات خياطة صناعية — فحص قبل الشحن، ودعم فني بلغتك.</Ar>
            <Ar className="mt-2 text-[22px] font-bold leading-10">ماكينات صناعية للملابس</Ar>
          </div>
        </Stage>
        <Specs rows={[
          ["Family (in order)", <Code key="f">Helvetica Neue Arabic · Geeza Pro · Noto Naskh Arabic · Segoe UI · Tahoma</Code>],
          ["Weights", "One step heavier than the Latin beside it (Latin 400 → Arabic 500)"],
          ["Free download", <a key="l" href="https://github.com/notofonts/arabic" target="_blank" rel="noreferrer" className="text-[#3E6796] underline underline-offset-2 dark:text-[#7FA9D6]">Noto Naskh Arabic</a>],
        ]} />
        <P>Full Arabic rules: <Ref n={52} />.</P>
      </Section>

      <Section id="chinese" title="Chinese">
        <Stage bg="#FFFFFF" h="auto" pad={28}>
          <div className="w-full text-[#0A0A0A]">
            <Zh className="text-[64px] font-semibold leading-tight">永 字</Zh>
            <Zh className="mt-3 text-[22px] leading-10">工业服装机械——出货前检验，提供专业技术支持。</Zh>
            <Zh className="mt-2 text-[16px] text-[#4B5563]">{KOLEEX_COMPANY.zh}</Zh>
          </div>
        </Stage>
        <Specs rows={[
          ["Family (in order)", <Code key="f">PingFang SC · Hiragino Sans GB · Microsoft YaHei · Noto Sans SC</Code>],
          ["Weights", "Regular, Medium, Semibold"],
          ["Free download", <a key="l" href="https://github.com/notofonts/noto-cjk" target="_blank" rel="noreferrer" className="text-[#3E6796] underline underline-offset-2 dark:text-[#7FA9D6]">Noto Sans SC</a>],
        ]} />
        <P>Full Chinese rules: <Ref n={53} />.</P>
      </Section>

      <Section id="mono" title="Numbers and codes">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="w-full space-y-1 text-[15px] text-[#0A0A0A]" style={MONO}>
            <p>KL-QU-12349</p>
            <p>USD 12,500.00</p>
            <p>27/09/2026</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Family", <Code key="f">SF Mono · Menlo · Consolas · ui-monospace</Code>],
          ["Use for", "Document numbers, model codes, amounts in tables, dates in tables, serial numbers"],
          ["In running text", "Use Inter with tabular figures instead"],
        ]} />
      </Section>

      <Section id="office" title="In Word, PowerPoint and email">
        <P>When Inter is not installed — on a customer&apos;s computer, in an email — the text falls back to fonts every computer has:</P>
        <Table
          head={["Script", "Fallback font"]}
          rows={[
            ["Latin", "Arial"],
            ["Arabic", "Tahoma (Windows) · Geeza Pro (Mac)"],
            ["Chinese", "Microsoft YaHei (Windows) · PingFang SC (Mac)"],
            ["Numbers and codes", "Consolas (Windows) · Menlo (Mac)"],
          ]}
        />
        <Note>Install Inter on every KOLEEX computer that makes documents or designs. Emails use the fallbacks above so that they look the same for every recipient.</Note>
      </Section>

      <Section id="why" title="Why these typefaces">
        <Bullets items={[
          <><B>Precise and neutral</B> — Inter was drawn for screens and reads the same on a phone, a spec sheet and a sign.</>,
          <><B>One family everywhere</B> — the same typeface already runs Koleex Hub, so documents, software and marketing match.</>,
          <><B>Free</B> — anyone making KOLEEX material, anywhere in the world, can use it legally at no cost.</>,
          <><B>Ready for our languages</B> — the Arabic and Chinese families are the ones our customers&apos; and staff&apos;s devices already have.</>,
        ]} />
        <Note>Earlier KOLEEX material named Helvetica Neue as the main typeface. It is replaced by Inter.</Note>
      </Section>
    </Chapter>
  );
}

/* ── 51 · Type Scale & Hierarchy ───────────────────────────────────────── */

const SCREEN_SCALE: Array<[string, number, number, number, string]> = [
  ["Display", 48, 56, 700, "Covers, heroes"],
  ["Heading 1", 32, 40, 700, "Page titles"],
  ["Heading 2", 24, 32, 600, "Section titles"],
  ["Heading 3", 18, 26, 600, "Sub-sections, card titles"],
  ["Body large", 16, 26, 400, "Lead paragraphs, long reading on phones"],
  ["Body", 14, 22, 400, "Default text"],
  ["Caption", 12, 18, 400, "Captions, notes, table details"],
];

export function TypeScale() {
  return (
    <Chapter
      n={51}
      lead={
        <p>
          Seven sizes on screen, seven in print, four weights — and never more than three weights in one
          layout. A fixed scale is what makes KOLEEX pages look related even when different people make them.
        </p>
      }
      toc={[
        { id: "screen", title: "Screen scale" },
        { id: "print", title: "Print scale" },
        { id: "labels", title: "Labels and eyebrows" },
        { id: "setting", title: "Setting text" },
        { id: "type-donts", title: "What never to do" },
      ]}
    >
      <Section id="screen" title="Screen scale">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="w-full space-y-3 text-[#0A0A0A]">
            {SCREEN_SCALE.map(([name, size, lh, w]) => (
              <div key={name} className="flex items-baseline gap-4 border-b border-[#E5E7EB] pb-2 last:border-0">
                <span className="w-28 shrink-0 font-mono text-[11px] text-[#4B5563]">{size}/{lh} · {w}</span>
                <span className="min-w-0 truncate" style={{ fontSize: size, lineHeight: `${lh}px`, fontWeight: w, letterSpacing: size >= 24 ? "-0.015em" : undefined }}>{name}</span>
              </div>
            ))}
          </div>
        </Stage>
        <Table
          head={["Style", "Size / line height (px)", "Weight", "Use"]}
          rows={SCREEN_SCALE.map(([n, s, l, w, u]) => [<B key="n">{n}</B>, `${s} / ${l}`, String(w), u])}
        />
      </Section>

      <Section id="print" title="Print scale">
        <Table
          head={["Style", "Size (pt)", "Leading (pt)", "Weight", "Use"]}
          rows={[
            [<B key="a">Display</B>, "36", "40", "700", "Catalog and profile covers, posters"],
            [<B key="a">Heading 1</B>, "24", "28", "700", "Page titles"],
            [<B key="a">Heading 2</B>, "16", "20", "600", "Section titles"],
            [<B key="a">Heading 3</B>, "12", "15", "600", "Sub-sections, table titles"],
            [<B key="a">Body</B>, "9.5", "14", "400", "Default text"],
            [<B key="a">Caption</B>, "8", "11", "400", "Captions, table cells"],
            [<B key="a">Legal</B>, "6.5", "9", "400", "Footers, legal lines — the smallest size"],
          ]}
        />
        <Note>House documents (quotations, invoices, contracts) follow the document scale built into the Hub — <Ref n={94} />.</Note>
      </Section>

      <Section id="labels" title="Labels and eyebrows">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="text-[#0A0A0A]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4B5563]">Overlock · New Series</p>
            <p className="mt-1 text-[28px] font-bold tracking-tight">Four threads. One pass.</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Style", "Inter SemiBold 600, all capitals"],
          ["Size", "11–12 px on screen · 7–8 pt in print"],
          ["Letter-spacing", "+0.12 em to +0.22 em"],
          ["Latin only", "Arabic and Chinese have no capitals — use weight or color for a label instead"],
        ]} />
      </Section>

      <Section id="setting" title="Setting text">
        <Specs rows={[
          ["Alignment", "Start-aligned (left in English, right in Arabic). Centered only for short titles on covers and cards"],
          ["Line length", "45–75 characters"],
          ["Headlines", "Letter-spacing −1% to −2%; balance the lines"],
          ["Numbers in tables", "Tabular figures, aligned to the end of the column"],
          ["Weights per layout", "Three at most"],
        ]} />
      </Section>

      <Section id="type-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="Light weights for body text." h={140}>
            <p className="max-w-[220px] text-[13px] font-light leading-5 text-[#4B5563]">Our machines are tested before they ship and supported by our technical team.</p>
          </Example>
          <Example tone="dont" caption="Long text centered or in capitals." h={140}>
            <p className="max-w-[230px] text-center text-[11px] uppercase leading-5 text-[#0A0A0A]">Our machines are tested before they ship and supported by our technical team in your language.</p>
          </Example>
          <Example tone="dont" caption="Too many weights and sizes." h={140}>
            <p className="text-[#0A0A0A]"><span className="text-[22px] font-black">Fast</span> <span className="text-[14px] font-light">and</span> <span className="text-[18px] font-medium italic">reliable</span> <span className="text-[11px] font-bold">SEWING</span></p>
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
          <div className="grid w-full grid-cols-1 gap-4 text-[#0A0A0A] md:grid-cols-2">
            <div>
              <p className="text-[11px] text-[#4B5563]">Same size and weight — the Arabic looks weak</p>
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
          <Ar className="w-full text-[18px] leading-9 text-[#0A0A0A]">تقدّم KOLEEX ماكينات صناعية للملابس منذ 2012، مع دعم فني باللغة العربية.</Ar>
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
            <Zh className="text-[20px] text-[#0A0A0A]">出货前检验，提供技术支持。</Zh>
          </Example>
          <Example tone="dont" caption="Latin punctuation inside Chinese text." h={110}>
            <Zh className="text-[20px] text-[#0A0A0A]">出货前检验, 提供技术支持.</Zh>
          </Example>
        </Examples>
      </Section>

      <Section id="mixed" title="Chinese with Latin and numbers">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <Zh className="w-full text-[18px] leading-9 text-[#0A0A0A]">KOLEEX 于 2017 年将总部迁至浙江台州，产品出口 70 多个国家。</Zh>
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
          <Example tone="dont" caption="Very light weights." h={110}><Zh className="text-[20px] font-extralight text-[#4B5563]">工业服装机械</Zh></Example>
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
            <div className="w-full space-y-1 text-[#0A0A0A]">
              <p className="text-[15px] font-semibold">Spare parts</p>
              <Zh className="text-[14px]">配件</Zh>
              <Ar className="text-[16px] font-medium">قطع الغيار</Ar>
            </div>
          </Example>
          <Example tone="do" caption={<><B>Side by side</B> — two languages, mirrored columns.</>} bg="#FFFFFF" h={190}>
            <div className="grid w-full grid-cols-2 gap-3 text-[#0A0A0A]">
              <p className="text-[11px] leading-5">Tested before shipping. Supported in your language.</p>
              <Ar className="text-[12px] leading-6">مفحوصة قبل الشحن. ودعم فني بلغتك.</Ar>
            </div>
          </Example>
          <Example tone="do" caption={<><B>Separate versions</B> — long texts: one file per language.</>} bg="#F5F5F5" h={190}>
            <div className="flex gap-2">
              {["EN", "中文", "عربي"].map((l) => (
                <div key={l} className="flex h-[110px] w-[64px] flex-col justify-between rounded bg-white p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
                  <Wordmark color="#000000" width={40} />
                  <span className="text-[11px] font-semibold text-[#0A0A0A]">{l}</span>
                </div>
              ))}
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="mirroring" title="Mirroring for Arabic">
        <Examples cols={2}>
          <Example tone="do" caption="English: reads left to right." bg="#F5F5F5" h={220}>
            <div className="w-[240px] rounded-lg bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between"><Wordmark color="#000000" width={70} /><span className="text-[9px] font-bold tracking-wider">SPEC SHEET</span></div>
              <div className="mt-4 space-y-1.5 text-[10px] text-[#0A0A0A]">
                <div className="flex justify-between"><span>Voltage</span><span style={MONO}>220 V · 50 Hz</span></div>
                <div className="flex justify-between"><span>Power</span><span style={MONO}>550 W</span></div>
              </div>
              <p className="mt-3 text-[10px] text-[#3E6796]">Next →</p>
            </div>
          </Example>
          <Example tone="do" caption="Arabic: the layout mirrors — logo top-right, arrows reversed, numbers unchanged." bg="#F5F5F5" h={220}>
            <div dir="rtl" className="w-[240px] rounded-lg bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between"><span dir="ltr"><Wordmark color="#000000" width={70} /></span><span className="text-[11px] font-bold" style={AR}>ورقة المواصفات</span></div>
              <div className="mt-4 space-y-1.5 text-[11px] text-[#0A0A0A]" style={AR}>
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
            ["Page layout, columns, alignment", <B key="a">The KOLEEX logo and the K monogram</B>],
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
