"use client";

/* Chapters 26–35: numbers, units, currency & dates; writing in English,
   Arabic and Chinese; AI translation rules; key messages; company
   descriptions; product descriptions; calls to action & ready replies;
   glossary.

   Owner decisions (27/09/2026): English first; translations reviewed with
   AI; the Arabic register depends on the customer's country; dates
   DD/MM/YYYY. Arabic and Chinese texts here are written as usable copy —
   placeholders are in [brackets]. */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  AR_FONT, B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table, ZH_FONT,
} from "../kit";
import { INK } from "../mockups";


function Ar({ children }: { children: ReactNode }) {
  return <span lang="ar" dir="rtl" className="block text-start" style={AR_FONT}>{children}</span>;
}
/** Arabic inside an English sentence: isolated, inline. */
function ArIn({ children }: { children: ReactNode }) {
  return <bdi lang="ar" dir="rtl" style={AR_FONT}>{children}</bdi>;
}
function Zh({ children }: { children: ReactNode }) {
  return <span lang="zh-Hans" style={ZH_FONT}>{children}</span>;
}

/** A block of copy in one language, on white — ready to copy. */
function Copy({ lang, label, children }: { lang: "en" | "ar" | "zh"; label: string; children: ReactNode }) {
  const rtl = lang === "ar";
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <p className="border-b border-[var(--border-subtle)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{label}</p>
      <div
        lang={lang === "zh" ? "zh-Hans" : lang}
        dir={rtl ? "rtl" : "ltr"}
        className="flex-1 bg-white px-4 py-3 text-start text-[14px] leading-7 text-[#1D1D1F]"
        style={rtl ? AR_FONT : lang === "zh" ? ZH_FONT : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/* ── 26 · Numbers, Units, Currency & Dates ─────────────────────────────── */

export function NumbersDates() {
  return (
    <Chapter
      n={26}
      lead={
        <p>
          A wrong date on a quotation or a unit missing from a spec costs money. Numbers are written one way in
          every language, every document and every post — the same way Koleex Hub prints them.
        </p>
      }
      toc={[
        { id: "formats", title: "Formats" },
        { id: "money", title: "Money" },
        { id: "units", title: "Units" },
      ]}
    >
      <Section id="formats" title="Formats">
        <Table
          head={["What", "Write", "Never"]}
          rows={[
            [<B key="a">Dates</B>, <Code key="b">27/09/2026</Code>, "09/27/2026, 27.9.26, Sept 27th"],
            [<B key="a">Months alone</B>, "September 2026", "Sep-26"],
            [<B key="a">Times</B>, <><Code>15:00</Code> — with the city when it crosses borders: 15:00 (Cairo)</>, "3 pm, 15.00h"],
            [<B key="a">Thousands and decimals</B>, <Code key="b">12,500.75</Code>, "12.500,75 · 12 500"],
            [<B key="a">Ranges</B>, <Code key="b">5–10 mm</Code>, "5 - 10mm, 5 to 10 mm in tables"],
            [<B key="a">Percent</B>, <Code key="b">20%</Code>, "20 %, twenty percent in tables"],
            [<B key="a">Phone numbers</B>, <Code key="b">+86 576 8892 7796</Code>, "(0576) 88927796, local-only numbers"],
            [<B key="a">Digits</B>, "Latin digits 0–9 in all three languages", "Mixed digit systems in one document"],
          ]}
        />
        <Note>Phone numbers follow the international format of <Ref n={62} />. Documents made by Koleex Hub print the company numbers from one record, so they never differ.</Note>
      </Section>

      <Section id="money" title="Money">
        <Rule why="$ can be US, Hong Kong or Singapore dollars; ¥ can be yuan or yen. A three-letter code cannot be misread.">
          Amounts are written with the ISO currency code before them, a space, and two decimals in documents.
        </Rule>
        <Specs rows={[
          ["Right", <Code key="a">USD 12,500.00 · CNY 86,000.00 · EGP 150,000.00</Code>],
          ["Wrong", "$12,500 · ¥86000 · 150 ألف جنيه"],
          ["Where", "Quotations, invoices and contracts only — never prices in public (owner rule)"],
        ]} />
      </Section>

      <Section id="units" title="Units">
        <Table
          head={["Measure", "Unit", "Example"]}
          rows={[
            ["Length", "mm, cm, m", "Stitch length 5 mm"],
            ["Weight", "kg", "N.W. 38.0 kg"],
            ["Speed", "SPM — stitches per minute", "6,000 SPM"],
            ["Electrical", "V, Hz, W, kW", "220 V · 50/60 Hz · 550 W"],
            ["Volume (shipping)", "CBM", "2.85 CBM"],
            ["Temperature", "°C", "Up to 40 °C"],
          ]}
        />
        <P>Metric always. Where a market asks for inches or pounds, add them in brackets after the metric value.</P>
      </Section>
    </Chapter>
  );
}

/* ── 27 · Writing in English ───────────────────────────────────────────── */

export function WritingEnglish() {
  return (
    <Chapter
      n={27}
      lead={
        <p>
          English is the source language of the brand — and most people who read our English learned it as a
          second or third language. So we write international English: plain, exact and easy to translate.
        </p>
      }
      toc={[
        { id: "international", title: "International English" },
        { id: "en-examples", title: "Before and after" },
      ]}
    >
      <Section id="international" title="International English">
        <Bullets items={[
          "American spelling: color, center, organize — as in this book.",
          "Short sentences, common words, one term for one thing (ch. 35).",
          "No idioms, sports metaphors or puns: “ballpark figure”, “game changer”, “sew-perior”.",
          "Few phrasal verbs: “install”, not “set it up and get it going”.",
          "Spell out an abbreviation at first use.",
        ]} />
      </Section>

      <Section id="en-examples" title="Before and after">
        <Examples cols={2}>
          <Example tone="dont" caption="Idioms a translator will get wrong." bg="#FFFFFF" h="auto" pad={20}>
            <p className="w-full text-[13.5px] leading-6 text-[#1D1D1F]">This bad boy is a total game changer that will knock your production out of the park.</p>
          </Example>
          <Example tone="do" caption="Plain words any reader and any translator understands." bg="#FFFFFF" h="auto" pad={20}>
            <p className="w-full text-[13.5px] leading-6 text-[#1D1D1F]">This machine trims and sews in one step, so each operator finishes more pieces per hour.</p>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 28 · Writing in Arabic ────────────────────────────────────────────── */

export function WritingArabic() {
  return (
    <Chapter
      n={28}
      lead={
        <p>
          Arabic is the language of many of our customers. The register follows the reader’s country: clear
          Modern Standard Arabic for official material everywhere, and Egyptian Arabic in chats and social posts
          for customers in Egypt.
        </p>
      }
      toc={[
        { id: "register", title: "Register" },
        { id: "ar-rules", title: "Rules" },
        { id: "ar-examples", title: "Examples" },
      ]}
    >
      <Section id="register" title="Register">
        <Table
          head={["Where", "Register"]}
          rows={[
            ["Documents, website, catalogs, profile, signs", "Modern Standard Arabic, simple and direct"],
            ["Social media and WhatsApp — Egypt", "Egyptian Arabic, polite and professional"],
            ["Social media and WhatsApp — the Gulf and other markets", "Modern Standard Arabic, a little more formal"],
          ]}
        />
        <Rule why="A mix of registers reads as careless. The customer should hear one clear voice.">
          One register per text — never Modern Standard and Egyptian Arabic in the same message.
        </Rule>
      </Section>

      <Section id="ar-rules" title="Rules">
        <Table
          head={["Topic", "Rule"]}
          rows={[
            ["The name", <><ArIn>كولكس</ArIn> in running text; the logo is never written in Arabic letters</>],
            ["Model codes and units", "Stay in Latin letters, left-to-right: XSO-7800-4 · 6,000 SPM"],
            ["Digits", "Latin digits 0–9, as in the Hub and our documents"],
            ["Punctuation", <>Arabic comma <ArIn>،</ArIn> · semicolon <ArIn>؛</ArIn> · question mark <ArIn>؟</ArIn></>],
            ["Direction", <>Right-to-left, right-aligned; layouts mirror (<Ref n={54} />)</>],
            ["Trade words", <>Common trade words are welcome: <ArIn>أوفرلوك، سنجل، أورليه</ArIn></>],
            ["Never", <><ArIn>الأفضل، رقم 1، الأرخص</ArIn> — the same claims rules as English (ch. 132)</>],
          ]}
        />
      </Section>

      <Section id="ar-examples" title="Examples">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Copy lang="ar" label="Modern Standard Arabic — catalog">
            ماكينة XSO-7800-4 أوفرلوك 4 فتلة للتريكو والأقمشة الخفيفة، بسرعة تصل إلى 6,000 غرزة في الدقيقة. نسلّمها مركّبة ومضبوطة، وندرّب المشغّلين عليها.
          </Copy>
          <Copy lang="ar" label="Egyptian Arabic — WhatsApp, Egypt">
            أهلاً أستاذ أحمد، شكراً لتواصلك مع كولكس. ممكن تقولّنا بتخيط إيه بالظبط وإنتاجك اليومي قد إيه؟ علشان نرشّحلك الماكينات المناسبة.
          </Copy>
        </div>
        <Note>Figures in examples illustrate the style. Real figures always come from Koleex Hub.</Note>
      </Section>
    </Chapter>
  );
}

/* ── 29 · Writing in Chinese ───────────────────────────────────────────── */

export function WritingChinese() {
  return (
    <Chapter
      n={29}
      lead={
        <p>
          Chinese is the language of our headquarters, our partners in China and many of our customers. We write
          Simplified Chinese that is professional, concise and trustworthy — and that respects China’s advertising
          law.
        </p>
      }
      toc={[
        { id: "zh-rules", title: "Rules" },
        { id: "zh-law", title: "Words the law forbids" },
        { id: "zh-examples", title: "Examples" },
      ]}
    >
      <Section id="zh-rules" title="Rules">
        <Table
          head={["Topic", "Rule"]}
          rows={[
            ["Script", "Simplified Chinese; Traditional only for Hong Kong and Taiwan, by a native writer"],
            ["The name", <>KOLEEX in Latin letters; <Zh>科莱恪斯（KOLEEX）</Zh> at the first formal mention</>],
            ["Punctuation", <>Full-width: <Zh>，。：；？（）“”</Zh></>],
            ["Spacing", <>A space between Chinese and Latin letters or numbers: <Zh>KOLEEX 包缝机 · 6,000 针/分钟</Zh></>],
            ["Address", <><Zh>您</Zh>, never <Zh>你</Zh>, with customers and partners</>],
            ["Tone", "Professional and concise; no internet slang or memes"],
          ]}
        />
      </Section>

      <Section id="zh-law" title="Words the law forbids">
        <Rule why="China’s Advertising Law forbids absolute terms. A single word can bring a fine and a forced withdrawal.">
          Never use absolute words in Chinese marketing — not even for specifications.
        </Rule>
        <div className="flex flex-wrap gap-2">
          {["最", "最佳", "最好", "第一", "国家级", "顶级", "极致", "首选", "独家"].map((w) => (
            <span key={w} lang="zh-Hans" className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[14px] text-[var(--text-secondary)] line-through decoration-[#DC2626]/70" style={ZH_FONT}>{w}</span>
          ))}
        </div>
        <P>Write “up to” instead of “maximum”: <Zh>转速可达 6,000 针/分钟</Zh>, not <Zh>最高转速</Zh>.</P>
      </Section>

      <Section id="zh-examples" title="Examples">
        <Examples cols={2}>
          <Example tone="do" caption="Facts, a benefit, polite form." bg="#FFFFFF" h="auto" pad={20}>
            <p lang="zh-Hans" className="w-full text-[14px] leading-7 text-[#1D1D1F]" style={ZH_FONT}>XSO-7800-4 四线包缝机，转速可达 6,000 针/分钟。整机安装调试到位，并为您的员工提供操作培训。</p>
          </Example>
          <Example tone="dont" caption="Absolute words, exclamation marks — illegal and off-brand." bg="#FFFFFF" h="auto" pad={20}>
            <p lang="zh-Hans" className="w-full text-[14px] leading-7 text-[#1D1D1F]" style={ZH_FONT}>全球最好的缝纫机！国家级品质！第一品牌！</p>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 30 · AI Translation Rules ─────────────────────────────────────────── */

const FLOW: Array<[string, string]> = [
  ["Approve the English", "The English text is final and approved before anything is translated"],
  ["Translate with Koleex AI", "With this book’s glossary (ch. 35) and the register for the market"],
  ["Review with Koleex AI", "A second pass checks meaning, terms, numbers and tone against the English"],
  ["Native check", "A native speaker reads anything legal, printed or published widely"],
  ["Approve and publish", "Like any other piece (ch. 134)"],
];

export function AiTranslation() {
  return (
    <Chapter
      n={30}
      lead={
        <p>
          We write in English first and translate with Koleex AI, the assistant inside Koleex Hub. AI makes
          translation fast; these rules make it right.
        </p>
      }
      toc={[
        { id: "flow", title: "The flow" },
        { id: "never-translate", title: "Never translated" },
        { id: "check", title: "Always checked" },
      ]}
    >
      <Section id="flow" title="The flow">
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FLOW.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
              <span className="text-[24px] font-bold tabular-nums leading-none text-[var(--text-ghost)]">{i + 1}</span>
              <p className="mt-2 text-[14px] font-semibold text-[var(--text-primary)]">{t}</p>
              <p className="mt-1 text-[12.5px] leading-5 text-[var(--text-secondary)]">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="never-translate" title="Never translated">
        <Bullets items={[
          "KOLEEX and Koleex Hub.",
          "Model codes, part numbers, document numbers: XSO-7800-4, KL-QU-12349.",
          "Units and their symbols: mm, kg, SPM, V, Hz.",
          <>The legal names — the Chinese legal name is used as registered: <Zh>{KOLEEX_COMPANY.zh}</Zh></>,
          "The tagline — only its approved translations (ch. 20).",
        ]} />
      </Section>

      <Section id="check" title="Always checked">
        <Bullets items={[
          "Every number, date and unit against the English.",
          "Terms against the glossary — one term for one thing.",
          "Arabic direction and alignment; Chinese punctuation and spacing.",
          "Length: translations run longer — the layout still has to work.",
          "Claims: no absolute words (ch. 29, ch. 132).",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 31 · Key Messages ─────────────────────────────────────────────────── */

const MESSAGES: Array<[string, string]> = [
  ["Garment machinery since 1955.", "A family business in Cairo, three generations (ch. 4)"],
  ["Every machine is a KOLEEX machine.", "One standard, one nameplate, one check (ch. 107–108)"],
  ["Complete lines, not single machines.", "Every category, planned together (ch. 6)"],
  ["Set up, trained and supported.", "Installation, training, genuine parts (ch. 6, 113)"],
  ["At the source of the industry.", "Headquarters in Taizhou since 2017 (ch. 7)"],
];

export function KeyMessages() {
  return (
    <Chapter
      n={31}
      lead={<p>Five messages carry the brand. Every campaign, post and presentation says one or more of them — in its own words, with its proof.</p>}
      toc={[
        { id: "house", title: "The message house" },
        { id: "use-messages", title: "Using them" },
      ]}
    >
      <Section id="house" title="The message house">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="w-full max-w-[620px] text-[#1D1D1F]">
            <div className="rounded-t-[10px] px-4 py-4 text-center text-white" style={{ background: INK }}>
              <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-[#98989D]">The promise</p>
              <p className="mt-1 text-[15px] font-bold leading-snug">Precise machines. Honest advice. People who stand behind what they sell.</p>
            </div>
            <div className="grid grid-cols-5 gap-1 bg-[#D2D2D7] p-1">
              {MESSAGES.map(([m], i) => (
                <div key={m} className="flex min-h-[96px] flex-col justify-between rounded-[4px] bg-white p-2">
                  <span className="font-mono text-[9px] text-[#98989D]">0{i + 1}</span>
                  <p className="text-[10px] font-semibold leading-tight">{m}</p>
                </div>
              ))}
            </div>
            <div className="rounded-b-[10px] bg-white px-4 py-2 text-center text-[9px] uppercase tracking-[0.2em] text-[#6E6E73]" style={{ boxShadow: "inset 0 0 0 1px #D2D2D7" }}>
              Proof: our history · our standard · our range · our service · our base
            </div>
          </div>
        </Stage>
        <Table head={["Message", "Proof"]} rows={MESSAGES.map(([m, p]) => [<B key="a">{m}</B>, p])} />
      </Section>

      <Section id="use-messages" title="Using them">
        <Bullets items={[
          "One main message per piece; a second one at most.",
          "The words may change with the channel; the meaning may not.",
          "Always with its proof nearby — a date, a photo, a fact.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 32 · Company Descriptions ─────────────────────────────────────────── */

export function Boilerplates() {
  return (
    <Chapter
      n={32}
      lead={<p>Ready-made descriptions of KOLEEX in three lengths and three languages. Copy them exactly — for press, profiles, bios, directories, fair catalogs and job posts.</p>}
      toc={[
        { id: "en", title: "English" },
        { id: "ar", title: "Arabic" },
        { id: "zh", title: "Chinese" },
        { id: "bp-rules", title: "Rules" },
      ]}
    >
      <Section id="en" title="English">
        <div className="space-y-3">
          <Copy lang="en" label="One line — bios">Industrial garment machinery since 1955 — from Cairo to Taizhou, China.</Copy>
          <Copy lang="en" label="Short — about 30 words">KOLEEX International Group supplies industrial garment machinery — complete lines, set up and supported — to garment factories and dealers in more than 70 countries, from its headquarters in Taizhou, China.</Copy>
          <Copy lang="en" label="Medium — about 60 words">KOLEEX International Group is an industrial garment machinery company headquartered in Taizhou, China, with an office in Egypt and agents in other markets. Rooted in a family business founded in Cairo in 1955, KOLEEX supplies complete lines of sewing and garment machines — planned, set up, trained and supported — to factories and dealers in more than 70 countries.</Copy>
          <Copy lang="en" label="Long — about 110 words">KOLEEX International Group is an industrial garment machinery company headquartered in Taizhou, China, with an office in Egypt and agents in other markets. Rooted in a family business founded in Cairo in 1955, KOLEEX supplies complete lines of sewing and garment machines — planned, set up, trained and supported — to factories and dealers in more than 70 countries. Every machine carries the KOLEEX name and is checked to one standard before it ships. The company works in English, Arabic and Chinese, and runs every quotation, document and shipment through its own system, Koleex Hub. Its promise has not changed in three generations: precise machines, honest advice, and people who stand behind what they sell.</Copy>
        </div>
      </Section>

      <Section id="ar" title="Arabic">
        <Copy lang="ar" label="Medium">كولكس إنترناشونال جروب شركة متخصصة في الماكينات الصناعية للملابس، مقرها الرئيسي في مدينة تايتشو بالصين، ولها مكتب في مصر ووكلاء في أسواق أخرى. تعود جذورها إلى شركة عائلية تأسست في القاهرة عام 1955، وتقدّم اليوم خطوط إنتاج متكاملة من ماكينات الخياطة والملابس — من التخطيط والتركيب إلى التدريب وخدمة ما بعد البيع — للمصانع والموزعين في أكثر من 70 دولة.</Copy>
      </Section>

      <Section id="zh" title="Chinese">
        <Copy lang="zh" label="Medium">KOLEEX International Group（科莱恪斯）是一家专业的工业服装机械企业，总部位于中国浙江台州，在埃及设有办事处，并在其他市场拥有代理商。公司源于 1955 年在开罗创立的家族企业，如今为 70 多个国家和地区的服装工厂与经销商提供成套缝纫及服装设备，涵盖方案规划、安装调试、操作培训与售后服务。</Copy>
      </Section>

      <Section id="bp-rules" title="Rules">
        <Bullets items={[
          "Copy exactly; shorten only by choosing a shorter version.",
          "When a fact changes — a new office, a new number — this page changes first.",
          <>The facts behind every line are in <Ref n={4} />, <Ref n={6} /> and <Ref n={7} />.</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 33 · Product Descriptions ─────────────────────────────────────────── */

export function ProductDescriptions() {
  return (
    <Chapter
      n={33}
      lead={<p>A product description helps a production manager decide in a minute whether this is the machine. It is built the same way for every machine, from Koleex Hub’s product data.</p>}
      toc={[
        { id: "structure", title: "The structure" },
        { id: "pd-example", title: "An example" },
        { id: "pd-rules", title: "Rules" },
      ]}
    >
      <Section id="structure" title="The structure">
        <Table
          head={["Part", "Content", "Length"]}
          rows={[
            [<B key="a">Name</B>, "KOLEEX + model code", "One line"],
            [<B key="a">What it is</B>, "Machine type and what it sews", "One sentence"],
            [<B key="a">Why it matters</B>, "Three benefits, each an outcome for the factory", "Three short lines"],
            [<B key="a">Specifications</B>, "From Koleex Hub, with units", "A table"],
            [<B key="a">Supplied as</B>, "Head only or complete set (head, table, motor)", "One line"],
            [<B key="a">Next step</B>, "One call to action (ch. 34)", "One line"],
          ]}
        />
      </Section>

      <Section id="pd-example" title="An example">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="w-full max-w-[460px] text-[#1D1D1F]">
            <p className="text-[18px] font-bold">KOLEEX <span className="font-mono">XSO-7800-4</span></p>
            <p className="text-[13px] text-[#6E6E73]">4-thread overlock for knitwear and light wovens.</p>
            <ul className="mt-3 space-y-1 text-[13px]">
              <li>— Trims and sews in one pass: seams come off finished.</li>
              <li>— Direct-drive motor: quiet, and less power per shift.</li>
              <li>— Set up and handed over with your operators trained.</li>
            </ul>
            <div className="mt-3 overflow-hidden rounded-[6px] border border-[#D2D2D7] text-[12px]">
              {[["Stitch type", "4-thread overlock"], ["Speed", "up to 6,000 SPM"], ["Stitch length", "— mm"], ["Supplied as", "Head only or complete set"]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-[#D2D2D7] px-3 py-1.5 last:border-0"><span className="text-[#6E6E73]">{k}</span><span className="font-mono">{v}</span></div>
              ))}
            </div>
            <p className="mt-3 text-[13px] font-semibold">Ask for a quotation on WhatsApp →</p>
            
          </div>
        </Stage>
        <Note>Figures in examples illustrate the style. Real figures always come from Koleex Hub; a dash stands where a value is not confirmed.</Note>
      </Section>

      <Section id="pd-rules" title="Rules">
        <Bullets items={[
          "Benefits say what the factory gains — output, quality, cost, ease — not what the part is called.",
          "No superlatives, no competitor names, no prices.",
          "The website, catalog and spec sheet use the same description, generated from the same data.",
          <>Photos: our own, on white (<Ref n={64} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 34 · Calls to Action & Ready Replies ──────────────────────────────── */

const CTAS: Array<[string, string, string]> = [
  ["Ask for a quotation", "اطلب عرض سعر", "获取报价"],
  ["Talk to us on WhatsApp", "تواصل معنا على واتساب", "WhatsApp 联系我们"],
  ["Add us on WeChat", "أضفنا على WeChat", "添加微信咨询"],
  ["Download the spec sheet", "حمّل ورقة المواصفات", "下载规格表"],
  ["See it at work", "شاهد الماكينة وهي تعمل", "观看设备运行视频"],
  ["Book a visit", "احجز زيارة", "预约参观"],
];

const REPLIES: Array<{ title: string; en: string; ar: string; zh: string }> = [
  {
    title: "First reply",
    en: "Hello [Name], thank you for contacting KOLEEX. To recommend the right machines, could you tell us what you sew and your daily output?",
    ar: "أهلاً أستاذ [الاسم]، شكراً لتواصلك مع كولكس. علشان نرشّحلك الماكينات المناسبة، ممكن تقولّنا بتخيط إيه وإنتاجك اليومي قد إيه؟",
    zh: "[姓名]您好，感谢您联系 KOLEEX。为了给您推荐合适的设备，请问您主要生产什么产品？日产量大约是多少？",
  },
  {
    title: "Price request",
    en: "Thank you for your interest in the [model]. How many machines do you need, and where should they be delivered? We will send your quotation by [day].",
    ar: "شكراً لاهتمامك بماكينة [الموديل]. محتاج كام ماكينة، والتسليم فين؟ هنبعتلك عرض السعر يوم [اليوم].",
    zh: "感谢您对 [型号] 的关注。请问您需要几台？交货地点在哪里？我们将在 [日期] 前发送报价单。",
  },
  {
    title: "Service request",
    en: "We are sorry the machine has stopped. Please send the model, the serial number from the nameplate and a short video. Our technician will contact you [today at 15:00].",
    ar: "آسفين إن الماكينة وقفت. ابعتلنا من فضلك الموديل ورقم السيريال من لوحة البيانات وفيديو قصير، والفني بتاعنا هيكلمك [النهارده الساعة 3].",
    zh: "很抱歉设备出现故障。请发送型号、铭牌上的序列号和一段短视频，我们的技术人员将于 [今天 15:00] 与您联系。",
  },
  {
    title: "Out of hours",
    en: "Thank you for contacting KOLEEX. Our office is closed now; we will reply on [day] from [time] ([city] time).",
    ar: "شكراً لتواصلك مع كولكس. المكتب مقفول دلوقتي، وهنرد عليك يوم [اليوم] من الساعة [الوقت] بتوقيت [المدينة].",
    zh: "感谢您联系 KOLEEX。现在是非工作时间，我们将于 [日期] [时间]（[城市] 时间）回复您。",
  },
];

export function CtasReplies() {
  return (
    <Chapter
      n={34}
      lead={<p>The words at the end of a post and the first words of a reply decide whether a conversation starts. These are ready to use in three languages.</p>}
      toc={[
        { id: "ctas", title: "Calls to action" },
        { id: "replies", title: "Ready replies" },
        { id: "reply-rules", title: "Rules" },
      ]}
    >
      <Section id="ctas" title="Calls to action">
        <Table
          head={["English", "Arabic", "Chinese"]}
          rows={CTAS.map(([en, ar, zh]) => [<B key="a">{en}</B>, <Ar key="b">{ar}</Ar>, <Zh key="c">{zh}</Zh>])}
        />
        <P>One call to action per piece. In China, WeChat replaces WhatsApp.</P>
      </Section>

      <Section id="replies" title="Ready replies">
        <P>The Arabic replies are in Egyptian Arabic, for WhatsApp in Egypt; for other Arabic markets, use Modern Standard Arabic (<Ref n={28} />).</P>
        <div className="space-y-4">
          {REPLIES.map((r) => (
            <div key={r.title} className="space-y-2">
              <p className="text-[15px] font-semibold text-[var(--text-primary)]">{r.title}</p>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                <Copy lang="en" label="English">{r.en}</Copy>
                <Copy lang="ar" label="Arabic — Egypt">{r.ar}</Copy>
                <Copy lang="zh" label="Chinese">{r.zh}</Copy>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="reply-rules" title="Rules">
        <Bullets items={[
          "Replace every [placeholder] before sending — a bracket left in a message looks automated.",
          "Reply within the working day; out of hours, the out-of-hours reply goes out at once.",
          "Send prices as a quotation from Koleex Hub rather than typing them into a chat — so price, terms and validity always travel together (ch. 94).",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 35 · Glossary ─────────────────────────────────────────────────────── */

const TERMS: Array<[string, string, string]> = [
  ["Industrial garment machinery", "ماكينات صناعية للملابس", "工业服装机械"],
  ["Sewing machine", "ماكينة خياطة", "缝纫机"],
  ["Lockstitch machine", "ماكينة سنجل (درزة مستقيمة)", "平缝机"],
  ["Overlock machine", "ماكينة أوفرلوك", "包缝机"],
  ["Coverstitch / interlock machine", "ماكينة أورليه (كفّ)", "绷缝机"],
  ["Chainstitch machine", "ماكينة غرزة سلسلة", "链缝机"],
  ["Double-needle machine", "ماكينة إبرتين", "双针机"],
  ["Bartack machine", "ماكينة ترابيع (بارتك)", "套结机"],
  ["Buttonhole machine", "ماكينة عراوي", "锁眼机"],
  ["Button attaching machine", "ماكينة زراير", "钉扣机"],
  ["Pattern sewer", "ماكينة برنامج (باترون)", "花样机"],
  ["Spreading machine", "ماكينة فرد القماش", "拉布机"],
  ["Cutting machine", "ماكينة قص", "裁剪机"],
  ["Direct drive", "دفع مباشر (دايركت درايف)", "直驱"],
  ["Servo motor", "موتور سيرفو", "伺服电机"],
  ["Automatic thread trimmer", "قطّاع خيط أوتوماتيك", "自动剪线"],
  ["Stitches per minute (SPM)", "غرزة في الدقيقة", "针/分钟"],
  ["Head only", "رأس فقط", "机头"],
  ["Complete set", "طقم كامل (رأس وترابيزة وموتور)", "整机（含台板、电机）"],
  ["Needle", "إبرة", "机针"],
  ["Presser foot", "رِجل الماكينة (قدم الضغط)", "压脚"],
  ["Spare parts", "قطع غيار", "配件"],
  ["Nameplate", "لوحة البيانات", "铭牌"],
  ["Serial number", "الرقم التسلسلي (السيريال)", "序列号"],
  ["Quotation", "عرض سعر", "报价单"],
  ["Proforma invoice", "فاتورة مبدئية (بروفورما)", "形式发票"],
  ["Commercial invoice", "فاتورة تجارية", "商业发票"],
  ["Packing list", "قائمة التعبئة", "装箱单"],
  ["Sales contract", "عقد بيع", "销售合同"],
  ["Purchase order", "أمر شراء", "采购订单"],
  ["Installation and setup", "التركيب والضبط", "安装调试"],
  ["Training", "التدريب", "培训"],
  ["After-sales service", "خدمة ما بعد البيع", "售后服务"],
  ["Warranty", "الضمان", "保修"],
  ["Authorized distributor", "موزع معتمد", "授权经销商"],
  ["Agent", "وكيل", "代理商"],
];

export function Glossary() {
  return (
    <Chapter
      n={35}
      lead={<p>One thing, one word — in every language. The glossary is what our people, our translators and Koleex AI use, so a machine is called the same thing in a catalog in Cairo and a quotation from Taizhou.</p>}
      toc={[
        { id: "brand-terms", title: "Brand terms" },
        { id: "terms", title: "Trade terms" },
      ]}
    >
      <Section id="brand-terms" title="Brand terms">
        <Table
          head={["English", "Arabic", "Chinese"]}
          rows={[
            [<B key="a">KOLEEX</B>, <Ar key="b">كولكس</Ar>, <Zh key="c">KOLEEX（科莱恪斯）</Zh>],
            [<B key="a">KOLEEX International Group</B>, <Ar key="b">كولكس إنترناشونال جروب</Ar>, <Zh key="c">KOLEEX International Group</Zh>],
            [<B key="a">Koleex Hub</B>, "Koleex Hub", "Koleex Hub"],
            [<B key="a">Shaping the Future.</B>, <Ar key="b">نُشكّل المستقبل.</Ar>, <Zh key="c">塑造未来。</Zh>],
          ]}
        />
      </Section>

      <Section id="terms" title="Trade terms">
        <Table
          head={["English", "Arabic", "Chinese"]}
          rows={TERMS.map(([en, ar, zh]) => [en, <Ar key="b">{ar}</Ar>, <Zh key="c">{zh}</Zh>])}
        />
        <Note>A new term is added here before it is used in material. Words in brackets are the everyday trade word or a clarification — both are understood.</Note>
      </Section>
    </Chapter>
  );
}
