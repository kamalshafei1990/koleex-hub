"use client";

/* The house print recipe (feedback_house_document_style): the /print route
   in an off-screen iframe — never visibility:hidden, some browsers skip
   invisible frames — printed once the paper says it is ready. Printing this
   window instead would drag the Hub layout into the print pass. */
export function printPaper(src: string) {
  const FRAME_ID = "koleex-numbers-print-frame";
  let frame = document.getElementById(FRAME_ID) as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = FRAME_ID;
    Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "210mm", height: "270mm", border: "none" });
    document.body.appendChild(frame);
  }
  const f = frame;
  const onLoad = () => {
    f.removeEventListener("load", onLoad);
    let tries = 0;
    const ready = () => {
      const win = f.contentWindow as (Window & { __quotation_pdf_ready__?: boolean }) | null;
      if (win?.__quotation_pdf_ready__) { win.focus(); win.print(); }
      else if (++tries < 300) setTimeout(ready, 100);
    };
    ready();
  };
  f.addEventListener("load", onLoad);
  f.src = `${src}${src.includes("?") ? "&" : "?"}_t=${Date.now()}`;
}
