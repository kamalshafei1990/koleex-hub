"use client";

/* Chapters 128–131: agents & distributors, dealer signage, suppliers &
   OEM, testimonials & case studies.

   Two owner rules decide this part: every machine is sold as KOLEEX with
   the supplier never shown, and customer names are never public without
   written permission (questionnaire, 27/09/2026). Chapter 130 is for
   internal use and suppliers only; it stays out of the public copy. */

import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { INK, Post } from "../mockups";
import { SILVER } from "@/lib/brand-book/tokens";

/* ── The badge ─────────────────────────────────────────────────────────── */

/** "Authorized KOLEEX Distributor" — the one mark a partner may show. */
/** The badge is black with a silver frame and silver words (owner,
 *  27/09/2026); the year is renewed every year. The white version is the
 *  second version (ch. 47). */
function PartnerBadge({ role = "Distributor", place = "Country", dark = true, w = 220, year = "2026" }: { role?: string; place?: string; dark?: boolean; w?: number; year?: string }) {
  const fg = dark ? "#FFFFFF" : INK;
  const silverText = { backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;
  return (
    <div className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[6px]" style={{ padding: w * 0.06, gap: w * 0.06, background: dark ? INK : "#FFFFFF", boxShadow: dark ? "inset 0 0 0 1.5px #AEAEB2" : `inset 0 0 0 1.5px ${INK}` }}>
      <Wordmark color={fg} width={w * 0.36} />
      <span className="self-stretch" style={{ width: 1, background: dark ? SILVER.css : "#98989D" }} />
      <span className="flex flex-col" style={{ gap: w * 0.012 }}>
        <span className="font-semibold uppercase" style={{ ...(dark ? silverText : { color: "#6E6E73" }), fontSize: w * 0.04, letterSpacing: "0.18em" }}>Authorized · {year}</span>
        <span className="font-bold uppercase" style={{ ...(dark ? silverText : { color: fg }), fontSize: w * 0.052, letterSpacing: "0.08em" }}>{role}</span>
        <span className="font-medium" style={{ color: dark ? "#98989D" : "#6E6E73", fontSize: w * 0.042 }}>{place}</span>
      </span>
    </div>
  );
}

function Box({ label, w = 110, h = 34 }: { label: string; w?: number; h?: number }) {
  return (
    <span className="flex items-center justify-center rounded-md border border-dashed border-[#98989D] text-[9px] font-semibold tracking-[0.14em] text-[#6E6E73]" style={{ width: w, height: h }}>
      {label}
    </span>
  );
}

/* ── 128 · Agents & Distributors ───────────────────────────────────────── */

export function Agents() {
  return (
    <Chapter
      n={128}
      lead={
        <p>
          Our agents and distributors are KOLEEX to the customers they serve. They keep their own company
          name — and show their link to us in one consistent way: the Authorized badge.
        </p>
      }
      toc={[
        { id: "badge", title: "The Authorized badge" },
        { id: "may", title: "What an agent may do" },
        { id: "may-not", title: "What an agent may not do" },
        { id: "agent-card", title: "Business cards and pages" },
      ]}
    >
      <Section id="badge" title="The Authorized badge">
        <Rule why="A customer must be able to tell KOLEEX from the company that sells KOLEEX — for warranty, for service, for trust.">
          A partner shows its link to KOLEEX with the Authorized badge — never by placing its own logo next to
          ours, and never by calling itself KOLEEX.
        </Rule>
        <Examples cols={2}>
          <Example tone="do" caption="The badge — black, a silver frame and silver words, with the year. Renewed every year." bg="#F5F5F7" h={150}>
            <PartnerBadge place="Country" />
          </Example>
          <Example tone="do" caption="The white version — where the badge sits on black would not work (ch. 47)." bg="#FFFFFF" h={150}>
            <PartnerBadge role="Agent" place="City, Country" dark={false} />
          </Example>
        </Examples>
        <Specs rows={[
          ["Variants", "Authorized Distributor · Authorized Agent · Authorized Service Center"],
          ["Place line", "The country or city the agreement covers — nothing wider"],
          ["Files", "Made by KOLEEX for each partner and sent as a file; never rebuilt by the partner"],
          ["Minimum width", "40 mm in print, 160 px on screens"],
        ]} />
      </Section>

      <Section id="may" title="What an agent may do">
        <Bullets items={[
          "Show the Authorized badge on its website, shop, vehicles and documents.",
          <>Use KOLEEX product photos, catalogs and posts from the official files (<Ref n={136} />).</>,
          "Share and translate official KOLEEX posts, with the translation checked (ch. 30).",
          "Name KOLEEX products by their exact model names.",
        ]} />
      </Section>

      <Section id="may-not" title="What an agent may not do">
        <Bullets items={[
          "Register a company, domain, social account or group with “KOLEEX” in its name.",
          "Change, recolor or redraw the logo, or put its own logo next to it.",
          "Make its own KOLEEX catalogs, price lists with our branding, or claims we have not approved.",
          "Name our suppliers, show machines under another brand, or sell another brand as KOLEEX.",
        ]} />
        <Note tone="warn">The agreement with each partner says what it may do. Where the agreement and this book differ, the agreement decides — and the Marketing Manager is told.</Note>
      </Section>

      <Section id="agent-card" title="Business cards and pages">
        <Stage bg="#F5F5F7" h="auto" pad={24}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex w-[240px] flex-col justify-between rounded-[6px] bg-white p-3 text-[#1D1D1F] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ aspectRatio: "90 / 54" }}>
              <Box label="AGENT’S LOGO" w={100} h={26} />
              <div><p className="text-[10px] font-bold">Full Name</p><p className="text-[7px] text-[#6E6E73]">Sales Manager</p></div>
              <div className="flex items-end justify-between"><p className="text-[6px] text-[#6E6E73]">agent-company.com</p><PartnerBadge w={110} /></div>
            </div>
          </div>
        </Stage>
        <P>
          The agent’s card is the agent’s own, with its own logo and contacts. The Authorized badge sits at the
          foot, smaller than the agent’s logo. The agent’s social pages follow the same rule: its own name and
          picture, the badge in the cover image.
        </P>
      </Section>
    </Chapter>
  );
}

/* ── 129 · Dealer Signage ──────────────────────────────────────────────── */

function ShopFront({ wrong = false }: { wrong?: boolean }) {
  return (
    <div className="relative w-[260px] overflow-hidden rounded-[3px] bg-[#D1D1D6]" style={{ aspectRatio: "26 / 16" }}>
      <div className="absolute inset-x-0 top-0 flex h-[24%] items-center justify-center" style={{ background: wrong ? INK : "#FFFFFF" }}>
        {wrong ? <Wordmark color="#FFFFFF" width={130} /> : <Box label="DEALER’S NAME" w={140} h={24} />}
      </div>
      <div className="absolute bottom-0 left-[6%] top-[30%] w-[52%] rounded-t-[2px]" style={{ background: "linear-gradient(180deg,#98989D,#6E6E73)" }}>
        {!wrong && <div className="absolute right-[8%] top-[10%]"><PartnerBadge w={92} /></div>}
      </div>
      <div className="absolute bottom-0 right-[6%] top-[30%] w-[28%] rounded-t-[2px] bg-[#6E6E73]" />
    </div>
  );
}

export function DealerSignage() {
  return (
    <Chapter
      n={129}
      lead={
        <p>
          A dealer’s shop sells more than one thing, and often more than one brand. Its sign is its own. KOLEEX
          appears on the window and inside, clearly — as the machine brand the dealer is authorized to sell.
        </p>
      }
      toc={[
        { id: "front", title: "The shop front" },
        { id: "inside", title: "Inside the shop" },
        { id: "exclusive", title: "Exclusive KOLEEX stores" },
      ]}
    >
      <Section id="front" title="The shop front">
        <Examples cols={2}>
          <Example tone="do" caption="The dealer’s name on the fascia; the Authorized badge on the window." bg="#F5F5F7" h={210}>
            <ShopFront />
          </Example>
          <Example tone="dont" caption="Our logo as the shop’s name — the shop is not a KOLEEX store." bg="#F5F5F7" h={210}>
            <ShopFront wrong />
          </Example>
        </Examples>
        <Specs rows={[
          ["Window decal", "Authorized badge, 300–400 mm wide, cut vinyl, at eye height near the door"],
          ["Fascia", "The dealer’s own name; KOLEEX only with our written approval, and never larger than the dealer’s name"],
          ["Lit sign", "Optional: halo-lit letters, white light only (ch. 39) — no light boxes"],
        ]} />
      </Section>

      <Section id="inside" title="Inside the shop">
        <Bullets items={[
          "KOLEEX machines together, in one area, on white or light grey stands.",
          <>Spec cards on each machine (<Ref n={118} />); catalogs and brochures from the official files.</>,
          "One KOLEEX poster or roll-up for the area — not every wall.",
          "KOLEEX material never shares a panel with another machine brand.",
        ]} />
      </Section>

      <Section id="exclusive" title="Exclusive KOLEEX stores">
        <P>
          A store that sells only KOLEEX may, with a written agreement, use the logo on its fascia with the
          region lockup (<Ref n={43} />) — for example KOLEEX | Alexandria. It then follows the office and showroom
          chapters in full (<Ref n={117} />, <Ref n={118} />).
        </P>
      </Section>
    </Chapter>
  );
}

/* ── 130 · Suppliers & OEM ─────────────────────────────────────────────── */

export function SuppliersOem() {
  return (
    <Chapter
      n={130}
      lead={
        <p>
          This chapter is written for the factories that build KOLEEX machines and the people at KOLEEX who work
          with them. It turns one owner rule into practice: every machine is a KOLEEX machine, and the supplier
          is never shown.
        </p>
      }
      toc={[
        { id: "internal", title: "Who this chapter is for" },
        { id: "pack", title: "The branding pack" },
        { id: "check", title: "The pre-shipment check" },
        { id: "supplier-may-not", title: "What a supplier may not do" },
      ]}
    >
      <Section id="internal" title="Who this chapter is for">
        <Note tone="warn">Internal chapter — for KOLEEX staff and our suppliers under a confidentiality agreement. It is not part of the public copy of this book.</Note>
        <Rule why="Our customers buy KOLEEX. Our competitors would like to know where it is made. Both are reasons for the same rule.">
          No supplier name, logo, code, address or website appears on anything a customer receives — the
          machine, its parts, manual, carton, tape, labels or documents.
        </Rule>
      </Section>

      <Section id="pack" title="The branding pack">
        <P>Every purchase order carries the branding requirements (<Ref n={97} />) and is sent with the branding pack for that model:</P>
        <Table
          head={["File", "Used for", "Defined in"]}
          rows={[
            ["Logo, vector", "Machine arm, control box, motor cover", <Ref key="a" n={107} />],
            ["Nameplate artwork with the serial range", "Nameplate and serial labels", <Ref key="a" n={108} />],
            ["Safety and panel labels", "Machine labels", <Ref key="a" n={109} />],
            ["Carton and crate artwork", "Outer packing", <Ref key="a" n={110} />],
            ["Manual and warranty card", "Printed or PDF", <Ref key="a" n={113} />],
          ]}
        />
      </Section>

      <Section id="check" title="The pre-shipment check">
        <Rule why="A branding mistake found in the customer’s factory costs a relationship; found before loading it costs an hour.">
          No KOLEEX machine is shipped before its branding is checked in photos.
        </Rule>
        <Bullets items={[
          <>The supplier sends the eight standard photos of each model (<Ref n={65} />), with the nameplate and cartons.</>,
          "KOLEEX checks logo position, color and durability, the nameplate lines, the labels and the cartons.",
          "Anything wrong is fixed before loading — never “we will fix it next time”.",
        ]} />
      </Section>

      <Section id="supplier-may-not" title="What a supplier may not do">
        <Bullets items={[
          "Use the KOLEEX name, logo or machines in its own catalogs, website, social media or fairs.",
          "Tell anyone it builds machines for KOLEEX.",
          "Sell machines with KOLEEX branding to anyone but KOLEEX.",
          "Change a single element of the branding pack without written approval.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 131 · Testimonials & Case Studies ─────────────────────────────────── */

function QuoteCard() {
  return (
    <Post w={220} bg="#FFFFFF">
      <div className="absolute inset-0 flex flex-col p-[9%] text-[#1D1D1F]">
        <p className="text-[6.5px] font-semibold uppercase tracking-[0.2em] text-[#6E6E73]">Customer story</p>
        <p className="mt-3 text-[34px] font-bold leading-none text-[#D1D1D6]">“</p>
        <p className="-mt-2 text-[12px] font-bold leading-[1.25]">The machines arrived set up and ready. We were sewing the same afternoon.</p>
        <p className="mt-3 text-[7px] font-semibold">Name Surname</p>
        <p className="text-[6.5px] text-[#6E6E73]">Production Manager · Company · City</p>
        <div className="mt-auto flex items-center justify-between"><Wordmark color="#000000" width="34%" /></div>
      </div>
    </Post>
  );
}

export function Testimonials() {
  return (
    <Chapter
      n={131}
      lead={
        <p>
          A customer who says we did good work is worth more than any headline we could write. That is exactly
          why a testimonial must be real, used with permission, and never improved.
        </p>
      }
      toc={[
        { id: "permission", title: "Permission" },
        { id: "quote", title: "The quote" },
        { id: "case-study", title: "The case study" },
      ]}
    >
      <Section id="permission" title="Permission">
        <Rule why="Owner rule: customer names are never public — unless the customer agrees in writing.">
          Before a customer’s name, words, logo, photo or factory appears anywhere, we have their written
          permission for that exact use.
        </Rule>
        <Specs
          title="The permission form records"
          rows={[
            ["Who", "The person’s name and title, and the company"],
            ["What", "The exact quote, photos and logo we may use"],
            ["Where", "Website, social media, catalogs, presentations, fairs"],
            ["How long", "Until they withdraw it — and we remove it within 7 days"],
            ["Signed", "Name, signature and date; filed with the customer’s record"],
          ]}
        />
      </Section>

      <Section id="quote" title="The quote">
        <Examples cols={2}>
          <Example tone="do" caption="The customer’s own words, a real name and role, with permission." bg="#F5F5F7" h={300}>
            <QuoteCard />
          </Example>
          <Example tone="dont" caption="Invented or polished praise, an anonymous “happy customer”, a stock photo." bg="#F5F5F7" h={300}>
            <Post w={220} bg="#FFFFFF">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-[9%] text-center text-[#1D1D1F]">
                <p className="text-[12px] font-bold leading-tight">“The best machines in the world!!! 10/10”</p>
                <p className="text-[7px] text-[#6E6E73]">— A happy customer</p>
                <span className="text-[14px] tracking-[0.2em]" style={{ color: "#EAB308" }}>★★★★★</span>
              </div>
            </Post>
          </Example>
        </Examples>
        <Bullets items={[
          "Shorten a quote only with the customer’s approval of the shortened words; never change its meaning.",
          "Numbers — output, savings, time — come from the customer and are stated as theirs.",
          "Translate with care and show the customer the translation (ch. 30).",
        ]} />
      </Section>

      <Section id="case-study" title="The case study">
        <Table
          head={["Part", "Content", "Length"]}
          rows={[
            [<B key="a">The customer</B>, "Who they are, what they make, where", "2–3 lines"],
            [<B key="a">The need</B>, "The problem in their words", "1 paragraph"],
            [<B key="a">What we did</B>, "Machines, setup, training, service", "1–2 paragraphs"],
            [<B key="a">The result</B>, "What changed, with their numbers", "1 paragraph + 1 quote"],
            [<B key="a">Photos</B>, <>Our own, in their factory, with consent (<Ref n={67} />)</>, "3–6"],
          ]}
        />
        <Note>
          Where a customer agrees to share the story but not the name, it is told as “a knitwear factory in
          Alexandria” — never with a made-up name. Questions: <span className="font-mono">{KOLEEX_COMPANY.email}</span>.
        </Note>
        <P>Case studies use the presentation and document templates of Parts 4–5.</P>
      </Section>
    </Chapter>
  );
}

