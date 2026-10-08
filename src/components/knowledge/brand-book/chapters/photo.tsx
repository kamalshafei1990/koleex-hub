"use client";

/* Chapters 63–69: photography principles, studio and mobile product
   photography, people, factory, events, image editing & AI policy.

   Owner decisions (27/09/2026): our own photographs only; people with their
   consent; AI images for abstract backgrounds only; photos are often taken
   on a phone, so the phone protocol must be exact. Apple direction: product
   on PURE BLACK first (dramatic top light) and PURE WHITE second (soft,
   even light); close-ups; people and factories in cool, muted colour.

   There is no KOLEEX photo library yet, so the examples here are drawn
   scenes (flat 2D, clearly schematic) rather than borrowed photographs —
   which would break the very rule this part sets. */

import type { ReactNode } from "react";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import FlatBedMachineIcon from "@/components/icons/machine-kinds/FlatBedMachineIcon";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { MachineShot } from "../mockups";

/** A schematic photograph: a frame, a ground, a machine — and whatever is wrong with it. */
function Scene({ bg = "#FFFFFF", floor = "#F5F5F7", tilt = 0, scale = 1, clutter = false, backlight = false, children }: {
  bg?: string; floor?: string; tilt?: number; scale?: number; clutter?: boolean; backlight?: boolean; children?: ReactNode;
}) {
  return (
    <div className="relative h-[150px] w-[210px] overflow-hidden rounded-md shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ background: bg }}>
      <div className="absolute inset-x-0 bottom-0 h-[38%]" style={{ background: floor }} />
      {backlight && <div className="absolute inset-y-0 right-0 w-1/2" style={{ background: "linear-gradient(90deg,rgba(255,255,255,0),#FFFFFF)" }} />}
      {clutter && (
        <>
          <div className="absolute bottom-6 left-2 h-12 w-10 rounded-sm bg-[#D97706]/70" />
          <div className="absolute bottom-8 left-10 h-8 w-12 rounded-sm bg-[#92400E]/60" />
          <div className="absolute bottom-5 right-3 h-16 w-8 rounded-sm bg-[#6E6E73]" />
          <div className="absolute right-12 top-3 h-6 w-16 rounded-sm bg-[#DC2626]/60" />
        </>
      )}
      <div className="absolute left-1/2 top-[52%]" style={{ transform: `translate(-50%,-50%) rotate(${tilt}deg) scale(${scale})`, color: backlight ? "#6E6E73" : "#000000" }}>
        <FlatBedMachineIcon size={86} />
      </div>
      {children}
      <span className="absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[8px] tracking-[0.14em] text-white">PHOTO</span>
    </div>
  );
}

/** A labelled placeholder for a kind of image we never publish. */
function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-[150px] w-[210px] items-center justify-center rounded-md border border-dashed border-[#98989D] bg-[#F5F5F7] px-3 text-center text-[10px] font-semibold tracking-[0.14em] text-[#6E6E73]">
      {label}
    </div>
  );
}

/* ── 63 · Photography Principles ───────────────────────────────────────── */

export function PhotoPrinciples() {
  return (
    <Chapter
      n={63}
      lead={
        <p>
          The machine is the hero. Our photographs show real KOLEEX machines — on pure black, lit like a
          product launch, or on pure white for the catalog. They must be ours, and they must be true.
        </p>
      }
      toc={[
        { id: "hero", title: "The machine is the hero" },
        { id: "five", title: "Five principles" },
        { id: "own-only", title: "Our own photographs only" },
        { id: "subjects", title: "What we photograph" },
        { id: "look", title: "The KOLEEX look" },
        { id: "photo-donts", title: "What never to publish" },
      ]}
    >
      <Section id="hero" title="The machine is the hero">
        <Examples cols={2}>
          <Example tone="do" caption="First: pure black, one light from above — heroes, ads, launches." bg="#000000" h={260}><MachineShot w={300} /></Example>
          <Example tone="do" caption="Second: pure white, soft even light — catalog, website, spec sheets." bg="#FFFFFF" h={260}><MachineShot w={300} dark={false} /></Example>
        </Examples>
        <Note>Until the studio shoot, the book shows the white KOLEEX machine as a simple shape. Every place it appears is a place for a real KOLEEX photograph.</Note>
      </Section>

      <Section id="five" title="Five principles">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Real", "Our machines, our people, our places. Never stock, never borrowed."],
            ["Honest", "What you see is what the customer receives. No edit changes the product."],
            ["Clean", "One subject on pure black or pure white. Nothing else in the frame."],
            ["Precise", "Sharp, level, true color. Details visible."],
            ["Consistent", "Same light, same angles, same background across a series."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-[24px] bg-[var(--bg-secondary)] p-6">
              <p className="text-[19px] font-semibold tracking-[-0.015em] text-[var(--text-primary)]">{t}</p>
              <p className="mt-1.5 text-[15px] leading-[1.5] text-[var(--text-secondary)]">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="own-only" title="Our own photographs only">
        <Rule why="A stock or borrowed photo tells the customer something that is not true about us — and any reverse image search can prove it. Borrowed photos also carry copyright risk.">
          KOLEEX publishes only photographs it took or commissioned: of machines it sells, in places it
          works, of people who agreed to be photographed.
        </Rule>
        <Bullets items={[
          <><B>No stock photos</B> of offices, cities, handshakes or “teams” presented as KOLEEX.</>,
          <><B>No supplier or catalog photos</B>, and no photos showing another brand’s product or logo.</>,
          <><B>No photos found online</B>, whatever the source says about licences.</>,
          <>If we do not have the right photograph yet, we use a clean layout without one until we shoot it — never a borrowed one.</>,
        ]} />
      </Section>

      <Section id="subjects" title="What we photograph">
        <Table
          head={["Subject", "Chapter"]}
          rows={[
            [<B key="a">Products in a studio</B>, <Ref key="b" n={64} />],
            [<B key="a">Products with a phone</B>, <Ref key="b" n={65} />],
            [<B key="a">People and the team</B>, <Ref key="b" n={66} />],
            [<B key="a">Factories and production</B>, <Ref key="b" n={67} />],
            [<B key="a">Exhibitions and events</B>, <Ref key="b" n={68} />],
            [<B key="a">Editing and AI</B>, <Ref key="b" n={69} />],
          ]}
        />
      </Section>

      <Section id="look" title="The KOLEEX look">
        <Specs rows={[
          ["Product background", "Pure black #000000 first; pure white #FFFFFF second. Never grey paper, never a room"],
          ["Light on black", "One large soft light from above and slightly behind — the silver finish glows, the edges fall into black"],
          ["Light on white", "Soft and even — two large softboxes; a short contact shadow only"],
          ["Close-ups", "Needle, stitch, control panel, nameplate — macro, shallow depth"],
          ["People and factories", "Real color graded cool and calm: slightly lower saturation, clean whites, no warm cast"],
          ["Framing", "The subject centered with generous space around it; the camera level"],
        ]} />
      </Section>

      <Section id="photo-donts" title="What never to publish">
        <Examples cols={3}>
          <Example tone="dont" caption="Stock images presented as KOLEEX." h={180}><Placeholder label="STOCK: CITY SKYLINE / HANDSHAKE" /></Example>
          <Example tone="dont" caption="A machine among boxes and clutter." h={180}><Scene clutter bg="#D2D2D7" floor="#98989D" /></Example>
          <Example tone="dont" caption="Another brand's product or logo." h={180}><Placeholder label="OTHER BRAND'S MACHINE" /></Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 64 · Product Photography: Studio ──────────────────────────────────── */

function StudioPlan() {
  return (
    <svg viewBox="0 0 420 260" className="h-auto w-full max-w-[460px]" role="img" aria-label="Studio lighting plan seen from above">
      <path d="M40 30 H380 V120 Q210 150 40 120 Z" fill="#F5F5F7" stroke="#D2D2D7" />
      <text x="210" y="24" textAnchor="middle" fontSize="11" fill="#6E6E73" fontFamily="Inter, sans-serif">White seamless background</text>
      <g transform="translate(174 58) scale(3)" color="#000000"><FlatBedMachineIcon size={24} /></g>
      <rect x="40" y="150" width="70" height="26" rx="4" fill="#E8E8ED" stroke="#8E8E93" transform="rotate(-35 75 163)" />
      <text x="58" y="205" fontSize="10.5" fill="#6E6E73" fontFamily="Inter, sans-serif">Key light 45°</text>
      <rect x="310" y="150" width="70" height="26" rx="4" fill="#E8E8ED" stroke="#8E8E93" transform="rotate(35 345 163)" />
      <text x="318" y="205" fontSize="10.5" fill="#6E6E73" fontFamily="Inter, sans-serif">Fill light 45°</text>
      <g transform="translate(198 212)" color="#000000"><CameraIcon size={24} /></g>
      <text x="210" y="252" textAnchor="middle" fontSize="10.5" fill="#000000" fontFamily="Inter, sans-serif">Camera on tripod, at machine-head height</text>
    </svg>
  );
}

export function StudioPhoto() {
  return (
    <Chapter
      n={64}
      lead={
        <p>
          Studio photographs are the master images of every machine: the catalog, the website, the spec
          sheet and the Hub all start from them. Every machine is shot the same way, so a catalog page
          looks like one family.
        </p>
      }
      toc={[
        { id: "setup", title: "The setup" },
        { id: "settings", title: "Camera settings" },
        { id: "shot-list", title: "The shot list" },
        { id: "as-sold", title: "Photograph machines as sold" },
        { id: "delivery", title: "Files to deliver" },
      ]}
    >
      <Section id="setup" title="The setup">
        <Stage bg="#FFFFFF" h="auto" pad={20}><StudioPlan /></Stage>
        <Specs rows={[
          ["Background — hero set", "Black seamless paper or velvet, pure black in the file (#000000)"],
          ["Light — hero set", "One large softbox or strip light above and slightly behind; black flags at the sides"],
          ["Background — catalog set", "White seamless paper, pure white in the file (#FFFFFF)"],
          ["Light — catalog set", "Two large softboxes at 45°, front-left and front-right; soft contact shadow only"],
          ["Machine", "Cleaned, dust-free, threaded if the shot shows sewing; protective film removed"],
        ]} />
      </Section>

      <Section id="settings" title="Camera settings">
        <Specs rows={[
          ["Lens", "50–100 mm equivalent — no wide angle (it distorts the machine)"],
          ["Aperture", "f/8–f/11 so the whole machine is sharp"],
          ["ISO", "100–200"],
          ["White balance", "Set from a grey card, or 5500 K"],
          ["Support", "Tripod always"],
          ["Format", "RAW + JPEG"],
        ]} />
      </Section>

      <Section id="shot-list" title="The shot list">
        <Table
          head={["#", "Shot", "Why"]}
          rows={[
            ["1", "Front", "The catalog and website hero"],
            ["2", "Front ¾ left", "Shape and depth"],
            ["3", "Front ¾ right", "Shape and depth, from the operator's side"],
            ["4", "Left side", "Arm and length"],
            ["5", "Right side", "Handwheel, motor side"],
            ["6", "Back", "Connections and cables"],
            ["7", "Top", "Bed and work area"],
            ["8", "Details", "Needle area, control panel, motor, KOLEEX nameplate, accessories laid flat"],
          ]}
        />
      </Section>

      <Section id="as-sold" title="Photograph machines as sold">
        <Rule why="The photo is a promise: it must show exactly what the customer will receive.">
          Machines are photographed exactly as sold, with their KOLEEX branding. A machine that carries
          another brand is not photographed for KOLEEX material — and another brand’s logo is never
          edited out to make it look like ours.
        </Rule>
      </Section>

      <Section id="delivery" title="Files to deliver">
        <Specs rows={[
          ["Master", "RAW files, kept in the company media library"],
          ["Print", "JPEG or TIFF, full resolution, maximum quality"],
          ["Web and Hub", "JPEG, sRGB, 3000 px on the long side"],
          ["Cut-outs", "PNG with transparent background, for catalogs and spec sheets"],
          ["File names", <span key="f">Model, view and date — see <Ref n={135} /></span>],
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 65 · Product Photography: Mobile ──────────────────────────────────── */

function EightAngles() {
  const cx = 210; const cy = 150; const r = 110;
  /* Degrees around the machine, clockwise from its front — unambiguous for
     whoever is holding the phone. */
  const labels = ["Front 0°", "45°", "Side 90°", "135°", "Back 180°", "225°", "Side 270°", "315°"];
  return (
    <svg viewBox="0 0 420 300" className="h-auto w-full max-w-[460px]" role="img" aria-label="Eight camera positions around a machine, seen from above">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#D2D2D7" strokeDasharray="4 4" />
      <g transform={`translate(${cx - 36} ${cy - 36}) scale(3)`} color="#000000"><FlatBedMachineIcon size={24} /></g>
      {labels.map((l, i) => {
        const a = (Math.PI / 2) + (i * Math.PI) / 4;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        const main = i === 0 || i === 1 || i === 7;
        return (
          <g key={l}>
            <circle cx={x} cy={y} r="13" fill={main ? "#1D1D1F" : "#FFFFFF"} stroke="#1D1D1F" strokeWidth="1.5" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={main ? "#FFFFFF" : "#1D1D1F"} fontFamily="Inter, sans-serif">{i + 1}</text>
            <text x={x + (Math.cos(a) >= 0 ? 18 : -18)} y={y + 4} textAnchor={Math.cos(a) >= 0 ? "start" : "end"} fontSize="10.5" fill="#6E6E73" fontFamily="Inter, sans-serif">{l}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function MobilePhoto() {
  return (
    <Chapter
      n={65}
      lead={
        <p>
          Most KOLEEX photographs are taken on a phone — at the warehouse, in a factory, at a customer’s
          workshop. A phone can take a catalog-quality photo when the protocol below is followed exactly.
        </p>
      }
      toc={[
        { id: "phone", title: "Set up the phone" },
        { id: "place", title: "Set up the place" },
        { id: "angles", title: "The eight angles" },
        { id: "checklist", title: "Checklist before you send" },
        { id: "mobile-examples", title: "Right and wrong" },
      ]}
    >
      <Section id="phone" title="Set up the phone">
        <Specs rows={[
          ["Lens", "The main 1× camera — never the 0.5× wide lens"],
          ["Grid", "On — keep the machine level and centered"],
          ["Mode", "Photo, highest resolution. No portrait mode, beauty mode or filters"],
          ["Flash", "Off"],
          ["Focus", "Tap and hold on the machine to lock focus and exposure"],
          ["Lens glass", "Wipe it clean before every session"],
          ["Format", "JPEG (\"Most compatible\" on iPhone)"],
        ]} />
      </Section>

      <Section id="place" title="Set up the place">
        <Bullets items={[
          <><B>Background:</B> a 2 × 3 m white paper roll or cloth behind and under the machine — or black velvet for the black set. Never a room, never a grey wall.</>,
          <><B>Clear the area:</B> no boxes, tools, bags, cables or other brands in the frame. Clean the floor.</>,
          <><B>Light:</B> daylight from a large window beside the machine, or outdoors in the shade. No direct sun, no mixed colored lights.</>,
          <><B>Machine:</B> clean, covers on, protective film off, KOLEEX nameplate visible.</>,
        ]} />
      </Section>

      <Section id="angles" title="The eight angles">
        <Stage bg="#FFFFFF" h="auto" pad={20}><EightAngles /></Stage>
        <P>Walk around the machine in steps of 45° and take all eight, holding the phone level at the height of the machine head. Positions 1, 2 and 8 (in blue: the front and the two front corners) are used most — take extra of those. Then add close-ups: needle area, control panel, motor, nameplate.</P>
      </Section>

      <Section id="checklist" title="Checklist before you send">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            "Machine sharp, level and filling most of the frame",
            "Plain background, nothing else in the photo",
            "No other brand's logo or product visible",
            "True colors — white looks white",
            "No people's faces unless they agreed",
            "No screens, documents or labels with private data",
            "All eight angles plus close-ups",
            "Sent as original files, not screenshots or compressed chat images",
          ].map((t) => (
            <div key={t} className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-secondary)]">
              <span className="mt-[2px] h-3.5 w-3.5 shrink-0 rounded border border-[#98989D]" aria-hidden />{t}
            </div>
          ))}
        </div>
        <Note tone="warn">WhatsApp and WeChat compress photos. Send originals as <B>documents / files</B>, or upload them to the Hub directly.</Note>
      </Section>

      <Section id="mobile-examples" title="Right and wrong">
        <Examples cols={2}>
          <Example tone="do" caption="Level, centered, plain background, soft light." bg="#F5F5F7" h={180}><Scene /></Example>
          <Example tone="dont" caption="Clutter and other products in the frame." bg="#F5F5F7" h={180}><Scene clutter bg="#D2D2D7" floor="#98989D" /></Example>
          <Example tone="dont" caption="Tilted, taken with the wide lens." bg="#F5F5F7" h={180}><Scene tilt={-9} scale={1.25} /></Example>
          <Example tone="dont" caption="Shot against a bright window — the machine goes dark." bg="#F5F5F7" h={180}><Scene backlight bg="#D2D2D7" /></Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 66 · People & Team Photography ─────────────────────────────────────── */

export function PeoplePhoto() {
  return (
    <Chapter
      n={66}
      lead={
        <p>
          People make KOLEEX: the team that selects and checks the machines, the technicians who install
          them, the customers who run them. We photograph them with respect — and only with their
          permission.
        </p>
      }
      toc={[
        { id: "consent", title: "Consent first" },
        { id: "portraits", title: "Team portraits" },
        { id: "at-work", title: "People at work" },
        { id: "privacy", title: "Privacy in the frame" },
      ]}
    >
      <Section id="consent" title="Consent first">
        <Rule why="A photograph of a person is their personal data. Publishing it without permission can break the law in China, Egypt and the Gulf — and it breaks trust everywhere.">
          Nobody appears in KOLEEX material without their written permission. Customers’ staff appear
          only with the customer’s permission too. Children never.
        </Rule>
      </Section>

      <Section id="portraits" title="Team portraits">
        <Examples cols={2}>
          <Example tone="do" caption="Black background, soft light from above, shoulders up, level eyes." bg="#F5F5F7" h={200}>
            <div className="flex h-[170px] w-[136px] items-end justify-center overflow-hidden rounded-md shadow-[0_0_0_1px_rgba(0,0,0,0.1)]" style={{ background: "radial-gradient(90% 70% at 50% 10%, #3A3A3C 0%, #000000 70%)" }}>
              <div className="flex flex-col items-center"><div className="h-14 w-14 rounded-full" style={{ background: "linear-gradient(180deg,#D1D1D6,#8E8E93)" }} /><div className="mt-1 h-16 w-28 rounded-t-[48px] bg-[#1D1D1F]" /></div>
            </div>
          </Example>
          <Example tone="dont" caption="Busy background, harsh flash, cropped at an angle." bg="#F5F5F7" h={200}>
            <div className="relative flex h-[170px] w-[136px] items-end justify-center overflow-hidden rounded-md shadow-[0_0_0_1px_rgba(0,0,0,0.1)]" style={{ background: "repeating-linear-gradient(90deg,#D97706 0 10px,#6E6E73 10px 22px)", transform: "rotate(-6deg)" }}>
              <div className="flex flex-col items-center"><div className="h-14 w-14 rounded-full bg-[#F5F5F7]" /><div className="mt-1 h-16 w-28 rounded-t-[48px] bg-[#1D1D1F]" /></div>
            </div>
          </Example>
        </Examples>
        <Specs rows={[
          ["Background", "Black for everyone — the same as the machine photos; plain white is the second version (ch. 47)"],
          ["Light", "Soft light from above and a little to the side, like the machine hero shots; no flash"],
          ["Crop", "Shoulders up, 4 : 5, eyes on the upper third"],
          ["Clothes", "KOLEEX uniform or plain dark clothing; no large logos"],
          ["Color", "Cool and muted — lower saturation, clean skin tones. A series may be black and white — never mixed on one page"],
          ["File", "2000 × 2500 px JPEG, sRGB"],
        ]} />
      </Section>

      <Section id="at-work" title="People at work">
        <Bullets items={[
          "Real work, not poses: hands threading a machine, a technician adjusting a feed, an inspector checking a seam.",
          "Correct safety gear in every factory and warehouse shot.",
          "No staged handshakes, pointing at laptops or stacked hands.",
          <>Social responsibility is shown only with photographs of <B>our own real projects</B> (<Ref n={132} />).</>,
        ]} />
      </Section>

      <Section id="privacy" title="Privacy in the frame">
        <Bullets items={[
          "Blur or remove name badges, screens, documents and labels with private or customer data.",
          "No car number plates, no phone numbers on whiteboards.",
          "If someone asks to be removed from a published photo, remove it.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 67 · Factory & Production Photography ─────────────────────────────── */

export function FactoryPhoto() {
  return (
    <Chapter
      n={67}
      lead={
        <p>
          Factory and production photographs prove that our machines are built, checked and packed with care.
          They are powerful — which is why they have the strictest rules on honesty and confidentiality.
        </p>
      }
      toc={[
        { id: "honest", title: "Honest labels" },
        { id: "shoot", title: "What to shoot" },
        { id: "safety", title: "Safety and order" },
        { id: "confidential", title: "Confidentiality" },
      ]}
    >
      <Section id="honest" title="Honest labels">
        <Rule why="Customers make decisions on what they believe about our production. Presenting a partner's factory as our own is a false claim.">
          A photograph of a factory says whose factory it is. Our own facilities are shown as ours; a partner
          factory is never presented as KOLEEX’s own.
        </Rule>
      </Section>

      <Section id="shoot" title="What to shoot">
        <Table
          head={["Shot", "Shows"]}
          rows={[
            [<B key="a">Wide</B>, "The line, the warehouse or the test area — clean and working"],
            [<B key="a">Medium</B>, "A process: assembly, testing, inspection, packing"],
            [<B key="a">Detail</B>, "Hands, tools, a seam test, a measurement, the KOLEEX nameplate going on"],
          ]}
        />
        <P>Take all three for every process: together they tell the story; alone, a wide shot says little.</P>
      </Section>

      <Section id="safety" title="Safety and order">
        <Bullets items={[
          "Everyone in the frame wears the required safety gear.",
          "Machine guards in place; no unsafe practice shown, even for a second.",
          "Tidy the area before shooting — floors clear, materials stacked, cables managed.",
        ]} />
      </Section>

      <Section id="confidential" title="Confidentiality">
        <Note tone="warn">Our suppliers are confidential (<Ref n={130} />). Nothing in a published photo may reveal who they are.</Note>
        <Bullets items={[
          "No supplier names, logos, signs, uniforms or packaging in the frame.",
          "No screens, drawings, orders or labels that show supplier or customer data.",
          "No other clients' products on the line.",
          "Photograph a partner's premises only with their permission.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 68 · Exhibition & Event Photography ───────────────────────────────── */

export function EventPhoto() {
  return (
    <Chapter
      n={68}
      lead={
        <p>
          At CISMA and every other fair, the booth is the brand at full size. Photographs record it, feed our
          social channels during the event and become proof of our presence afterwards.
        </p>
      }
      toc={[
        { id: "shot-list", title: "The event shot list" },
        { id: "timing", title: "Timing" },
        { id: "publishing", title: "Publishing" },
        { id: "event-donts", title: "What never to publish" },
      ]}
    >
      <Section id="shot-list" title="The event shot list">
        <Table
          head={["When", "Shot"]}
          rows={[
            ["Before doors open", "The empty booth, wide and from each corner — the clean record of the booth"],
            ["Opening hours", "Demonstrations with machines running, visitors at the counter, the team at work"],
            ["Meetings", "Only with the visitor's permission; signings only with the customer's written permission"],
            ["Details", "Signage, product displays, catalogs, the KOLEEX wall"],
          ]}
        />
      </Section>

      <Section id="timing" title="Timing">
        <Specs rows={[
          ["Clean booth shots", "The first 30 minutes before opening"],
          ["Atmosphere", "Peak hours — usually late morning"],
          ["Every day", "A short set for social media"],
        ]} />
      </Section>

      <Section id="publishing" title="Publishing">
        <Bullets items={[
          "Post during the event, on the same day where possible.",
          <>Caption with the fair name, city, dates (DD/MM/YYYY) and booth number: <B>CISMA 2027 · Shanghai · Hall 0 · Booth 000</B> (example).</>,
          "Use the post templates in Part 4 so every event looks like KOLEEX.",
        ]} />
      </Section>

      <Section id="event-donts" title="What never to publish">
        <Bullets items={[
          "Competitors' booths or products in the frame.",
          "Visitors' badges, faces in close-up, or business cards that can be read.",
          "Blurry crowd shots and photos of an untidy booth.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 69 · Image Editing & AI Policy ────────────────────────────────────── */

export function ImageEditing() {
  return (
    <Chapter
      n={69}
      lead={
        <p>
          Editing makes a good photograph clean; it never makes a false one. And artificial intelligence
          never replaces a photograph of something real.
        </p>
      }
      toc={[
        { id: "allowed", title: "Edits that are allowed" },
        { id: "not-allowed", title: "Edits that are never allowed" },
        { id: "ai", title: "AI images" },
        { id: "export", title: "Export and storage" },
      ]}
    >
      <Section id="allowed" title="Edits that are allowed">
        <Bullets items={[
          "Exposure, contrast and white balance.",
          "Cropping, straightening and perspective correction.",
          "Removing dust, scratches on the backdrop, stray threads.",
          "Cleaning the background to pure black or pure white.",
          "The cool, muted grade on people and factory photos — the same preset for a whole series.",
          "Noise reduction and upscaling of our own photographs, when the result is still a true photograph.",
        ]} />
      </Section>

      <Section id="not-allowed" title="Edits that are never allowed">
        <Rule why="A retouched feature is a promise the machine cannot keep — and a claim a customer can hold us to.">
          No edit changes what the product is: its shape, color, parts, features or condition.
        </Rule>
        <Bullets items={[
          "Adding, removing or moving parts.",
          "Changing a machine's color to show a version we do not have.",
          "Hiding defects instead of fixing the machine and reshooting.",
          "Removing another brand's logo to present a product as ours.",
          "Putting a product into a scene it was never in, or adding people who were not there.",
        ]} />
      </Section>

      <Section id="ai" title="AI images">
        <Table
          head={["Allowed", "Never"]}
          rows={[
            ["Abstract backgrounds: textures, gradients, soft shapes behind a layout", "Machines, parts or accessories"],
            ["Technical clean-up of our own photographs (noise, upscaling)", "People, faces, teams or customers"],
            ["", "Factories, offices, warehouses, exhibitions or events"],
          ]}
        />
        <Note tone="warn">Where a platform or the law requires AI-generated content to be labelled — for example in mainland China — it is labelled.</Note>
      </Section>

      <Section id="export" title="Export and storage">
        <Specs rows={[
          ["Web, Hub, social", "JPEG, sRGB, 2000–3000 px long side, quality 80–85"],
          ["Print", "Full resolution JPEG or TIFF at 300 dpi at the printed size"],
          ["Cut-outs", "PNG with transparency"],
          ["Originals", "Kept unedited (RAW or original JPEG) in the company media library — never only on a phone"],
        ]} />
      </Section>
    </Chapter>
  );
}
