"use client";

/* Chapters 122–127: uniforms, merchandise & gifts, seasonal gifts,
   employer brand & hiring, staff on social media, the founder's personal
   brand.

   People carry the brand further than any campaign. The rules here protect
   two things at once: the brand, and the people themselves — their consent,
   their privacy, their own voice. */

import type { ReactNode } from "react";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { Avatar, INK, Phone, Post, Scaled } from "../mockups";

const FOUNDER_PHOTO = "/brand/book/founder-kamal-shafei.webp";

/* ── Drawings ──────────────────────────────────────────────────────────── */

/** A polo shirt, front view (designed at 200 × 200). The logo sits on the
 *  wearer's left chest — the viewer's right. */
function Polo({ color = INK, ink = "#FFFFFF", logo = "chest" }: { color?: string; ink?: string; logo?: "chest" | "center" | "none" }) {
  const line = color === "#FFFFFF" ? "#D1D1D6" : "rgba(255,255,255,0.18)";
  return (
    <div className="relative" style={{ width: 200, height: 200 }}>
      <svg viewBox="0 0 200 200" width={200} height={200} className="absolute inset-0" aria-hidden>
        <path d="M60 30 L84 20 Q100 30 116 20 L140 30 L176 56 L160 82 L145 72 L145 186 L55 186 L55 72 L40 82 L24 56 Z" fill={color} stroke={line} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M84 20 L100 44 L116 20" fill="none" stroke={line} strokeWidth="1.5" />
        <path d="M100 44 L100 70" stroke={line} strokeWidth="1.5" />
        <circle cx="100" cy="53" r="1.6" fill={line} /><circle cx="100" cy="63" r="1.6" fill={line} />
      </svg>
      {logo === "chest" && <div className="absolute" style={{ left: 114, top: 66 }}><Wordmark color={ink} width={30} /></div>}
      {logo === "center" && <div className="absolute" style={{ left: 60, top: 96 }}><Wordmark color="#EAB308" width={80} /></div>}
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="flex h-[92px] items-center justify-center">{children}</div>
      <figcaption className="text-[11px] font-medium text-[#6E6E73]">{label}</figcaption>
    </figure>
  );
}

/* ── 122 · Uniforms ────────────────────────────────────────────────────── */

export function Uniforms() {
  return (
    <Chapter
      n={122}
      lead={
        <p>
          A uniform tells a customer who to ask. Ours is simple and well made: black or white, the logo on
          the chest, nothing else. It looks the same at CISMA, in a customer’s factory and in our office.
        </p>
      }
      toc={[
        { id: "set", title: "The set" },
        { id: "placement", title: "Logo placement" },
        { id: "uniform-never", title: "What never to do" },
      ]}
    >
      <Section id="set" title="The set">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-end justify-center gap-4">
            <Item label="Polo — sales, fairs"><Scaled w={92} base={200} h={200}><Polo /></Scaled></Item>
            <Item label="Polo — office, visits"><Scaled w={92} base={200} h={200}><Polo color="#FFFFFF" ink="#000000" /></Scaled></Item>
            <Item label="Work shirt — technicians"><Scaled w={92} base={200} h={200}><Polo color="#38383A" /></Scaled></Item>
          </div>
        </Stage>
        <Table
          head={["Who", "Garment", "Colors"]}
          rows={[
            ["Sales, exhibitions", "Piqué polo", "Black, white logo"],
            ["Office, customer visits", "Polo or oxford shirt", "White, black logo"],
            ["Technicians, warehouse", "Work shirt or jacket, durable cotton", "Graphite #38383A, white logo"],
            ["Cold weather", "Soft-shell jacket", "Black, white logo"],
          ]}
        />
      </Section>

      <Section id="placement" title="Logo placement">
        <Specs rows={[
          ["Chest", "Wearer’s left, 70–80 mm wide, 180–200 mm below the shoulder seam"],
          ["Back (jackets, fair polos)", "Optional: logo 200–250 mm wide, 100 mm below the collar"],
          ["Sleeve, cap", "The full logo, 40–50 mm wide — or nothing"],
          ["Method", "Embroidery, one thread color — screen print or DTF only on technical fabrics (ch. 39)"],
        ]} />
        <Note>In the warehouse, high-visibility vests and safety wear come first. The logo may be printed on the back of a vest, black on yellow; it never covers the reflective strips.</Note>
      </Section>

      <Section id="uniform-never" title="What never to do">
        <Examples cols={2}>
          <Example tone="do" caption="One logo, on the chest, one color." bg="#F5F5F7" h={200}>
            <Scaled w={160} base={200} h={200}><Polo /></Scaled>
          </Example>
          <Example tone="dont" caption="Gold thread, a big logo in the middle, a colored shirt." bg="#F5F5F7" h={200}>
            <Scaled w={160} base={200} h={200}><Polo color="#1D4ED8" logo="center" /></Scaled>
          </Example>
        </Examples>
        <Bullets items={[
          "Slogans, phone numbers or social icons on garments.",
          "Supplier or partner logos next to ours.",
          "Worn, faded or stained uniforms — replace them.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 123 · Merchandise & Gifts ─────────────────────────────────────────── */

export function Merchandise() {
  return (
    <Chapter
      n={123}
      lead={
        <p>
          A gift with our logo lives on someone’s desk for years. A cheap one that breaks says something about
          our machines. So we give few things, and good ones — useful, well made, quietly branded.
        </p>
      }
      toc={[
        { id: "items", title: "Approved items" },
        { id: "merch-rules", title: "Rules" },
      ]}
    >
      <Section id="items" title="Approved items">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-end justify-center gap-6 text-[#1D1D1F]">
            <Item label="Notebook A5">
              <div className="relative h-[84px] w-[62px] rounded-[3px] bg-[#000000]" style={{ boxShadow: "inset -3px 0 0 #38383A" }}>
                <div className="absolute inset-x-0 bottom-3 flex justify-center"><Wordmark color="#FFFFFF" width={34} /></div>
              </div>
            </Item>
            <Item label="Pen">
              <div className="flex h-[84px] items-center"><div className="relative flex h-[8px] w-[84px] items-center rounded-full bg-[#000000] ps-3"><Wordmark color="#FFFFFF" width={30} /></div></div>
            </Item>
            <Item label="Tote bag">
              <div className="relative flex h-[84px] w-[72px] items-end">
                <div className="absolute left-1/2 top-0 h-6 w-9 -translate-x-1/2 rounded-t-full border-[3px] border-b-0 border-[#D8CFBF]" />
                <div className="flex h-[66px] w-full items-center justify-center rounded-[2px] bg-[#EFE8DC]" style={{ boxShadow: "inset 0 0 0 1px #D8CFBF" }}><Wordmark color="#000000" width={46} /></div>
              </div>
            </Item>
            <Item label="Mug">
              <div className="relative flex h-[84px] items-end">
                <div className="flex h-[58px] w-[50px] items-center justify-center rounded-b-[8px] bg-white" style={{ boxShadow: "inset 0 0 0 1px #D1D1D6" }}><Wordmark color="#000000" width={34} /></div>
                <div className="mb-3 h-7 w-4 rounded-r-full border-[3px] border-l-0 border-[#D1D1D6]" />
              </div>
            </Item>
            <Item label="Cap">
              <div className="relative flex h-[84px] items-end">
                <div className="relative flex h-[40px] w-[64px] items-center justify-center rounded-t-full bg-[#000000] pt-2"><Wordmark color="#FFFFFF" width={34} /></div>
                <div className="h-[6px] w-[26px] rounded-r-full bg-[#1D1D1F]" />
              </div>
            </Item>
          </div>
        </Stage>
        <Table
          head={["Item", "Method", "Mark"]}
          rows={[
            ["Notebook, A5, black", "Blind or white foil deboss", "Logo 40 mm, bottom center"],
            ["Pen, black metal", "Laser engraving", "The full logo along the barrel, 30 mm"],
            ["Tote bag, natural cotton", "Screen print, black", "Logo 120–150 mm"],
            ["Mug, white ceramic", "Ceramic print, black", "Logo 60 mm, on the side facing the drinker’s right hand"],
            ["Cap, black cotton", "Embroidery, white", "The full logo, 50–60 mm on the front"],
            ["Tape measure, seam ripper, thread snips", "Pad print", "The full logo along the longest flat side — tools for the people who use our machines"],
          ]}
        />
      </Section>

      <Section id="merch-rules" title="Rules">
        <Bullets items={[
          "One color, one logo per item.",
          "No slogans, website lists or social icons on gifts.",
          "Sample first: every item is approved on a physical sample before an order (ch. 134).",
          "Gifts follow the law and the customer’s own rules; never cash or cash-like gifts.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 124 · Seasonal Gifts ──────────────────────────────────────────────── */

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-[150px] flex-col items-center justify-between rounded-[3px] bg-white p-3 text-center text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "105 / 148" }}>
      <Wordmark color="#000000" width={52} />
      <div className="space-y-1">{children}</div>
      
    </div>
  );
}

export function SeasonalGifts() {
  return (
    <Chapter
      n={124}
      lead={
        <p>
          We work across Egypt, the Gulf, China and the rest of the world, so our calendar has many seasons.
          We greet each partner on the occasions that matter to them, in their language — with the same calm
          KOLEEX card.
        </p>
      }
      toc={[
        { id: "calendar", title: "The calendar" },
        { id: "cards", title: "The cards" },
        { id: "season-rule", title: "Colors of the season" },
      ]}
    >
      <Section id="calendar" title="The calendar">
        <Table
          head={["Occasion", "Who we greet", "Language"]}
          rows={[
            ["Ramadan, Eid al-Fitr, Eid al-Adha", "Customers and partners in Egypt, the Gulf and Muslim markets", "Arabic (with English)"],
            ["Spring Festival (Chinese New Year)", "Partners and staff in China, Chinese-speaking customers", "Chinese (with English)"],
            ["Mid-Autumn Festival", "Partners and staff in China", "Chinese"],
            ["New Year", "Everyone", "English, plus the partner’s language"],
            ["Egypt’s national holidays, Chinese Golden Week", "Customers — as a notice of office hours", "The market’s language"],
          ]}
        />
        <Note>Dates of Islamic and Chinese holidays move every year. Plan from the official calendar of each country, two months ahead.</Note>
      </Section>

      <Section id="cards" title="The cards">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Card>
              <p dir="rtl" lang="ar" className="text-[16px] font-bold">عيد مبارك</p>
              <p className="text-[7px] text-[#6E6E73]">Eid Mubarak from all of us at KOLEEX</p>
            </Card>
            <Card>
              <p lang="zh-Hans" className="text-[16px] font-bold">新春快乐</p>
              <p className="text-[7px] text-[#6E6E73]">Happy Spring Festival</p>
            </Card>
            <Card>
              <p className="text-[14px] font-bold">Happy New Year</p>
              <p className="text-[7px] text-[#6E6E73]">Thank you for a year of work together</p>
            </Card>
          </div>
        </Stage>
        <Specs rows={[
          ["Card", "105 × 148 mm (A6), 350 g/m² uncoated white card, black print"],
          ["Inside", "A handwritten line and a real signature — never a printed signature"],
          ["Digital version", "1080 × 1350 px, same layout, for WhatsApp and WeChat (ch. 80)"],
        ]} />
      </Section>

      <Section id="season-rule" title="Colors of the season">
        <Rule why="Red envelopes at Spring Festival and lanterns at Ramadan carry meaning people care about. Our card does not need to borrow them to show respect.">
          The season’s colors belong to the gift; the KOLEEX card stays black and white.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="Traditional gift (a mooncake box, a red envelope) with the KOLEEX card." bg="#F5F5F7" h={170}>
            <div className="flex items-end gap-3">
              <div className="h-[80px] w-[80px] rounded-[4px]" style={{ background: "#B91C1C", boxShadow: "inset 0 0 0 4px #EAB308" }} />
              <div className="flex h-[96px] w-[68px] flex-col items-center justify-center gap-2 rounded-[2px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"><Wordmark color="#000000" width={40} /></div>
            </div>
          </Example>
          <Example tone="dont" caption="The logo recolored gold or red for the season." bg="#B91C1C" h={170}>
            <Wordmark color="#EAB308" width={130} />
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 125 · Employer Brand & Hiring ─────────────────────────────────────── */

export function EmployerBrand() {
  return (
    <Chapter
      n={125}
      lead={
        <p>
          The people we hire decide what KOLEEX becomes. A job post is the first thing a good candidate sees of
          us, so it is written like everything else we publish: clear, honest, specific.
        </p>
      }
      toc={[
        { id: "job-post", title: "The job post" },
        { id: "structure", title: "What it says" },
        { id: "hiring-rules", title: "Rules" },
      ]}
    >
      <Section id="job-post" title="The job post">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <Post w={220} bg={INK}>
            <div className="absolute inset-0 flex flex-col p-[8%] text-white">
              <p className="text-[6.5px] font-semibold uppercase tracking-[0.2em] text-[#98989D]">We’re hiring · Taizhou</p>
              <p className="mt-1.5 text-[15px] font-bold leading-[1.1]">Sales Engineer,<br />Middle East</p>
              <div className="mt-3 space-y-1 text-[7px] text-[#D1D1D6]">
                <p>Advise garment factories on the right machines</p>
                <p>Arabic and English · industry experience</p>
                <p>Based in Taizhou, travel to the region</p>
              </div>
              <p className="mt-auto text-[7px] font-semibold">Apply on {KOLEEX_COMPANY.web}</p>
              <div className="mt-2 flex items-center justify-between"><Wordmark color="#FFFFFF" width="34%" /></div>
            </div>
          </Post>
        </Stage>
      </Section>

      <Section id="structure" title="What it says">
        <Table
          head={["Part", "Content"]}
          rows={[
            [<B key="a">Title</B>, "The real job title and the place — no invented titles"],
            [<B key="a">The work</B>, "Three to five lines on what the person will actually do"],
            [<B key="a">The person</B>, "Skills, experience and languages the job needs"],
            [<B key="a">About us</B>, <>The standard company description (<Ref n={32} />)</>],
            [<B key="a">How to apply</B>, "One way, with a closing date"],
          ]}
        />
        <P>Job openings are published from Koleex Hub, so the website and every post announce the same role in the same words.</P>
      </Section>

      <Section id="hiring-rules" title="Rules">
        <Rule why="It is the law in the countries where we hire, and it is how we find the best people.">
          Requirements are about the job — skills, experience, languages. Never age, gender, religion,
          nationality or appearance.
        </Rule>
        <Bullets items={[
          <>Photos of our team only with their consent (<Ref n={66} />).</>,
          "No exaggerated promises about pay, growth or perks.",
          "Every applicant gets an answer, even when it is no.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 126 · Staff on Social Media ───────────────────────────────────────── */

export function StaffSocial() {
  return (
    <Chapter
      n={126}
      lead={
        <p>
          Our people’s own accounts reach customers our pages never will. We welcome them sharing their work —
          as themselves, with a few clear rules that protect our customers, our partners and them.
        </p>
      }
      toc={[
        { id: "can", title: "What you can do" },
        { id: "never-post", title: "What you never post" },
        { id: "profiles", title: "Your work profile" },
        { id: "problems", title: "When something goes wrong" },
      ]}
    >
      <Section id="can" title="What you can do">
        <Bullets items={[
          "Share and repost KOLEEX posts from the official accounts.",
          "Post your own photos from fairs, trainings and customer visits — with the consent of anyone in them.",
          "Say where you work: “Sales Engineer at KOLEEX International Group”.",
          "Answer general questions, and move anything about an order to WhatsApp Business or email.",
        ]} />
      </Section>

      <Section id="never-post" title="What you never post">
        <Rule why="These are the owner’s confidential categories. Once posted, they cannot be taken back.">
          Prices, costs, supplier names, customer names, internal documents, screens of Koleex Hub, and plans that
          have not been announced.
        </Rule>
        <Bullets items={[
          "No personal pages or groups named “KOLEEX …” — only the official accounts use the name (ch. 79).",
          "No edited or recolored logo in your profile picture or banner.",
          "No arguments with customers or competitors in public.",
        ]} />
      </Section>

      <Section id="profiles" title="Your work profile">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Phone w={170}>
              <div className="flex flex-col items-center px-3 pt-4 text-center text-[#1D1D1F]">
                <span className="h-12 w-12 rounded-full bg-[#D1D1D6]" />
                <p className="mt-2 text-[10px] font-bold">Full Name</p>
                <p className="text-[7px] text-[#6E6E73]">Sales Engineer · KOLEEX</p>
                <div className="mt-3 w-full space-y-1 text-start text-[6.5px]">
                  <div className="rounded-[4px] bg-[#F5F5F7] px-2 py-1"><p className="text-[#6E6E73]">About</p><p>Industrial garment machinery · EN / <span lang="ar">عربي</span></p></div>
                  <div className="rounded-[4px] bg-[#F5F5F7] px-2 py-1"><p className="text-[#6E6E73]">Website</p><p>{KOLEEX_COMPANY.web}</p></div>
                </div>
              </div>
            </Phone>
          </div>
        </Stage>
        <Specs rows={[
          ["Photo", "A real, recent photo of you — not the logo"],
          ["Name", "Your real name"],
          ["Title", "Your real job title and “KOLEEX” or “KOLEEX International Group”"],
          ["Link", "The official website"],
        ]} />
      </Section>

      <Section id="problems" title="When something goes wrong">
        <P>
          If a customer complains in public, or a post about KOLEEX worries you, do not reply. Send the link to the
          Marketing Manager — the official account answers, once, calmly (<Ref n={24} />).
        </P>
      </Section>
    </Chapter>
  );
}

/* ── 127 · The Founder's Personal Brand ────────────────────────────────── */

export function FounderBrand() {
  return (
    <Chapter
      n={127}
      lead={
        <p>
          The founder is the most trusted voice KOLEEX has: three generations of the industry in one person. His
          own accounts speak in the first person — personal, but always consistent with the brand.
        </p>
      }
      toc={[
        { id: "identity", title: "Name and image" },
        { id: "voice", title: "Voice and subjects" },
        { id: "founder-post", title: "A post" },
      ]}
    >
      <Section id="identity" title="Name and image">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed portrait file shown at its own ratio */}
        <img src={FOUNDER_PHOTO} alt="Kamal Shafei, Founder & CEO of KOLEEX" width={720} height={900} className="w-full max-w-[200px] rounded-2xl object-cover grayscale" loading="lazy" />
        <Specs rows={[
            ["Name", "Kamal Shafei"],
            ["Title", "Founder & CEO, KOLEEX International Group"],
            ["Portrait", "One official portrait, black and white, updated every two years"],
            ["Channels", "LinkedIn first; WeChat for partners in China"],
            ["Profile link", KOLEEX_COMPANY.web],
          ]} />
      </Section>

      <Section id="voice" title="Voice and subjects">
        <Table
          head={["Subject", "Example"]}
          rows={[
            [<B key="a">The industry</B>, "What changes in garment production, and what it means for factories"],
            [<B key="a">The story</B>, "Seventy years from a shop in Cairo to Taizhou — the lessons, not the boasting"],
            [<B key="a">On the road</B>, "Fairs, factories and partners visited — with their consent"],
            [<B key="a">The team</B>, "People at KOLEEX and the work they did"],
          ]}
        />
        <Bullets items={[
          "First person, calm, specific — the brand voice with a name on it (ch. 22).",
          "The same confidential categories as everyone: no prices, customer or supplier names, or unannounced plans (ch. 126).",
          "Personal matters stay personal; no politics or religion.",
        ]} />
      </Section>

      <Section id="founder-post" title="A post">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="w-[280px] rounded-[8px] bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- the same portrait, as an avatar */}
              <img src={FOUNDER_PHOTO} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover grayscale" loading="lazy" />
              <div className="min-w-0"><p className="text-[9px] font-bold">Kamal Shafei</p><p className="text-[7px] text-[#6E6E73]">Founder & CEO, KOLEEX International Group</p></div>
            </div>
            <p className="mt-2 text-[8.5px] leading-[1.45]">
              My grandfather opened his shop in Cairo in 1955. What he taught still decides how we work: sell the
              machine the customer needs, not the one on the shelf. Back from four factory visits this week —
              every one of them asked the same question about speed versus stitch quality. Here is what I told them.
            </p>
            <div className="mt-2 h-[90px] rounded-[4px] bg-[#D2D2D7]" />
            <div className="mt-2 flex items-center gap-1.5"><Avatar size={14} /><span className="text-[7px] text-[#6E6E73]">KOLEEX International Group</span></div>
          </div>
        </Stage>
        <Note>This post is an example written to show the voice — not a published post. His posts are his own; when one announces something for the company, the official accounts publish it first and he shares it.</Note>
      </Section>
    </Chapter>
  );
}
