"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Users,
  TrendingUp,
  MapPin,
  Building2,
  ChevronRight,
  BarChart3,
  Shield,
  Star,
  Mail,
  Phone,
  Briefcase,
  Eye,
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MarketsIcon from "@/components/icons/MarketsIcon";

/* ─────────── Reference Data ─────────── */

const REFERENCE_COUNTRIES = [
  "Afghanistan 🇦🇫|-0.03", "Albania 🇦🇱|0", "Algeria 🇩🇿|-0.03", "Andorra 🇦🇩|0.08", "Angola 🇦🇴|-0.03", "Antigua 🇦🇬|0", "Argentina 🇦🇷|0", "Armenia 🇦🇲|0", "Australia 🇦🇺|0.08", "Austria 🇦🇹|0.08", "Azerbaijan 🇦🇿|0",
  "Bahamas 🇧🇸|0", "Bahrain 🇧🇭|0", "Bangladesh 🇧🇩|-0.03", "Barbados 🇧🇧|0", "Belarus 🇧🇾|0", "Belgium 🇧🇪|0.08", "Belize 🇧🇿|0", "Benin 🇧🇯|-0.03", "Bhutan 🇧🇹|-0.03", "Bolivia 🇧🇴|0", "Bosnia 🇧🇦|0", "Botswana 🇧🇼|-0.03", "Brazil 🇧🇷|0", "Brunei 🇧🇳|0", "Bulgaria 🇧🇬|0", "Burkina Faso 🇧🇫|-0.03", "Burundi 🇧🇮|-0.03",
  "Cabo Verde 🇨🇻|-0.03", "Cambodia 🇰🇭|0", "Cameroon 🇨🇲|-0.03", "Canada 🇨🇦|0.08", "CAR 🇨🇫|-0.03", "Chad 🇹🇩|-0.03", "Chile 🇨🇱|0", "China 🇨🇳|0", "Colombia 🇨🇴|0", "Comoros 🇰🇲|-0.03", "Congo 🇨🇬|-0.03", "Costa Rica 🇨🇷|0", "Croatia 🇭🇷|0", "Cuba 🇨🇺|0", "Cyprus 🇨🇾|0.08", "Czechia 🇨🇿|0",
  "Denmark 🇩🇰|0.08", "Djibouti 🇩🇯|-0.03", "Dominica 🇩🇲|0", "Dominican Rep 🇩🇴|0",
  "Ecuador 🇪🇨|0", "Egypt 🇪🇬|-0.03", "El Salvador 🇸🇻|0", "Equatorial Guinea 🇬🇶|-0.03", "Eritrea 🇪🇷|-0.03", "Estonia 🇪🇪|0.08", "Eswatini 🇸🇿|-0.03", "Ethiopia 🇪🇹|-0.03",
  "Fiji 🇫🇯|0", "Finland 🇫🇮|0.08", "France 🇫🇷|0.08",
  "Gabon 🇬🇦|-0.03", "Gambia 🇬🇲|-0.03", "Georgia 🇬🇪|0", "Germany 🇩🇪|0.08", "Ghana 🇬🇭|-0.03", "Greece 🇬🇷|0.08", "Grenada 🇬🇩|0", "Guatemala 🇬🇹|0", "Guinea 🇬🇳|-0.03", "Guinea-Bissau 🇬🇼|-0.03", "Guyana 🇬🇾|0",
  "Haiti 🇭🇹|0", "Honduras 🇭🇳|0", "Hungary 🇭🇺|0",
  "Iceland 🇮🇸|0.08", "India 🇮🇳|-0.03", "Indonesia 🇮🇩|0", "Iran 🇮🇷|0", "Iraq 🇮🇶|0", "Ireland 🇮🇪|0.08", "Israel 🇮🇱|0", "Italy 🇮🇹|0.08", "Ivory Coast 🇨🇮|-0.03",
  "Jamaica 🇯🇲|0", "Japan 🇯🇵|0.08", "Jordan 🇯🇴|0",
  "Kazakhstan 🇰🇿|0", "Kenya 🇰🇪|-0.03", "Kiribati 🇰🇮|0", "Kuwait 🇰🇼|0", "Kyrgyzstan 🇰🇬|0",
  "Laos 🇱🇦|0", "Latvia 🇱🇻|0.08", "Lebanon 🇱🇧|0", "Lesotho 🇱🇸|-0.03", "Liberia 🇱🇷|-0.03", "Libya 🇱🇾|-0.03", "Liechtenstein 🇱🇮|0.08", "Lithuania 🇱🇹|0.08", "Luxembourg 🇱🇺|0.08",
  "Madagascar 🇲🇬|-0.03", "Malawi 🇲🇼|-0.03", "Malaysia 🇲🇾|0", "Maldives 🇲🇻|-0.03", "Mali 🇲🇱|-0.03", "Malta 🇲🇹|0.08", "Marshall 🇲🇭|0", "Mauritania 🇲🇷|-0.03", "Mauritius 🇲🇺|-0.03", "Mexico 🇲🇽|0", "Micronesia 🇫🇲|0", "Moldova 🇲🇩|0", "Monaco 🇲🇨|0.08", "Mongolia 🇲🇳|0", "Montenegro 🇲🇪|0", "Morocco 🇲🇦|-0.03", "Mozambique 🇲🇿|-0.03", "Myanmar 🇲🇲|0",
  "Namibia 🇳🇦|-0.03", "Nauru 🇳🇷|0", "Nepal 🇳🇵|-0.03", "Netherlands 🇳🇱|0.08", "New Zealand 🇳🇿|0.08", "Nicaragua 🇳🇮|0", "Niger 🇳🇪|-0.03", "Nigeria 🇳🇬|-0.03", "North Korea 🇰🇵|0", "Macedonia 🇲🇰|0", "Norway 🇳🇴|0.08",
  "Oman 🇴🇲|0",
  "Pakistan 🇵🇰|-0.03", "Palau 🇵🇼|0", "Palestine 🇵🇸|0", "Panama 🇵🇦|0", "PNG 🇵🇬|0", "Paraguay 🇵🇾|0", "Peru 🇵🇪|0", "Philippines 🇵🇭|0", "Poland 🇵🇱|0", "Portugal 🇵🇹|0.08",
  "Qatar 🇶🇦|0",
  "Romania 🇷🇴|0", "Russia 🇷🇺|0", "Rwanda 🇷🇼|-0.03",
  "St Kitts 🇰🇳|0", "St Lucia 🇱🇨|0", "St Vincent 🇻🇨|0", "Samoa 🇼🇸|0", "San Marino 🇸🇲|0.08", "Sao Tome 🇸🇹|-0.03", "Saudi Arabia 🇸🇦|0", "Senegal 🇸🇳|-0.03", "Serbia 🇷🇸|0", "Seychelles 🇸🇨|-0.03", "Sierra Leone 🇸🇱|-0.03", "Singapore 🇸🇬|0.08", "Slovakia 🇸🇰|0", "Slovenia 🇸🇮|0.08", "Solomon 🇸🇧|0", "Somalia 🇸🇴|-0.03", "South Africa 🇿🇦|-0.03", "South Korea 🇰🇷|0.08", "South Sudan 🇸🇸|-0.03", "Spain 🇪🇸|0.08", "Sri Lanka 🇱🇰|-0.03", "Sudan 🇸🇩|-0.03", "Suriname 🇸🇷|0", "Sweden 🇸🇪|0.08", "Switzerland 🇨🇭|0.08", "Syria 🇸🇾|0",
  "Taiwan 🇹🇼|0", "Tajikistan 🇹🇯|0", "Tanzania 🇹🇿|-0.03", "Thailand 🇹🇭|0", "Timor-Leste 🇹🇱|0", "Togo 🇹🇬|-0.03", "Tonga 🇹🇴|0", "Trinidad 🇹🇹|0", "Tunisia 🇹🇳|-0.03", "Turkey 🇹🇷|0", "Turkmenistan 🇹🇲|0", "Tuvalu 🇹🇻|0",
  "Uganda 🇺🇬|-0.03", "Ukraine 🇺🇦|0", "UAE 🇦🇪|0", "UK 🇬🇧|0.08", "USA 🇺🇸|0.08", "Uruguay 🇺🇾|0", "Uzbekistan 🇺🇿|0",
  "Vanuatu 🇻🇺|0", "Vatican 🇻🇦|0.08", "Venezuela 🇻🇪|0", "Vietnam 🇻🇳|0",
  "Yemen 🇾🇪|0",
  "Zambia 🇿🇲|-0.03", "Zimbabwe 🇿🇼|-0.03",
];

/* ─────────── Types ─────────── */

interface MarketEntry {
  name: string;
  flag: string;
  adjustmentPct: number;
  band: "A" | "B" | "C";
  bandLabel: string;
}

interface CustomerRow {
  id?: string | number;
  name?: string;
  customer_name?: string;
  company?: string;
  company_name?: string;
  type?: string;
  customer_type?: string;
  status?: string;
  email?: string;
  phone?: string;
}

/* ─────────── Helpers ─────────── */

function parseReferenceData(): MarketEntry[] {
  return REFERENCE_COUNTRIES.map((entry) => {
    const [nameWithFlag, adjStr] = entry.split("|");
    const adjustmentPct = parseFloat(adjStr);

    // Extract flag emoji (last sequence of emoji characters) from the name
    const flagMatch = nameWithFlag.match(
      /[\u{1F1E0}-\u{1F1FF}]{2}|[\u{1F3F4}][\u{E0060}-\u{E007F}]+/u
    );
    const flag = flagMatch ? flagMatch[0] : "";
    const name = nameWithFlag.replace(flag, "").trim();

    let band: "A" | "B" | "C";
    let bandLabel: string;

    if (adjustmentPct < 0) {
      band = "A";
      bandLabel = "Emerging";
    } else if (adjustmentPct === 0) {
      band = "B";
      bandLabel = "Standard";
    } else {
      band = "C";
      bandLabel = "Premium";
    }

    return { name, flag, adjustmentPct, band, bandLabel };
  });
}

function getBandColor(band: "A" | "B" | "C") {
  switch (band) {
    case "A":
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/20",
        dot: "bg-blue-400",
      };
    case "B":
      return {
        bg: "bg-gray-500/10",
        text: "text-gray-400",
        border: "border-gray-500/20",
        dot: "bg-gray-400",
      };
    case "C":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/20",
        dot: "bg-amber-400",
      };
  }
}

function getAdjustmentDisplay(pct: number): string {
  if (pct < 0) return `${(pct * 100).toFixed(0)}%`;
  if (pct === 0) return "0%";
  return `+${(pct * 100).toFixed(0)}%`;
}

/* ─────────── Component ─────────── */

export default function Markets() {
  const [markets] = useState<MarketEntry[]>(() => parseReferenceData());
  const [search, setSearch] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<MarketEntry | null>(
    null
  );
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [bandFilter, setBandFilter] = useState<"all" | "A" | "B" | "C">(
    "all"
  );

  /* ── Derived counts ── */
  const bandACounts = useMemo(
    () => markets.filter((m) => m.band === "A").length,
    [markets]
  );
  const bandBCounts = useMemo(
    () => markets.filter((m) => m.band === "B").length,
    [markets]
  );
  const bandCCounts = useMemo(
    () => markets.filter((m) => m.band === "C").length,
    [markets]
  );

  /* ── Filtered markets ── */
  const filteredMarkets = useMemo(() => {
    let result = markets;
    if (bandFilter !== "all") {
      result = result.filter((m) => m.band === bandFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.bandLabel.toLowerCase().includes(q) ||
          m.band.toLowerCase().includes(q)
      );
    }
    return result;
  }, [markets, search, bandFilter]);

  /* ── Fetch customers for a market ── */
  const fetchCustomers = useCallback(async (market: MarketEntry) => {
    setLoadingCustomers(true);
    setCustomers([]);
    try {
      const { data, error } = await supabaseAdmin
        .from("customers")
        .select("*")
        .or(
          `market_id.eq.${market.name.toLowerCase().replace(/\s+/g, "-")},country.ilike.%${market.name}%`
        )
        .limit(100);

      if (!error && data && data.length > 0) {
        setCustomers(data as CustomerRow[]);
      } else {
        setCustomers([]);
      }
    } catch {
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  /* ── Handle market selection ── */
  const openMarketProfile = useCallback(
    (market: MarketEntry) => {
      setSelectedMarket(market);
      fetchCustomers(market);
    },
    [fetchCustomers]
  );

  const closeMarketProfile = useCallback(() => {
    setSelectedMarket(null);
    setCustomers([]);
  }, []);

  /* ── Keyboard shortcut for search ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("markets-search")?.focus();
      }
      if (e.key === "Escape") {
        if (selectedMarket) {
          closeMarketProfile();
        } else {
          setSearch("");
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedMarket, closeMarketProfile]);

  /* ─────────── Market Profile View ─────────── */
  if (selectedMarket) {
    const bandColor = getBandColor(selectedMarket.band);
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--border-color)]">
          <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 flex items-center gap-4">
            <button
              onClick={closeMarketProfile}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedMarket.flag}</span>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                  {selectedMarket.name}
                </h1>
                <p className="text-sm text-[var(--text-subtle)]">Market Profile</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
          {/* Market Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Band Card */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-[var(--text-subtle)]">
                <Shield size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">
                  Band Classification
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${bandColor.bg} ${bandColor.text} ${bandColor.border}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${bandColor.dot}`}
                  />
                  Band {selectedMarket.band}
                </span>
                <span className="text-[var(--text-muted)] text-sm">
                  {selectedMarket.bandLabel}
                </span>
              </div>
            </div>

            {/* Adjustment Card */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-[var(--text-subtle)]">
                <TrendingUp size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">
                  Price Adjustment
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    selectedMarket.adjustmentPct < 0
                      ? "text-blue-400"
                      : selectedMarket.adjustmentPct > 0
                        ? "text-amber-400"
                        : "text-gray-400"
                  }`}
                >
                  {getAdjustmentDisplay(selectedMarket.adjustmentPct)}
                </span>
                <span className="text-[var(--text-faint)] text-sm">
                  {selectedMarket.adjustmentPct < 0
                    ? "discount"
                    : selectedMarket.adjustmentPct > 0
                      ? "premium"
                      : "base rate"}
                </span>
              </div>
            </div>

            {/* Market Status Card */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-[var(--text-subtle)]">
                <MapPin size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">
                  Market Status
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[var(--text-highlight)] text-sm font-medium">
                  Active Market
                </span>
              </div>
              <p className="text-[var(--text-faint)] text-xs">
                Included in pricing engine calculations
              </p>
            </div>
          </div>

          {/* Customers Section */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--bg-surface)]">
                  <Users size={18} className="text-[var(--text-muted)]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">
                    Customers in {selectedMarket.name}
                  </h2>
                  <p className="text-xs text-[var(--text-faint)] mt-0.5">
                    Accounts associated with this market
                  </p>
                </div>
              </div>
              <span className="text-xs text-[var(--text-dim)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-full">
                {customers.length} found
              </span>
            </div>

            {loadingCustomers ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[var(--border-focus)] border-t-white/60 rounded-full animate-spin" />
                  <span className="text-sm text-[var(--text-faint)]">
                    Loading customers...
                  </span>
                </div>
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--bg-surface)]">
                  <Users size={24} className="text-[var(--text-ghost)]" />
                </div>
                <p className="text-[var(--text-faint)] text-sm font-medium">
                  No customers in this market yet
                </p>
                <p className="text-[var(--text-dim)] text-xs">
                  Customers will appear here when added to this market
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                        Customer Name
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                        Company
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                        Email
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                        Phone
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, idx) => (
                      <tr
                        key={c.id ?? idx}
                        className="border-b border-[#1a1a1a] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                      >
                        <td className="px-6 py-4 text-[var(--text-highlight)] font-medium">
                          {c.name || c.customer_name || "-"}
                        </td>
                        <td className="px-6 py-4 text-[var(--text-muted)]">
                          {c.company || c.company_name || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[var(--text-subtle)] text-xs bg-[var(--bg-surface)] px-2 py-1 rounded">
                            {c.type || c.customer_type || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {c.status ? (
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${
                                c.status.toLowerCase() === "active"
                                  ? "bg-green-500/10 text-green-400"
                                  : c.status.toLowerCase() === "inactive"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-gray-500/10 text-gray-400"
                              }`}
                            >
                              {c.status}
                            </span>
                          ) : (
                            <span className="text-[var(--text-dim)]">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {c.email ? (
                            <span className="flex items-center gap-1.5 text-[var(--text-subtle)]">
                              <Mail size={12} />
                              {c.email}
                            </span>
                          ) : (
                            <span className="text-[var(--text-dim)]">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {c.phone ? (
                            <span className="flex items-center gap-1.5 text-[var(--text-subtle)]">
                              <Phone size={12} />
                              {c.phone}
                            </span>
                          ) : (
                            <span className="text-[var(--text-dim)]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─────────── Directory View ─────────── */
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ── Page header ── */}
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <MarketsIcon size={16} />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
              Markets
            </h1>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-4 ml-0 md:ml-11">
          Global market directory and pricing bands · {filteredMarkets.length} of {markets.length} markets
        </p>
      </div>

      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Markets */}
          <button
            onClick={() => setBandFilter("all")}
            className={`bg-[var(--bg-secondary)] border rounded-xl p-5 text-left transition-all hover:border-[var(--border-focus)] ${
              bandFilter === "all"
                ? "border-white/30 ring-1 ring-white/10"
                : "border-[var(--border-color)]"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-surface)]">
                <MarketsIcon size={16} className="text-[var(--text-subtle)]" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
                Total Markets
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
              {markets.length}
            </p>
            <p className="text-xs text-[var(--text-dim)] mt-1">All countries</p>
          </button>

          {/* Band A */}
          <button
            onClick={() =>
              setBandFilter(bandFilter === "A" ? "all" : "A")
            }
            className={`bg-[var(--bg-secondary)] border rounded-xl p-5 text-left transition-all hover:border-blue-500/30 ${
              bandFilter === "A"
                ? "border-blue-500/40 ring-1 ring-blue-500/10"
                : "border-[var(--border-color)]"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                <BarChart3 size={16} className="text-blue-400" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">
                Band A
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-blue-400">
              {bandACounts}
            </p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Emerging (-3%)</p>
          </button>

          {/* Band B */}
          <button
            onClick={() =>
              setBandFilter(bandFilter === "B" ? "all" : "B")
            }
            className={`bg-[var(--bg-secondary)] border rounded-xl p-5 text-left transition-all hover:border-gray-500/30 ${
              bandFilter === "B"
                ? "border-gray-500/40 ring-1 ring-gray-500/10"
                : "border-[var(--border-color)]"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-500/10">
                <Building2 size={16} className="text-gray-400" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400/60">
                Band B
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-400">
              {bandBCounts}
            </p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Standard (0%)</p>
          </button>

          {/* Band C */}
          <button
            onClick={() =>
              setBandFilter(bandFilter === "C" ? "all" : "C")
            }
            className={`bg-[var(--bg-secondary)] border rounded-xl p-5 text-left transition-all hover:border-amber-500/30 ${
              bandFilter === "C"
                ? "border-amber-500/40 ring-1 ring-amber-500/10"
                : "border-[var(--border-color)]"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
                <Star size={16} className="text-amber-400" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/60">
                Band C
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-amber-400">
              {bandCCounts}
            </p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Premium (+8%)</p>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 gap-3 focus-within:border-[var(--border-focus)] focus-within:ring-1 focus-within:ring-white/5 transition-all">
            <Search size={18} className="text-[var(--text-dim)] flex-shrink-0" />
            <input
              id="markets-search"
              type="text"
              placeholder="Search markets by name, band, or classification..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none h-12"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors px-2 py-1 rounded bg-[var(--bg-surface)]"
              >
                Clear
              </button>
            )}
            <kbd className="hidden md:inline-block text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-ghost)] border border-[var(--border-color)]">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Markets Table */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
              Markets Directory
            </h2>
            {bandFilter !== "all" && (
              <button
                onClick={() => setBandFilter("all")}
                className="text-xs text-[var(--text-faint)] hover:text-[var(--text-primary)]/70 transition-colors bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg border border-[var(--border-color)]"
              >
                Clear filter
              </button>
            )}
          </div>

          {filteredMarkets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--bg-surface)]">
                <Search size={24} className="text-[var(--text-ghost)]" />
              </div>
              <p className="text-[var(--text-faint)] text-sm font-medium">
                No markets found
              </p>
              <p className="text-[var(--text-dim)] text-xs">
                Try adjusting your search or filter
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                      Market Name
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                      Band
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider hidden md:table-cell">
                      Adjustment
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider hidden lg:table-cell">
                      Classification
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[var(--text-faint)] uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarkets.map((market, idx) => {
                    const bandColor = getBandColor(market.band);
                    return (
                      <tr
                        key={idx}
                        className="border-b border-[#1a1a1a] last:border-b-0 hover:bg-[var(--bg-surface-subtle)] transition-colors group cursor-pointer"
                        onClick={() => openMarketProfile(market)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl leading-none">
                              {market.flag}
                            </span>
                            <span className="text-[var(--text-primary)]/90 font-medium group-hover:text-[var(--text-primary)] transition-colors">
                              {market.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${bandColor.bg} ${bandColor.text} ${bandColor.border}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${bandColor.dot}`}
                            />
                            Band {market.band}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span
                            className={`text-sm font-mono ${
                              market.adjustmentPct < 0
                                ? "text-blue-400"
                                : market.adjustmentPct > 0
                                  ? "text-amber-400"
                                  : "text-[var(--text-faint)]"
                            }`}
                          >
                            {getAdjustmentDisplay(market.adjustmentPct)}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <span className="text-[var(--text-subtle)] text-xs">
                            {market.bandLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openMarketProfile(market);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-focus)] transition-all"
                          >
                            <Eye size={13} />
                            <span className="hidden sm:inline">
                              View Profile
                            </span>
                            <ChevronRight
                              size={13}
                              className="sm:hidden"
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
