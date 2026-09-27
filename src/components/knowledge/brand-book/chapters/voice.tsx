"use client";

/* Chapters 18–25: using the name, legal names & trademarks, tagline,
   descriptor, tone of voice, tone by channel, tone by situation, writing
   style & punctuation.

   The meaning of the name (K-O-L-E-E-X) and the approved Arabic and
   Chinese tagline come from the first brand guidelines, which the owner
   confirmed (27/09/2026). The owner asked for a new tagline without a
   candidate, so chapter 20 carries proposals, clearly marked, next to the
   tagline in use. */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  AR_FONT, B, Bullets, Chapter, Code, Example, Examples, Note, P, Ref, Section, Specs, Stage, Table, ZH_FONT,
} from "../kit";
import { Wordmark } from "../marks";
import { LEGAL_NAME_EN } from "@/lib/legal-name";


/** A sample of writing on a white card — what the reader actually sees. */
function Sample({ children, rtl = false }: { children: ReactNode; rtl?: boolean }) {
  return (
    <div dir={rtl ? "rtl" : "ltr"} className="w-full max-w-[420px] space-y-1.5 text-start text-[13px] leading-6 text-[#1D1D1F]" style={rtl ? AR_FONT : undefined}>
      {children}
    </div>
  );
}

/* ── 18 · Using the Name ───────────────────────────────────────────────── */

const LETTERS: Array<[string, string, string]> = [
  ["K", "Knowledge", "Understand the industry, the machine and the customer first."],
  ["O", "Operations", "Build it into systems and processes, not one-off efforts."],
  ["L", "Logic", "Decide like an engineer: on facts and structure."],
  ["E", "Evolution", "Improve continuously; never stand still."],
  ["E", "Excellence", "Hold every detail to a high standard."],
  ["X", "Execution", "Deliver real machines, real lines, real results."],
];

export function NameUsage() {
  return (
    <Chapter
      n={18}
      lead={
        <p>
          KOLEEX is not a random word. It is six ideas in one name — a way of working from knowledge to
          execution. Written the same way everywhere, it is also our most valuable asset.
        </p>
      }
      toc={[
        { id: "meaning", title: "What the name means" },
        { id: "say", title: "Saying it" },
        { id: "write", title: "Writing it" },
        { id: "name-rules", title: "Rules" },
      ]}
    >
      <Section id="meaning" title="What the name means">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LETTERS.map(([l, w, d], i) => (
            <div key={`${l}${i}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
              <p className="text-[34px] font-bold leading-none text-[var(--text-primary)]">{l}</p>
              <p className="mt-2 text-[13.5px] font-semibold text-[var(--text-primary)]">{w}</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{d}</p>
            </div>
          ))}
        </div>
        <P>Read in order, the letters are a cycle: understand, organize, decide, improve, perfect, deliver — then begin again with what was learned.</P>
        <Note>The meaning explains how we work; it is not spelled out in ads. The name itself is enough.</Note>
      </Section>

      <Section id="say" title="Saying it">
        <Specs rows={[
          ["English", "KOH-lex"],
          ["Arabic", <span key="a" lang="ar" dir="rtl" style={AR_FONT}>كولكس</span>],
          ["Chinese", <span key="z" lang="zh-Hans" style={ZH_FONT}>科莱恪斯 · kē lái kè sī</span>],
        ]} />
      </Section>

      <Section id="write" title="Writing it">
        <Table
          head={["Right", "Wrong"]}
          rows={[
            [<B key="a">KOLEEX</B>, "Koleex, koleex, KOLEX, Kolex, K-LEEX, KX"],
            [<B key="a">KOLEEX International Group</B>, "Koleex Group, KOLEEX Intl, KOLEEX Co., KX Group"],
            [<B key="a">Koleex Hub</B>, "KOLEEX HUB, Koleex hub, the Hub system"],
            [<span key="a" lang="ar" dir="rtl" style={AR_FONT}>كولكس</span>, <span key="b" lang="ar" dir="rtl" style={AR_FONT}>كوليكس، كوليكسي، كولكسس</span>],
          ]}
        />
      </Section>

      <Section id="name-rules" title="Rules">
        <Bullets items={[
          "KOLEEX is always in capitals in running text. The logo is never typed (ch. 36).",
          "Koleex Hub is the one exception: the name of our software is written as a product name.",
          "The name is not a verb, not plural and not possessive: “the KOLEEX warranty”, not “KOLEEX’s warranty”.",
          "In Arabic text write كولكس; in Chinese text KOLEEX, with 科莱恪斯 at the first formal mention.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 19 · Legal Names & Trademarks ─────────────────────────────────────── */


export function LegalNames() {
  return (
    <Chapter
      n={19}
      lead={<p>Different documents need different names. Using the right one keeps contracts valid, invoices accepted and the brand consistent.</p>}
      toc={[
        { id: "names-table", title: "Which name, where" },
        { id: "domains", title: "Official domains" },
        { id: "tm", title: "Trademarks" },
      ]}
    >
      <Section id="names-table" title="Which name, where">
        <Table
          head={["Name", "Use it on"]}
          rows={[
            [<span key="a" className="font-mono text-[12.5px]">{LEGAL_NAME_EN}</span>, "Formal documents only — contracts, invoices, customs and bank documents, official letters"],
            [<span key="a" lang="zh-Hans" style={ZH_FONT}>{KOLEEX_COMPANY.zh}</span>, "Chinese contracts, invoices, seals and government forms"],
            [<B key="a">KOLEEX International Group</B>, "The everyday name — company profile, LinkedIn, press, partner material, e-mails"],
            [<B key="a">KOLEEX</B>, "Machines, marketing, social media, signs — everywhere else"],
          ]}
        />
        <Specs rows={[
          ["Registered in Taizhou", "14/03/2024"],
          ["Registered address", KOLEEX_COMPANY.address],
        ]} />
        <Note>The Egypt office’s legal name is used on its own local documents. It is added here once confirmed.</Note>
      </Section>

      <Section id="domains" title="Official domains">
        <Table
          head={["Domain", "What it is"]}
          rows={[
            [<Code key="a">koleexgroup.com</Code>, "The website — the address on every piece of material"],
            [<Code key="a">hub.koleexgroup.com</Code>, "Koleex Hub, our system"],
            [<Code key="a">koleexgroup.cn</Code>, "China"],
          ]}
        />
        <P>Email addresses use <Code>@koleexgroup.com</Code>. Personal or free email addresses are never used for company business.</P>
      </Section>

      <Section id="tm" title="Trademarks">
        <Bullets items={[
          <>The KOLEEX trademark: registration No. <span className="font-mono">74343050</span>.</>,
          <>® only where KOLEEX is registered, once, at the first mention (<Ref n={132} />).</>,
          "The list of registrations is kept by management. Ask before using ® in a new market.",
          "Never register a domain, company name or social account containing KOLEEX without the Founder & CEO’s approval.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 20 · Tagline ──────────────────────────────────────────────────────── */

const PROPOSALS: Array<[string, string]> = [
  ["Precision, stitch by stitch.", "Says what we sell — precise machines — in the language of the trade."],
  ["Built for the line.", "Short and industrial: we think in production lines, not single machines."],
  ["Seventy years. One standard.", "Heritage and consistency in four words; strong for the profile and fairs."],
  ["Machines you can build on.", "Reliability and partnership — the factory grows on what we deliver."],
];

export function Tagline() {
  return (
    <Chapter
      n={20}
      lead={
        <p>
          The tagline is the brand’s signature line. KOLEEX uses one tagline, in one form, in three languages —
          and uses it sparingly, so it keeps its weight.
        </p>
      }
      toc={[
        { id: "current", title: "The tagline in use" },
        { id: "tagline-rules", title: "Rules" },
        { id: "proposals", title: "A new tagline" },
      ]}
    >
      <Section id="current" title="The tagline in use">
        <Stage bg="#000000" h="auto" pad={32}>
          <div className="flex flex-col items-center gap-3 text-center">
            <Wordmark color="#FFFFFF" width={170} />
            <p className="text-[12px] font-semibold tracking-[0.3em] text-[#D1D1D6]">{KOLEEX_COMPANY.tagline}</p>
          </div>
        </Stage>
        <Table
          head={["Language", "Tagline"]}
          rows={[
            ["English", <B key="a">Shaping the Future.</B>],
            ["Arabic", <span key="a" lang="ar" dir="rtl" className="text-[15px] font-semibold" style={AR_FONT}>نُشكّل المستقبل.</span>],
            ["Chinese", <span key="a" lang="zh-Hans" className="text-[15px] font-semibold" style={ZH_FONT}>塑造未来。</span>],
          ]}
        />
      </Section>

      <Section id="tagline-rules" title="Rules">
        <Bullets items={[
          "Word for word, with its full stop. No extra words, no new versions.",
          "Under or beside the logo as a lockup (ch. 43), or alone as a closing line — never inside a sentence.",
          "Company material: profile, website, presentations, fairs, office walls. Not on machines, parts, packaging or in the Hub.",
          "Never together with the descriptor on the same lockup.",
        ]} />
      </Section>

      <Section id="proposals" title="A new tagline">
        <Note tone="warn">The owner has asked for a new tagline. These are proposals for his choice — none is in use until it is approved. Until then, the tagline is Shaping the Future.</Note>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PROPOSALS.map(([t, why], i) => (
            <div key={t} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
              <p className="font-mono text-[12px] text-[var(--text-dim)]">Proposal {i + 1}</p>
              <p className="mt-1 text-[19px] font-bold text-[var(--text-primary)]">{t}</p>
              <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">{why}</p>
            </div>
          ))}
        </div>
        <P>The chosen line is translated into Arabic and Chinese by native writers, checked against ch. 132, and then replaces the tagline everywhere at once.</P>
      </Section>
    </Chapter>
  );
}

/* ── 21 · Descriptor ───────────────────────────────────────────────────── */

export function Descriptor() {
  return (
    <Chapter
      n={21}
      lead={<p>The descriptor tells a stranger, in three words, what KOLEEX does. It is a fact, not a slogan — and it goes wherever the logo meets someone for the first time.</p>}
      toc={[
        { id: "descriptor", title: "The descriptor" },
        { id: "where", title: "Where it goes" },
      ]}
    >
      <Section id="descriptor" title="The descriptor">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="flex flex-col items-start gap-3">
            <Wordmark color="#000000" width={220} />
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#6E6E73]">Industrial Garment Machinery</span>
          </div>
        </Stage>
        <Table
          head={["Language", "Descriptor"]}
          rows={[
            ["English", <B key="a">Industrial Garment Machinery</B>],
            ["Arabic", <span key="a" lang="ar" dir="rtl" className="text-[15px] font-semibold" style={AR_FONT}>ماكينات صناعية للملابس</span>],
            ["Chinese", <span key="a" lang="zh-Hans" className="text-[15px] font-semibold" style={ZH_FONT}>工业服装机械</span>],
          ]}
        />
      </Section>

      <Section id="where" title="Where it goes">
        <Bullets items={[
          "First contact: booth walls, roll-ups, vans, the website header, social media bios.",
          <>As a lockup under or beside the logo (<Ref n={43} />), or as a small label above a headline.</>,
          "Not needed where the reader already knows us: documents, the Hub, repeat customers’ material.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 22 · Tone of Voice ────────────────────────────────────────────────── */

const WORDS_NOT: string[] = ["best", "No. 1", "world-class", "leading", "revolutionary", "cutting-edge", "unbeatable", "amazing", "cheapest", "guaranteed (unless the contract says so)", "!!!"];

export function ToneOfVoice() {
  return (
    <Chapter
      n={22}
      lead={
        <p>
          Our voice is how the personality sounds: confident, precise, modern. It is the same voice in every
          language and every channel — only the volume changes.
        </p>
      }
      toc={[
        { id: "voice-traits", title: "The voice" },
        { id: "rewrite", title: "Before and after" },
        { id: "never-words", title: "Words we do not use" },
      ]}
    >
      <Section id="voice-traits" title="The voice">
        <Table
          head={["We are", "So we", "We are not"]}
          rows={[
            [<B key="a">Confident</B>, "State facts plainly and stand behind them", "Loud, boastful or pushy"],
            [<B key="a">Precise</B>, "Use exact models, figures and dates; one idea per sentence", "Vague, or technical without explaining"],
            [<B key="a">Modern</B>, "Write short, clear, active sentences", "Trendy, slangy or old-fashioned"],
          ]}
        />
      </Section>

      <Section id="rewrite" title="Before and after">
        <Examples cols={2}>
          <Example tone="dont" caption="Hype, no facts, no next step." bg="#FFFFFF" h="auto" pad={20}>
            <Sample><p>We are the leading world-class supplier of the BEST sewing machines at unbeatable prices!!! Contact us now!!!</p></Sample>
          </Example>
          <Example tone="do" caption="A fact, a benefit, a next step." bg="#FFFFFF" h="auto" pad={20}>
            <Sample><p>The XSO-7800-4 sews 4-thread overlock at up to 6,000 stitches per minute. We deliver it set up and train your operators. Ask for a quotation on WhatsApp.</p></Sample>
          </Example>
          <Example tone="dont" caption="Cold and bureaucratic." bg="#FFFFFF" h="auto" pad={20}>
            <Sample><p>Please be informed that your request has been received and will be processed in due course according to company procedures.</p></Sample>
          </Example>
          <Example tone="do" caption="Clear, human, with a time." bg="#FFFFFF" h="auto" pad={20}>
            <Sample><p>Thank you — we have your request. You will have the quotation by Thursday, 02/10/2026.</p></Sample>
          </Example>
        </Examples>
        <Note>Figures in examples illustrate the style. Real figures always come from Koleex Hub.</Note>
      </Section>

      <Section id="never-words" title="Words we do not use">
        <div className="flex flex-wrap gap-2">
          {WORDS_NOT.map((w) => (
            <span key={w} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[12.5px] text-[var(--text-secondary)] line-through decoration-[#DC2626]/70">{w}</span>
          ))}
        </div>
        <P>Show it instead: a number, a result, a customer who agreed to say it (<Ref n={131} />).</P>
      </Section>
    </Chapter>
  );
}

/* ── 23 · Tone by Channel ──────────────────────────────────────────────── */

function Meter({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${n} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="h-2 w-4 rounded-full" style={{ background: i < n ? "var(--text-primary)" : "var(--bg-surface-hover)" }} />
      ))}
    </span>
  );
}

export function ToneByChannel() {
  return (
    <Chapter
      n={23}
      lead={<p>One voice, different rooms. A contract and a WhatsApp reply sound like the same company — the contract is simply more formal.</p>}
      toc={[
        { id: "channels", title: "Channels" },
        { id: "emoji", title: "Emoji" },
      ]}
    >
      <Section id="channels" title="Channels">
        <Table
          head={["Channel", "Formality", "Length", "Opens with"]}
          rows={[
            ["Contracts, invoices, letters", <Meter key="m" n={5} />, "As needed", "“Dear Mr. / Ms. [Name],”"],
            ["Website, catalogs, profile", <Meter key="m" n={4} />, "Short paragraphs", "The fact that matters most"],
            ["Email", <Meter key="m" n={4} />, "Under 150 words", "“Dear [Name],” then the point"],
            ["LinkedIn", <Meter key="m" n={3} />, "3–6 lines", "A fact or a result"],
            ["Facebook, Instagram, WeChat", <Meter key="m" n={3} />, "2–4 lines", "A hook under 80 characters (ch. 80)"],
            ["WhatsApp", <Meter key="m" n={2} />, "1–3 short messages", "“Hello [Name],” and the answer"],
            ["TikTok, Douyin", <Meter key="m" n={2} />, "One line on screen", "What the video shows"],
          ]}
        />
      </Section>

      <Section id="emoji" title="Emoji">
        <Bullets items={[
          "None in documents, email, the website or catalogs.",
          "At most one per post on social media, and only where it helps: ✓ ➜ 📍 📞.",
          "In WhatsApp, follow the customer: if they use emoji, one is fine; never a row of them.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 24 · Tone by Situation ────────────────────────────────────────────── */

const SITUATIONS: Array<{ s: string; aim: string; text: string }> = [
  { s: "A new enquiry", aim: "Answer fast, ask what we need", text: "Hello Ahmed, thank you for contacting KOLEEX. To recommend the right machines, could you tell us the product you sew and your daily output?" },
  { s: "Sending a quotation", aim: "Make the next step easy", text: "Please find quotation KL-QU-12349 attached. It is valid until 15/10/2026. I am happy to go through it with you on a call." },
  { s: "A delay", aim: "Say it first, give a new date", text: "Your shipment will leave on 08/10/2026, three days later than planned, because of a port closure. We are sorry for the delay and will send the tracking as soon as it sails." },
  { s: "A complaint", aim: "Own it, fix it, follow up", text: "Thank you for telling us. Our technician will call you today at 15:00 to solve it. I will check with you tomorrow that everything runs as it should." },
  { s: "Declining a discount", aim: "Stay warm, stay firm", text: "We have priced this line carefully, including setup and training. We cannot lower the price, but we can deliver in two stages if that helps your cash flow." },
  { s: "Public criticism", aim: "One calm reply, then take it private", text: "We are sorry to read this and want to put it right. We have sent you a private message to arrange a call today." },
];

export function ToneBySituation() {
  return (
    <Chapter
      n={24}
      lead={<p>The moments that test a brand are not the easy ones. Here is how KOLEEX sounds when something is new, late, wrong or difficult.</p>}
      toc={[
        { id: "situations", title: "Situations" },
        { id: "situation-rules", title: "Rules" },
      ]}
    >
      <Section id="situations" title="Situations">
        <div className="space-y-3">
          {SITUATIONS.map((x) => (
            <div key={x.s} className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 md:grid-cols-[200px_minmax(0,1fr)]">
              <div>
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">{x.s}</p>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-dim)]">{x.aim}</p>
              </div>
              <p className="rounded-xl bg-white px-4 py-3 text-[13.5px] leading-6 text-[#1D1D1F]" style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}>{x.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="situation-rules" title="Rules">
        <Bullets items={[
          "Bad news first and early — never hope it goes unnoticed.",
          "Always a name, a date or a time: “today at 15:00”, not “soon”.",
          "Apologize once, clearly; then talk about the fix.",
          <>Public complaints are answered by the official account only (<Ref n={126} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 25 · Writing Style & Punctuation ──────────────────────────────────── */

export function WritingStyle() {
  return (
    <Chapter
      n={25}
      lead={<p>Small rules, applied every time, are what make hundreds of writers sound like one company.</p>}
      toc={[
        { id: "style", title: "The rules" },
        { id: "style-example", title: "An example" },
      ]}
    >
      <Section id="style" title="The rules">
        <Table
          head={["Topic", "Rule", "Example"]}
          rows={[
            [<B key="a">Headlines</B>, "Sentence case, no full stop (taglines excepted)", "Clean edges on every seam"],
            [<B key="a">Sentences</B>, "Short and active; one idea each; under 20 words", "We install the line in two days."],
            [<B key="a">Exclamation marks</B>, "None", "—"],
            [<B key="a">Lists</B>, "No serial comma; bullets start with a capital, no full stop for fragments", "Egypt, the Gulf and China"],
            [<B key="a">Dashes</B>, "A spaced em dash for a break", "Set up — and supported"],
            [<B key="a">Quotation marks</B>, "Curly quotes “ ” and apostrophes ’", "the customer’s “yes”"],
            [<B key="a">Numbers</B>, "Words for one to nine in prose; figures from 10, and always with units", "three generations · 12 machines · 5 mm"],
            [<B key="a">Capitals</B>, "KOLEEX, model codes and acronyms only; product types in lower case", "the XSO-7800-4 overlock machine"],
            [<B key="a">Bold</B>, "Once or twice per page, for the thing the reader must not miss", "Valid until 15/10/2026"],
            [<B key="a">Abbreviations</B>, "Spell out at first use unless the reader knows it", "stitches per minute (SPM)"],
          ]}
        />
      </Section>

      <Section id="style-example" title="An example">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <Sample>
            <p className="text-[16px] font-bold">Clean edges on every seam</p>
            <p>The XSO-7800-4 is a 4-thread overlock for knitwear and light wovens. It runs at up to 6,000 stitches per minute (SPM) and trims as it sews — so seams come off the machine finished.</p>
            <p>We deliver it set up, train your operators and keep genuine parts in stock.</p>
            
          </Sample>
        </Stage>
      </Section>
    </Chapter>
  );
}
