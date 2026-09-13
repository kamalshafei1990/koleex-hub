"use client";

/* ---------------------------------------------------------------------------
   /travel/[id]/print — the printable letter: THREE A4 pages, one document.

     1. English
     2. Chinese
     3. The business licence

   Chrome-less by design and deliberately OUTSIDE the /travel segment layout's
   Aurora scope — this renders paper, so it must not inherit a glass scope or
   a wave canvas.

   The PDF route drives this page and waits for `__invitation_pdf_ready__`,
   which is set only after every image has decoded and the fonts have settled.
   Setting it earlier is how a PDF ends up with a blank stamp: Chromium
   snapshots whatever is painted at that moment.
   --------------------------------------------------------------------------- */

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LetterSheet, { type SheetAssets } from "@/components/travel/LetterSheet";
import { LETTER_STYLES } from "@/components/travel/letter-styles";
import { buildChinese, buildEnglish } from "@/lib/invitations/templates";
import type { InvitationLetter, InvitationSettings } from "@/lib/invitations/types";

/** THE KOLEEX COMPANY LOGO — not the Hub mark.
 *
 *  Standing rule from the owner: "logo" always means the Koleex logo. The Hub
 *  mark is the internal software's badge; a letter that goes to a consulate
 *  represents KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., Ltd., and putting
 *  the software's badge on it signs with the wrong identity. The first version
 *  of this file did exactly that.
 *
 *  Black, because the letter is black on white paper. SVG, because a raster
 *  wordmark at 12 mm tall on A4 shows its edges in print. */
const DEFAULT_LOGO = "/brand/koleex-logo-black.svg";

type Loaded = {
  letter: InvitationLetter;
  settings: InvitationSettings;
  assets: SheetAssets;
};

export default function InvitationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  /** Sheets that grew past one page — measured after paint, shown on screen
   *  only. A letter is allowed to run long; it must never do so unnoticed. */
  const [overflowing, setOverflowing] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        /* Three independent reads, in parallel — the page cannot paint until
           all three land, so running them in sequence would just be slower. */
        const [lRes, sRes, aRes] = await Promise.all([
          fetch(`/api/invitations/${id}`, { cache: "no-store" }),
          fetch("/api/invitations/settings", { cache: "no-store" }),
          fetch("/api/quotations/saved-assets", { cache: "no-store" }),
        ]);
        if (!lRes.ok || !sRes.ok) throw new Error();

        const letter = (await lRes.json()) as InvitationLetter;
        const settings = (await sRes.json()) as InvitationSettings;
        /* The stamp/signature endpoint is gated on the Quotations module. A
           user with Travel but not Quotations still gets a correct letter —
           just without the marks — rather than a failed page. */
        const marks = aRes.ok
          ? ((await aRes.json()) as { stampUrl: string | null; signatureUrl: string | null })
          : { stampUrl: null, signatureUrl: null };

        if (cancelled) return;
        setData({
          letter,
          settings,
          assets: {
            logoUrl: DEFAULT_LOGO,
            stampUrl: marks.stampUrl,
            signatureUrl: marks.signatureUrl,
          },
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* Signal readiness only once everything the PDF needs is actually painted. */
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    void (async () => {
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                /* Resolve on error too: a missing stamp must not hang the
                   export forever, it should just print without one. */
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );
      if ("fonts" in document) {
        try {
          await document.fonts.ready;
        } catch {
          /* ignore — a font that never settles is not worth blocking on */
        }
      }
      if (cancelled) return;

      /* The tab's title is what "Print → Save as PDF" proposes as the file
         name, and the owner's save dialog offered "Claude" — the host app's
         name, because nothing here ever set one. Name it after the letter so
         the saved file arrives as KX-INV-2026-0002 - Invitation Letter.pdf.
         (The Export PDF button names its own download server-side; this is
         only for the browser-print path.) */
      const ref = data.letter.reference || "Invitation Letter";
      const who = (data.letter.visitor?.name || "").trim();
      document.title = who ? `${ref} - ${who}` : `${ref} - Invitation Letter`;

      /* Measure each sheet now that images and fonts have settled — a stamp
         that decoded late can be what pushes a page over. */
      const MM = 96 / 25.4;
      const over: number[] = [];
      /* 270mm — the sheet's OWN design height, not the 292 the warning used.
         The letter has to survive TWO printing paths, and they do not offer
         the same room:
           · Export PDF  → headless Chromium, margin 0 → 297mm usable.
           · Print → Save as PDF → the operator's print dialog, which applies
             its own paper margins (~13mm top and bottom on macOS) → about
             271mm usable, and @page margin:0 does not override the system
             dialog.
         The owner printed through the second path and the letter's last two
         lines — phones and reference — landed on a blank sheet, even though
         the same letter exported perfectly through the first. Fitting to the
         sheet's declared height satisfies both, and it is the height the
         design already promises. */
      const LIMIT = 270 * MM;
      document.querySelectorAll<HTMLElement>(".inv-a4").forEach((el, i) => {
        /* SHRINK TO FIT, don't just warn.
           The English sheet measures 288mm against a 297mm page — nine
           millimetres of slack — and the sheet's height depends on the FONT:
           measured on the live letter, Helvetica Neue gives 288mm, Inter 293,
           Courier 312. The dev machine has Helvetica Neue; the serverless
           Chromium that renders the production PDF does not, so it falls back
           to something wider and the letter spills its last three lines onto
           an otherwise blank page — which is the export the owner received
           while the same letter generated locally fitted perfectly.
           Pinning a font would only move the problem (Inter already leaves
           4mm). Instead the sheet is measured after fonts and images settle
           and scaled down just enough to fit — Word's "shrink to fit", and it
           does nothing at all when the letter already fits its own height.
           `zoom`, not `transform`: zoom changes the LAYOUT box, so print
           pagination sees the smaller sheet. It scales width too, hence the
           `margin: 0 auto` in the print stylesheet that keeps a shrunk sheet
           centred on the paper. Floor at 0.82 so a genuinely over-long letter
           still flows to another page (and still warns) instead of becoming
           unreadable. */
        el.style.zoom = "";
        const h = el.getBoundingClientRect().height;
        if (h > LIMIT) {
          el.style.zoom = String(Math.max(0.82, LIMIT / h));
          if (el.getBoundingClientRect().height > LIMIT) over.push(i + 1);
        }
      });
      setOverflowing(over);

      (window as unknown as { __invitation_pdf_ready__?: boolean }).__invitation_pdf_ready__ =
        true;

      const auto = new URLSearchParams(window.location.search).get("auto") === "1";
      if (auto) {
        /* One frame for the flag's layout flush to commit, then a beat for
           multi-page reflow — Safari can otherwise capture a half-painted
           frame. Same guard the quotation print page uses. */
        requestAnimationFrame(() => setTimeout(() => window.print(), 120));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (failed) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui", color: "#000", background: "#fff" }}>
        Could not load this invitation.
      </main>
    );
  }
  if (!data) {
    /* Intentionally bare: this route has no app chrome, so it has no Hub
       spinner either. The PDF route waits on the ready flag, not on this. */
    return <main style={{ background: "#fff", minHeight: "100vh" }} />;
  }

  const { letter, settings, assets } = data;

  /* WHAT THE LETTER CANNOT BE SENT WITHOUT.
     Found by rendering a real letter against an empty settings row: the
     Chinese page read "我司系在中华人民共和国浙江省台州市依法注册成立的企业"
     — the company inviting was simply absent, and nothing said so. A letter
     that does not name the inviting company is not a document a consulate can
     act on, so the gap is named here rather than left to be noticed by the
     person at the counter. */
  const missing: string[] = [];
  if (!settings.companyNameEn) missing.push("the registered name (English)");
  if (!settings.companyNameCn) missing.push("the registered name (Chinese)");
  if (!settings.creditCode) missing.push("the Unified Social Credit Code");
  if (!settings.addressEn && !settings.addressCn) missing.push("the licence address");
  if (!settings.inviterName) missing.push("who signs the letter");
  if (!assets.stampUrl) missing.push("the company stamp");
  if (!assets.signatureUrl) missing.push("the signature");
  const input = {
    visitor: letter.visitor,
    visit: letter.visit,
    settings,
    letterDate: letter.letterDate,
    reference: letter.reference,
  };

  return (
    <>
      <style>{LETTER_STYLES}</style>
      {/* The control bar — same shape as the Quotation editor's dark toolbar
          above its A4: Back, then the letter's actions. In the desktop shell
          there is no browser chrome, so this bar is also the only way out —
          the trap the owner hit twice. no-print + the PDF route's readiness
          flag ignores it, so paper never carries it. */}
      <div className="inv-bar no-print">
        <button type="button" className="inv-bar-btn" onClick={() => router.back()}>
          ← Back
        </button>
        <span className="inv-bar-ref">{letter.reference}</span>
        <span className="inv-bar-spacer" />
        <button
          type="button"
          className="inv-bar-btn"
          onClick={() => router.push(`/travel/${id}`)}
        >
          Edit
        </button>
        <button type="button" className="inv-bar-btn" onClick={() => window.print()}>
          Print
        </button>
        <button
          type="button"
          className="inv-bar-btn inv-bar-btn-primary"
          onClick={() => {
            window.location.href = `/api/invitations/${id}/pdf`;
          }}
        >
          Export PDF
        </button>
      </div>
      <div className="inv-stack">
        {missing.length > 0 && (
          /* no-print: this is guidance for the operator, never part of the
             document. The letter still renders in full so what IS set can be
             checked — refusing to render would hide the rest. */
          <div className="inv-missing-note no-print">
            <strong>This letter is missing {missing.length === 1 ? "one thing" : `${missing.length} things`}.</strong>{" "}
            Not set yet: {missing.join(", ")}.{" "}
            {(!assets.stampUrl || !assets.signatureUrl)
              ? "The stamp and signature come from Quotations → saved assets; everything else is in Travel → Settings."
              : "Add them in Travel → Settings."}{" "}
            This notice is not printed.
          </div>
        )}
        {overflowing.length > 0 && (
          <div className="inv-overflow-note no-print">
            <strong>
              {overflowing.length === 1
                ? `Page ${overflowing[0]} runs past one sheet.`
                : `Pages ${overflowing.join(" and ")} run past one sheet.`}
            </strong>{" "}
            The letter is complete — nothing has been cut — but the PDF will have
            more than three pages. Shortening the extra note, or the company name
            and address, brings it back to three. This notice is not printed.
          </div>
        )}

        <LetterSheet lang="en" text={buildEnglish(input)} assets={assets} />
        <LetterSheet lang="zh" text={buildChinese(input)} assets={assets} />

        {/* Page 3 — the licence. Its own sheet so it paginates with the rest
            and the PDF is genuinely one file, which is what the consulate
            expects to receive. */}
        <section className="inv-a4 inv-licence-page">
          <h2 className="inv-licence-title">
            Business Licence · 营业执照
          </h2>
          {settings.licenceDocUrl ? (
            /* The frame exists because the image inside it is ROTATED — see
               .inv-licence-img in letter-styles for why. */
            <div className="inv-licence-frame">
              {/* eslint-disable-next-line @next/next/no-img-element -- see LetterSheet */}
              <img src={settings.licenceDocUrl} alt="" className="inv-licence-img" />
            </div>
          ) : (
            <div className="inv-licence-missing">
              No business licence has been uploaded yet.
              <br />
              Add it in Travel → Settings so it prints as page 3.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
