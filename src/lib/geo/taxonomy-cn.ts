/* Chinese display names for KOLEEX divisions & product categories.
   Storage stays the English name; this only localizes what the operator sees
   when the app language is Chinese. Unmapped names fall back to English. */

const DIVISION_CN: Record<string, string> = {
  "Garment Machinery": "制衣机械",
  "Digital Devices": "数码设备",
  "Smart Living": "智能生活",
  "Lifestyle": "生活方式",
  "Mobility": "出行",
  "Industrial Solutions": "工业解决方案",
  "Fabrics": "面料",
  "Energy": "能源",
  "Medical": "医疗",
};

const CATEGORY_CN: Record<string, string> = {
  "Fabric Preparation": "面料准备",
  "Cutting Equipment": "裁剪设备",
  "Industrial Sewing Machines": "工业缝纫机",
  "Automatic Sewing Systems": "自动缝制系统",
  "Leather & Footwear Machinery": "皮革鞋类机械",
  "Embroidery Equipment": "刺绣设备",
  "Printing & Heat Press Equipment": "印花与热压设备",
  "Finishing Equipment": "整理设备",
  "Packing & Inspection": "包装与检验",
  "Domestic Sewing Machines": "家用缝纫机",
  "Spare Parts & Accessories": "零配件与附件",
  "Commercial identity": "商业标识",
  "Technical identity": "技术标识",
  "ERP intelligence": "ERP 智能",
  "AI understanding": "AI 理解",
  "Spare-parts matching": "零配件匹配",
  "Technical compatibility": "技术兼容性",
};

export function divisionNameLocalized(name: string, lang: string): string {
  if (lang !== "zh" || !name) return name;
  return DIVISION_CN[name] || name;
}

export function categoryNameLocalized(label: string, lang: string): string {
  if (lang !== "zh" || !label) return label;
  return CATEGORY_CN[label] || label;
}
