import type { Translations } from "@/lib/i18n";

/* Security alerts to Super Admins, account and sign-in help requests —
   lib/server/sa-notify.ts (via audit.ts, api/activity/heartbeat,
   api/auth/signin), api/support/membership-request, api/support/sign-in-help.

   The English is byte for byte the sentence these writers stored before
   templates: notifySuperAdmins dedupes and supersedes BY SUBJECT, so a
   changed English word would split one series of alerts into two. */
export const adminTpl: Translations = {
  /* ── new_device (activity heartbeat) ─────────────────────────────────── */
  "new_device.s": { en: "{actor} signed in from a new device", zh: "{actor} 从新设备登录", ar: "تسجيل دخول {actor} من جهاز جديد" },
  "new_device.b": { en: "{browser} on {os}[[ · {country}]]", zh: "{os} 上的 {browser}[[ · {country}]]", ar: "{browser} على {os}[[ · {country}]]" },
  "new_device.unknown.s": { en: "A user signed in from a new device", zh: "有用户从新设备登录", ar: "تسجيل دخول مستخدم من جهاز جديد" },
  "new_device.unknown.b": { en: "{browser} on {os}[[ · {country}]]", zh: "{os} 上的 {browser}[[ · {country}]]", ar: "{browser} على {os}[[ · {country}]]" },

  /* ── failed_login_threshold (sign-in) ────────────────────────────────── */
  "failed_login_threshold.s": {
    en: "Repeated failed logins for {account}",
    zh: "{account} 多次登录失败",
    ar: "محاولات تسجيل دخول فاشلة متكررة للحساب {account}",
  },
  "failed_login_threshold.b": {
    en: "{count} failed attempts in the last 15 minutes[[ · {ip}]]",
    zh: "过去 15 分钟内登录失败 {count} 次[[ · {ip}]]",
    ar: "محاولات فاشلة خلال آخر 15 دقيقة: {count}[[ · {ip}]]",
  },

  /* ── audited actions (audit.ts → one key pair per alert kind) ───────────
     "{action} — {entity}: {label}" / "In {module}". The bare key: the label
     is a number, a code, an id or a person's name, shown as stored. `.typed`:
     the label is a name a person typed (a product, a role), which the
     reader's screen may translate on its own. */
  "data_delete.s": { en: "{action:sa_action} — {entity:sa_entity}: {label}", zh: "{action:sa_action} — {entity:sa_entity}：{label}", ar: "{action:sa_action} — {entity:sa_entity}: {label}" },
  "data_delete.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },
  "data_delete.typed.s": { en: "{action:sa_action} — {entity:sa_entity}: {label:free}", zh: "{action:sa_action} — {entity:sa_entity}：{label:free}", ar: "{action:sa_action} — {entity:sa_entity}: {label:free}" },
  "data_delete.typed.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },

  "sensitive_export.s": { en: "{action:sa_action} — {entity:sa_entity}: {label}", zh: "{action:sa_action} — {entity:sa_entity}：{label}", ar: "{action:sa_action} — {entity:sa_entity}: {label}" },
  "sensitive_export.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },
  "sensitive_export.typed.s": { en: "{action:sa_action} — {entity:sa_entity}: {label:free}", zh: "{action:sa_action} — {entity:sa_entity}：{label:free}", ar: "{action:sa_action} — {entity:sa_entity}: {label:free}" },
  "sensitive_export.typed.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },

  "price_cost_change.s": { en: "{action:sa_action} — {entity:sa_entity}: {label}", zh: "{action:sa_action} — {entity:sa_entity}：{label}", ar: "{action:sa_action} — {entity:sa_entity}: {label}" },
  "price_cost_change.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },
  "price_cost_change.typed.s": { en: "{action:sa_action} — {entity:sa_entity}: {label:free}", zh: "{action:sa_action} — {entity:sa_entity}：{label:free}", ar: "{action:sa_action} — {entity:sa_entity}: {label:free}" },
  "price_cost_change.typed.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },

  "settings_change.s": { en: "{action:sa_action} — {entity:sa_entity}: {label}", zh: "{action:sa_action} — {entity:sa_entity}：{label}", ar: "{action:sa_action} — {entity:sa_entity}: {label}" },
  "settings_change.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },
  "settings_change.typed.s": { en: "{action:sa_action} — {entity:sa_entity}: {label:free}", zh: "{action:sa_action} — {entity:sa_entity}：{label:free}", ar: "{action:sa_action} — {entity:sa_entity}: {label:free}" },
  "settings_change.typed.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },

  "admin_role_change.s": { en: "{action:sa_action} — {entity:sa_entity}: {label}", zh: "{action:sa_action} — {entity:sa_entity}：{label}", ar: "{action:sa_action} — {entity:sa_entity}: {label}" },
  "admin_role_change.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },
  "admin_role_change.typed.s": { en: "{action:sa_action} — {entity:sa_entity}: {label:free}", zh: "{action:sa_action} — {entity:sa_entity}：{label:free}", ar: "{action:sa_action} — {entity:sa_entity}: {label:free}" },
  "admin_role_change.typed.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },

  "file_change.s": { en: "{action:sa_action} — {entity:sa_entity}: {label}", zh: "{action:sa_action} — {entity:sa_entity}：{label}", ar: "{action:sa_action} — {entity:sa_entity}: {label}" },
  "file_change.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },
  "file_change.typed.s": { en: "{action:sa_action} — {entity:sa_entity}: {label:free}", zh: "{action:sa_action} — {entity:sa_entity}：{label:free}", ar: "{action:sa_action} — {entity:sa_entity}: {label:free}" },
  "file_change.typed.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },

  "suspicious.s": { en: "{action:sa_action} — {entity:sa_entity}: {label}", zh: "{action:sa_action} — {entity:sa_entity}：{label}", ar: "{action:sa_action} — {entity:sa_entity}: {label}" },
  "suspicious.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },
  "suspicious.typed.s": { en: "{action:sa_action} — {entity:sa_entity}: {label:free}", zh: "{action:sa_action} — {entity:sa_entity}：{label:free}", ar: "{action:sa_action} — {entity:sa_entity}: {label:free}" },
  "suspicious.typed.b": { en: "In {module:sa_module}", zh: "应用：{module:sa_module}", ar: "التطبيق: {module:sa_module}" },

  /* The audited action, as the alert has always printed it (audit.ts
     humanizeAction: "change_price" → "Change Price"). An action not listed
     here reads as that English in every language — never as a raw code. */
  "enum.sa_action.Change Price": { en: "Change Price", zh: "修改价格", ar: "تغيير السعر" },
  "enum.sa_action.Change Pricing Policy": { en: "Change Pricing Policy", zh: "修改定价政策", ar: "تغيير سياسة التسعير" },
  "enum.sa_action.Change Permissions": { en: "Change Permissions", zh: "修改权限", ar: "تغيير الصلاحيات" },
  "enum.sa_action.Create": { en: "Create", zh: "创建", ar: "إنشاء" },
  "enum.sa_action.Delete": { en: "Delete", zh: "删除", ar: "حذف" },
  "enum.sa_action.Password Changed": { en: "Password Changed", zh: "密码已更改", ar: "تم تغيير كلمة المرور" },

  /* The audited record's type, as stored (audit_logs.entity_type). The
     English is the code itself — what the alert has always printed. */
  "enum.sa_entity.product": { en: "product", zh: "产品", ar: "منتج" },
  "enum.sa_entity.role": { en: "role", zh: "角色", ar: "دور" },
  "enum.sa_entity.quotation": { en: "quotation", zh: "报价单", ar: "عرض سعر" },
  "enum.sa_entity.document": { en: "document", zh: "文档", ar: "مستند" },
  "enum.sa_entity.employee": { en: "employee", zh: "员工", ar: "موظف" },
  "enum.sa_entity.account": { en: "account", zh: "账户", ar: "حساب" },
  "enum.sa_entity.commercial_policy_section": { en: "commercial_policy_section", zh: "商业政策章节", ar: "قسم السياسة التجارية" },
  "enum.sa_entity.record": { en: "record", zh: "记录", ar: "سجل" },

  /* The module the action was taken in (audit_logs.module), as stored. */
  "enum.sa_module.Product Data": { en: "Product Data", zh: "产品数据", ar: "بيانات المنتجات" },
  "enum.sa_module.Commercial Policy": { en: "Commercial Policy", zh: "商业政策", ar: "السياسة التجارية" },
  "enum.sa_module.Roles & Permissions": { en: "Roles & Permissions", zh: "角色与权限", ar: "الأدوار والصلاحيات" },
  "enum.sa_module.Settings": { en: "Settings", zh: "设置", ar: "الإعدادات" },
  "enum.sa_module.Quotations": { en: "Quotations", zh: "报价单", ar: "عروض الأسعار" },
  "enum.sa_module.Documents": { en: "Documents", zh: "文档", ar: "المستندات" },
  "enum.sa_module.Employees": { en: "Employees", zh: "员工", ar: "الموظفون" },

  /* ── membership_request / support_request (sign-in screen forms) ───────
     Subjects only: the body is the applicant's form, line by line — data,
     stored as written. */
  "membership_request.s": { en: "Account request · {name}", zh: "账户申请 · {name}", ar: "طلب حساب · {name}" },
  "support_request.s": { en: "Sign-in help · {name}", zh: "登录帮助 · {name}", ar: "مساعدة في تسجيل الدخول · {name}" },
  "support_request.urgent.s": { en: "⚠ Suspected account misuse · {name}", zh: "⚠ 疑似账户被盗用 · {name}", ar: "⚠ اشتباه في إساءة استخدام الحساب · {name}" },

  /* Not a writer's template: the bell and the notification center fold the
     same audited action by one person on one day into this one line
     (lib/notification-view — "Delete — product × 6"). */
  "sa_alert.digest.s": { en: "{action:sa_action} — {entity:sa_entity} × {count}", zh: "{action:sa_action} — {entity:sa_entity} × {count}", ar: "{action:sa_action} — {entity:sa_entity} × {count}" },

  /* Lock-screen folding (service worker): when a push lands on a tag that is
     still showing, the device counts them and shows this title instead —
     `{n}` is filled ON THE DEVICE (the server passes it through as "{n}"). */
  "push_group.alerts.s": { en: "{actor} — {n} alerts", zh: "{actor} — {n} 条提醒", ar: "{actor} — تنبيهات: {n}" },
  "push_group.messages.s": { en: "{actor} · {n} new messages", zh: "{actor} · {n} 条新消息", ar: "{actor} · رسائل جديدة: {n}" },
};
