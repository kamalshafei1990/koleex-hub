"use client";

/* Chapter 136: Downloads — every file the book offers, in one place. */

import { Chapter, Downloads, Note, P, Ref, Rule, Section, Table } from "../kit";
import { HUB_MARK_FILES } from "../marks";

export function DownloadsChapter() {
  return (
    <Chapter
      n={136}
      lead={
        <p>
          The official files, ready to use. Take them from here every time — never from an old email, a
          screenshot or a previous job — so every piece of KOLEEX material starts from the same master.
        </p>
      }
      toc={[
        { id: "pack", title: "Complete logo pack" },
        { id: "logo", title: "KOLEEX logo" },
        { id: "tiles", title: "Logo tiles" },
        { id: "hub", title: "Koleex Hub mark & app icon" },
        { id: "colors", title: "Colors" },
        { id: "fonts", title: "Fonts" },
        { id: "coming", title: "Coming next" },
      ]}
    >
      <Section id="pack" title="Complete logo pack">
        <Rule why="An old copy may be a redrawn, recolored or low-resolution version. The master is the only safe source.">
          Always download the logo from this page. Never copy it from a website, a PDF or a screenshot.
        </Rule>
        <Downloads items={[
          { label: "KOLEEX logo pack", href: "/brand/kit/koleex-logo-pack.zip", format: "ZIP", note: "Logo (SVG + PNG, black and white), logo tiles, colors and silver, README" },
        ]} />
      </Section>

      <Section id="logo" title="KOLEEX logo">
        <Downloads items={[
          { label: "Black — master vector", href: "/brand/koleex-logo-black.svg", format: "SVG", note: "For light backgrounds" },
          { label: "White — master vector", href: "/brand/koleex-logo-white.svg", format: "SVG", note: "For dark backgrounds" },
          { label: "Black — 1000 px", href: "/brand/kit/koleex-logo-black-1000.png", format: "PNG" },
          { label: "Black — 2000 px", href: "/brand/kit/koleex-logo-black-2000.png", format: "PNG" },
          { label: "Black — 4000 px", href: "/brand/kit/koleex-logo-black-4000.png", format: "PNG" },
          { label: "White — 1000 px", href: "/brand/kit/koleex-logo-white-1000.png", format: "PNG" },
          { label: "White — 2000 px", href: "/brand/kit/koleex-logo-white-2000.png", format: "PNG" },
          { label: "White — 4000 px", href: "/brand/kit/koleex-logo-white-4000.png", format: "PNG" },
        ]} />
        <P>Which file for which job: <Ref n={36} />.</P>
      </Section>

      <Section id="tiles" title="Logo tiles">
        <Downloads items={[
          { label: "Logo tile — white on black, 1024 px", href: "/brand/kit/koleex-avatar-dark-1024.png", format: "PNG", note: "Profile pictures, app icons, favicons" },
          { label: "Logo tile — white on black, 512 px", href: "/brand/kit/koleex-avatar-dark-512.png", format: "PNG" },
          { label: "Logo tile — black on white, 1024 px", href: "/brand/kit/koleex-avatar-light-1024.png", format: "PNG" },
          { label: "Logo tile — black on white, 512 px", href: "/brand/kit/koleex-avatar-light-512.png", format: "PNG" },
          { label: "Logo tile — white on black, vector", href: "/brand/kit/koleex-avatar-dark.svg", format: "SVG" },
          { label: "Logo tile — black on white, vector", href: "/brand/kit/koleex-avatar-light.svg", format: "SVG" },
        ]} />
        <P>How and where to use them: <Ref n={41} />.</P>
      </Section>

      <Section id="hub" title="Koleex Hub mark & app icon">
        <Downloads items={[
          { label: "Horizontal — for dark", href: HUB_MARK_FILES.horizontal("for-dark"), format: "PNG" },
          { label: "Horizontal — for light", href: HUB_MARK_FILES.horizontal("for-light"), format: "PNG" },
          { label: "Stacked — for dark", href: HUB_MARK_FILES.stacked("for-dark"), format: "PNG" },
          { label: "Stacked — for light", href: HUB_MARK_FILES.stacked("for-light"), format: "PNG" },
          { label: "One color — for dark", href: HUB_MARK_FILES.horizontal("mono-dark"), format: "PNG" },
          { label: "One color — for light", href: HUB_MARK_FILES.horizontal("mono-light"), format: "PNG" },
          { label: "App icon, 512 px", href: "/icon-512.png", format: "PNG" },
        ]} />
        <P>Where the Hub mark may appear: <Ref n={42} />.</P>
      </Section>

      <Section id="colors" title="Colors">
        <Downloads items={[
          { label: "Brand colors — CSS variables", href: "/brand/kit/koleex-colors.css", format: "CSS" },
          { label: "Brand colors — JSON (HEX, RGB, CMYK)", href: "/brand/kit/koleex-colors.json", format: "JSON" },
        ]} />
        <Note tone="warn">CMYK values are starting values for a printer — approve every print job on a physical proof (<Ref n={48} />).</Note>
      </Section>

      <Section id="fonts" title="Fonts">
        <Table
          head={["Font", "For", "Official source"]}
          rows={[
            ["Inter", "All Latin text — headlines in the Display cut", <a key="a" href="https://rsms.me/inter/" target="_blank" rel="noreferrer" className="text-[var(--bk-link)] hover:underline underline-offset-2">rsms.me/inter</a>],
            ["Noto Sans Arabic", "All Arabic text", <a key="a" href="https://fonts.google.com/noto/specimen/Noto+Sans+Arabic" target="_blank" rel="noreferrer" className="text-[var(--bk-link)] hover:underline underline-offset-2">fonts.google.com/noto</a>],
            ["Noto Sans SC", "All Chinese text", <a key="a" href="https://fonts.google.com/noto/specimen/Noto+Sans+SC" target="_blank" rel="noreferrer" className="text-[var(--bk-link)] hover:underline underline-offset-2">fonts.google.com/noto</a>],
          ]}
        />
        <Note>All three are free under the SIL Open Font License. If a source cannot be opened from mainland China, ask the Marketing Manager for the files.</Note>
      </Section>

      <Section id="coming" title="Coming next">
        <P>
          Templates arrive with the chapters that define them: presentation master, business card, letterhead,
          email signature, social post templates, catalog and spec sheet pages. They will be listed here and in
          <Ref n={137} />.
        </P>
      </Section>
    </Chapter>
  );
}
