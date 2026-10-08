"use client";

/* ---------------------------------------------------------------------------
   The studio's view of a template that is HTML, not paper — the email
   signature (plan step C11). The signature sits inside a mail: light or
   dark (as the Gmail and Outlook apps draw it), desktop or phone width, the
   full or the reply version. Three ways to take it: copy it as it looks
   (pastes into Gmail, Outlook, Apple Mail, Foxmail), copy the HTML code,
   or download a .htm file (Outlook for Windows, Foxmail). A copy loads its
   pictures from our domain; the preview from this address.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import type { HtmlOutput, TemplateDef, TemplateValues } from "@/lib/brand-center/templates/types";
import { asLang } from "@/lib/brand-center/templates/card/model";
import { SELECTED_CHIP } from "@/components/travel/fields";

type T = (k: string) => string;
type Status = { kind: "ok" | "error"; key: string } | null;

/** What the mail says before the signature, in the preview only. */
const CLOSING = { en: "Kind regards,", zh: "顺颂商祺", ar: "مع خالص التحية،" } as const;
const BTN = "rounded-xl border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

/** Copies the signature as it looks (HTML + plain text); the older
 *  select-and-copy way where the clipboard API is missing or refused. */
async function copyRich(html: string, text: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      })]);
      return true;
    }
  } catch { /* the older way below */ }
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  Object.assign(box.style, { position: "fixed", left: "-10000px", top: "0", background: "#FFFFFF", color: "#000000" });
  box.innerHTML = html;
  document.body.appendChild(box);
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(box);
  sel?.removeAllRanges();
  sel?.addRange(range);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  sel?.removeAllRanges();
  box.remove();
  return ok;
}

export default function HtmlPreview({ t, def, html, values, fileBase }: { t: T; def: TemplateDef; html: HtmlOutput; values: TemplateValues; fileBase: string }) {
  const [variant, setVariant] = useState(html.variants[0]);
  const [dark, setDark] = useState(false);
  const [phone, setPhone] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const lang = asLang(values.lang);
  const rtl = lang === "ar";
  const here = typeof window !== "undefined" ? window.location.origin : html.host;
  const shown = html.render(values, { variant, base: here, preview: true });
  const forMail = () => html.render(values, { variant, base: html.host });

  /* What must be filled is the template's own rule (a name). */
  const ready = () => {
    const missing = def.check ? def.check(values) : null;
    if (missing) { setStatus({ kind: "error", key: missing }); return false; }
    return true;
  };
  const say = (ok: boolean, key: string) => setStatus(ok ? { kind: "ok", key } : { kind: "error", key: "sig.copyFail" });
  const copy = async () => { if (ready()) say(await copyRich(forMail(), html.text(values, variant)), "sig.copied"); };
  const copyCode = async () => {
    if (!ready()) return;
    try { await navigator.clipboard.writeText(forMail()); say(true, "sig.copiedCode"); } catch { say(false, ""); }
  };
  const download = () => {
    if (!ready()) return;
    const doc = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${fileBase}</title></head><body>\n${forMail()}\n</body></html>\n`;
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}${variant === "reply" ? "-reply" : ""}.htm`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    say(true, "sig.downloaded");
  };

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Seg t={t} label={t("sig.version")} value={variant} options={html.variants.map((v) => [v, `sig.variant.${v}`])} onChange={setVariant} />
        <Seg t={t} label={t("sig.mode")} value={dark ? "dark" : "light"} options={[["light", "sig.mode.light"], ["dark", "sig.mode.dark"]]} onChange={(v) => setDark(v === "dark")} />
        <Seg t={t} label={t("sig.width")} value={phone ? "phone" : "desktop"} options={[["desktop", "sig.width.desktop"], ["phone", "sig.width.phone"]]} onChange={(v) => setPhone(v === "phone")} />
      </div>
      {dark ? <p className="mt-2 text-[11.5px] text-[var(--text-dim)]">{t("sig.darkHint")}</p> : null}

      {/* the mail app; the page itself stays white like a real mail */}
      <div className={`mt-3 rounded-[12px] p-3 sm:p-5 ${dark ? "bg-[#1C1C1E]" : "bg-[#E8E8ED]"}`}>
        <div dir={rtl ? "rtl" : "ltr"} style={{ colorScheme: "light" }}
          className={`mx-auto overflow-x-auto rounded-[8px] bg-white px-4 py-5 sm:px-6 ${phone ? "max-w-[360px]" : "max-w-[720px]"} ${dark ? "invert hue-rotate-180 [&_img]:invert [&_img]:hue-rotate-180" : ""}`}>
          <p className="m-0 whitespace-pre-line text-[13px] leading-[1.5] text-black" style={{ fontFamily: rtl ? "Tahoma, Arial, sans-serif" : "Arial, Helvetica, sans-serif" }}>{CLOSING[lang]}</p>
          <div className="mt-4" dangerouslySetInnerHTML={{ __html: shown }} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void copy()} className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)]">
          {t(`sig.copy.${variant}`)}
        </button>
        <button type="button" onClick={() => void copyCode()} className={BTN}>{t("sig.copyCode")}</button>
        <button type="button" onClick={download} className={BTN}>{t("sig.download")}</button>
        {status ? (
          <span role={status.kind === "error" ? "alert" : "status"} className={`text-[12px] ${status.kind === "error" ? "text-red-500" : "text-[var(--text-secondary)]"}`}>{t(status.key)}</span>
        ) : null}
      </div>
      <p className="mt-2 max-w-2xl text-[11.5px] leading-5 text-[var(--text-dim)]">{t("sig.copyHint")}</p>

      <details className="mt-4 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-[var(--text-secondary)]">{t("sig.how")}</summary>
        <ul className="mt-2 grid [&>*]:min-w-0 gap-2 text-[12px] leading-5 text-[var(--text-secondary)]">
          {["gmail", "outlook", "outlookWin", "apple", "iphone", "foxmail"].map((k) => (
            <li key={k}><span className="font-semibold text-[var(--text-primary)]">{t(`sig.how.${k}`)}</span> — {t(`sig.how.${k}.steps`)}</li>
          ))}
        </ul>
      </details>
      <details className="mt-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-[var(--text-secondary)]">{t("sig.code")}</summary>
        <pre dir="ltr" className="mt-2 max-h-[280px] overflow-auto whitespace-pre-wrap break-all font-mono text-[10.5px] leading-4 text-[var(--text-dim)]">{forMail()}</pre>
      </details>
    </div>
  );
}

function Seg({ t, label, value, options, onChange }: { t: T; label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <span className="inline-flex rounded-lg border border-[var(--border-subtle)] p-0.5" role="radiogroup" aria-label={label}>
      {options.map(([v, k]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`rounded-md border px-2.5 py-1 text-[12px] ${value === v ? SELECTED_CHIP : "border-transparent text-[var(--text-secondary)]"}`}>
          {t(k)}
        </button>
      ))}
    </span>
  );
}
