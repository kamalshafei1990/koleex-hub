import type { Translations } from "@/lib/i18n";

export const landedCostT: Translations = {

  /* ═══════════════════════════════════════════════════════════════════════════
     GLOBAL / SHARED
     ═══════════════════════════════════════════════════════════════════════════ */
  "save":               { en: "Save",                zh: "保存",                ar: "حفظ" },
  "saving":             { en: "Saving...",            zh: "保存中...",            ar: "جارٍ الحفظ..." },
  "finalize":           { en: "Finalize",             zh: "完成",                ar: "إنهاء" },
  "draft":              { en: "draft",                zh: "草稿",                ar: "مسودة" },
  "completed":          { en: "completed",            zh: "已完成",              ar: "مكتمل" },
  "subtitle":           { en: "Landed Cost Simulator — Calculate full warehouse cost", zh: "到岸成本模拟器 — 计算完整仓库成本", ar: "محاكي تكلفة الوصول — احسب التكلفة الكاملة للمستودع" },
  "simulationName":     { en: "Simulation name",      zh: "模拟名称",            ar: "اسم المحاكاة" },
  "printReport":        { en: "Print Report",         zh: "打印报告",            ar: "طباعة التقرير" },
  "required":           { en: "Required",             zh: "必填",                ar: "مطلوب" },
  "auto":               { en: "Auto",                 zh: "自动",                ar: "تلقائي" },
  "edited":             { en: "Edited",               zh: "已编辑",              ar: "تم التعديل" },
  "suggested":          { en: "Suggested",            zh: "建议",                ar: "مقترح" },

  /* ═══════════════════════════════════════════════════════════════════════════
     TAB NAVIGATION
     ═══════════════════════════════════════════════════════════════════════════ */
  "tab.customer":       { en: "Customer",             zh: "客户",                ar: "العميل" },
  "tab.product":        { en: "Product",              zh: "产品",                ar: "المنتج" },
  "tab.export":         { en: "Export",               zh: "出口",                ar: "التصدير" },
  "tab.shipping":       { en: "Shipping",             zh: "运输",                ar: "الشحن" },
  "tab.import":         { en: "Import",               zh: "进口",                ar: "الاستيراد" },
  "tab.delivery":       { en: "Delivery",             zh: "配送",                ar: "التوصيل" },
  "tab.financial":      { en: "Financial",            zh: "财务",                ar: "المالية" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SECTION: CUSTOMER & DESTINATION
     ═══════════════════════════════════════════════════════════════════════════ */
  "sec.customer":           { en: "Customer & Destination",       zh: "客户与目的地",                 ar: "العميل والوجهة" },
  "sec.customerDesc":       { en: "Who is this shipment for and where is it going?", zh: "这批货物是给谁的，要运到哪里？", ar: "لمن هذه الشحنة وإلى أين تذهب؟" },
  "customerName":           { en: "Customer Name",                zh: "客户名称",                     ar: "اسم العميل" },
  "customerCompany":        { en: "Customer Company",             zh: "客户公司",                     ar: "شركة العميل" },
  "customerCountry":        { en: "Customer Country",             zh: "客户国家",                     ar: "دولة العميل" },
  "customerCity":           { en: "Customer City",                zh: "客户城市",                     ar: "مدينة العميل" },
  "warehouseDest":          { en: "Warehouse Destination",        zh: "仓库目的地",                   ar: "وجهة المستودع" },
  "ph.contactName":         { en: "Contact name",                 zh: "联系人姓名",                   ar: "اسم جهة الاتصال" },
  "ph.companyName":         { en: "Company name",                 zh: "公司名称",                     ar: "اسم الشركة" },
  "ph.egypt":               { en: "e.g. Egypt",                   zh: "例如 中国",                    ar: "مثال: مصر" },
  "ph.cairo":               { en: "e.g. Cairo",                   zh: "例如 上海",                    ar: "مثال: القاهرة" },
  "ph.warehouseAddr":       { en: "Full warehouse address",       zh: "完整仓库地址",                  ar: "عنوان المستودع الكامل" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SECTION: PRODUCT & PRICING
     ═══════════════════════════════════════════════════════════════════════════ */
  "sec.product":            { en: "Product & Pricing",            zh: "产品与定价",                   ar: "المنتج والتسعير" },
  "sec.productDesc":        { en: "Select or enter product details, pricing terms, and physical specs", zh: "选择或输入产品详情、定价条款和物理规格", ar: "اختر أو أدخل تفاصيل المنتج وشروط التسعير والمواصفات" },
  "product":                { en: "Product",                      zh: "产品",                         ar: "المنتج" },
  "model":                  { en: "Model",                        zh: "型号",                         ar: "الموديل" },
  "selectProduct":          { en: "Select product...",            zh: "选择产品...",                   ar: "اختر المنتج..." },
  "selectModel":            { en: "Select model...",              zh: "选择型号...",                   ar: "اختر الموديل..." },
  "sku":                    { en: "SKU",                          zh: "SKU",                          ar: "رمز المنتج" },
  "hsCode":                 { en: "HS Code",                      zh: "HS编码",                       ar: "رمز النظام المنسق" },
  "hsCodeHint":             { en: "Harmonized System code for customs classification", zh: "海关分类的协调制度编码", ar: "رمز النظام المنسق للتصنيف الجمركي" },
  "brand":                  { en: "Brand",                        zh: "品牌",                         ar: "العلامة التجارية" },
  "countryOfOrigin":        { en: "Country of Origin",            zh: "原产国",                       ar: "بلد المنشأ" },
  "ph.countryOfOrigin":     { en: "e.g. China",                   zh: "例如 中国",                    ar: "مثال: الصين" },
  "warn.hsCode":            { en: "Needed for customs",           zh: "海关所需",                     ar: "مطلوب للجمارك" },

  /* ── Pricing & Terms ── */
  "sub.pricingTerms":       { en: "Pricing & Terms",              zh: "定价与条款",                   ar: "التسعير والشروط" },
  "quantity":               { en: "Quantity",                     zh: "数量",                         ar: "الكمية" },
  "unitPrice":              { en: "Unit Price",                   zh: "单价",                         ar: "سعر الوحدة" },
  "currency":               { en: "Currency",                     zh: "货币",                         ar: "العملة" },
  "priceBasis":             { en: "Price Basis",                  zh: "价格基准",                     ar: "أساس السعر" },
  "productTotal":           { en: "Product Total",                zh: "产品总额",                     ar: "إجمالي المنتج" },

  /* ── Physical Specs ── */
  "sub.physicalSpecs":      { en: "Physical Specifications",      zh: "物理规格",                     ar: "المواصفات الفيزيائية" },
  "packingType":            { en: "Packing Type",                 zh: "包装类型",                     ar: "نوع التغليف" },
  "ph.packingType":         { en: "e.g. Carton box",              zh: "例如 纸箱",                    ar: "مثال: صندوق كرتوني" },
  "numCartons":             { en: "Number of Cartons",            zh: "箱数",                         ar: "عدد الكراتين" },
  "loadingType":            { en: "Loading Type",                 zh: "装载类型",                     ar: "نوع التحميل" },
  "netWeightPerUnit":       { en: "Net Weight / Unit",            zh: "净重/单位",                    ar: "الوزن الصافي / الوحدة" },
  "grossWeightPerUnit":     { en: "Gross Weight / Unit",          zh: "毛重/单位",                    ar: "الوزن الإجمالي / الوحدة" },
  "grossWeightHint":        { en: "Weight including packaging per unit", zh: "含包装每单位重量", ar: "الوزن شامل التغليف لكل وحدة" },
  "totalGrossWeight":       { en: "Total Gross Weight",           zh: "总毛重",                       ar: "إجمالي الوزن الإجمالي" },
  "cbmPerUnit":             { en: "CBM / Unit",                   zh: "立方米/单位",                  ar: "متر مكعب / الوحدة" },
  "cbmHint":                { en: "Cubic meters per unit — L x W x H in meters", zh: "每单位立方米 — 长x宽x高（米）", ar: "متر مكعب لكل وحدة — الطول × العرض × الارتفاع بالأمتار" },
  "totalCbm":               { en: "Total CBM",                    zh: "总立方米",                     ar: "إجمالي المتر المكعب" },
  "warn.weight":            { en: "Needed for shipping",          zh: "运输所需",                     ar: "مطلوب للشحن" },
  "warn.cbm":               { en: "Needed for freight",           zh: "货运所需",                     ar: "مطلوب للشحن البحري" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SECTION: EXPORT SIDE COSTS
     ═══════════════════════════════════════════════════════════════════════════ */
  "sec.export":             { en: "Export Side Costs",            zh: "出口侧费用",                   ar: "تكاليف جانب التصدير" },
  "sec.exportDesc":         { en: "Costs at origin country — factory to port of loading", zh: "原产国费用 — 工厂到装货港", ar: "التكاليف في بلد المنشأ — من المصنع إلى ميناء الشحن" },
  "includedIn":             { en: "Included in",                  zh: "已包含在",                     ar: "مشمول في" },
  "exportIncludedMsg":      { en: "export costs are already included in the unit price and will not be added to the total. You can still record them for reference.", zh: "出口费用已包含在单价中，不会添加到总额。您仍可记录以供参考。", ar: "تكاليف التصدير مشمولة بالفعل في سعر الوحدة ولن تُضاف إلى الإجمالي. يمكنك تسجيلها للرجوع إليها." },

  "factoryToPort":          { en: "Factory to Port Transport",    zh: "工厂到港口运输",               ar: "نقل من المصنع إلى الميناء" },
  "localTrucking":          { en: "Local Trucking",               zh: "本地运输",                     ar: "النقل المحلي" },
  "exportCustomsFee":       { en: "Export Customs Fee",           zh: "出口海关费",                   ar: "رسوم التخليص الجمركي" },
  "sub.portTerminal":       { en: "Port & Terminal",              zh: "港口与码头",                   ar: "الميناء والمحطة" },
  "portCharges":            { en: "Port Charges",                 zh: "港口费",                       ar: "رسوم الميناء" },
  "terminalHandling":       { en: "Terminal Handling",            zh: "码头装卸",                     ar: "مناولة المحطة" },
  "loadingFee":             { en: "Loading Fee",                  zh: "装载费",                       ar: "رسوم التحميل" },
  "sub.docsCompliance":     { en: "Documentation & Compliance",   zh: "文件与合规",                   ar: "التوثيق والامتثال" },
  "documentationFee":       { en: "Documentation Fee",            zh: "文件费",                       ar: "رسوم التوثيق" },
  "inspectionFee":          { en: "Inspection Fee",               zh: "检验费",                       ar: "رسوم الفحص" },
  "fumigationFee":          { en: "Fumigation Fee",               zh: "熏蒸费",                       ar: "رسوم التبخير" },
  "certificateOfOriginFee": { en: "Certificate of Origin Fee",    zh: "原产地证书费",                  ar: "رسوم شهادة المنشأ" },
  "formCertificateFee":     { en: "Form / Certificate Fee",       zh: "表格/证书费",                  ar: "رسوم النماذج / الشهادات" },
  "sub.otherCosts":         { en: "Other Costs",                  zh: "其他费用",                     ar: "تكاليف أخرى" },
  "palletizationFee":       { en: "Palletization Fee",            zh: "托盘化费",                     ar: "رسوم التحميل على المنصات" },
  "extraPackingCost":       { en: "Extra Packing Cost",           zh: "额外包装费",                   ar: "تكلفة التغليف الإضافي" },
  "exportAgentFee":         { en: "Export Agent / Forwarder Fee", zh: "出口代理/货代费",              ar: "رسوم وكيل التصدير / وسيط الشحن" },
  "bankCharges":            { en: "Bank Charges",                 zh: "银行费用",                     ar: "رسوم بنكية" },
  "otherExportCharges":     { en: "Other Export Charges",         zh: "其他出口费用",                  ar: "رسوم تصدير أخرى" },
  "exportNotes":            { en: "Export Notes",                 zh: "出口备注",                     ar: "ملاحظات التصدير" },
  "exportTotal":            { en: "Export Total",                 zh: "出口总额",                     ar: "إجمالي التصدير" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SECTION: SHIPPING & FREIGHT
     ═══════════════════════════════════════════════════════════════════════════ */
  "sec.shipping":           { en: "Shipping & Freight",           zh: "运输与货运",                   ar: "الشحن والنقل البحري" },
  "sec.shippingDesc":       { en: "International freight, insurance, and surcharges", zh: "国际货运、保险和附加费", ar: "الشحن الدولي والتأمين والرسوم الإضافية" },
  "shippingMode":           { en: "Shipping Mode",                zh: "运输方式",                     ar: "طريقة الشحن" },
  "portOfLoading":          { en: "Port of Loading",              zh: "装货港",                       ar: "ميناء التحميل" },
  "portOfDestination":      { en: "Port of Destination",          zh: "目的港",                       ar: "ميناء الوصول" },
  "ph.shanghai":            { en: "e.g. Shanghai",                zh: "例如 上海",                    ar: "مثال: شنغهاي" },
  "ph.alexandria":          { en: "e.g. Alexandria",              zh: "例如 亚历山大",                 ar: "مثال: الإسكندرية" },

  "sub.freightInsurance":   { en: "Freight & Insurance",          zh: "货运与保险",                   ar: "الشحن والتأمين" },
  "freightCost":            { en: "Freight Cost",                 zh: "运费",                         ar: "تكلفة الشحن" },
  "insuranceCost":          { en: "Insurance Cost",               zh: "保险费",                       ar: "تكلفة التأمين" },
  "transitTime":            { en: "Transit Time",                 zh: "运输时间",                     ar: "مدة النقل" },
  "ph.transitTime":         { en: "e.g. 25 days",                 zh: "例如 25天",                    ar: "مثال: 25 يوم" },

  "sub.surcharges":         { en: "Surcharges",                   zh: "附加费",                       ar: "الرسوم الإضافية" },
  "baf":                    { en: "BAF (Bunker Adjustment)",      zh: "燃油附加费 (BAF)",             ar: "رسوم تعديل الوقود (BAF)" },
  "bafHint":                { en: "Fuel surcharge — fluctuates with oil prices", zh: "燃油附加费 — 随油价波动", ar: "رسوم الوقود — تتغير مع أسعار النفط" },
  "caf":                    { en: "CAF (Currency Adjustment)",    zh: "汇率附加费 (CAF)",             ar: "رسوم تعديل العملة (CAF)" },
  "gri":                    { en: "GRI (General Rate Increase)",  zh: "普通费率上调 (GRI)",           ar: "زيادة السعر العام (GRI)" },
  "peakSeasonSurcharge":    { en: "Peak Season Surcharge",        zh: "旺季附加费",                   ar: "رسوم موسم الذروة" },
  "amsEnsIsf":              { en: "AMS / ENS / ISF",              zh: "AMS / ENS / ISF",             ar: "AMS / ENS / ISF" },
  "amsHint":                { en: "Advance manifest filing fees", zh: "预报舱单申报费",               ar: "رسوم تقديم البيان المسبق" },
  "blAwbFee":               { en: "BL / AWB Fee",                 zh: "提单/空运单费",                ar: "رسوم بوليصة الشحن" },
  "blHint":                 { en: "Bill of Lading or Air Waybill fee", zh: "海运提单或空运单费", ar: "رسوم بوليصة الشحن البحري أو الجوي" },
  "telexReleaseFee":        { en: "Telex Release Fee",            zh: "电放费",                       ar: "رسوم الإفراج التلكسي" },

  "sub.weightCurrency":     { en: "Weight & Currency",            zh: "重量与货币",                   ar: "الوزن والعملة" },
  "chargeableWeight":       { en: "Chargeable Weight",            zh: "计费重量",                     ar: "الوزن المحاسب" },
  "chargeableWeightHint":   { en: "Higher of actual vs volumetric weight — auto-calculated", zh: "实际重量与体积重量取大值 — 自动计算", ar: "الأعلى بين الوزن الفعلي والحجمي — محسوب تلقائياً" },
  "actualWeight":           { en: "Actual Weight",                zh: "实际重量",                     ar: "الوزن الفعلي" },
  "volumetricWeight":       { en: "Volumetric Weight",            zh: "体积重量",                     ar: "الوزن الحجمي" },
  "volumetricWeightHint":   { en: "Auto-calculated from CBM — L x W x H (cm) / 5000 for air", zh: "根据CBM自动计算 — 长x宽x高(cm)/5000(空运)", ar: "محسوب تلقائياً من CBM — الطول × العرض × الارتفاع (سم) / 5000 للشحن الجوي" },
  "freightCurrency":        { en: "Freight Currency",             zh: "货运货币",                     ar: "عملة الشحن" },
  "freightExchangeRate":    { en: "Freight Exchange Rate",        zh: "货运汇率",                     ar: "سعر صرف الشحن" },
  "freightExRateHint":      { en: "Rate to convert freight currency to main currency", zh: "将货运货币转换为主货币的汇率", ar: "سعر تحويل عملة الشحن إلى العملة الرئيسية" },
  "shippingNotes":          { en: "Shipping Notes",               zh: "运输备注",                     ar: "ملاحظات الشحن" },
  "shippingTotal":          { en: "Shipping Total",               zh: "运输总额",                     ar: "إجمالي الشحن" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SECTION: IMPORT SIDE COSTS
     ═══════════════════════════════════════════════════════════════════════════ */
  "sec.import":             { en: "Import Side Costs",            zh: "进口侧费用",                   ar: "تكاليف جانب الاستيراد" },
  "sec.importDesc":         { en: "Duties, taxes, port fees, and customs charges at destination", zh: "目的地的关税、税费、港口费和海关费用", ar: "الرسوم الجمركية والضرائب ورسوم الميناء في الوجهة" },
  "customsDutyPct":         { en: "Customs Duty (%)",             zh: "关税 (%)",                     ar: "الرسوم الجمركية (%)" },
  "dutyHint":               { en: "Applied to duty base value — auto-suggested from destination country", zh: "适用于关税基准值 — 根据目的国自动建议", ar: "تُطبق على القيمة الأساسية — مقترحة تلقائياً من دولة الوجهة" },
  "importVatPct":           { en: "Import VAT (%)",               zh: "进口增值税 (%)",               ar: "ضريبة القيمة المضافة (%)" },
  "vatHint":                { en: "Applied to (duty base + duty amount) — auto-suggested from destination country", zh: "适用于（关税基准+关税额）— 根据目的国自动建议", ar: "تُطبق على (القيمة الأساسية + مبلغ الرسوم) — مقترحة تلقائياً من دولة الوجهة" },
  "additionalTaxPct":       { en: "Additional Tax (%)",           zh: "附加税 (%)",                   ar: "ضريبة إضافية (%)" },
  "calculationBasis":       { en: "Calculation Basis",            zh: "计算基准",                     ar: "أساس الحساب" },
  "calcBasisHint":          { en: "Which value to calculate duties and taxes on", zh: "以哪个值计算关税和税费", ar: "ما هي القيمة التي تُحسب عليها الرسوم والضرائب" },
  "basedOnFOB":             { en: "Based on FOB value",           zh: "基于FOB值",                    ar: "بناءً على قيمة FOB" },
  "basedOnCIF":             { en: "Based on CIF value",           zh: "基于CIF值",                    ar: "بناءً على قيمة CIF" },
  "customDeclaredValue":    { en: "Custom declared value",        zh: "自定义申报值",                  ar: "قيمة مصرح بها مخصصة" },
  "customValue":            { en: "Custom Value",                 zh: "自定义值",                     ar: "القيمة المخصصة" },
  "antiDumpingDuty":        { en: "Anti-Dumping Duty",            zh: "反倾销税",                     ar: "رسوم مكافحة الإغراق" },
  "antiDumpingHint":        { en: "Extra duty on unfairly priced imports", zh: "对不公平定价进口的额外关税", ar: "رسوم إضافية على الواردات بأسعار غير عادلة" },

  "sub.portTerminalFees":   { en: "Port & Terminal Fees",         zh: "港口与码头费",                  ar: "رسوم الميناء والمحطة" },
  "portSecurityFee":        { en: "Port Security Fee",            zh: "港口安保费",                   ar: "رسوم أمن الميناء" },
  "scanningFee":            { en: "Scanning Fee",                 zh: "扫描费",                       ar: "رسوم المسح" },

  "sub.customsCompliance":  { en: "Customs & Compliance",         zh: "海关与合规",                   ar: "الجمارك والامتثال" },
  "customsClearanceFee":    { en: "Customs Clearance Fee",        zh: "清关费",                       ar: "رسوم التخليص الجمركي" },
  "customsBrokerFee":       { en: "Customs Broker Fee",           zh: "报关代理费",                   ar: "رسوم وسيط الجمارك" },
  "certVerificationFee":    { en: "Certificate Verification Fee", zh: "证书核验费",                   ar: "رسوم التحقق من الشهادات" },
  "translationLegalization":{ en: "Translation / Legalization",   zh: "翻译/公证",                    ar: "الترجمة / التصديق" },
  "municipalityFee":        { en: "Municipality / Local Fee",     zh: "市政/地方费",                  ar: "رسوم البلدية / محلية" },

  "sub.storageDelays":      { en: "Storage & Delays",             zh: "仓储与延误",                   ar: "التخزين والتأخيرات" },
  "storageFee":             { en: "Storage Fee",                  zh: "仓储费",                       ar: "رسوم التخزين" },
  "demurrage":              { en: "Demurrage",                    zh: "滞箱费",                       ar: "رسوم التأخير" },
  "demurrageHint":          { en: "Container fee for exceeding free days at port", zh: "超过港口免费天数的集装箱费", ar: "رسوم الحاوية لتجاوز الأيام المجانية في الميناء" },
  "detention":              { en: "Detention",                    zh: "滞留费",                       ar: "رسوم الاحتجاز" },
  "detentionHint":          { en: "Fee for holding container outside the port", zh: "港外使用集装箱的费用", ar: "رسوم احتجاز الحاوية خارج الميناء" },
  "deliveryOrderFee":       { en: "Delivery Order Fee",           zh: "交货单费",                     ar: "رسوم أمر التسليم" },
  "otherImportCharges":     { en: "Other Import Charges",         zh: "其他进口费用",                  ar: "رسوم استيراد أخرى" },
  "importNotes":            { en: "Import Notes",                 zh: "进口备注",                     ar: "ملاحظات الاستيراد" },
  "importTotal":            { en: "Import Total",                 zh: "进口总额",                     ar: "إجمالي الاستيراد" },

  /* ── Duty Breakdown ── */
  "viewBreakdown":          { en: "View Duty & Tax Breakdown",    zh: "查看关税与税费明细",            ar: "عرض تفاصيل الرسوم والضرائب" },
  "hideBreakdown":          { en: "Hide Duty & Tax Breakdown",    zh: "隐藏关税与税费明细",            ar: "إخفاء تفاصيل الرسوم والضرائب" },
  "dutyBase":               { en: "Duty Base",                    zh: "关税基准",                     ar: "أساس الرسوم" },
  "customsDuty":            { en: "Customs Duty",                 zh: "关税",                         ar: "الرسوم الجمركية" },
  "vatBase":                { en: "VAT Base (Duty Base + Duty)",  zh: "增值税基准（关税基准+关税）",    ar: "أساس الضريبة (الأساس + الرسوم)" },
  "importVAT":              { en: "Import VAT",                   zh: "进口增值税",                   ar: "ضريبة القيمة المضافة" },
  "additionalTax":          { en: "Additional Tax",               zh: "附加税",                       ar: "ضريبة إضافية" },
  "fixedImportCharges":     { en: "Fixed Import Charges",         zh: "固定进口费用",                  ar: "رسوم استيراد ثابتة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SECTION: INLAND DELIVERY
     ═══════════════════════════════════════════════════════════════════════════ */
  "sec.inland":             { en: "Inland Delivery",              zh: "内陆配送",                     ar: "التوصيل الداخلي" },
  "sec.inlandDesc":         { en: "Port to final warehouse — local transport and handling", zh: "从港口到最终仓库 — 本地运输和装卸", ar: "من الميناء إلى المستودع النهائي — النقل والمناولة المحلية" },
  "finalDeliveryCity":      { en: "Final Delivery City",          zh: "最终交付城市",                  ar: "مدينة التسليم النهائي" },
  "finalWarehouseAddress":  { en: "Final Warehouse Address",      zh: "最终仓库地址",                  ar: "عنوان المستودع النهائي" },
  "distanceFromPort":       { en: "Distance from Port",           zh: "距港口距离",                   ar: "المسافة من الميناء" },
  "ph.distance":            { en: "e.g. 120 km",                  zh: "例如 120公里",                 ar: "مثال: 120 كم" },

  "sub.transportHandling":  { en: "Transport & Handling",         zh: "运输与装卸",                   ar: "النقل والمناولة" },
  "localTruckingToWarehouse":{ en: "Local Trucking to Warehouse", zh: "本地运输到仓库",               ar: "النقل المحلي إلى المستودع" },
  "unloadingFee":           { en: "Unloading Fee",                zh: "卸载费",                       ar: "رسوم التفريغ" },
  "craneForkliftFee":       { en: "Crane / Forklift Fee",         zh: "起重机/叉车费",                ar: "رسوم الرافعة / الرافعة الشوكية" },
  "warehouseReceiving":     { en: "Warehouse Receiving",          zh: "仓库接收",                     ar: "استلام المستودع" },
  "lastMileHandling":       { en: "Last-Mile Handling",           zh: "最后一公里处理",               ar: "مناولة الميل الأخير" },

  "remoteAreaSurcharge":    { en: "Remote Area Surcharge",        zh: "偏远地区附加费",               ar: "رسوم المناطق النائية" },
  "restrictedAreaSurcharge":{ en: "Restricted Area Surcharge",    zh: "限制区域附加费",               ar: "رسوم المناطق المقيدة" },
  "appointmentDeliveryFee": { en: "Appointment Delivery Fee",     zh: "预约交货费",                   ar: "رسوم التوصيل بموعد" },
  "nightDeliveryFee":       { en: "Night Delivery Fee",           zh: "夜间交货费",                   ar: "رسوم التوصيل الليلي" },
  "otherLocalDelivery":     { en: "Other Local Delivery",         zh: "其他本地配送",                  ar: "توصيل محلي آخر" },
  "inlandNotes":            { en: "Inland Notes",                 zh: "内陆备注",                     ar: "ملاحظات التوصيل" },
  "inlandTotal":            { en: "Inland Total",                 zh: "内陆总额",                     ar: "إجمالي التوصيل" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SECTION: FINANCIAL & COMMERCIAL
     ═══════════════════════════════════════════════════════════════════════════ */
  "sec.financial":          { en: "Financial & Commercial",       zh: "财务与商业",                   ar: "المالية والتجارية" },
  "sec.financialDesc":      { en: "Exchange rates, financing, margins, and adjustments", zh: "汇率、融资、利润和调整", ar: "أسعار الصرف والتمويل والهوامش والتعديلات" },
  "exchangeRate":           { en: "Exchange Rate (to local)",     zh: "汇率（转本地货币）",            ar: "سعر الصرف (إلى المحلي)" },
  "exchangeRateHint":       { en: "Multiply total by this rate to get local currency value", zh: "总额乘以此汇率得到本地货币值", ar: "اضرب الإجمالي في هذا السعر للحصول على القيمة بالعملة المحلية" },
  "paymentTerm":            { en: "Payment Term",                 zh: "付款条件",                     ar: "شروط الدفع" },
  "paymentTermHint":        { en: "TT = Wire Transfer, LC = Letter of Credit, DP = Documents against Payment, OA = Open Account", zh: "TT=电汇, LC=信用证, DP=付款交单, OA=赊账", ar: "TT = تحويل بنكي، LC = اعتماد مستندي، DP = مستندات مقابل الدفع، OA = حساب مفتوح" },

  "sub.bankingFinance":     { en: "Banking & Finance",            zh: "银行与融资",                   ar: "البنوك والتمويل" },
  "bankTransferCost":       { en: "Bank Transfer Cost",           zh: "银行转账费",                   ar: "تكلفة التحويل البنكي" },
  "financingCost":          { en: "Financing Cost",               zh: "融资成本",                     ar: "تكلفة التمويل" },
  "creditInsurance":        { en: "Credit Insurance",             zh: "信用保险",                     ar: "تأمين الائتمان" },
  "unexpectedReserve":      { en: "Unexpected Reserve",           zh: "意外准备金",                   ar: "احتياطي غير متوقع" },
  "unexpectedReserveHint":  { en: "Buffer for unforeseen costs",  zh: "用于不可预见费用的缓冲",       ar: "احتياطي للتكاليف غير المتوقعة" },

  "sub.commissionAdj":      { en: "Commission & Adjustments",     zh: "佣金与调整",                   ar: "العمولات والتعديلات" },
  "agentCommission":        { en: "Agent Commission",             zh: "代理佣金",                     ar: "عمولة الوكيل" },
  "salesCommission":        { en: "Sales Commission",             zh: "销售佣金",                     ar: "عمولة المبيعات" },
  "discountPct":            { en: "Discount (%)",                 zh: "折扣 (%)",                     ar: "الخصم (%)" },
  "marginPct":              { en: "Margin (%)",                   zh: "利润率 (%)",                   ar: "هامش الربح (%)" },
  "marginHint":             { en: "Target profit margin on product cost", zh: "产品成本的目标利润率", ar: "هامش الربح المستهدف على تكلفة المنتج" },
  "contingencyPct":         { en: "Contingency (%)",              zh: "应急 (%)",                     ar: "الطوارئ (%)" },
  "contingencyHint":        { en: "Percentage buffer applied to all costs", zh: "适用于所有成本的百分比缓冲", ar: "نسبة احتياطية تُطبق على جميع التكاليف" },
  "includeTaxInFinal":      { en: "Include tax in final price",   zh: "最终价格含税",                  ar: "تضمين الضريبة في السعر النهائي" },
  "includeCommissionInFinal":{ en: "Include commission in final price", zh: "最终价格含佣金",           ar: "تضمين العمولة في السعر النهائي" },
  "financialNotes":         { en: "Financial Notes",              zh: "财务备注",                     ar: "ملاحظات مالية" },
  "financialTotal":         { en: "Financial Total",              zh: "财务总额",                     ar: "إجمالي المالية" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SECTION: NOTES
     ═══════════════════════════════════════════════════════════════════════════ */
  "sec.notes":              { en: "Notes",                        zh: "备注",                         ar: "ملاحظات" },
  "sec.notesDesc":          { en: "Additional remarks or instructions for this simulation", zh: "此模拟的附加备注或说明", ar: "ملاحظات إضافية أو تعليمات لهذه المحاكاة" },
  "ph.notes":               { en: "General notes about this simulation...", zh: "关于此模拟的一般备注...", ar: "ملاحظات عامة حول هذه المحاكاة..." },
  "ph.additionalNotes":     { en: "Additional notes...",          zh: "附加备注...",                   ar: "ملاحظات إضافية..." },

  /* ═══════════════════════════════════════════════════════════════════════════
     SIDEBAR: SUMMARY
     ═══════════════════════════════════════════════════════════════════════════ */
  "finalWarehouseCost":     { en: "Final Warehouse Cost",         zh: "最终仓库成本",                  ar: "التكلفة النهائية للمستودع" },
  "localCurrency":          { en: "Local",                        zh: "本地",                         ar: "محلي" },
  "overProductCost":        { en: "over product cost",            zh: "超出产品成本",                  ar: "فوق تكلفة المنتج" },
  "missingFields":          { en: "Missing Field",                zh: "缺失字段",                     ar: "حقل مفقود" },
  "missingFieldsPlural":    { en: "Missing Fields",               zh: "缺失字段",                     ar: "حقول مفقودة" },

  "unitEconomics":          { en: "Unit Economics",               zh: "单位经济",                     ar: "اقتصاديات الوحدة" },
  "perUnit":                { en: "Per Unit",                     zh: "每单位",                       ar: "لكل وحدة" },
  "perCarton":              { en: "Per Carton",                   zh: "每箱",                         ar: "لكل كرتون" },
  "perCBM":                 { en: "Per CBM",                      zh: "每立方米",                     ar: "لكل متر مكعب" },
  "perKG":                  { en: "Per KG",                       zh: "每公斤",                       ar: "لكل كيلوغرام" },

  "costBreakdown":          { en: "Cost Breakdown",               zh: "成本明细",                     ar: "تفاصيل التكلفة" },
  "total":                  { en: "Total",                        zh: "总计",                         ar: "الإجمالي" },
  "simulationDetails":      { en: "Simulation Details",           zh: "模拟详情",                     ar: "تفاصيل المحاكاة" },
  "destination":            { en: "Destination",                  zh: "目的地",                       ar: "الوجهة" },
  "units":                  { en: "units",                        zh: "件",                           ar: "وحدات" },

  /* ── Cost labels ── */
  "cost.product":           { en: "Product",                      zh: "产品",                         ar: "المنتج" },
  "cost.export":            { en: "Export",                       zh: "出口",                         ar: "التصدير" },
  "cost.shipping":          { en: "Shipping",                     zh: "运输",                         ar: "الشحن" },
  "cost.import":            { en: "Import",                       zh: "进口",                         ar: "الاستيراد" },
  "cost.inland":            { en: "Inland",                       zh: "内陆",                         ar: "التوصيل" },
  "cost.financial":         { en: "Financial",                    zh: "财务",                         ar: "المالية" },

  /* ═══════════════════════════════════════════════════════════════════════════
     VALIDATION WARNINGS
     ═══════════════════════════════════════════════════════════════════════════ */
  "warn.unitPrice":         { en: "Unit price is required",       zh: "需要填写单价",                  ar: "سعر الوحدة مطلوب" },
  "warn.quantity":          { en: "Quantity is required",         zh: "需要填写数量",                  ar: "الكمية مطلوبة" },
  "warn.hsCodeMissing":     { en: "HS Code needed for customs",   zh: "海关需要HS编码",               ar: "رمز النظام المنسق مطلوب للجمارك" },
  "warn.weightMissing":     { en: "Gross weight needed for shipping", zh: "运输需要毛重", ar: "الوزن الإجمالي مطلوب للشحن" },
  "warn.cbmMissing":        { en: "CBM needed for freight calculation", zh: "货运计算需要CBM", ar: "المتر المكعب مطلوب لحساب الشحن" },
  "warn.customerMissing":   { en: "Customer info missing",        zh: "缺少客户信息",                  ar: "معلومات العميل مفقودة" },
  "warn.shippingMode":      { en: "Shipping mode not selected",   zh: "未选择运输方式",                ar: "لم يتم اختيار طريقة الشحن" },
  "warn.countryMissing":    { en: "Destination country needed for duty defaults", zh: "需要目的国以获取关税默认值", ar: "دولة الوجهة مطلوبة لتحديد الرسوم الافتراضية" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PRICE BASIS HINTS
     ═══════════════════════════════════════════════════════════════════════════ */
  "hint.EXW":               { en: "Ex Works — All costs from factory to warehouse apply", zh: "出厂价 — 从工厂到仓库的所有费用适用", ar: "تسليم المصنع — تُطبق جميع التكاليف من المصنع إلى المستودع" },
  "hint.FOB":               { en: "Free On Board — Export costs included in price, skip export block", zh: "离岸价 — 出口费用已含在价格中，跳过出口板块", ar: "تسليم على ظهر السفينة — تكاليف التصدير مشمولة في السعر" },
  "hint.CFR":               { en: "Cost & Freight — Export + freight included, only surcharges apply", zh: "成本加运费 — 出口+运费已含，仅适用附加费", ar: "التكلفة والشحن — التصدير + الشحن مشمولان، تُطبق الرسوم الإضافية فقط" },
  "hint.CIF":               { en: "Cost, Insurance & Freight — Export + freight + insurance included", zh: "到岸价 — 出口+运费+保险已含", ar: "التكلفة والتأمين والشحن — التصدير + الشحن + التأمين مشمولة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     LOADING TYPE HINTS
     ═══════════════════════════════════════════════════════════════════════════ */
  "hint.LCL":             { en: "Less than Container Load — Shared container, charged per CBM", zh: "拼箱 — 共享集装箱，按立方米计费", ar: "أقل من حمولة حاوية — حاوية مشتركة، محاسبة بالمتر المكعب" },
  "hint.FCL 20GP":        { en: "Full Container 20ft — ~33 CBM capacity", zh: "整箱20尺 — 约33立方米容量", ar: "حاوية كاملة 20 قدم — سعة ~33 متر مكعب" },
  "hint.FCL 40GP":        { en: "Full Container 40ft — ~67 CBM capacity", zh: "整箱40尺 — 约67立方米容量", ar: "حاوية كاملة 40 قدم — سعة ~67 متر مكعب" },
  "hint.FCL 40HQ":        { en: "Full Container 40ft High Cube — ~76 CBM capacity", zh: "整箱40尺高柜 — 约76立方米容量", ar: "حاوية كاملة 40 قدم عالية — سعة ~76 متر مكعب" },
  "hint.Air":             { en: "Air freight — Charged by volumetric or actual weight", zh: "空运 — 按体积重量或实际重量计费", ar: "شحن جوي — محاسبة بالوزن الحجمي أو الفعلي" },
  "hint.Courier":         { en: "Express courier — DHL, FedEx, UPS etc.", zh: "快递 — DHL、FedEx、UPS等", ar: "بريد سريع — DHL، FedEx، UPS إلخ" },

  /* ── Untitled Simulation ── */
  "untitledSimulation":   { en: "Untitled Simulation",   zh: "未命名模拟",          ar: "محاكاة بدون عنوان" },

  /* ═══════════════════════════════════════════════════════════════════════════
     LIST PAGE
     ═══════════════════════════════════════════════════════════════════════════ */
  "list.title":             { en: "Landed Cost Simulator",        zh: "到岸成本模拟器",               ar: "محاكي تكلفة الوصول" },
  "list.simulations":       { en: "simulation",                   zh: "个模拟",                       ar: "محاكاة" },
  "list.simulationsPlural": { en: "simulations",                  zh: "个模拟",                       ar: "محاكاة" },
  "list.newSimulation":     { en: "New Simulation",               zh: "新建模拟",                     ar: "محاكاة جديدة" },
  "list.createSimulation":  { en: "Create Simulation",            zh: "创建模拟",                     ar: "إنشاء محاكاة" },
  "list.searchPlaceholder": { en: "Search simulations...",        zh: "搜索模拟...",                   ar: "بحث المحاكاة..." },
  "list.allStatus":         { en: "All Status",                   zh: "所有状态",                     ar: "جميع الحالات" },
  "list.recentlyUpdated":   { en: "Recently Updated",             zh: "最近更新",                     ar: "آخر تحديث" },
  "list.nameAZ":            { en: "Name A–Z",                     zh: "名称 A–Z",                    ar: "الاسم أ–ي" },
  "list.highestCost":       { en: "Highest Cost",                 zh: "最高成本",                     ar: "أعلى تكلفة" },
  "list.noSimsFound":       { en: "No simulations found",         zh: "未找到模拟",                   ar: "لم يتم العثور على محاكاة" },
  "list.noSimsYet":         { en: "No simulations yet",           zh: "暂无模拟",                     ar: "لا توجد محاكاة بعد" },
  "list.adjustFilters":     { en: "Try adjusting your search or filters.", zh: "请调整搜索或筛选条件。", ar: "حاول تعديل البحث أو الفلاتر." },
  "list.createFirstSim":    { en: "Create your first landed cost simulation to calculate full warehouse cost for any product.", zh: "创建您的第一个到岸成本模拟，计算任何产品的完整仓库成本。", ar: "أنشئ أول محاكاة لتكلفة الوصول لحساب التكلفة الكاملة للمستودع لأي منتج." },
  "list.noCustomer":        { en: "No customer",                  zh: "无客户",                       ar: "بدون عميل" },
  "list.noProduct":         { en: "No product",                   zh: "无产品",                       ar: "بدون منتج" },
  "list.totalLandedCost":   { en: "Total Landed Cost",            zh: "总到岸成本",                   ar: "إجمالي تكلفة الوصول" },
  "list.open":              { en: "Open",                         zh: "打开",                         ar: "فتح" },
  "list.duplicate":         { en: "Duplicate",                    zh: "复制",                         ar: "تكرار" },
  "list.delete":            { en: "Delete",                       zh: "删除",                         ar: "حذف" },
  "list.deleteConfirm":     { en: "Delete this simulation?",      zh: "删除此模拟？",                  ar: "حذف هذه المحاكاة؟" },
};
