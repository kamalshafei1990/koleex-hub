/* ---------------------------------------------------------------------------
   Localized display names for the Country / Province / City pickers.

   Storage stays English (so data is consistent and portable) — these helpers
   only change what the operator SEES based on the active app language.

   • Countries → Intl.DisplayNames (built in, covers every locale incl. zh).
   • China provinces → curated ISO-3166-2 code → 中文 map (34 entries).
   • China cities → curated English→中文 map for the common ones; anything not
     listed falls back to its English name.
   --------------------------------------------------------------------------- */

const regionCache = new Map<string, Intl.DisplayNames | null>();
function regionNames(lang: string): Intl.DisplayNames | null {
  if (regionCache.has(lang)) return regionCache.get(lang)!;
  let dn: Intl.DisplayNames | null = null;
  try { dn = new Intl.DisplayNames([lang], { type: "region" }); } catch { dn = null; }
  regionCache.set(lang, dn);
  return dn;
}

/** Country name in the given language, falling back to the English name. */
export function countryNameLocalized(isoCode: string | null | undefined, lang: string, fallback: string): string {
  if (!isoCode || lang === "en") return fallback;
  const dn = regionNames(lang);
  if (!dn) return fallback;
  try { return dn.of(isoCode.toUpperCase()) || fallback; } catch { return fallback; }
}

/* China provinces / regions — ISO 3166-2:CN subdivision code → 中文. */
const CN_PROVINCES: Record<string, string> = {
  AH: "安徽", BJ: "北京", CQ: "重庆", FJ: "福建", GS: "甘肃", GD: "广东",
  GX: "广西", GZ: "贵州", HI: "海南", HE: "河北", HL: "黑龙江", HA: "河南",
  HK: "香港", HB: "湖北", HN: "湖南", NM: "内蒙古", JS: "江苏", JX: "江西",
  JL: "吉林", LN: "辽宁", MO: "澳门", NX: "宁夏", QH: "青海", SN: "陕西",
  SD: "山东", SH: "上海", SX: "山西", SC: "四川", TW: "台湾", TJ: "天津",
  XJ: "新疆", XZ: "西藏", YN: "云南", ZJ: "浙江",
};

export function provinceNameLocalized(countryCode: string, stateCode: string | null | undefined, lang: string, fallback: string): string {
  if (lang !== "zh" || countryCode !== "CN" || !stateCode) return fallback;
  return CN_PROVINCES[stateCode.toUpperCase()] || fallback;
}

/* Common Chinese cities — keyed by the English name the geo library returns. */
const CN_CITIES: Record<string, string> = {
  // Zhejiang
  Hangzhou: "杭州", Ningbo: "宁波", Wenzhou: "温州", Taizhou: "台州", Shaoxing: "绍兴",
  Jiaxing: "嘉兴", Huzhou: "湖州", Jinhua: "金华", Quzhou: "衢州", Zhoushan: "舟山",
  Lishui: "丽水", Yiwu: "义乌", Wenling: "温岭", Yueqing: "乐清", Cixi: "慈溪", Yuyao: "余姚",
  // National majors
  Shanghai: "上海", Beijing: "北京", Guangzhou: "广州", Shenzhen: "深圳", Dongguan: "东莞",
  Foshan: "佛山", Suzhou: "苏州", Nanjing: "南京", Wuxi: "无锡", Changzhou: "常州",
  Chengdu: "成都", Chongqing: "重庆", Wuhan: "武汉", Tianjin: "天津", Qingdao: "青岛",
  Xiamen: "厦门", Dalian: "大连", Shenyang: "沈阳", Zhengzhou: "郑州", Changsha: "长沙",
  Jinan: "济南", Hefei: "合肥", Fuzhou: "福州", Nanchang: "南昌", Nanning: "南宁",
  Kunming: "昆明", Guiyang: "贵阳", "Xi'an": "西安", Xian: "西安", Lanzhou: "兰州",
  Taiyuan: "太原", Shijiazhuang: "石家庄", Harbin: "哈尔滨", Changchun: "长春",
  Hohhot: "呼和浩特", Urumqi: "乌鲁木齐", Lhasa: "拉萨", Yinchuan: "银川", Xining: "西宁",
  Haikou: "海口", Sanya: "三亚", Zhuhai: "珠海", Zhongshan: "中山", Huizhou: "惠州",
  Jiangmen: "江门", Yantai: "烟台", Weifang: "潍坊", Tangshan: "唐山", Baoding: "保定",
  Langfang: "廊坊", Wuhu: "芜湖", Xuzhou: "徐州", Nantong: "南通", Yangzhou: "扬州",
};

export function cityNameLocalized(countryCode: string, cityName: string | null | undefined, lang: string): string {
  const en = cityName || "";
  if (lang !== "zh" || countryCode !== "CN" || !en) return en;
  return CN_CITIES[en] || en;
}
