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
        { id: "k", title: "K monogram" },
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
          { label: "KOLEEX logo pack", href: "/brand/kit/koleex-logo-pack.zip", format: "ZIP", note: "Logo (SVG + PNG, black and white), K monogram, colors, README" },
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

      <Section id="k" title="K monogram">
        <Downloads items={[
          { label: "K — black", href: "/brand/kit/koleex-k-black.svg", format: "SVG" },
          { label: "K — white", href: "/brand/kit/koleex-k-white.svg", format: "SVG" },
          { label: "K tile — dark, 1024 px (profile pictures)", href: "/brand/kit/koleex-k-tile-dark-1024.png", format: "PNG" },
          { label: "K tile — dark, 512 px", href: "/brand/kit/koleex-k-tile-dark-512.png", format: "PNG" },
          { label: "K tile — light, 1024 px", href: "/brand/kit/koleex-k-tile-light-1024.png", format: "PNG" },
          { label: "K tile — light, 512 px", href: "/brand/kit/koleex-k-tile-light-512.png", format: "PNG" },
          { label: "K tile — dark, vector", href: "/brand/kit/koleex-k-tile-dark.svg", format: "SVG" },
          { label: "K tile — light, vector", href: "/brand/kit/koleex-k-tile-light.svg", format: "SVG" },
        ]} />
        <P>When to use the K: <Ref n={41} />.</P>
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
            ["Inter", "All Latin text", <a key="a" href="https://rsms.me/inter/" target="_blank" rel="noreferrer" className="text-[#3E6796] underline underline-offset-2 dark:text-[#7FA9D6]">rsms.me/inter</a>],
            ["Noto Naskh Arabic", "Arabic, where the system Arabic font is missing", <a key="a" href="https://github.com/notofonts/arabic" target="_blank" rel="noreferrer" className="text-[#3E6796] underline underline-offset-2 dark:text-[#7FA9D6]">github.com/notofonts/arabic</a>],
            ["Noto Sans SC", "Chinese, where PingFang / YaHei are missing", <a key="a" href="https://github.com/notofonts/noto-cjk" target="_blank" rel="noreferrer" className="text-[#3E6796] underline underline-offset-2 dark:text-[#7FA9D6]">github.com/notofonts/noto-cjk</a>],
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
