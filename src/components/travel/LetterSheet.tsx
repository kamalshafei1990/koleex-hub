"use client";

/* ---------------------------------------------------------------------------
   One A4 sheet of an invitation letter.

   The same component renders the English and the Chinese page — they are the
   same document in two languages, so they must be the same layout. Anything
   that differs between them is a fact from LetterText, never a branch here.

   Sheet geometry matches the quotation's: 210 × 270 mm. 270, not 297, so the
   sheet fits inside BOTH A4 (297 mm) and US Letter (279 mm) printable areas
   and the print pipeline never spills onto a phantom blank page.
   --------------------------------------------------------------------------- */

import type { LetterText } from "@/lib/invitations/templates";

export type SheetAssets = {
  logoUrl: string;
  stampUrl: string | null;
  signatureUrl: string | null;
};

export default function LetterSheet({
  text,
  assets,
  lang,
}: {
  text: LetterText;
  assets: SheetAssets;
  /** Only affects typography — never which facts are printed. */
  lang: "en" | "zh";
}) {
  const zh = lang === "zh";
  return (
    <section className="inv-a4" lang={zh ? "zh-CN" : "en"}>
      {/* ── header ── */}
      <header className="inv-head">
        {/* eslint-disable-next-line @next/next/no-img-element -- the PDF
            renderer snapshots a plain document; next/image's lazy wrapper
            would not have decoded by the time Chromium prints. */}
        <img src={assets.logoUrl} alt="" className="inv-logo" />
        <div className="inv-head-co">
          <p className="inv-co-name">{text.signOff.company}</p>
          <p className="inv-co-addr">{text.signOff.address}</p>
        </div>
      </header>
      <div className="inv-rule" />

      {/* ── title ── */}
      <h1 className={zh ? "inv-title inv-title-zh" : "inv-title"}>{text.title}</h1>

      {/* ── addressee + date ── */}
      <div className="inv-meta">
        <div className="inv-addressee">
          {text.addressee.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="inv-meta-right">
          <p>{text.dateLine}</p>
          <p className="inv-ref">{text.refLine}</p>
        </div>
      </div>

      <p className="inv-salutation">{text.salutation}</p>

      {text.intro.map((p) => (
        <p key={p} className="inv-p">
          {p}
        </p>
      ))}

      {/* ── passport block ── */}
      <table className="inv-table">
        <tbody>
          {text.passportBlock.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {text.body.map((p) => (
        <p key={p} className="inv-p">
          {p}
        </p>
      ))}

      {/* ── sign-off ── */}
      <div className="inv-signoff">
        <p className="inv-closing">
          {text.closing.split("\n").map((line) => (
            <span key={line} className="inv-closing-line">
              {line}
            </span>
          ))}
        </p>

        {/* The stamp overlaps the signature, as it does on paper. Both are
            absolutely placed inside a box that reserves their height, so a
            missing asset never collapses the block and shifts the address
            lines up into it. */}
        <div className="inv-marks">
          {assets.signatureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assets.signatureUrl} alt="" className="inv-sig" />
          )}
          {assets.stampUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assets.stampUrl} alt="" className="inv-stamp" />
          )}
        </div>

        <div className="inv-signer">
          <p className="inv-signer-name">{text.signOff.name}</p>
          <p>{text.signOff.position}</p>
          <p>{text.signOff.company}</p>
          <p>{text.signOff.address}</p>
          <p>{text.signOff.phone}</p>
        </div>
      </div>
    </section>
  );
}
