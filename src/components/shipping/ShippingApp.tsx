"use client";

/* ---------------------------------------------------------------------------
   Shipping — the app.

   The whole interaction is one line of thought: FROM a Chinese port, TO a
   country and a port, BY a method, SEARCH. Everything else appears only when
   that method needs it — containers for FCL, a volume for LCL, a weight for
   air — so the screen never asks a question the answer does not depend on.

   ── Responsive by MEASUREMENT, not by breakpoint ──────────────────────────
   The layout reads the pane's own width through a ResizeObserver, because
   `md:` and `lg:` know nothing about the Hub's sidebar rail: on a 1024pt
   tablet, 1024 − 220 leaves 804, and a `lg:` three-column grid at 804px gives
   each card 250px. Measured width is the rule the Contacts directory
   established after exactly that bug. `container-type` is NOT used — it would
   make this element the containing block for the fixed Aurora ground.

   Three real layouts, not one stacked three ways:
     ≥1180  rail and results side by side, containers three across
     ≥780   search strip full width above results, containers two across
     <780   one column, the method as a three-up segmented control, inputs at
            touch size, results stacked
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AuroraShell from "@/components/ui/AuroraShell";
import { useSkin } from "@/lib/appearance";
import PageHeader from "@/components/ui/PageHeader";
import { useTranslation } from "@/lib/i18n";
import { shippingT } from "@/lib/translations/shipping";
import { countryDisplayName, flagEmoji } from "@/lib/invitations/types";
import { CONTAINER_EQUIPMENT, type ContainerEquipment, type ShippingMode, type VolumetricRule } from "@/lib/shipping/types";
import { cbmOf, revenueTons } from "@/lib/shipping/chargeable-weight";
import { placeName, type PlaceNames } from "@/lib/shipping/place-names";
import Link from "next/link";
import SearchCombobox, { type ComboOption } from "./SearchCombobox";
import RateResults from "./RateResults";
import ForwarderQuoteModal from "./ForwarderQuoteModal";
import {
  loadCountries, loadRoutes, saveRoute, searchAirports, searchPorts, searchRates,
  RateSearchError, type AirportHit, type PortCountry, type PortHit, type RateSearchResponse, type RoutesPayload, type SavedRoute,
} from "./shipping-client";

import ShippingIcon from "@/components/icons/ShippingIcon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import ContainerIcon from "@/components/icons/ui/ContainerIcon";
import CubicMeterIcon from "@/components/icons/ui/CubicMeterIcon";
import WeightIcon from "@/components/icons/ui/WeightIcon";
import PortIcon from "@/components/icons/ui/PortIcon";
import RouteIcon from "@/components/icons/ui/RouteIcon";
import PlaneIcon from "@/components/icons/ui/PlaneIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import RefreshIcon from "@/components/icons/ui/RefreshIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import ArrowRightLeftIcon from "@/components/icons/ui/ArrowRightLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import RulerIcon from "@/components/icons/ui/RulerIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import FilePlusIcon from "@/components/icons/ui/FilePlusIcon";

type PortOpt = ComboOption<PortHit | AirportHit>;

/** ISO country out of a UN/LOCODE. IATA codes carry none, so they answer null. */
function countryOfCode(code: string): string | null {
  return /^[A-Z]{2}[A-Z0-9]{3}$/.test(code) ? code.slice(0, 2) : null;
}

/* A saved route stores codes and labels, not the full port row. Rebuilding the
   option from those two is enough for the trigger to look identical to a
   freshly picked one — including the flag, which the LOCODE already carries.
   The stored label is the LATIN name and stays the option's value; the label
   shown is its approved name in the screen's language, looked up by code. */
function restoredEndpoint(code: string, label: string | null, names: PlaceNames | undefined, lang: string): PortOpt {
  const cc = countryOfCode(code);
  const latin = label ?? code;
  return {
    key: code,
    value: { locode: code, name: latin, names } as PortHit,
    label: placeName(latin, names, lang),
    code,
    glyph: cc ? (flagEmoji(cc) || undefined) : undefined,
  };
}

/* ⚠️ WHAT IS SHOWN IS NOT WHAT IDENTIFIES. An option's `label` is its name in
   the screen's language (an approved Arabic or Chinese name); the port's
   Latin name — the value — is what a code-less port is resolved by, what a
   saved lane stores and what gets printed. A translated name never leaves
   the screen (the owner's identifier rule, 15/09/2026). */
const latinOf = (o: PortOpt): string => o.value?.name || o.label;

/** A saved lane's approved names, by the code it stored. Sea lanes only: an
 *  air lane's codes are IATA, and airports have no names yet. */
const laneNames = (routes: RoutesPayload, r: SavedRoute, end: "origin" | "destination"): PlaceNames | undefined =>
  r.mode === "air" ? undefined : routes.names?.[end === "origin" ? r.origin_code : r.destination_code];

/* The reference endpoint's own ceiling. Anything smaller truncates a country's
   port list during a plain browse, which reads as missing data. The United
   States has 662 ports, so the ceiling stays — the panel says when it is hit
   instead of hiding it. */
const PICKER_ROWS = 100;

const MODES: { id: ShippingMode; icon: (s: number) => React.ReactNode }[] = [
  { id: "ocean_fcl", icon: (s) => <ContainerIcon size={s} /> },
  { id: "ocean_lcl", icon: (s) => <CubicMeterIcon size={s} /> },
  { id: "air", icon: (s) => <PlaneIcon size={s} /> },
];

export default function ShippingApp() {
  const { t, lang } = useTranslation(shippingT);
  const isRtl = lang === "ar";
  /* kx-seg-on / kx-chip-on are Aurora-ONLY rules — under Core they evaluate to
     nothing, so a selected control would be indistinguishable from an unselected
     one. Core's own selection mark is the filled inverted pill, byte-identical
     to what the Hub looked like before Aurora. Branching is the house pattern
     (see settings/page.tsx and inbox/page.tsx). */
  const aurora = useSkin() === "aurora";
  const SEG_ON = aurora ? "kx-seg-on" : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]";
  const SEG_OFF = aurora ? "kx-seg-off" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]";
  const CHIP_ON = aurora ? "kx-chip-on" : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]";

  /* ── measured layout ───────────────────────────────────────────────────── */
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const hostRef = useCallback((node: HTMLDivElement | null) => setHost(node), []);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!host) return;
    const read = () => setW(host.getBoundingClientRect().width);
    read();                                   // before paint, so nothing shifts
    const ro = new ResizeObserver(read);
    ro.observe(host);
    return () => ro.disconnect();
  }, [host]);
  /* 0 = not measured yet (first frame only). One column is the safe default:
     it is the layout that works at any width. */
  /* ⚠️ MEASURED THRESHOLDS, AND THEY ARE NOT VIEWPORT NUMBERS.
     A 768pt tablet in portrait gives this pane 693px once the rail is taken
     off — measured, 15 Sep. A threshold set at 780 because "tablets are 768"
     therefore handed a tablet the PHONE layout, which is the same arithmetic
     mistake the Contacts directory was built to avoid, just in reverse.
     640 is below the real tablet width with room to spare. */
  const wide = w >= 1180;
  const mid = !wide && w >= 640;
  const cols: 1 | 2 | 3 = wide ? 3 : mid ? 2 : 1;

  /* ── form state ────────────────────────────────────────────────────────── */
  const [mode, setMode] = useState<ShippingMode>("ocean_fcl");
  const [origin, setOrigin] = useState<PortOpt | null>(null);
  const [country, setCountry] = useState<ComboOption<PortCountry> | null>(null);
  const [dest, setDest] = useState<PortOpt | null>(null);
  const [equipment, setEquipment] = useState<ContainerEquipment[]>([...CONTAINER_EQUIPMENT]);
  const [cbm, setCbm] = useState("");
  const [grossKg, setGrossKg] = useState("");
  const [rule, setRule] = useState<VolumetricRule>("iata_air");
  const [dims, setDims] = useState<{ l: string; w: string; h: string; qty: string }[]>([]);

  const [countries, setCountries] = useState<PortCountry[]>([]);
  const [routes, setRoutes] = useState<RoutesPayload>({ recent: [], favorites: [] });

  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<RateSearchResponse | null>(null);
  const [error, setError] = useState<{ title: string; body: string; candidates?: PortHit[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sourcesRef = useRef<HTMLElement | null>(null);

  /* "View rate sources" brings the section that already exists into view — it
     never opens a second screen saying the same thing twice. The brief ring is
     so the operator sees WHERE they landed; .kx-reduce-motion turns the
     transition off for anyone who asked for that. */
  const viewSources = useCallback(() => {
    const el = sourcesRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el.classList.add("ring-2", "ring-[#567FB2]/50");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-[#567FB2]/50"), 1600);
  }, []);

  const isAir = mode === "air";

  /* Dimensions, when entered, ARE the volume — the CBM field becomes derived
     so the two can never disagree on screen. */
  const parsedDims = useMemo(
    () => dims.map((d) => ({ l: Number(d.l), w: Number(d.w), h: Number(d.h), qty: Number(d.qty) || 1 }))
              .filter((d) => d.l > 0 && d.w > 0 && d.h > 0),
    [dims],
  );
  const derivedCbm = parsedDims.length ? cbmOf(parsedDims) : null;
  const effectiveCbm = derivedCbm ?? (Number(cbm) || undefined);

  /* Countries and saved routes are small and wanted immediately. */
  useEffect(() => {
    let alive = true;
    loadCountries().then((r) => { if (alive) setCountries(r.countries); }).catch(() => {});
    loadRoutes().then((r) => { if (alive) setRoutes(r); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  /* ⚠️ THESE RESETS ARE HANDLERS, NOT EFFECTS, AND THAT IS THE WHOLE POINT.
     As effects keyed on `isAir` / `country`, they ran after ANY change to
     those values — including a saved-route chip restoring a lane, which sets
     the mode and both endpoints together. The effect then fired on the next
     commit and wiped the endpoints it had just been given, so clicking an air
     route while in ocean mode emptied both fields.

     A handler only runs when the OPERATOR changes the control, which is the
     actual rule: switching between sea and air changes what a "port" is, so
     both ends clear rather than carrying a seaport into an air search. */
  const changeMode = useCallback((next: ShippingMode) => {
    setMode((prev) => {
      if ((prev === "air") !== (next === "air")) { setOrigin(null); setDest(null); }
      return next;
    });
  }, []);
  const changeCountry = useCallback((next: ComboOption<PortCountry> | null) => {
    setCountry((prev) => {
      if (prev?.key !== next?.key) setDest(null);
      return next;
    });
  }, []);

  /* ── option builders ───────────────────────────────────────────────────── */
  /* The approved name in the screen's language on top; under it the Latin
     name forwarders write (when the top line is a translation), the
     register's spelling, and the country in the screen's language. */
  const portOption = useCallback((p: PortHit): PortOpt => {
    const label = placeName(p.name, p.names, lang);
    return {
      key: p.id,
      value: p,
      label,
      sublabel: [
        label !== p.name ? p.name : null,
        p.nameOfficial && p.nameOfficial !== p.name ? p.nameOfficial : null,
        countryDisplayName(p.countryCode, p.countryName ?? p.countryCode, lang),
      ].filter(Boolean).join(" · ") || undefined,
      glyph: flagEmoji(p.countryCode) || undefined,
      code: p.locode ?? undefined,
      pinned: p.inKoleexList,
    };
  }, [lang]);

  const airportOption = useCallback((a: AirportHit): PortOpt => ({
    key: a.id,
    value: a,
    label: a.name,
    sublabel: a.municipality ?? undefined,
    glyph: flagEmoji(a.country_code) || undefined,
    code: a.iata,
  }), []);

  /* PAGE_ROWS is the endpoint's own maximum. 20 was below the size of a single
     country's list — China has 43 ports and Egypt 34 — so browsing either one
     stopped part-way with no sign that it had. */
  const searchOrigin = useCallback(async (term: string, signal: AbortSignal): Promise<PortOpt[]> => {
    void signal;
    if (isAir) {
      const { airports } = await searchAirports({ q: term, country: "CN", limit: PICKER_ROWS });
      return airports.map(airportOption);
    }
    const { ports } = await searchPorts({ q: term, origin: true, limit: PICKER_ROWS, nv: routes.namesVersion });
    return ports.map(portOption);
  }, [isAir, portOption, airportOption, routes.namesVersion]);

  const searchDest = useCallback(async (term: string, signal: AbortSignal): Promise<PortOpt[]> => {
    void signal;
    const cc = country?.value.code;
    if (!cc) return [];
    if (isAir) {
      const { airports } = await searchAirports({ q: term, country: cc, limit: PICKER_ROWS });
      return airports.map(airportOption);
    }
    const { ports } = await searchPorts({ q: term, country: cc, limit: PICKER_ROWS, nv: routes.namesVersion });
    return ports.map(portOption);
  }, [country?.value.code, isAir, portOption, airportOption, routes.namesVersion]);

  /* Countries are a fixed list, so this filters in memory — no request per
     keystroke for 170 rows that never change. Name FIRST, then the flag:
     leading with the emoji broke the browser's own first-letter type-ahead. */
  const searchCountry = useCallback(async (term: string): Promise<ComboOption<PortCountry>[]> => {
    /* ⚠️ NOT CAPPED. A `.slice(0, 40)` lived here, copied from the PORT
       pickers where a cap is right — those search 3,806 rows on the server and
       return a page. Countries are a fixed in-memory list of ~198 that the
       operator SCROLLS, so the cap silently truncated it and everything past
       the fortieth name was unreachable. A picker that cannot reach its own
       options is worse than a slow one. */
    const q = term.trim().toLowerCase();
    return countries
      .map((c) => ({
        key: c.code,
        value: c,
        label: countryDisplayName(c.code, c.name ?? c.code, lang),
        glyph: flagEmoji(c.code) || undefined,
        code: c.code,
      }))
      .filter((o) => !q || o.label.toLowerCase().includes(q) || o.key.toLowerCase().startsWith(q))
      .sort((a, b) => a.label.localeCompare(b.label, lang === "zh" ? "zh-CN" : lang === "ar" ? "ar" : "en"));
  }, [countries, lang]);

  /* ── the search ────────────────────────────────────────────────────────── */
  /* ⚠️ THE CODE IS TAKEN FROM THE OPTION, NOT SNIFFED OFF THE VALUE'S SHAPE.
     The earlier version asked `"locode" in value ? … : "iata" in value ? …`,
     which is guessing a coding system from an object's keys — the exact habit
     that lets a seaport code and an airport code be mistaken for each other.
     The picker already carries the canonical code it displayed. */
  const originCode = origin?.code ?? null;
  const destCode = dest?.code ?? null;
  const canSearch = Boolean(origin && dest && !busy);

  const run = useCallback(async (force = false) => {
    if (!origin || !dest) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    try {
      const res = await searchRates({
        mode,
        origin: origin.code ?? latinOf(origin),
        destination: dest.code ?? latinOf(dest),
        destinationCountry: country?.value.code,
        equipment: mode === "ocean_fcl" ? equipment : undefined,
        cbm: effectiveCbm,
        grossKg: Number(grossKg) || undefined,
        dimensionsCm: parsedDims.length ? parsedDims : undefined,
        volumetricRule: rule,
        force,
      }, ctrl.signal);
      setData(res);
      /* Recording the lane is a convenience, never a reason to fail a search. */
      void saveRoute({
        action: "record", mode,
        originCode: res.origin.locode ?? origin.code ?? latinOf(origin),
        destinationCode: res.destination.locode ?? dest.code ?? latinOf(dest),
        originLabel: latinOf(origin), destinationLabel: latinOf(dest),
        params: { equipment, cbm, grossKg, rule },
      }).then(() => loadRoutes()).then(setRoutes).catch(() => {});
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setData(null);
      setError(describe(e, t));
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, [origin, dest, mode, country?.value.code, equipment, cbm, effectiveCbm, grossKg, rule, parsedDims, t]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /* The quote form is opened FROM a lane, never on its own: a forwarder quote
     filed against a route the operator is not looking at is a quote nobody
     will ever find again. */
  const [quoteOpen, setQuoteOpen] = useState(false);

  const isFavorite = useMemo(
    () => routes.favorites.some((f) => f.origin_code === originCode && f.destination_code === destCode && f.mode === mode),
    [routes.favorites, originCode, destCode, mode],
  );

  const toggleFavorite = useCallback(async () => {
    if (!originCode || !destCode || !origin || !dest) return;
    await saveRoute({
      action: isFavorite ? "unfavorite" : "favorite",
      mode, originCode, destinationCode: destCode,
      originLabel: latinOf(origin), destinationLabel: latinOf(dest),
    });
    setRoutes(await loadRoutes());
  }, [isFavorite, mode, originCode, destCode, origin, dest]);

  /* ── chrome ────────────────────────────────────────────────────────────── */
  const quantity = mode === "ocean_lcl" ? (effectiveCbm || 1) : mode === "air" ? (Number(grossKg) || 1) : 1;

  return (
    <AuroraShell dir={isRtl ? "rtl" : "ltr"}>
      {/* pb-24 when the saved/recent rail sits at the BOTTOM: the Hub's floating
          AI dock is `fixed bottom-6 end-6`, and with only pb-8 the last route
          chip rendered underneath it. In the wide layout the rail is a right
          column and clears it on its own. */}
      {/* Top padding is the Hub shell's (was pt-12, for a frosted ramp that no
          longer hangs below the header at rest — measured 25/09). The bottom
          is `!` so the compact density layer cannot rewrite the dock
          clearance above to 16px. */}
      <div ref={hostRef} className={`mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 ${wide ? "!pb-8" : "!pb-24"}`}>
        <PageHeader
          title={t("app.title")}
          subtitle={t("app.subtitle")}
          icon={<ShippingIcon size={16} />}
          showTabs={false}
          action={routes.canReviewNames ? (
            /* Shipping · edit only — the server says so with the lanes. */
            <Link href="/shipping/names" aria-label={t("names.open")}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-focus)] sm:px-4">
              <LanguagesIcon size={15} />
              <span className="hidden sm:inline">{t("names.open")}</span>
            </Link>
          ) : undefined}
        />

        {/* ── the search strip ──────────────────────────────────────────────
            ⚠️ NOTHING HERE IS STICKY, AND THAT IS THE HOUSE PATTERN.

            The first version pinned this whole block — method, both port
            pickers, the container chips and the button, about 200px of it —
            with a `kx-bar-host` + `kx-glass-bar` frost of its own. Two things
            were wrong with that. Half the page moved and half did not, which
            is what the owner reported. And it was a SECOND edge blur: on an
            under-glass route the main header's pane already wears the
            progressive ramp, and the standing rule is one edge blur, never
            three.

            Shipping has exactly the shape the apps that get this right have —
            PageHeader with showTabs={false}, navigation from the page itself,
            no tab band. Travel, Expenses, Notes, Projects and Planning all
            render that and carry ZERO stickies; they sit in isUnderglassRoute
            and deliberately NOT in appOwnsTopRamp, because with no band there
            is no ramp host and listing them would trade the pane's frost for a
            ramp that never gets drawn. This is the same case.

            mt-5 is the house gap after a PageHeader — Travel and Contracts
            both set exactly that on their first block. This strip had no top
            margin at all, so the method selector sat flush against the header
            row with nothing between them. */}
        <div className="mb-4 mt-5">
          {/* method — three-up, icon-led, always visible */}
          <div role="radiogroup" aria-label={t("a11y.modeGroup")} className="mb-2 grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1">
            {MODES.map((m) => {
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => changeMode(m.id)}
                  /* kx-seg-on paints a RING, and a ring cannot be clipped into
                     a curve — the element owns its own radius. CI rule 09. */
                  /* The radius lives on THIS element, not the group: kx-seg-on
                     paints an inset RING, and a parent's rounded+overflow can
                     clip a fill into a curve but cannot bend a ring. */
                  className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors ${on ? SEG_ON : SEG_OFF}`}
                >
                  {m.icon(15)}
                  <span>{t(`mode.${m.id}`)}</span>
                  {w >= 560 ? (
                    <span className={`text-[10px] font-normal leading-tight ${on && !aurora ? "text-[var(--text-inverted)]/70" : "text-[var(--text-ghost)]"}`}>{t(`mode.${m.id}.hint`)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* route */}
          <div className={`grid gap-2 ${wide ? "grid-cols-[1fr_auto_1fr_1fr_auto]" : mid ? "grid-cols-3" : "grid-cols-1"}`}>
            <Labelled label={isAir ? t("field.originAirport") : t("field.originPort")}>
              <SearchCombobox
                value={origin}
                onChange={setOrigin}
                search={searchOrigin}
                scopeKey={`origin-${mode}`}
                icon={isAir ? <PlaneIcon size={14} /> : <PortIcon size={14} />}
                placeholder={isAir ? t("field.originAirport") : t("ph.originPort")}
                searchPlaceholder={isAir ? t("ph.searchAirports") : t("ph.searchPorts")}
                emptyLabel={t("err.noRoute")}
                loadingLabel={t("load.ports")}
                ariaLabel={isAir ? t("field.originAirport") : t("a11y.originPicker")}
                resultCap={PICKER_ROWS}
                cappedHint={t("ph.moreResults")}
                clearLabel={t("action.clear")}
              />
            </Labelled>

            {/* Direction is fixed for v1 — Koleex ships FROM China. The control
                is present and disabled so the shape of a future return lane is
                visible rather than invented later, and it exists only in the
                wide layout where there is a column for it: a lone disabled
                button on its own row is noise, not affordance. */}
            {wide ? (
              <div className="flex items-end justify-center pb-[1px]">
                <button
                  type="button"
                  aria-label={t("action.swap")}
                  title={t("action.swap")}
                  disabled
                  className="flex h-10 w-8 items-center justify-center rounded-lg text-[var(--text-ghost)]"
                >
                  <ArrowRightLeftIcon size={13} />
                </button>
              </div>
            ) : null}

            <Labelled label={t("field.country")}>
              <SearchCombobox
                value={country}
                onChange={changeCountry}
                search={searchCountry}
                scopeKey="country"
                icon={<GlobeIcon size={14} />}
                placeholder={t("ph.country")}
                searchPlaceholder={t("ph.searchCountries")}
                emptyLabel={t("err.noRoute")}
                loadingLabel={t("load.ports")}
                ariaLabel={t("field.country")}
                clearLabel={t("action.clear")}
              />
            </Labelled>

            <Labelled label={isAir ? t("field.destAirport") : t("field.destPort")}>
              <SearchCombobox
                value={dest}
                onChange={setDest}
                search={searchDest}
                scopeKey={`dest-${country?.key ?? ""}-${mode}`}
                icon={isAir ? <PlaneIcon size={14} /> : <PortIcon size={14} />}
                placeholder={isAir ? t("field.destAirport") : t("ph.destPort")}
                searchPlaceholder={isAir ? t("ph.searchAirports") : t("ph.searchPorts")}
                emptyLabel={t("err.noRoute")}
                loadingLabel={t("load.ports")}
                ariaLabel={isAir ? t("field.destAirport") : t("a11y.destPicker")}
                resultCap={PICKER_ROWS}
                cappedHint={t("ph.moreResults")}
                clearLabel={t("action.clear")}
                disabled={!country}
                disabledHint={t("ph.pickCountryFirst")}
              />
            </Labelled>

            {wide ? <div className="flex items-end"><SearchButton t={t} busy={busy} disabled={!canSearch} onClick={() => run(false)} /></div> : null}
          </div>

          {/* cargo — only what this method actually needs */}
          <div className={`mt-2 flex flex-wrap items-end gap-2 ${wide ? "" : "pb-1"}`}>
            {mode === "ocean_fcl" ? (
              <Labelled label={t("field.containers")}>
                <div className="flex gap-1.5">
                  {CONTAINER_EQUIPMENT.map((eq) => {
                    const on = equipment.includes(eq);
                    return (
                      <button
                        key={eq}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setEquipment((prev) => (on ? prev.filter((x) => x !== eq) : [...prev, eq]))}
                        className={`h-10 min-w-[64px] rounded-xl px-3 font-mono text-[12px] font-semibold tabular-nums transition-colors ${on ? CHIP_ON : SEG_OFF}`}
                      >
                        {eq}
                      </button>
                    );
                  })}
                </div>
              </Labelled>
            ) : null}

            {mode === "ocean_lcl" ? (
              <>
                <NumberField label={t("field.volume")} unit={t("unit.cbm")} icon={<CubicMeterIcon size={13} />} value={cbm} onChange={setCbm} />
                <NumberField label={t("field.grossWeight")} unit={t("unit.kg")} icon={<WeightIcon size={13} />} value={grossKg} onChange={setGrossKg} />
              </>
            ) : null}

            {isAir ? (
              <>
                <NumberField label={t("field.grossWeight")} unit={t("unit.kg")} icon={<WeightIcon size={13} />} value={grossKg} onChange={setGrossKg} />
                <NumberField
                  label={t("field.volume")} unit={t("unit.cbm")} icon={<CubicMeterIcon size={13} />}
                  value={derivedCbm != null ? String(derivedCbm) : cbm}
                  onChange={setCbm}
                  readOnly={derivedCbm != null}
                  hint={derivedCbm != null ? t("field.dimensions") : undefined}
                />
                <Labelled label={t("field.dimensions")}>
                  <button
                    type="button"
                    onClick={() => setDims((d) => (d.length ? [] : [{ l: "", w: "", h: "", qty: "1" }]))}
                    aria-pressed={dims.length > 0}
                    className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-medium transition-colors ${dims.length ? `${CHIP_ON} border-transparent` : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}
                  >
                    <RulerIcon size={13} />
                    {dims.length ? t("action.hideDetails") : t("action.addDimensions")}
                  </button>
                </Labelled>
                <Labelled label={t("weight.rule")}>
                  <select
                    value={rule}
                    onChange={(e) => setRule(e.target.value as VolumetricRule)}
                    title={t("weight.ruleNote")}
                    className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.04] px-2 text-[12px] text-[var(--text-primary)]"
                  >
                    <option value="iata_air">{t("weight.rule.iata_air")}</option>
                    <option value="express_courier">{t("weight.rule.express_courier")}</option>
                  </select>
                </Labelled>
              </>
            ) : null}

            {/* Phone: the primary action is full width and thumb-sized, not a
                right-aligned pill that competes with the fields above it. */}
            {!wide ? (
              <div className={w < 560 ? "w-full" : "ms-auto"}>
                <SearchButton t={t} busy={busy} disabled={!canSearch} onClick={() => run(false)} fullWidth={w < 560} />
              </div>
            ) : null}
          </div>

          {isAir && dims.length ? (
            <div className="mt-2 space-y-1.5">
              {dims.map((d, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <DimBox value={d.l} onChange={(v) => setDims((p) => p.map((x, j) => (j === i ? { ...x, l: v } : x)))} label="L" />
                  <span aria-hidden className="text-[11px] text-[var(--text-ghost)]">×</span>
                  <DimBox value={d.w} onChange={(v) => setDims((p) => p.map((x, j) => (j === i ? { ...x, w: v } : x)))} label="W" />
                  <span aria-hidden className="text-[11px] text-[var(--text-ghost)]">×</span>
                  <DimBox value={d.h} onChange={(v) => setDims((p) => p.map((x, j) => (j === i ? { ...x, h: v } : x)))} label="H" />
                  <span className="text-[11px] text-[var(--text-ghost)]">{t("unit.cm")}</span>
                  <DimBox value={d.qty} onChange={(v) => setDims((p) => p.map((x, j) => (j === i ? { ...x, qty: v } : x)))} label={t("field.pieces")} wide />
                  <button type="button" aria-label={t("action.removePiece")} title={t("action.removePiece")}
                    onClick={() => setDims((p) => p.filter((_, j) => j !== i))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)]">
                    <CrossIcon size={11} />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => setDims((p) => [...p, { l: "", w: "", h: "", qty: "1" }])}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                <PlusIcon size={11} />{t("action.addDimensions")}
              </button>
            </div>
          ) : null}
        </div>

        {/* ── body ─────────────────────────────────────────────────────────── */}
        <div className={`grid gap-4 ${wide ? "grid-cols-[minmax(0,1fr)_300px]" : "grid-cols-1"}`}>
          <main className="min-w-0 space-y-3">
            {origin && dest ? (
              <RouteStrip origin={origin} dest={dest} mode={mode} isFavorite={isFavorite}
                          onToggleFavorite={toggleFavorite} onRefresh={() => run(true)}
                          onAddQuote={() => setQuoteOpen(true)}
                          busy={busy} cached={data?.servedFromCache ?? false} t={t} narrow={w < 560} />
            ) : null}

            {data?.weight && isAir ? <WeightPanel weight={data.weight} t={t} /> : null}
            {data && mode === "ocean_lcl" && effectiveCbm && Number(grossKg) > 0
              ? <MeasurePanel cbm={effectiveCbm} grossKg={Number(grossKg)} t={t} /> : null}

            {busy ? <ResultSkeleton label={t("load.rates")} cols={cols} />
              : error ? <ErrorPanel error={error} t={t} onRetry={() => run(true)} />
              : data ? <RateResults data={data} t={t} lang={lang} quantity={quantity} columns={cols}
                                    onViewSources={viewSources} onAddQuote={() => setQuoteOpen(true)} />
              : <EmptyPanel t={t} />}
          </main>

          <aside className={`min-w-0 space-y-3 ${wide ? "" : "order-last"}`}>
            {data ? <SourcesPanel providers={data.providers} mode={mode} t={t} panelRef={sourcesRef} /> : null}
            <RoutesPanel routes={routes} t={t} lang={lang}
              onPick={(r) => {
                /* changeMode first (it may clear the endpoints when the sea/air
                   axis flips), then set them — never the other way round. */
                changeMode(r.mode);
                setOrigin(restoredEndpoint(r.origin_code, r.origin_label, laneNames(routes, r, "origin"), lang));
                setDest(restoredEndpoint(r.destination_code, r.destination_label, laneNames(routes, r, "destination"), lang));
                /* The country field has to follow, or the form shows a chosen
                   destination port above an empty "Pick a country" and reads
                   half-filled. A UN/LOCODE opens with the ISO country code, so
                   the answer is already in the value we just set. IATA carries
                   no country, so an air route leaves it alone rather than
                   guessing. */
                const cc = countryOfCode(r.destination_code);
                const hit = cc ? countries.find((c) => c.code === cc) : null;
                if (hit) {
                  setCountry({
                    key: hit.code, value: hit,
                    label: countryDisplayName(hit.code, hit.name ?? hit.code, lang),
                    glyph: flagEmoji(hit.code) || undefined,
                    code: hit.code,
                  });
                }
              }} />
          </aside>
        </div>
      </div>

      {/* Mounted only with both ends chosen — the lane is the form's subject,
          not one of its fields. */}
      {origin && dest ? (
        <ForwarderQuoteModal
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          /* Re-run FORCED so the new row is read back and the card repaints
             with it, rather than the operator saving a price and still looking
             at the empty state that made them open the form. */
          onSaved={() => { void run(true); }}
          lane={{
            mode,
            origin: origin.code ?? latinOf(origin),
            destination: dest.code ?? latinOf(dest),
            originLabel: origin.label,
            destinationLabel: dest.label,
            destinationCountry: country?.value.code,
            equipment: mode === "ocean_fcl" ? (equipment[0] ?? "40HQ") : undefined,
          }}
          t={t}
          lang={lang}
        />
      ) : null}
    </AuroraShell>
  );
}

/* ── small pieces ───────────────────────────────────────────────────────── */

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-ghost)]">{label}</span>
      {children}
    </label>
  );
}

function NumberField({ label, unit, icon, value, onChange, readOnly, hint }: {
  label: string; unit: string; icon: React.ReactNode; value: string;
  onChange: (v: string) => void; readOnly?: boolean; hint?: string;
}) {
  return (
    <Labelled label={label}>
      <div
        title={hint}
        className={`flex h-10 w-[150px] items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-2.5 ${
          readOnly ? "bg-[var(--bg-surface-subtle)]" : "bg-[var(--bg-inverted)]/[0.04] focus-within:border-[#567FB2]/60 focus-within:shadow-[0_0_0_4px_rgba(86,127,178,0.16)]"
        }`}
      >
        <span className="shrink-0 text-[var(--text-ghost)]">{icon}</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          readOnly={readOnly}
          aria-readonly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[13px] tabular-nums text-[var(--text-primary)] outline-none read-only:text-[var(--text-dim)]"
        />
        <span className="shrink-0 text-[11px] text-[var(--text-ghost)]">{unit}</span>
      </div>
    </Labelled>
  );
}

/** One L / W / H / qty box. Small on purpose — four of them share a row. */
function DimBox({ value, onChange, label, wide }: {
  value: string; onChange: (v: string) => void; label: string; wide?: boolean;
}) {
  return (
    <label className="flex h-9 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inverted)]/[0.04] px-2 focus-within:border-[#567FB2]/60">
      <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--text-ghost)]">{label}</span>
      <input
        type="number" inputMode="decimal" min="0" step="any"
        value={value} onChange={(e) => onChange(e.target.value)}
        className={`min-w-0 bg-transparent text-[12px] tabular-nums text-[var(--text-primary)] outline-none ${wide ? "w-12" : "w-14"}`}
      />
    </label>
  );
}

function SearchButton({ t, busy, disabled, onClick, fullWidth }: {
  t: (k: string, f?: string) => string; busy: boolean; disabled: boolean; onClick: () => void; fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-5 text-[13px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90 disabled:opacity-40 ${fullWidth ? "h-11 w-full" : "h-10"}`}
    >
      {busy ? <SpinnerIcon size={14} className="animate-spin" /> : <SearchIcon size={14} />}
      {busy ? t("action.searching") : t("action.search")}
    </button>
  );
}

function RouteStrip({ origin, dest, mode, isFavorite, onToggleFavorite, onRefresh, onAddQuote, busy, cached, t, narrow }: {
  origin: PortOpt; dest: PortOpt; mode: ShippingMode; isFavorite: boolean;
  onToggleFavorite: () => void; onRefresh: () => void; onAddQuote: () => void;
  busy: boolean; cached: boolean;
  t: (k: string, f?: string) => string; narrow: boolean;
}) {
  const actions = (
    <div className={narrow ? "ms-auto flex items-center gap-1" : "ms-auto flex items-center gap-1"}>
      <button type="button" onClick={onToggleFavorite}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? t("action.unfavorite") : t("action.favorite")}
        title={isFavorite ? t("action.unfavorite") : t("action.favorite")}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] transition-colors ${isFavorite ? "text-[#F59E0B]" : "text-[var(--text-ghost)] hover:text-[var(--text-primary)]"}`}>
        <StarIcon size={13} />
      </button>
      <button type="button" onClick={onRefresh} disabled={busy}
        aria-label={t("action.refresh")} title={t("action.refresh")}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-ghost)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40">
        <RefreshIcon size={13} className={busy ? "animate-spin" : undefined} />
      </button>
      {/* Sits with the lane, not with the results: a forwarder quote belongs
          to a ROUTE, and the operator has one in front of them whether or not
          a search has returned anything. */}
      <button type="button" onClick={onAddQuote}
        aria-label={t("quote.add")} title={t("quote.add")}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2 text-[11px] font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]">
        <FilePlusIcon size={13} />
        {narrow ? null : <span>{t("quote.addShort")}</span>}
      </button>
    </div>
  );
  const meta = (
    <>
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-dim)]">
        {mode === "air" ? <PlaneIcon size={11} /> : <ContainerIcon size={11} />}
        {t(`mode.${mode}`)}
      </span>
      {cached ? <span className="text-[11px] text-[var(--text-ghost)]">{t("load.cached")}</span> : null}
    </>
  );

  /* ⚠️ On a phone the one-row version squeezed BOTH port names to zero width —
     `truncate` inside a flex row shrinks text before it drops a sibling, so the
     strip rendered as "CNSGH→ EGALY" with no names at all. Below 560 the route
     gets its own row and the meta and actions move underneath. */
  if (narrow) {
    return (
      <div className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
        <div className="flex items-start gap-2">
          <RouteIcon size={15} className="mt-[3px] shrink-0 text-[var(--text-ghost)]" />
          {/* WRAPS on a phone. Measured at 375pt: the row needed 334px inside
              317px, so the destination's UN/LOCODE was clipped away — and a
              port code is the one thing on this screen that must not be half
              shown, since EGPSD and EGALY differ by their last three letters.
              Letting the destination drop to its own line costs a row and
              keeps both identifiers whole. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
            <Endpoint opt={origin} />
            <ArrowRightIcon size={13} className="shrink-0 text-[var(--text-ghost)] rtl:rotate-180" />
            <Endpoint opt={dest} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{meta}{actions}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
      <RouteIcon size={15} className="shrink-0 text-[var(--text-ghost)]" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Endpoint opt={origin} />
        {/* The arrow is logical: rtl:rotate-180 turns "onward" the right way
            when the row itself mirrors. */}
        <ArrowRightIcon size={13} className="shrink-0 text-[var(--text-ghost)] rtl:rotate-180" />
        <Endpoint opt={dest} />
      </div>
      {meta}
      {actions}
    </div>
  );
}

function Endpoint({ opt }: { opt: PortOpt }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {opt.glyph ? <span aria-hidden className="shrink-0 text-[14px] leading-none">{opt.glyph}</span> : null}
      {/* The NAME is what the operator reads. `truncate` in a flex row shrinks
          text before it drops a sibling, so without this floor both names
          collapsed to nothing on a phone and the strip read "CNSGH→ EGALY". */}
      <span className="min-w-[4.5rem] truncate text-[13px] font-semibold text-[var(--text-primary)]">{opt.label}</span>
      {opt.code ? <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-ghost)]">{opt.code}</span> : null}
    </span>
  );
}

function WeightPanel({ weight, t }: {
  weight: NonNullable<RateSearchResponse["weight"]>;
  t: (k: string, f?: string) => string;
}) {
  const rows: [string, string][] = [
    [t("weight.gross"), `${weight.grossKg} kg`],
    [t("weight.volumetric"), `${weight.volumetricKg} kg`],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-ghost)]">
        <WeightIcon size={13} />{t("weight.chargeable")}
      </span>
      <span className="text-[20px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">{weight.chargeableKg} kg</span>
      <span className="text-[11px] text-[var(--text-dim)]">
        {weight.basis === "volumetric" ? t("weight.basisVolumetric") : t("weight.basisGross")}
      </span>
      <span className="ms-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-ghost)]">
        {rows.map(([k, v]) => <span key={k}>{k} <span className="tabular-nums text-[var(--text-dim)]">{v}</span></span>)}
        <span title={t("weight.ruleNote")} className="inline-flex items-center gap-1">
          <InfoIcon size={11} />
          {t(`weight.rule.${weight.rule}`)}
        </span>
      </span>
    </div>
  );
}

/* Groupage is billed weight-OR-measure: the greater of cubic metres and
   tonnes, at the same per-unit rate. A 4.5 CBM consignment weighing 6 tonnes
   is billed as 6, and an operator who multiplies CBM by the rate under-quotes
   it. So the basis is stated, not left to be discovered on the invoice. */
function MeasurePanel({ cbm, grossKg, t }: { cbm: number; grossKg: number; t: (k: string, f?: string) => string }) {
  const rt = revenueTons({ cbm, grossKg });
  const basis = rt.basis === "weight" ? t("lcl.basisWeight") : t("lcl.basisMeasure");
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-ghost)]">
        <CubicMeterIcon size={13} />{t("lcl.revenueTons")}
      </span>
      <span className="text-[20px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">{rt.revenueTons}</span>
      <span className="text-[11px] text-[var(--text-dim)]">{t("lcl.wmNote").replace("{basis}", basis)}</span>
      <span className="ms-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-ghost)]">
        <span>{t("field.volume")} <span className="tabular-nums text-[var(--text-dim)]">{rt.cbm} {t("unit.cbm")}</span></span>
        <span>{t("field.grossWeight")} <span className="tabular-nums text-[var(--text-dim)]">{rt.tonnes} t</span></span>
      </span>
    </div>
  );
}

function SourcesPanel({ providers, mode, t, panelRef }: {
  providers: RateSearchResponse["providers"]; mode: ShippingMode;
  t: (k: string, f?: string) => string;
  panelRef?: React.Ref<HTMLElement>;
}) {
  const relevant = providers.filter((p) => p.modes.includes(mode));
  return (
    <section ref={panelRef} className="scroll-mt-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition-shadow">
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-ghost)]">{t("src.title")}</h2>
      {relevant.length === 0 ? (
        <p className="text-[12px] text-[var(--text-dim)]">{t("src.none")}</p>
      ) : (
        <ul className="space-y-2">
          {relevant.map((p) => (
            <li key={p.id} className="flex items-start gap-2">
              <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${p.enabled ? "bg-[#10B981]" : "bg-[var(--text-whisper)]"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">{t(`kind.${p.kind}`)}</span>
                  {/* ⚠️ The freshness badge is for CONNECTED sources only. A
                      disabled provider showing "Live" states a fact about a
                      feed nobody is reading — and next to "Market Estimate" it
                      reads as a promise the source does not make. */}
                  {p.enabled ? (
                    <span className="shrink-0 text-[10px] text-[var(--text-ghost)]">{t(`src.cadence.${p.cadence}`)}</span>
                  ) : null}
                </div>
                {/* ⚠️ THE TECHNICAL REQUIREMENT IS A TOOLTIP, NOT THE RESTING
                    STATE. Environment-variable names and a provider's sign-up
                    URL are for whoever configures this, not for the operator
                    checking a price. The status line stays plain. */}
                <p
                  title={p.enabled ? undefined : [p.reason, p.requires].filter(Boolean).join("\n\n")}
                  className="mt-0.5 text-[11px] leading-snug text-[var(--text-dim)]"
                >
                  {p.enabled ? t("src.active") : t("src.off")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* Declared at module scope, not inside RoutesPanel. A component created
   during render is a NEW component type on every render, so React unmounts and
   remounts it and any state inside resets — react-hooks/static-components. */
/* Declared at module scope, not inside RoutesPanel. A component created
   during render is a NEW component type on every render, so React unmounts and
   remounts it and any state inside resets — react-hooks/static-components. */
function RouteSection({ title, icon, list, empty, onPick, t, routes, lang }: {
  title: string; icon: React.ReactNode; list: SavedRoute[]; empty?: string;
  onPick: (r: SavedRoute) => void; t: (k: string, f?: string) => string;
  routes: RoutesPayload; lang: string;
}) {
  /* The lane stored its Latin labels; the chip shows each end's approved name
     in the screen's language, looked up by code. */
  const from = (r: SavedRoute) => placeName(r.origin_label ?? r.origin_code, laneNames(routes, r, "origin"), lang);
  const to = (r: SavedRoute) => placeName(r.destination_label ?? r.destination_code, laneNames(routes, r, "destination"), lang);
  return (
    <div>
      <h2 className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-ghost)]">
        {icon}{title}
      </h2>
      {list.length === 0 ? (
        empty ? <p className="text-[11px] text-[var(--text-dim)]">{empty}</p> : null
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {list.map((r) => (
            /* max-w-full: a long name (an airport's, or a port's in Arabic)
               truncates inside its chip instead of pushing it past the panel. */
            <li key={r.id} className="max-w-full">
              <button
                type="button"
                onClick={() => onPick(r)}
                title={`${from(r)} → ${to(r)} · ${t(`mode.${r.mode}`)}`}
                className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]">
                {/* ⚠️ THE MODE IS PART OF THE IDENTITY. The same lane searched
                    as FCL and as groupage is two rows (the unique key includes
                    the mode), and without this glyph they rendered as two
                    identical chips — the list looked like it had duplicated
                    itself. */}
                <span aria-hidden className="shrink-0 text-[var(--text-ghost)]">
                  {r.mode === "air" ? <PlaneIcon size={10} />
                    : r.mode === "ocean_lcl" ? <CubicMeterIcon size={10} />
                    : <ContainerIcon size={10} />}
                </span>
                <span className="truncate">{from(r)}</span>
                <ArrowRightIcon size={10} className="shrink-0 text-[var(--text-ghost)] rtl:rotate-180" />
                <span className="truncate">{to(r)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoutesPanel({ routes, onPick, t, lang }: {
  routes: RoutesPayload;
  onPick: (r: SavedRoute) => void;
  t: (k: string, f?: string) => string;
  lang: string;
}) {
  if (!routes.recent.length && !routes.favorites.length) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <RouteSection title={t("fav.title")} icon={<StarIcon size={12} />} list={routes.favorites} empty={t("fav.empty")} onPick={onPick} t={t} routes={routes} lang={lang} />
      <RouteSection title={t("recent.title")} icon={<HistoryIcon size={12} />} list={routes.recent} onPick={onPick} t={t} routes={routes} lang={lang} />
    </section>
  );
}

function EmptyPanel({ t }: { t: (k: string, f?: string) => string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-6 py-16 text-center">
      <RouteIcon size={22} className="mx-auto mb-2 text-[var(--text-ghost)]" />
      <p className="text-[14px] font-semibold text-[var(--text-primary)]">{t("empty.title")}</p>
      <p className="mx-auto mt-1 max-w-[44ch] text-[12px] text-[var(--text-dim)]">{t("empty.hint")}</p>
    </div>
  );
}

function ErrorPanel({ error, t, onRetry }: {
  error: { title: string; body: string; candidates?: PortHit[] };
  t: (k: string, f?: string) => string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#F59E0B]/35 bg-[#F59E0B]/[0.06] px-6 py-10 text-center">
      <TriangleWarningIcon size={20} className="mx-auto mb-2 text-[#F59E0B]" />
      <p className="text-[14px] font-semibold text-[var(--text-primary)]">{error.title}</p>
      <p className="mx-auto mt-1 max-w-[52ch] text-[12px] text-[var(--text-dim)]">{error.body}</p>
      <button type="button" onClick={onRetry}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 text-[12px] font-semibold text-[var(--text-primary)] hover:border-[var(--border-focus)]">
        <RefreshIcon size={13} />{t("err.retry")}
      </button>
    </div>
  );
}

function ResultSkeleton({ label, cols }: { label: string; cols: 1 | 2 | 3 }) {
  const grid = cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <div className="space-y-3">
      <p className="inline-flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
        <SpinnerIcon size={13} className="animate-spin" />{label}
      </p>
      <div className={`grid gap-3 ${grid}`}>
        {[0, 1, 2].slice(0, cols).map((i) => (
          <div key={i} className="kx-shimmer h-[168px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]" />
        ))}
      </div>
    </div>
  );
}

/** Turns a thrown error into a sentence. Raw provider text never reaches here. */
function describe(e: unknown, t: (k: string, f?: string) => string): { title: string; body: string; candidates?: PortHit[] } {
  if (e instanceof RateSearchError) {
    switch (e.code) {
      case "port_unknown":
        return { title: t("err.title"), body: t("err.portUnknown").replace("{name}", e.detail?.input ?? "") };
      case "port_ambiguous":
        return { title: t("err.title"), body: t("err.portAmbiguous").replace("{name}", e.detail?.input ?? ""), candidates: e.detail?.candidates };
      case "port_has_no_code":
        return { title: t("err.title"), body: t("err.portNoCode").replace("{name}", e.detail?.port ?? "") };
      case "rate_limited":
        return { title: t("err.title"), body: t("err.quota") };
      default:
        return { title: t("err.title"), body: t("res.unavailableHint") };
    }
  }
  return { title: t("err.title"), body: t("err.timeout") };
}
