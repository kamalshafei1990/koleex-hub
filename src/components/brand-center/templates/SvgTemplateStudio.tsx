"use client";

/* A designer's template in the studio (plan step C18): the design's SVG
   files are fetched, cleaned and read into a template once, then the usual
   studio takes over — fill, employees, print, download, My templates. */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { brandCenterTemplatesT } from "@/lib/translations/brand-center-templates";
import { bc } from "@/lib/brand-center/client";
import { readSvgTemplate, svgTemplateDef, type SvgTemplate } from "@/lib/brand-center/templates/svg-template";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";
import TemplateStudio from "./TemplateStudio";

type State = { state: "loading" } | { state: "error"; key: string } | { state: "ready"; tpl: SvgTemplate };

export default function SvgTemplateStudio({ designId }: { designId: string }) {
  const { t } = useTranslation(brandCenterTemplatesT);
  const [s, setS] = useState<State>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    void bc.designTemplate(designId).then((res) => {
      if (!alive) return;
      if (!res.ok) { setS({ state: "error", key: res.error === "no_svg" ? "svgt.no_svg" : res.status === 404 ? "svgt.notFound" : "svgt.loadFailed" }); return; }
      const tpl = readSvgTemplate(designId, res.data.design.name, res.data.pages);
      setS("error" in tpl ? { state: "error", key: `svgt.${tpl.error}` } : { state: "ready", tpl });
    });
    return () => { alive = false; };
  }, [designId]);
  const def = useMemo(() => (s.state === "ready" ? svgTemplateDef(s.tpl) : null), [s]);
  if (s.state === "loading") return <DirectoryListSkeleton label="Loading…" />;
  if (s.state === "error" || !def) {
    return <p role="alert" className="mx-auto max-w-[900px] px-6 py-10 text-[13px] text-[var(--text-secondary)]">{t(s.state === "error" ? s.key : "svgt.loadFailed")}</p>;
  }
  return <TemplateStudio templateId={def.id} def={def} />;
}
