import type { Translations } from "@/lib/i18n";

export const rolesT: Translations = {
  /* Page chrome */
  "app.title":          { en: "Roles & Permissions",
                          zh: "角色与权限",
                          ar: "الأدوار والصلاحيات" },
  "app.subtitle.one":   { en: "role configured",
                          zh: "个角色已配置",
                          ar: "دور مُعدّ" },
  "app.subtitle.many":  { en: "roles configured",
                          zh: "个角色已配置",
                          ar: "أدوار مُعدّة" },

  /* Buttons + actions */
  "btn.newRole":        { en: "New Role",        zh: "新建角色",        ar: "دور جديد" },
  "btn.createRole":     { en: "Create Role",     zh: "创建角色",        ar: "إنشاء دور" },
  "btn.save":           { en: "Save",            zh: "保存",            ar: "حفظ" },
  "btn.saving":         { en: "Saving…",         zh: "正在保存…",        ar: "جارٍ الحفظ…" },
  "btn.saved":          { en: "Saved",           zh: "已保存",          ar: "تم الحفظ" },
  "btn.cancel":         { en: "Cancel",          zh: "取消",            ar: "إلغاء" },
  "btn.delete":         { en: "Delete",          zh: "删除",            ar: "حذف" },
  "btn.deleting":       { en: "Deleting…",       zh: "正在删除…",        ar: "جارٍ الحذف…" },
  "btn.clone":          { en: "Clone",           zh: "克隆",            ar: "تكرار" },
  "btn.edit":           { en: "Edit",            zh: "编辑",            ar: "تعديل" },
  "btn.permissions":    { en: "Permissions",     zh: "权限",            ar: "الصلاحيات" },

  /* Search + toasts */
  "search.placeholder": { en: "Search roles…",   zh: "搜索角色…",        ar: "بحث في الأدوار…" },
  "toast.roleCreated":  { en: "Role created",    zh: "角色已创建",       ar: "تم إنشاء الدور" },
  "toast.roleUpdated":  { en: "Role updated",    zh: "角色已更新",       ar: "تم تحديث الدور" },
  "toast.roleCloned":   { en: "Role cloned",     zh: "角色已克隆",       ar: "تم تكرار الدور" },
  "toast.roleDeleted":  { en: "Role deleted",    zh: "角色已删除",       ar: "تم حذف الدور" },

  /* KPI cards */
  "kpi.totalRoles":     { en: "Total Roles",     zh: "角色总数",        ar: "إجمالي الأدوار" },
  "kpi.moduleGroups":   { en: "Module Groups",   zh: "模块组",          ar: "مجموعات الوحدات" },
  "kpi.totalModules":   { en: "Total Modules",   zh: "模块总数",        ar: "إجمالي الوحدات" },

  /* Empty + loading states */
  "state.loading":      { en: "Loading roles…",  zh: "正在加载角色…",   ar: "جارٍ تحميل الأدوار…" },
  "state.noRoles":      { en: "No roles yet",    zh: "还没有角色",      ar: "لا توجد أدوار بعد" },
  "state.noResults":    { en: "No results found", zh: "未找到结果",      ar: "لا توجد نتائج" },
  "state.createFirst":  { en: "Create your first role to start managing permissions.",
                          zh: "创建您的第一个角色以开始管理权限。",
                          ar: "أنشئ أول دور للبدء بإدارة الصلاحيات." },
  "state.tryAdjust":    { en: "Try adjusting your search.",
                          zh: "请尝试调整搜索条件。",
                          ar: "حاول تعديل البحث." },

  /* Role modal */
  "modal.newTitle":     { en: "New Role",        zh: "新建角色",        ar: "دور جديد" },
  "modal.editTitle":    { en: "Edit Role",       zh: "编辑角色",        ar: "تعديل الدور" },
  "modal.deleteTitle":  { en: "Delete Role",     zh: "删除角色",        ar: "حذف الدور" },
  "modal.name":         { en: "Role name",       zh: "角色名称",        ar: "اسم الدور" },
  "modal.description":  { en: "Description",     zh: "描述",            ar: "الوصف" },
  "modal.descPlaceholder": { en: "What does this role do?",
                             zh: "此角色的职责是什么？",
                             ar: "ماذا يفعل هذا الدور؟" },
  "modal.namePlaceholder": { en: "e.g. Sales Manager",
                             zh: "例如：销售经理",
                             ar: "مثل: مدير المبيعات" },
  "modal.isSA":         { en: "Super Admin role",
                          zh: "超级管理员角色",
                          ar: "دور المسؤول الأعلى" },
  "modal.isSA.help":    { en: "Bypasses every module + scope check. Grant carefully.",
                          zh: "绕过所有模块和范围检查。请谨慎授予。",
                          ar: "يتجاوز كل تحقق للوحدات والنطاقات. امنح بعناية." },
  "modal.canViewPrivate":
    { en: "Can view private records",
      zh: "可查看私密记录",
      ar: "يمكن رؤية السجلات الخاصة" },
  "modal.canViewPrivate.help":
    { en: "Grants access to records marked Private (personal mail, notes, sensitive HR). Every read is logged to koleex_private_access_log. Grant sparingly — typically only during legal discovery.",
      zh: "授予访问标记为私密记录的权限（个人邮件、笔记、敏感 HR 数据）。每次读取都会记录到 koleex_private_access_log。请谨慎授予——通常仅用于法律调查期间。",
      ar: "يمنح وصولًا إلى السجلات المصنّفة خاصة (بريد شخصي، ملاحظات، بيانات موارد بشرية حساسة). يُسجَّل كل وصول في koleex_private_access_log. امنح بحذر — عادةً ما يستخدم للاستقصاء القانوني فقط." },
  "modal.delete.confirm":
    { en: "Delete this role? Users with this role will lose their permissions but their accounts remain active.",
      zh: "删除此角色？具有此角色的用户将失去其权限，但他们的帐户仍然有效。",
      ar: "حذف هذا الدور؟ سيفقد المستخدمون بهذا الدور صلاحياتهم لكن حساباتهم ستبقى فعّالة." },

  /* Validation */
  "err.nameRequired":   { en: "Role name is required.",
                          zh: "角色名称为必填项。",
                          ar: "اسم الدور مطلوب." },
  "err.saveFailed":     { en: "Save failed:",    zh: "保存失败：",      ar: "فشل الحفظ:" },
  "err.generic":        { en: "Failed.",         zh: "失败。",          ar: "فشل." },

  /* Permission matrix */
  "perm.app":           { en: "App",             zh: "应用",            ar: "التطبيق" },
  "perm.view":          { en: "View",            zh: "查看",            ar: "عرض" },
  "perm.add":           { en: "Add",             zh: "添加",            ar: "إضافة" },
  "perm.edit":          { en: "Edit",            zh: "编辑",            ar: "تعديل" },
  "perm.del":           { en: "Del",             zh: "删除",            ar: "حذف" },
  "perm.all":           { en: "All",             zh: "全部",            ar: "الكل" },
  "perm.scope":         { en: "Scope",           zh: "范围",            ar: "النطاق" },
  "perm.hide":          { en: "Hide",            zh: "隐藏",            ar: "إخفاء" },
  "perm.full":          { en: "Full",            zh: "全部",            ar: "كامل" },

  /* Scope chip labels */
  "scope.all":          { en: "All",             zh: "全部",            ar: "الكل" },
  "scope.department":   { en: "Dept",            zh: "部门",            ar: "قسم" },
  "scope.own":          { en: "Own",             zh: "自己",            ar: "خاص بي" },
  "scope.private":      { en: "Private",         zh: "私密",            ar: "خاصة" },
  "scope.personal":     { en: "Personal",        zh: "个人",            ar: "شخصي" },
  "scope.personal.tip": { en: "Personal productivity data. Always scoped to the owner + explicit sharing. Only Super Admin can view others'.",
                          zh: "个人生产力数据。始终限定为所有者及其明确共享的人。只有超级管理员可以查看他人的数据。",
                          ar: "بيانات إنتاجية شخصية. محصورة دائمًا بالمالك والمشاركين صراحة. فقط المسؤول الأعلى يستطيع رؤية بيانات الآخرين." },
  "scope.cycle.tip":    { en: "Data scope — click to cycle (All → Dept → Own → Private).",
                          zh: "数据范围——点击循环切换（全部 → 部门 → 自己 → 私密）。",
                          ar: "نطاق البيانات — انقر للتبديل (الكل → قسم → خاص بي → خاصة)." },

  /* Hide column tooltip */
  "hide.enable.tip":    { en: "Hide this app from everyone with this role",
                          zh: "对具有此角色的所有人隐藏此应用",
                          ar: "إخفاء هذا التطبيق عن كل من لديه هذا الدور" },
  "hide.disable.tip":   { en: "Un-hide (grants view-only)",
                          zh: "取消隐藏（授予仅查看权限）",
                          ar: "إلغاء الإخفاء (منح عرض فقط)" },

  /* Super Admin banner */
  "sa.title":           { en: "This is the Super Admin role",
                          zh: "这是超级管理员角色",
                          ar: "هذا هو دور المسؤول الأعلى" },
  "sa.body":            { en: "Changes to these permissions don't affect users with this role — Super Admin always has full access to every module and every record, by design. To test Hide / View restrictions, edit a non-SA role (e.g. User, Data Entry, Assistant).",
                          zh: "对这些权限的更改不会影响具有此角色的用户——超级管理员根据设计始终对所有模块和所有记录拥有完全访问权限。要测试隐藏/查看限制，请编辑非超级管理员角色（例如用户、数据录入员、助理）。",
                          ar: "التعديلات على هذه الصلاحيات لا تؤثر على المستخدمين بهذا الدور — المسؤول الأعلى يملك وصولًا كاملًا لكل وحدة وكل سجل، بالتصميم. لاختبار قيود الإخفاء/العرض، عدّل دورًا غير SA (مثل مستخدم، إدخال بيانات، مساعد)." },

  /* Row actions */
  "row.cloneTip":       { en: "Clone role",      zh: "克隆角色",        ar: "تكرار الدور" },
  "row.editTip":        { en: "Edit role",       zh: "编辑角色",        ar: "تعديل الدور" },
  "row.deleteTip":      { en: "Delete role",     zh: "删除角色",        ar: "حذف الدور" },

  /* Permission group labels (also surface as section headers in matrix) */
  "group.Operations":   { en: "Operations",      zh: "运营",            ar: "العمليات" },
  "group.Commercial":   { en: "Commercial",      zh: "商务",            ar: "التجاري" },
  "group.Finance":      { en: "Finance",         zh: "财务",            ar: "المالية" },
  "group.People":       { en: "People",          zh: "人员",            ar: "الأشخاص" },
  "group.Communication":{ en: "Communication",   zh: "沟通",            ar: "التواصل" },
  "group.Marketing & Growth": { en: "Marketing & Growth", zh: "营销与增长", ar: "التسويق والنمو" },
  "group.Planning & Knowledge": { en: "Planning & Knowledge", zh: "规划与知识", ar: "التخطيط والمعرفة" },
  "group.System":       { en: "System",          zh: "系统",            ar: "النظام" },
};
