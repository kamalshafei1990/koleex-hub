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
    align-items: center;
    justify-content: space-between;
    gap: 8mm;
  }
  .inv-logo { height: 12mm; width: auto; object-fit: contain; }
  .inv-head-co { text-align: right; }
  .inv-a4[lang="zh-CN"] .inv-head-co { text-align: right; }
  .inv-co-name { margin: 0; font-size: 10pt; font-weight: 700; letter-spacing: .01em; }
  .inv-co-addr { margin: 0.8mm 0 0; font-size: 7.5pt; color: #444; max-width: 92mm; }

  .inv-rule { height: 1.2pt; background: #000; margin: 3mm 0 5mm; }

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
    /* Four columns now: label, value, label, value. Fixed label widths keep
       both halves aligned regardless of how long a value is. */
    width: 26mm;
    font-weight: 600;
    background: #f4f4f4;
    white-space: nowrap;
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
    height: 22mm;
    margin: 1mm 0 1mm;
  }
  .inv-sig {
    position: absolute;
    left: 0;
    top: 2mm;
    height: 14mm;
    width: auto;
    object-fit: contain;
  }
  /* The stamp overlaps the signature the way it does on paper — offset right
     and slightly up, semi-transparent so the signature stays readable under
     it. */
  .inv-stamp {
    position: absolute;
    left: 20mm;
    top: 0;
    height: 22mm;
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
