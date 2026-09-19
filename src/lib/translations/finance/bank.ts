import type { Translations } from "@/lib/i18n";

/* Finance — the `bank.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_BANK: Translations = {
  /* ── BankAccounts dialogs ─────────────────────────────────────── */
  "bank.edit.title":           { en: "Edit bank account",               zh: "编辑银行账户",             ar: "تعديل الحساب البنكي" },
  "bank.new.title":            { en: "New bank account",                zh: "新建银行账户",             ar: "حساب بنكي جديد" },
  "bank.edit.subtitle":        { en: "Treasury-grade entry. Account number is masked in list views.",
                                  zh: "资金级别录入。账号在列表视图中将被隐藏。",
                                  ar: "إدخال على مستوى الخزينة. رقم الحساب يُخفى في القوائم." },
  "bank.field.bankName":       { en: "Bank name",                       zh: "银行名称",                ar: "اسم البنك" },
  "bank.field.accountName":    { en: "Account name",                    zh: "账户名称",                ar: "اسم الحساب" },
  "bank.field.currency":       { en: "Currency",                        zh: "币种",                    ar: "العملة" },
  "bank.field.currencyHint":   { en: "ISO code (USD / EUR / EGP / CNY …)",
                                  zh: "ISO 代码（USD / EUR / EGP / CNY …）",
                                  ar: "رمز ISO (USD / EUR / EGP / CNY …)" },
  "bank.field.country":        { en: "Country",                         zh: "国家",                    ar: "الدولة" },
  "bank.field.countryHint":    { en: "ISO country (EG / CN / US …)",    zh: "ISO 国家代码（EG / CN / US …）",
                                                                         ar: "رمز الدولة ISO (EG / CN / US …)" },
  "bank.field.accountNumber":  { en: "Account number",                  zh: "账号",                    ar: "رقم الحساب" },
  "bank.field.iban":           { en: "IBAN",                            zh: "IBAN",                    ar: "IBAN" },
  "bank.field.swift":          { en: "SWIFT / BIC",                     zh: "SWIFT / BIC",             ar: "SWIFT / BIC" },
  "bank.field.status":         { en: "Status",                          zh: "状态",                    ar: "الحالة" },
  "bank.field.available":      { en: "Available",                       zh: "可用",                    ar: "المتاح" },
  "bank.field.pending":        { en: "Pending",                         zh: "未结",                    ar: "معلق" },
  "bank.field.restricted":     { en: "Restricted",                      zh: "受限",                    ar: "مقيّد" },
  "bank.field.opening":        { en: "Opening",                         zh: "期初余额",                ar: "افتتاحي" },
  "bank.field.makePrimary":    { en: "Make primary for this currency",  zh: "设为此币种的主账户",        ar: "اجعله الأساسي لهذه العملة" },
  "bank.field.notes":          { en: "Notes",                           zh: "备注",                    ar: "ملاحظات" },
  "bank.action.saveChanges":   { en: "Save changes",                    zh: "保存更改",                ar: "حفظ التغييرات" },
  "bank.action.createAccount": { en: "Create account",                  zh: "创建账户",                ar: "إنشاء حساب" },
  "bank.action.cancel":        { en: "Cancel",                          zh: "取消",                    ar: "إلغاء" },
  "bank.err.namesRequired":    { en: "Bank name and account name are required",
                                  zh: "必须填写银行名称和账户名称",
                                  ar: "اسم البنك واسم الحساب مطلوبان" },
  "bank.err.currencyRequired": { en: "Currency is required",            zh: "必须填写币种",             ar: "العملة مطلوبة" },
};
