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
    padding: 14mm 17mm 12mm;
    margin: 0 auto 10mm;
    background: #fff;
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
    max-width: 94mm;
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
  }
  .inv-licence-title {
    margin: 0 0 6mm;
    text-align: center;
    font-size: 13pt;
    font-weight: 700;
  }
  .inv-licence-img {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
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
