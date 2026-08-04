/* ===========================================================================
   humanizeError — translate raw server / Postgres / HTTP errors into
   sentences an operator can act on.

   Rules:
     · always returns a non-empty string
     · prefers the longer of (mapped message, original) when both exist
     · never includes status codes or stack traces
     · safe to call with anything (string / Error / unknown)

   Patterns mapped:
     · "violates foreign key constraint" → "Linked record missing or
       removed. Please select a different value."
     · "violates check constraint"       → "One of the fields has an
       invalid value."
     · "duplicate key value"             → "This record already exists."
     · "permission denied"               → "You don't have permission
       for this action."
     · "FX rate"                         → "FX rate is missing — add a
       rate in Finance → FX Rates."
     · "Not enough stock"                → unchanged (already human)
     · raw "HTTP 4xx/5xx" / "Failed (4xx)" → mapped to generic
       "Something went wrong. Please try again."
   ========================================================================== */

/* ── Localisation ──────────────────────────────────────────────────────────
   These sentences are the ONLY thing most operators ever read when
   something fails, and they were hardcoded English — so an Arabic session
   ended with "Network problem — check your connection and retry." sitting
   in the middle of an Arabic conversation, and the Chinese staff read every
   failure in a language they did not pick.

   The active language lives in localStorage["koleex-lang"], written by the
   header switcher. Reading it here keeps humanizeError's signature
   (unknown -> string) intact, so all ~40 call sites are fixed at once
   without touching one of them. On the server (no window) it stays
   English, which is correct for logs. */
type Lang = "en" | "zh" | "ar";
type Msg = Record<Lang, string>;

function activeLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const v = window.localStorage.getItem("koleex-lang");
    return v === "ar" || v === "zh" ? v : "en";
  } catch { return "en"; }
}

const M = {
  fk:        { en: "Linked record is missing or was removed — pick a different value.", ar: "السجل المرتبط غير موجود أو تم حذفه — اختر قيمة أخرى.", zh: "关联记录不存在或已被删除 — 请选择其他值。" },
  notNull:   { en: "A required field is empty.", ar: "هناك حقل مطلوب فارغ.", zh: "有必填字段未填写。" },
  check:     { en: "One of the fields has an invalid value.", ar: "أحد الحقول يحتوي على قيمة غير صالحة.", zh: "某个字段的值无效。" },
  duplicate: { en: "This record already exists.", ar: "هذا السجل موجود بالفعل.", zh: "该记录已存在。" },
  denied:    { en: "You don't have permission for this action.", ar: "لا تملك صلاحية لتنفيذ هذا الإجراء.", zh: "您没有执行此操作的权限。" },
  session:   { en: "Your session expired — please sign in again.", ar: "انتهت جلستك — يرجى تسجيل الدخول مرة أخرى.", zh: "登录已过期 — 请重新登录。" },
  network:   { en: "Network problem — check your connection and retry.", ar: "مشكلة في الشبكة — تحقق من اتصالك ثم أعد المحاولة.", zh: "网络异常 — 请检查网络连接后重试。" },
  timeout:   { en: "The server took too long to respond. Please retry.", ar: "استغرق الخادم وقتاً طويلاً للرد. يرجى إعادة المحاولة.", zh: "服务器响应超时，请重试。" },
  fxMissing: { en: "FX rate is missing — open Finance → FX Rates to add one.", ar: "سعر الصرف غير موجود — افتح المالية ← أسعار الصرف لإضافته.", zh: "缺少汇率 — 请在「财务 → 汇率」中添加。" },
  fxSame:    { en: "From and To currencies must be different.", ar: "يجب أن تختلف عملة المصدر عن عملة الوجهة.", zh: "源货币与目标货币必须不同。" },
  fxZero:    { en: "FX rate must be greater than zero.", ar: "يجب أن يكون سعر الصرف أكبر من صفر.", zh: "汇率必须大于零。" },
  stock:     { en: "Not enough stock at this location.", ar: "الكمية غير كافية في هذا الموقع.", zh: "该库位库存不足。" },
  finalised: { en: "This document is already finalised and cannot be changed.", ar: "هذا المستند مُعتمد بالفعل ولا يمكن تعديله.", zh: "该单据已确认，无法修改。" },
  generic:   { en: "Something went wrong. Please try again.", ar: "حدث خطأ ما. يرجى المحاولة مرة أخرى.", zh: "出了点问题，请重试。" },
} satisfies Record<string, Msg>;

const say = (m: Msg): string => m[activeLang()] ?? m.en;

const KNOWN_PATTERNS: Array<[RegExp | string, Msg]> = [
  [/violates foreign key constraint/i,         M.fk],
  [/violates not-null constraint/i,            M.notNull],
  [/violates check constraint/i,               M.check],
  [/duplicate key value/i,                     M.duplicate],
  [/permission denied/i,                       M.denied],
  [/jwt expired|invalid token|unauthorized/i,  M.session],
  [/network|fetch failed|failed to fetch/i,    M.network],
  [/timeout/i,                                 M.timeout],
  /* Domain-specific helpful rewrites. */
  [/no fx rate.*configured|missing fx rate/i,  M.fxMissing],
  [/from and to currencies must differ/i,      M.fxSame],
  [/rate must be > 0/i,                        M.fxZero],
  [/insufficient stock|not enough stock/i,     M.stock],
  [/already posted|already approved/i,         M.finalised],
  [/^HTTP\s?\d{3}/,                            M.generic],
  [/Failed\s?\(\d{3}\)/i,                      M.generic],
  [/^422\b|^400\b|^500\b/,                     M.generic],
];

export function humanizeError(input: unknown): string {
  let raw: string;
  if (input == null) raw = say(M.generic);
  else if (typeof input === "string") raw = input;
  else if (input instanceof Error) raw = input.message;
  else if (typeof input === "object") {
    /* Supabase/PostgrestError is a plain object carrying `message`
       (+ details/hint/code) and NO `error` key — the old branch only
       looked for `error`, so every DB failure fell through to
       String(obj) and users were shown the literal "[object Object]".
       That is why product-save failures were undiagnosable. */
    const o = input as { message?: unknown; error?: unknown; details?: unknown; hint?: unknown };
    const pick =
      typeof o.message === "string" && o.message.trim() ? o.message
      : typeof o.error === "string" && o.error.trim() ? o.error
      : typeof o.details === "string" && o.details.trim() ? o.details
      : typeof o.hint === "string" && o.hint.trim() ? o.hint
      : null;
    raw = pick ?? say(M.generic);
  } else raw = String(input);

  /* Never let an unresolved object reach the user. */
  if (raw === "[object Object]") raw = say(M.generic);

  if (!raw || raw.trim().length === 0) return say(M.generic);
  for (const [pattern, mapped] of KNOWN_PATTERNS) {
    const matches = typeof pattern === "string" ? raw.toLowerCase().includes(pattern.toLowerCase()) : pattern.test(raw);
    if (matches) return say(mapped);
  }
  /* Drop stack-trace lines and trim long technical strings. */
  const firstLine = raw.split(/\r?\n/)[0].trim();
  if (firstLine.length > 180) return say(M.generic);
  return firstLine;
}
