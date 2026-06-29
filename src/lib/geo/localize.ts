/* ---------------------------------------------------------------------------
   Localized display names for the Country / Province / City pickers.

   Storage stays English (so data is consistent and portable) — these helpers
   only change what the operator SEES based on the active app language.

   • Countries → Intl.DisplayNames (built in, covers every locale incl. zh).
   • China provinces → curated ISO-3166-2 code → 中文 map (34 entries).
   • China cities → a curated, CLEAN prefecture-level list per province with
     EN + 中文. For China we use this list instead of the geo library's (which
     is English-only and noisy — duplicates like "Anqing"/"Anqing Shi"). Names
     not found fall back to their English text.
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

/* China prefecture-level cities by ISO 3166-2:CN province code: [English, 中文]. */
const CN_CITY_LIST: Record<string, [string, string][]> = {
  AH: [["Hefei","合肥"],["Wuhu","芜湖"],["Bengbu","蚌埠"],["Huainan","淮南"],["Ma'anshan","马鞍山"],["Huaibei","淮北"],["Tongling","铜陵"],["Anqing","安庆"],["Huangshan","黄山"],["Chuzhou","滁州"],["Fuyang","阜阳"],["Suzhou","宿州"],["Lu'an","六安"],["Bozhou","亳州"],["Chizhou","池州"],["Xuancheng","宣城"]],
  BJ: [["Beijing","北京"]],
  CQ: [["Chongqing","重庆"]],
  FJ: [["Fuzhou","福州"],["Xiamen","厦门"],["Putian","莆田"],["Sanming","三明"],["Quanzhou","泉州"],["Zhangzhou","漳州"],["Nanping","南平"],["Longyan","龙岩"],["Ningde","宁德"]],
  GS: [["Lanzhou","兰州"],["Jiayuguan","嘉峪关"],["Jinchang","金昌"],["Baiyin","白银"],["Tianshui","天水"],["Wuwei","武威"],["Zhangye","张掖"],["Pingliang","平凉"],["Jiuquan","酒泉"],["Qingyang","庆阳"],["Dingxi","定西"],["Longnan","陇南"]],
  GD: [["Guangzhou","广州"],["Shaoguan","韶关"],["Shenzhen","深圳"],["Zhuhai","珠海"],["Shantou","汕头"],["Foshan","佛山"],["Jiangmen","江门"],["Zhanjiang","湛江"],["Maoming","茂名"],["Zhaoqing","肇庆"],["Huizhou","惠州"],["Meizhou","梅州"],["Shanwei","汕尾"],["Heyuan","河源"],["Yangjiang","阳江"],["Qingyuan","清远"],["Dongguan","东莞"],["Zhongshan","中山"],["Chaozhou","潮州"],["Jieyang","揭阳"],["Yunfu","云浮"]],
  GX: [["Nanning","南宁"],["Liuzhou","柳州"],["Guilin","桂林"],["Wuzhou","梧州"],["Beihai","北海"],["Fangchenggang","防城港"],["Qinzhou","钦州"],["Guigang","贵港"],["Yulin","玉林"],["Baise","百色"],["Hezhou","贺州"],["Hechi","河池"],["Laibin","来宾"],["Chongzuo","崇左"]],
  GZ: [["Guiyang","贵阳"],["Liupanshui","六盘水"],["Zunyi","遵义"],["Anshun","安顺"],["Bijie","毕节"],["Tongren","铜仁"]],
  HI: [["Haikou","海口"],["Sanya","三亚"],["Sansha","三沙"],["Danzhou","儋州"]],
  HE: [["Shijiazhuang","石家庄"],["Tangshan","唐山"],["Qinhuangdao","秦皇岛"],["Handan","邯郸"],["Xingtai","邢台"],["Baoding","保定"],["Zhangjiakou","张家口"],["Chengde","承德"],["Cangzhou","沧州"],["Langfang","廊坊"],["Hengshui","衡水"]],
  HL: [["Harbin","哈尔滨"],["Qiqihar","齐齐哈尔"],["Jixi","鸡西"],["Hegang","鹤岗"],["Shuangyashan","双鸭山"],["Daqing","大庆"],["Yichun","伊春"],["Jiamusi","佳木斯"],["Qitaihe","七台河"],["Mudanjiang","牡丹江"],["Heihe","黑河"],["Suihua","绥化"]],
  HA: [["Zhengzhou","郑州"],["Kaifeng","开封"],["Luoyang","洛阳"],["Pingdingshan","平顶山"],["Anyang","安阳"],["Hebi","鹤壁"],["Xinxiang","新乡"],["Jiaozuo","焦作"],["Puyang","濮阳"],["Xuchang","许昌"],["Luohe","漯河"],["Sanmenxia","三门峡"],["Nanyang","南阳"],["Shangqiu","商丘"],["Xinyang","信阳"],["Zhoukou","周口"],["Zhumadian","驻马店"]],
  HB: [["Wuhan","武汉"],["Huangshi","黄石"],["Shiyan","十堰"],["Yichang","宜昌"],["Xiangyang","襄阳"],["Ezhou","鄂州"],["Jingmen","荆门"],["Xiaogan","孝感"],["Jingzhou","荆州"],["Huanggang","黄冈"],["Xianning","咸宁"],["Suizhou","随州"]],
  HN: [["Changsha","长沙"],["Zhuzhou","株洲"],["Xiangtan","湘潭"],["Hengyang","衡阳"],["Shaoyang","邵阳"],["Yueyang","岳阳"],["Changde","常德"],["Zhangjiajie","张家界"],["Yiyang","益阳"],["Chenzhou","郴州"],["Yongzhou","永州"],["Huaihua","怀化"],["Loudi","娄底"]],
  JS: [["Nanjing","南京"],["Wuxi","无锡"],["Xuzhou","徐州"],["Changzhou","常州"],["Suzhou","苏州"],["Nantong","南通"],["Lianyungang","连云港"],["Huai'an","淮安"],["Yancheng","盐城"],["Yangzhou","扬州"],["Zhenjiang","镇江"],["Taizhou","泰州"],["Suqian","宿迁"]],
  JX: [["Nanchang","南昌"],["Jingdezhen","景德镇"],["Pingxiang","萍乡"],["Jiujiang","九江"],["Xinyu","新余"],["Yingtan","鹰潭"],["Ganzhou","赣州"],["Ji'an","吉安"],["Yichun","宜春"],["Fuzhou","抚州"],["Shangrao","上饶"]],
  JL: [["Changchun","长春"],["Jilin","吉林"],["Siping","四平"],["Liaoyuan","辽源"],["Tonghua","通化"],["Baishan","白山"],["Songyuan","松原"],["Baicheng","白城"]],
  LN: [["Shenyang","沈阳"],["Dalian","大连"],["Anshan","鞍山"],["Fushun","抚顺"],["Benxi","本溪"],["Dandong","丹东"],["Jinzhou","锦州"],["Yingkou","营口"],["Fuxin","阜新"],["Liaoyang","辽阳"],["Panjin","盘锦"],["Tieling","铁岭"],["Chaoyang","朝阳"],["Huludao","葫芦岛"]],
  NM: [["Hohhot","呼和浩特"],["Baotou","包头"],["Wuhai","乌海"],["Chifeng","赤峰"],["Tongliao","通辽"],["Ordos","鄂尔多斯"],["Hulunbuir","呼伦贝尔"],["Bayannur","巴彦淖尔"],["Ulanqab","乌兰察布"]],
  NX: [["Yinchuan","银川"],["Shizuishan","石嘴山"],["Wuzhong","吴忠"],["Guyuan","固原"],["Zhongwei","中卫"]],
  QH: [["Xining","西宁"],["Haidong","海东"]],
  SN: [["Xi'an","西安"],["Tongchuan","铜川"],["Baoji","宝鸡"],["Xianyang","咸阳"],["Weinan","渭南"],["Yan'an","延安"],["Hanzhong","汉中"],["Yulin","榆林"],["Ankang","安康"],["Shangluo","商洛"]],
  SD: [["Jinan","济南"],["Qingdao","青岛"],["Zibo","淄博"],["Zaozhuang","枣庄"],["Dongying","东营"],["Yantai","烟台"],["Weifang","潍坊"],["Jining","济宁"],["Tai'an","泰安"],["Weihai","威海"],["Rizhao","日照"],["Linyi","临沂"],["Dezhou","德州"],["Liaocheng","聊城"],["Binzhou","滨州"],["Heze","菏泽"]],
  SH: [["Shanghai","上海"]],
  SX: [["Taiyuan","太原"],["Datong","大同"],["Yangquan","阳泉"],["Changzhi","长治"],["Jincheng","晋城"],["Shuozhou","朔州"],["Jinzhong","晋中"],["Yuncheng","运城"],["Xinzhou","忻州"],["Linfen","临汾"],["Lüliang","吕梁"]],
  SC: [["Chengdu","成都"],["Zigong","自贡"],["Panzhihua","攀枝花"],["Luzhou","泸州"],["Deyang","德阳"],["Mianyang","绵阳"],["Guangyuan","广元"],["Suining","遂宁"],["Neijiang","内江"],["Leshan","乐山"],["Nanchong","南充"],["Meishan","眉山"],["Yibin","宜宾"],["Guang'an","广安"],["Dazhou","达州"],["Ya'an","雅安"],["Bazhong","巴中"],["Ziyang","资阳"]],
  TJ: [["Tianjin","天津"]],
  XJ: [["Urumqi","乌鲁木齐"],["Karamay","克拉玛依"],["Turpan","吐鲁番"],["Hami","哈密"]],
  XZ: [["Lhasa","拉萨"],["Shigatse","日喀则"],["Chamdo","昌都"],["Nyingchi","林芝"],["Shannan","山南"],["Nagqu","那曲"]],
  YN: [["Kunming","昆明"],["Qujing","曲靖"],["Yuxi","玉溪"],["Baoshan","保山"],["Zhaotong","昭通"],["Lijiang","丽江"],["Pu'er","普洱"],["Lincang","临沧"]],
  ZJ: [["Hangzhou","杭州"],["Ningbo","宁波"],["Wenzhou","温州"],["Jiaxing","嘉兴"],["Huzhou","湖州"],["Shaoxing","绍兴"],["Jinhua","金华"],["Quzhou","衢州"],["Zhoushan","舟山"],["Taizhou","台州"],["Lishui","丽水"]],
  TW: [["Taipei","台北"],["New Taipei","新北"],["Taichung","台中"],["Tainan","台南"],["Kaohsiung","高雄"],["Taoyuan","桃园"],["Hsinchu","新竹"],["Keelung","基隆"]],
  HK: [["Hong Kong","香港"],["Kowloon","九龙"],["New Territories","新界"]],
  MO: [["Macau","澳门"]],
};

/* Flat English→中文 map (covers already-saved English city values). */
const CN_CITY_ZH: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const code of Object.keys(CN_CITY_LIST)) for (const [en, zh] of CN_CITY_LIST[code]) m[en] = zh;
  return m;
})();

export interface GeoCity { en: string; zh: string }

/** Clean prefecture-level cities for a China province (empty if none/known). */
export function chinaCitiesForState(stateCode: string | null | undefined): GeoCity[] {
  if (!stateCode) return [];
  return (CN_CITY_LIST[stateCode.toUpperCase()] || []).map(([en, zh]) => ({ en, zh }));
}

export function cityNameLocalized(countryCode: string, cityName: string | null | undefined, lang: string): string {
  const en = cityName || "";
  if (lang !== "zh" || countryCode !== "CN" || !en) return en;
  return CN_CITY_ZH[en] || en;
}
