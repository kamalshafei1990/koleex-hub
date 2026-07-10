/* ---------------------------------------------------------------------------
   Seaport reference data for shipping documents (packing list, etc.).

   · CHINA_PORTS      — the major Chinese sea/container ports (Port of Loading,
                        since Koleex ships FROM China).
   · PORTS_BY_COUNTRY — destination ports grouped by country (Port of Discharge:
                        pick a country, then a port in that country).

   Curated, not exhaustive — covers the world's major container ports plus a
   thorough set for Koleex's core markets (Egypt / MENA / Europe / Asia). The
   pickers still allow free text, so an unlisted port can always be typed.
   --------------------------------------------------------------------------- */

export const CHINA_PORTS: string[] = [
  "Shanghai", "Ningbo-Zhoushan", "Shenzhen", "Guangzhou (Nansha)", "Qingdao",
  "Tianjin", "Xiamen", "Dalian", "Lianyungang", "Yingkou", "Rizhao", "Yantai",
  "Fuzhou", "Quanzhou", "Zhuhai", "Dongguan", "Zhanjiang", "Shantou", "Nantong",
  "Zhongshan", "Weihai", "Jiangyin", "Taicang", "Yangzhou", "Zhenjiang",
  "Wenzhou", "Beihai", "Fangchenggang", "Qinhuangdao", "Haikou", "Yangpu",
  "Jinzhou", "Dandong", "Huanghua", "Jiaxing", "Taizhou", "Wuhu", "Nanjing",
  "Zhangjiagang", "Changshu", "Foshan", "Jingtang", "Hong Kong",
];

export const PORTS_BY_COUNTRY: Record<string, string[]> = {
  Egypt: ["Alexandria", "Port Said", "Damietta", "Ain Sokhna", "Suez", "El Dekheila", "Adabiya", "Safaga"],
  "United States": ["Los Angeles", "Long Beach", "New York/New Jersey", "Savannah", "Houston", "Seattle", "Oakland", "Norfolk", "Charleston", "Miami"],
  "United Kingdom": ["Felixstowe", "Southampton", "London Gateway", "Liverpool", "Immingham"],
  Germany: ["Hamburg", "Bremerhaven", "Wilhelmshaven"],
  Netherlands: ["Rotterdam", "Amsterdam"],
  France: ["Le Havre", "Marseille-Fos", "Dunkirk"],
  Italy: ["Genoa", "Gioia Tauro", "La Spezia", "Naples", "Livorno", "Trieste"],
  Spain: ["Valencia", "Algeciras", "Barcelona", "Bilbao"],
  Belgium: ["Antwerp", "Zeebrugge"],
  Greece: ["Piraeus", "Thessaloniki"],
  Turkey: ["Istanbul (Ambarli)", "Mersin", "Izmir", "Gemlik", "Iskenderun"],
  "Saudi Arabia": ["Jeddah", "Dammam", "Jubail", "King Abdullah Port"],
  "United Arab Emirates": ["Jebel Ali (Dubai)", "Khalifa (Abu Dhabi)", "Sharjah"],
  Qatar: ["Hamad Port (Doha)"],
  Kuwait: ["Shuwaikh", "Shuaiba"],
  Oman: ["Sohar", "Salalah", "Muscat"],
  Jordan: ["Aqaba"],
  Iraq: ["Umm Qasr", "Basra"],
  Lebanon: ["Beirut", "Tripoli"],
  India: ["Nhava Sheva (JNPT)", "Mundra", "Chennai", "Kolkata", "Cochin", "Visakhapatnam"],
  Pakistan: ["Karachi", "Port Qasim", "Gwadar"],
  Bangladesh: ["Chittagong (Chattogram)", "Mongla"],
  Vietnam: ["Ho Chi Minh (Cat Lai)", "Hai Phong", "Cai Mep", "Da Nang"],
  Thailand: ["Laem Chabang", "Bangkok"],
  Indonesia: ["Tanjung Priok (Jakarta)", "Tanjung Perak (Surabaya)"],
  Malaysia: ["Port Klang", "Tanjung Pelepas", "Penang"],
  Singapore: ["Singapore"],
  Philippines: ["Manila"],
  "South Korea": ["Busan", "Incheon", "Gwangyang"],
  Japan: ["Tokyo", "Yokohama", "Kobe", "Nagoya", "Osaka"],
  Morocco: ["Casablanca", "Tanger Med"],
  Algeria: ["Algiers", "Oran"],
  Tunisia: ["Rades", "Sfax"],
  Libya: ["Tripoli", "Benghazi", "Misrata"],
  Sudan: ["Port Sudan"],
  "South Africa": ["Durban", "Cape Town", "Port Elizabeth"],
  Kenya: ["Mombasa"],
  Nigeria: ["Lagos (Apapa)", "Lagos (Tin Can)", "Onne"],
  Russia: ["Novorossiysk", "St Petersburg", "Vladivostok"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Fremantle"],
  Brazil: ["Santos", "Paranagua"],
  Mexico: ["Manzanillo", "Veracruz", "Lazaro Cardenas"],
};

export const PORT_COUNTRIES: string[] = Object.keys(PORTS_BY_COUNTRY).sort();
