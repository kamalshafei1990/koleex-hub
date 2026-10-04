/* ---------------------------------------------------------------------------
   Shipping — the normalised rate vocabulary.

   Shared by the server (providers, engine, API routes) and the browser (the
   Shipping app). No React, no Node: the same numbers have to come out on both
   sides, the way src/lib/logistics.ts already works.

   ── THE ONE RULE THIS FILE EXISTS FOR ──────────────────────────────────────
   Four kinds of number look identical on screen and mean completely different
   things. They are never merged, never averaged, and never relabelled:

     provider   a freight rate provider's own price for this lane
     market     a public index or calculator BAND. Not a quotation. It says
                roughly what the market is doing, and it cannot be booked.
     koleex     recovered from Koleex's own past shipments and cost
                simulations. Real money we actually paid — on a past date.
     forwarder  a price a named forwarder gave us, for a stated validity.

   A `RateKind` is required on every quote and has no default, so a writer has
   to decide. `isEstimate` is a separate axis: a provider rate can still be an
   estimate, and a forwarder quote can be bookable.
   --------------------------------------------------------------------------- */

/** Ocean full container, ocean groupage, or air. */
export type ShippingMode = "ocean_fcl" | "ocean_lcl" | "air";

/** The three container types Koleex quotes. */
export type ContainerEquipment = "20GP" | "40GP" | "40HQ";
export const CONTAINER_EQUIPMENT: readonly ContainerEquipment[] = ["20GP", "40GP", "40HQ"] as const;

export type RateKind = "provider" | "market" | "koleex" | "forwarder";

/**
 * How fresh the SOURCE is — not how fresh this row is.
 *
 * ⚠️ A provider that syncs once a day must never be labelled "Live". The
 * Shipping UI derives its badge from this field alone, so the honest answer
 * lives next to the rate instead of in a marketing claim.
 */
export type SourceCadence = "realtime" | "daily" | "historical" | "manual";

/**
 * What the price actually covers. Two rates are NOT alternatives to each other
 * unless this matches — a port-to-port price beside a door-to-door one is a
 * different product, not a cheaper one.
 */
export type ServiceScope =
  | "port_to_port"
  | "door_to_port"
  | "port_to_door"
  | "door_to_door"
  | "airport_to_airport";

/** What `amount` is per. */
export type RateUnit = "container" | "cbm" | "kg" | "shipment";

/** Objective, computed — see confidence.ts. Never an opinion. */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Why a rate scored what it scored — as a CODE the screen translates, never a
 * finished English sentence.
 *
 * ⚠️ These are shown to the operator in the panel under a price, so they carry
 * the same two obligations as any other visible string: they are translated
 * (en / zh / ar) and any date in them is rendered D/M/Y by the screen. Neither
 * is possible if the scorer bakes prose and an ISO date into a string.
 * `date` is ISO and stays ISO on the wire; `text` is an identifier pair like
 * "CNNBO→EGPSD" that is deliberately not translated.
 */
export interface ConfidenceReason {
  code:
    | "noRetrievalTime" | "retrievedToday" | "daysOld" | "daysOldStale"
    | "validTo" | "validityExpired" | "noValidity"
    | "exactLane" | "otherLane" | "equipmentMismatch"
    | "surchargeItemised" | "surchargesItemised" | "inclusionsOnly" | "freightOnly"
    | "singleSource" | "corroboratedOne" | "corroborated" | "sourcesDisagree"
    | "dailyCadence" | "marketBand" | "koleexPast";
  n?: number;
  /** ISO yyyy-mm-dd. The screen formats it. */
  date?: string;
  text?: string;
}

/** One itemised charge. Surcharges are listed, never folded into the freight. */
export interface Surcharge {
  /** Trade code where there is one: BAF, CAF, GRI, PSS, THC, ISPS, DOC, AMS… */
  code: string;
  label: string;
  amount: number;
  currency: string;
  /** What it is charged per; "shipment" means a flat fee. */
  per: RateUnit;
}

/**
 * One normalised rate. Every provider adapter returns this shape and nothing
 * else; the UI never sees a provider's own response.
 */
export interface FreightRate {
  id?: string;

  kind: RateKind;
  /** 'freightos_public' | 'awice' | 'koleex_landed_cost' | a forwarder's contact id */
  sourceId: string;
  sourceLabel: string;
  sourceCadence: SourceCadence;

  mode: ShippingMode;

  /** The canonical identifier, denormalised so history survives a reference
      row changing. Always read it together with the system below. */
  originCode: string;
  destinationCode: string;
  /** Which register `originCode` / `destinationCode` come from. */
  originCodeSystem: CodeSystem;
  destinationCodeSystem: CodeSystem;
  originLabel?: string;
  destinationLabel?: string;

  scope: ServiceScope;
  /** undefined = the source did not say. Not the same as false. */
  includesOriginCharges?: boolean;
  includesDestinationCharges?: boolean;
  includesCustoms?: boolean;
  incoterm?: string;

  /** FCL only. */
  equipment?: ContainerEquipment;
  unit: RateUnit;
  /** Air bracket as the provider expressed it: 'MIN' | '+45' | '+100' | … */
  weightBreak?: string;
  minCharge?: number;

  /**
   * null means: we asked, and there is no rate. That is a real answer and the
   * UI shows "Rate unavailable" for it. It is never replaced by a guess.
   */
  amount: number | null;
  /** A market BAND lives here and leaves `amount` null, so a range can never be read as a price. */
  amountLow?: number;
  amountHigh?: number;
  currency: string;
  surcharges: Surcharge[];
  /** freight + surcharges, only when every component is known. */
  totalEstimate?: number;

  /** When we fetched it. */
  retrievedAt: string;
  /** When our CACHE entry goes stale. Not the carrier's validity — that is validFrom/validUntil. */
  expiresAt?: string;
  validFrom?: string;
  validUntil?: string;

  transitDaysMin?: number;
  transitDaysMax?: number;
  carrier?: string;
  vessel?: string;
  voyage?: string;
  etd?: string;
  eta?: string;

  confidence?: ConfidenceLevel;
  confidenceScore?: number;
  confidenceReasons?: ConfidenceReason[];
  /** true unless the source says this is bookable. */
  isEstimate: boolean;

  notes?: string;
}

/** What the UI asks for. One search, one shape, all three modes. */
export interface RateQuery {
  mode: ShippingMode;
  /** Canonical identifiers, each with the register it belongs to. */
  originCode: string;
  destinationCode: string;
  originCodeSystem: CodeSystem;
  destinationCodeSystem: CodeSystem;

  /** FCL: which containers to price. Defaults to all three. */
  equipment?: ContainerEquipment[];

  /** LCL: the volume being shipped. */
  cbm?: number;
  /** LCL / air: gross weight in kg. */
  grossKg?: number;

  /** Air: one consignment's dimensions, for the volumetric calculation. */
  dimensionsCm?: { l: number; w: number; h: number; qty?: number }[];
  /** Air: which volumetric convention to apply. See chargeable-weight.ts. */
  volumetricRule?: VolumetricRule;

  /** ISO date; defaults to today. Part of the cache key. */
  departOn?: string;
}

/** Named so the divisor is never a magic number. See chargeable-weight.ts. */
export type VolumetricRule = "iata_air" | "express_courier";

/**
 * Which coding system a code belongs to.
 *
 * ⚠️ NEVER INFERRED FROM THE CODE'S SHAPE. 787 UN/LOCODEs in this data set
 * name both a seaport and an airport (USDET is Detroit port and Detroit
 * airport), and a country prefix plus an IATA code is frequently a real and
 * different seaport (CN + ZJG is Zhangjiagang). A bare code string cannot say
 * which register it came from, so it never travels without this.
 */
export type CodeSystem = "unlocode" | "iata";

/** What a provider adapter reports back, successes and failures alike. */
export interface ProviderResult {
  providerId: string;
  rates: FreightRate[];
  /**
   * Present when the provider could not answer. The UI turns this into a
   * human sentence; the raw text is logged, never shown.
   */
  error?: {
    kind: "unconfigured" | "unauthorised" | "timeout" | "quota" | "no_route" | "unsupported" | "upstream";
    detail?: string;
  };
  /** Wall-clock ms, for the diagnostics strip. */
  elapsedMs?: number;
}

/** A whole search: every provider's answer, kept apart. */
export interface RateSearchResult {
  query: RateQuery;
  results: ProviderResult[];
  /** Rates grouped by kind so the UI cannot accidentally mix them. */
  byKind: Record<RateKind, FreightRate[]>;
  searchedAt: string;
}

export const MODE_UNIT: Record<ShippingMode, RateUnit> = {
  ocean_fcl: "container",
  ocean_lcl: "cbm",
  air: "kg",
};

/** Air weight brackets, in the order the trade quotes them. */
export const AIR_WEIGHT_BREAKS = ["MIN", "+45", "+100", "+300", "+500", "+1000"] as const;
export type AirWeightBreak = (typeof AIR_WEIGHT_BREAKS)[number];

/** The lower bound of each bracket in kg; MIN is the minimum charge. */
export const AIR_BREAK_FLOOR: Record<AirWeightBreak, number> = {
  MIN: 0, "+45": 45, "+100": 100, "+300": 300, "+500": 500, "+1000": 1000,
};

/** The bracket a chargeable weight falls into. */
export function bracketFor(chargeableKg: number): AirWeightBreak {
  let hit: AirWeightBreak = "MIN";
  for (const b of AIR_WEIGHT_BREAKS) if (chargeableKg >= AIR_BREAK_FLOOR[b]) hit = b;
  return hit;
}
