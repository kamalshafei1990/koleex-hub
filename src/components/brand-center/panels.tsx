"use client";

/* Brand Center — the three panels that describe what is being built next:
   templates, "who am I?" and requests. Plain lists: no data, no requests. */

import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { CARD } from "@/components/travel/fields";

type T = (key: string) => string;

const TEMPLATES: Array<{ key: string; icon: RrIconName; status: "building" | "planned" }> = [
  { key: "businessCard", icon: "id-badge", status: "building" },
  { key: "staffCard", icon: "id-badge", status: "planned" },
  { key: "signature", icon: "signature", status: "planned" },
  { key: "badge", icon: "ticket", status: "planned" },
  { key: "certificate", icon: "award", status: "planned" },
  { key: "productPost", icon: "megaphone", status: "planned" },
  { key: "occasionPost", icon: "calendar", status: "planned" },
];

const ROLES: Array<{ key: string; icon: RrIconName }> = [
  { key: "photographer", icon: "camera" },
  { key: "designer", icon: "palette" },
  { key: "uiux", icon: "laptop" },
  { key: "video", icon: "signal-stream" },
  { key: "social", icon: "share" },
  { key: "printer", icon: "print" },
  { key: "decoration", icon: "building" },
  { key: "gifts", icon: "gift" },
  { key: "uniforms", icon: "id-badge" },
  { key: "dealer", icon: "handshake" },
  { key: "sales", icon: "briefcase" },
];

function Lead({ text }: { text: string }) {
  return <p className="mb-4 max-w-3xl text-[14px] leading-6 text-[var(--text-secondary)]">{text}</p>;
}

export function TemplatesPanel({ t }: { t: T }) {
  return (
    <section data-kx-pane>
      <Lead text={t("tpl.lead")} />
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((x) => (
          <li key={x.key} className={`${CARD} flex items-center gap-3 px-4 py-3.5`}>
            <span className="text-[var(--text-dim)]" aria-hidden><RrIcon name={x.icon} size={16} /></span>
            <span className="flex-1 text-[13.5px] font-medium text-[var(--text-primary)]">{t(`tpl.${x.key}`)}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${x.status === "building" ? "border-[var(--border-strong)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>
              {t(`status.${x.status}`)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RolesPanel({ t }: { t: T }) {
  return (
    <section data-kx-pane>
      <Lead text={t("roles.lead")} />
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {ROLES.map((r) => (
          <li key={r.key} className={`${CARD} flex items-center gap-3 px-4 py-3.5`}>
            <span className="text-[var(--text-dim)]" aria-hidden><RrIcon name={r.icon} size={16} /></span>
            <span className="text-[13.5px] font-medium text-[var(--text-primary)]">{t(`role.${r.key}`)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-[var(--text-dim)]">{t("status.planned")}</p>
    </section>
  );
}

export function RequestsPanel({ t }: { t: T }) {
  return (
    <section data-kx-pane className={`${CARD} max-w-3xl px-5 py-5`}>
      <p className="text-[14px] leading-6 text-[var(--text-secondary)]">{t("req.lead")}</p>
      <p className="mt-3 flex items-center gap-2 text-[13.5px] font-semibold text-[var(--text-primary)]">
        <RrIcon name="shield-check" size={15} />
        {t("req.rule")}
      </p>
      <p className="mt-3 text-[12px] text-[var(--text-dim)]">{t("status.planned")}</p>
    </section>
  );
}
