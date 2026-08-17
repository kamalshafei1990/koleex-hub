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
     areas, so the pipeline never spills onto a phantom blank sheet. Same
     geometry the quotation sheet uses. */
  .inv-a4 {
    box-sizing: border-box;
    width: 210mm;
    height: 270mm;
    min-height: 270mm;
    max-height: 270mm;
    padding: 18mm 20mm 14mm;
    margin: 0 auto 10mm;
    background: #fff;
    color: #000;
    overflow: hidden;
    position: relative;
    box-shadow: 0 0 16px rgba(0,0,0,0.10);
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 11.5pt;
    line-height: 1.6;
  }

  /* The Chinese page needs a CJK stack. Without it the browser falls back to
     a Latin face and every character renders from a substitution font, which
     is exactly the "this letter was not written by a Chinese company" look a
     consulate notices. */
  .inv-a4[lang="zh-CN"] {
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
                 "Source Han Sans SC", "Noto Sans CJK SC", sans-serif;
    font-size: 12pt;
    line-height: 1.9;
  }

  /* ── header ── */
  .inv-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8mm;
  }
  .inv-logo { height: 16mm; width: auto; object-fit: contain; }
  .inv-head-co { text-align: right; }
  .inv-a4[lang="zh-CN"] .inv-head-co { text-align: right; }
  .inv-co-name { margin: 0; font-size: 11pt; font-weight: 700; letter-spacing: .01em; }
  .inv-co-addr { margin: 1mm 0 0; font-size: 8.5pt; color: #444; max-width: 95mm; }

  .inv-rule { height: 1.2pt; background: #000; margin: 4mm 0 7mm; }

  /* ── title ── */
  .inv-title {
    margin: 0 0 7mm;
    text-align: center;
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: .06em;
  }
  .inv-title-zh { letter-spacing: .3em; font-size: 17pt; }

  /* ── addressee + date ── */
  .inv-meta {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10mm;
    margin-bottom: 6mm;
  }
  .inv-addressee { font-size: 10.5pt; }
  .inv-addressee p { margin: 0; }
  .inv-meta-right { text-align: right; font-size: 10.5pt; white-space: nowrap; }
  .inv-meta-right p { margin: 0; }
  .inv-ref { color: #555; font-size: 9pt; font-variant-numeric: tabular-nums; }

  .inv-salutation { margin: 0 0 4mm; }
  .inv-p { margin: 0 0 4mm; text-align: justify; }
  .inv-a4[lang="zh-CN"] .inv-p { text-indent: 2em; text-align: justify; }

  /* ── passport block ── */
  .inv-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 6mm;
    font-size: 10.5pt;
  }
  .inv-table th,
  .inv-table td {
    border: 0.8pt solid #000;
    padding: 1.6mm 3mm;
    text-align: left;
    vertical-align: middle;
  }
  .inv-table th {
    width: 42mm;
    font-weight: 600;
    background: #f4f4f4;
    white-space: nowrap;
  }
  .inv-table td { font-variant-numeric: tabular-nums; }

  /* ── sign-off ── */
  .inv-signoff { margin-top: 6mm; }
  .inv-closing { margin: 0 0 2mm; }
  .inv-closing-line { display: block; }

  /* The marks box RESERVES its height whether or not the images exist, so a
     tenant without a stamp uploaded gets the same layout, just blank —
     rather than the address block sliding up into the closing line. */
  .inv-marks {
    position: relative;
    height: 30mm;
    margin: 1mm 0 1mm;
  }
  .inv-sig {
    position: absolute;
    left: 0;
    top: 2mm;
    height: 18mm;
    width: auto;
    object-fit: contain;
  }
  /* The stamp overlaps the signature the way it does on paper — offset right
     and slightly up, semi-transparent so the signature stays readable under
     it. */
  .inv-stamp {
    position: absolute;
    left: 22mm;
    top: 0;
    height: 30mm;
    width: auto;
    object-fit: contain;
    opacity: .92;
  }

  .inv-signer { font-size: 10pt; line-height: 1.5; }
  .inv-signer p { margin: 0; }
  .inv-signer-name { font-weight: 700; font-size: 11pt; }

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
