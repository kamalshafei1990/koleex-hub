/* ---------------------------------------------------------------------------
   Print styles for the invitation letter.

   A plain string, injected as a <style> tag by the print route — the same
   approach the quotation print page takes, and for the same reason: Tailwind's
   utilities are scoped to the app shell, and a chrome-less print document that
   relied on them rendered unstyled inside headless Chromium.

   Nothing here depends on a theme token. This is paper: black on white, in
   both skins, in both themes, forever.
   --------------------------------------------------------------------------- */

export const LETTER_STYLES = `
  html, body {
    margin: 0;
    padding: 0;
    background: #f2f2f2;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* The Hub's root layout puts overflow-hidden h-full on <body> — right for
     app routes, which scroll inside #main-scroll-container. This route
     renders bare (no shell, so no scroller), and the owner found the result:
     three A4 pages locked inside a body that cannot scroll. !important
     because Tailwind's .overflow-hidden is a class and bare body loses the
     cascade to it. Print is unaffected — @media print paginates regardless. */
  body {
    overflow-y: auto !important;
    height: auto !important;
    min-height: 100vh;
  }

  .inv-back {
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: 50;
    padding: 8px 14px;
    border: 1px solid rgba(0,0,0,0.15);
    border-radius: 10px;
    background: #fff;
    color: #111;
    font: 600 13px/1 -apple-system, "Helvetica Neue", sans-serif;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,0.12);
  }
  .inv-back:hover { background: #f5f5f5; }

  .inv-stack { width: 210mm; margin: 0 auto; }

  /* 270 mm, not 297: fits inside BOTH A4 (297) and US Letter (279) printable
     areas, so the pipeline never spills onto a phantom blank sheet.
   *
   * min-height WITHOUT height/max-height, and overflow VISIBLE. The quotation
   * sheet pins all three and clips — correct there, because a quotation's
   * content is paginated by the editor. A letter is not: its length depends on
   * the customer's name, company, address and optional note, and the first
   * version of this file pinned the height and clipped. The English page
   * measured 390 mm of content in a 270 mm box, so the closing guarantee and
   * the actual visa request were silently thrown away — a letter that looked
   * finished on screen and reached a consulate incomplete.
   *
   * So: the sheet is at least a page, and grows if it must. A complete letter
   * that runs onto a fourth page is a document; a clipped one is not. The
   * print page measures each sheet after paint and shows an on-screen (never
   * printed) warning when one overflows, so the operator can shorten the note
   * instead of discovering it at the counter. */
  .inv-a4 {
    box-sizing: border-box;
    width: 210mm;
    min-height: 270mm;
    /* THE WATERMARK — the owner's Feiyue letter tiles the company mark
       faintly behind the whole page, and he asked for the same. Two
       staggered KOLEEX wordmarks per tile, built from the same SVG paths as
       the letterhead logo, at 4% black so text stays fully readable over it.
       A background needs print-color-adjust to reach paper, and the PDF
       route already prints backgrounds. The licence page opts out below —
       branding a copy of a government document reads as tampering. */
    background-image: url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%201600%20640%27%3E%3Cg%20fill=%27black%27%20fill-opacity=%270.040%27%3E%3Cg%20transform=%27translate(40,80)%27%3E%3Cpath%20d=%27M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z%27/%3E%3Cpath%20d=%27M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z%27/%3E%3Cpath%20d=%27M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z%27/%3E%3Cpath%20d=%27M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68ZM473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z%27/%3E%3Cpath%20d=%27M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68ZM585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z%27/%3E%3Cpath%20d=%27M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31h0Z%27/%3E%3C/g%3E%3Cg%20transform=%27translate(840,400)%27%3E%3Cpath%20d=%27M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z%27/%3E%3Cpath%20d=%27M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z%27/%3E%3Cpath%20d=%27M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z%27/%3E%3Cpath%20d=%27M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68ZM473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z%27/%3E%3Cpath%20d=%27M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68ZM585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z%27/%3E%3Cpath%20d=%27M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31h0Z%27/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    background-size: 150mm auto;
    background-repeat: repeat;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    padding: 14mm 17mm 12mm;
    margin: 0 auto 10mm;
    /* background-COLOR, never the shorthand: background resets every
       background-* longhand, and it silently erased the watermark declared
       four lines up — computed style read initial while the source looked
       perfectly fine. */
    background-color: #fff;
    color: #000;
    overflow: visible;
    position: relative;
    box-shadow: 0 0 16px rgba(0,0,0,0.10);
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.42;
  }

  /* The Chinese page needs a CJK stack. Without it the browser falls back to
     a Latin face and every character renders from a substitution font, which
     is exactly the "this letter was not written by a Chinese company" look a
     consulate notices. */
  .inv-a4[lang="zh-CN"] {
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
                 "Source Han Sans SC", "Noto Sans CJK SC", sans-serif;
    font-size: 9.8pt;
    line-height: 1.55;
  }

  /* ── header ── */
  .inv-head {
    display: flex;
    /* flex-start, not center: the logo is one line tall and the company block
       is three, so centring left the wordmark floating in the middle of the
       address. Aligning tops makes them read as one letterhead. */
    align-items: flex-start;
    justify-content: space-between;
    gap: 10mm;
  }
  /* 7mm, not 12. The Koleex wordmark is 6.7:1, so height drives width hard:
     at 12mm it measured 80mm across — 47% of the 170mm content width — and
     read as a banner with the company details crowded beside it rather than
     as a letterhead. At 7mm it is ~47mm, about a quarter of the line, which
     is where a wordmark sits on formal stationery. */
  .inv-logo { height: 7mm; width: auto; object-fit: contain; }

  .inv-head-co { text-align: right; }
  .inv-a4[lang="zh-CN"] .inv-head-co { text-align: right; }
  .inv-co-name { margin: 0; font-size: 9.5pt; font-weight: 700; letter-spacing: .01em; line-height: 1.25; }
  /* 94mm. MEASURED: at 74mm there were 29mm of dead space between the logo
     and this block, and the address broke mid-phrase — "…Feiyue Science and /
     Technology Innovation Park…", "…Xiachen / Street…". Widening into that gap
     lets the licence address (which must be printed verbatim and is long) wrap
     at commas instead of inside names. 47mm logo + 9mm gap + 94mm here still
     leaves margin on a 170mm content line.

     text-wrap: pretty asks the browser to avoid a short last line; harmless
     where unsupported. */
  .inv-co-addr {
    margin: 1mm 0 0;
    font-size: 7pt;
    line-height: 1.4;
    color: #444;
    max-width: 112mm;
    text-wrap: pretty;
  }

  /* Hairline, not a bar. 1.2pt under a 12mm logo looked deliberate; under a
     7mm one it read as heavy. */
  .inv-rule { height: 0.6pt; background: #111; margin: 2.5mm 0 6mm; }

  /* ── title ── */
  .inv-title {
    margin: 0 0 4mm;
    text-align: center;
    font-size: 15pt;
    font-weight: 700;
    letter-spacing: .06em;
  }
  .inv-title-zh { letter-spacing: .3em; font-size: 16pt; }

  /* ── addressee + date ── */
  .inv-meta {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10mm;
    margin-bottom: 4.5mm;
  }
  .inv-addressee { font-size: 9.5pt; }
  .inv-addressee p { margin: 0; }
  .inv-meta-right { text-align: right; font-size: 9.5pt; white-space: nowrap; }
  .inv-meta-right p { margin: 0; }
  .inv-ref { color: #555; font-size: 9pt; font-variant-numeric: tabular-nums; }

  .inv-salutation { margin: 0 0 3mm; }
  .inv-p { margin: 0 0 2.4mm; text-align: justify; }
  .inv-a4[lang="zh-CN"] .inv-p { text-indent: 2em; text-align: justify; }

  /* ── passport block ── */
  .inv-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 4mm;
    font-size: 9pt;
    table-layout: fixed;
  }
  .inv-table th,
  .inv-table td {
    border: 0.8pt solid #000;
    padding: 1.1mm 2mm;
    text-align: left;
    vertical-align: middle;
  }
  .inv-table th {
    /* Four columns: label, value, label, value. A fixed label width keeps both
       halves aligned regardless of how long a value is.

       30mm, not 26mm — MEASURED, not guessed. "Passport Number" is the longest
       label at 9pt and needed 108px against the 97px a 26mm column gave it;
       with table-layout:fixed, nowrap and overflow:visible, the excess
       did not clip or wrap — it spilled OUT of the cell and printed on top of
       the passport number beside it ("Passport NumbeA12345678"). 30mm clears
       the longest label with room to spare.

       And nowrap is gone: it was what turned "too long" into "overlapping"
       instead of "wrapped". A two-line label in a form table is ordinary; a
       label printed over its own value is a broken document. The width above
       is the fix, this is the guarantee that no future label can break it. */
    width: 30mm;
    font-weight: 600;
    background: #f4f4f4;
  }
  .inv-table td { font-variant-numeric: tabular-nums; }

  /* ── sign-off ── */
  .inv-signoff { margin-top: 3mm; }
  .inv-closing { margin: 0 0 2mm; }
  .inv-closing-line { display: block; }

  /* The marks box RESERVES its height whether or not the images exist, so a
     tenant without a stamp uploaded gets the same layout, just blank —
     rather than the address block sliding up into the closing line. */
  .inv-marks {
    position: relative;
    height: 40mm;
    margin: 1mm 0 1mm;
  }
  .inv-sig {
    position: absolute;
    left: 0;
    top: 12mm;
    height: 16mm;
    width: auto;
    object-fit: contain;
  }
  /* The stamp at its REAL size. A Chinese company seal (公章) is 40mm in
     diameter by regulation — the owner's physical stamp included. It printed
     at 22mm here, which reads as a pasted-in graphic to anyone who has held
     a stamped Chinese document, and a visa officer has. The overlap with the
     signature stays, the way ink actually lands on paper. */
  .inv-stamp {
    position: absolute;
    left: 22mm;
    top: 0;
    height: 40mm;
    width: auto;
    object-fit: contain;
    opacity: .92;
  }

  .inv-signer { font-size: 9pt; line-height: 1.4; }
  .inv-signer p { margin: 0; }
  .inv-signer-name { font-weight: 700; font-size: 10pt; }

  /* ── the licence page ── */
  .inv-licence-page {
    display: flex;
    flex-direction: column;
    /* No watermark over the licence: it is a copy of a government document,
       and overlaying our brand on it reads as tampering. */
    background-image: none;
  }
  .inv-licence-title {
    margin: 0 0 6mm;
    text-align: center;
    font-size: 13pt;
    font-weight: 700;
  }
  /* THE LICENCE IS A LANDSCAPE DOCUMENT ON A PORTRAIT SHEET.

     Laid flat it used the sheet's 176mm width and came out ~120mm tall — a
     small rectangle floating in white space, which is what the owner flagged.
     Rotating it 90 degrees lets its long side run down the page instead:
     236mm of licence instead of 176mm, the way a landscape copy is actually
     bound into a portrait submission. The reader turns the paper; the
     consulate receives a full-size licence.

     The frame reserves the rotated footprint (236mm tall) and the image is
     centred in it, sized PRE-rotation as 236mm wide by 170mm high — after the
     turn those become the vertical and horizontal extents. object-fit keeps
     the scan's own aspect inside that box, whatever the upload's shape. */
  .inv-licence-frame {
    position: relative;
    flex: 1 1 auto;
    min-height: 236mm;
    /* THE PHANTOM PAGE 4. The image's PRE-rotation layout box is 236mm wide
       inside this 176mm frame — the rotation paints it back inside, but
       layout overflow is computed before transforms, and Chromium emits the
       horizontal spill as an extra, entirely blank printed page. Clipping is
       safe: the post-rotation footprint (170×236) fits the frame, so nothing
       visible is ever cut. Measured: 4 pages → 3. */
    overflow: hidden;
  }
  .inv-licence-img {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 236mm;
    /* Tailwind's preflight puts max-width:100% on every img; inside the
       176mm frame that silently capped the 236mm width and the rotation
       gained nothing — measured 176mm where 236 was asked for. The whole
       point of the rotation is to exceed the frame's width. */
    max-width: none;
    height: 170mm;
    /* -90, not 90: binding convention puts the TOP of a landscape page at
       the portrait sheet's LEFT edge, so the reader turns the paper
       clockwise — the way Word and every scanner emit mixed-orientation
       documents. */
    transform: translate(-50%, -50%) rotate(-90deg);
    object-fit: contain;
  }
  .inv-licence-missing {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1pt dashed #999;
    color: #777;
    font-size: 10pt;
    text-align: center;
    padding: 10mm;
  }

  /* ── overflow warning ──
     Set by the print page after it measures each sheet. Screen only: .no-print
     hides it from the PDF, so the operator sees it and the consulate never
     does. Positioned outside the paper so it cannot be mistaken for content. */
  .inv-missing-note,
.inv-overflow-note {
    width: 210mm;
    margin: 0 auto 10mm;
    padding: 4mm 6mm;
    border: 1.5pt solid #b45309;
    border-radius: 3mm;
    background: #fffbeb;
    color: #78350f;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
  }

  /* ── print ── */
  @media print {
    html, body { background: #fff; }
    body {
      overflow: visible !important;
      height: auto !important;
      min-height: 0 !important;
    }
    /* Next dev tools portal — dev-only, but the PDF is generated against the
       dev server, so it has to be silenced here too. */
    nextjs-portal { display: none !important; }
    .inv-stack { width: auto; margin: 0; }
    .inv-a4 {
      margin: 0;
      box-shadow: none;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .inv-a4:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .no-print { display: none !important; }
    /* size: auto follows the operator's paper choice; the sheet is 270 mm so
       it fits A4 and Letter alike without an every-other-blank-page. */
    @page { size: auto; margin: 0; }
  }
`;
