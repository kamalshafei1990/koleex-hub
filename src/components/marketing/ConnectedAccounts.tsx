"use client";

/* ---------------------------------------------------------------------------
   ConnectedAccounts — the Accounts tab of a marketing space: its accounts, added and removed
   by the people who run it (owner, 27/09/2026: "connect any social media
   account by myself, add or remove freely — Koleex accounts too, the Odoo
   way"). Social Marketing renders it for 'company'; CEO Brand for 'ceo'.

   "Add account" opens every platform:
     · Facebook / Instagram — sign in with Facebook (a plain navigation to
       /api/marketing/connect/meta/start, which comes back with
       ?connect=<result>, shown once as a banner and then removed from the
       address bar);
     · Instagram on CEO Brand — Instagram Login (a Creator account);
     · LinkedIn on CEO Brand — sign in with LinkedIn (his own profile,
       publishing only: its card says so, and the day to sign in again);
     · LinkedIn on Social Marketing, YouTube, TikTok, X — "coming soon",
       with what is missing;
     · WeChat, WhatsApp, Douyin — added by hand (no posting API).
   "Remove" deletes the account's access key and takes it off the list; its
   history stays — shown only to whoever holds "delete" (the server asks the
   same). Access keys never reach this screen.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import Button from "@/components/kds/Button";
import StatusPill from "@/components/kds/StatusPill";
import EmptyState from "@/components/kds/EmptyState";
import Modal from "@/components/kds/Modal";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import { useTranslation, type Translations } from "@/lib/i18n";
import { dmyHm } from "@/lib/marketing/format";
import type { AdsState } from "@/lib/marketing/ads";
import {
  CONNECT_RESULTS, PLATFORM_ORDER, pageAccessRemoved, platformFlow,
  type ConnectResult, type ConnectVia, type MarketingAccountView, type MarketingPlatform, type MarketingSetup, type MarketingSpace,
} from "@/lib/marketing/spaces";

type MessagesState = { ready: boolean; missing: string[]; error: string | null };
type LinkedInState = { endsAt: string | null; ended: boolean };

const T: Translations = {
  "accounts.title":   { en: "Connected accounts", zh: "已连接的账号", ar: "الحسابات المربوطة" },
  "accounts.empty":   { en: "No account yet", zh: "还没有账号", ar: "لا توجد حسابات بعد" },
  "accounts.emptyHint": { en: "Add the accounts you publish to: Koleex's, or any other you manage.", zh: "添加您要发布内容的账号：Koleex 的账号，或您管理的任何其他账号。", ar: "أضف الحسابات التي تنشر عليها: حسابات كولكس أو أي حساب آخر تديره." },
  "add.button":       { en: "Add account", zh: "添加账号", ar: "إضافة حساب" },
  "add.title":        { en: "Add an account", zh: "添加账号", ar: "إضافة حساب" },
  "add.hint":         { en: "Pick a platform. The accounts you sign in to are added, and you can remove any of them later.", zh: "选择平台。您登录的账号会被添加，之后可随时移除。", ar: "اختر المنصة. تُضاف الحسابات التي تسجّل الدخول إليها، ويمكنك إزالة أي منها لاحقًا." },
  "add.signIn":       { en: "Sign in with Facebook", zh: "使用 Facebook 登录", ar: "تسجيل الدخول بـ Facebook" },
  "add.keepAll":      { en: "In Meta's window, keep EVERY Page and Instagram account the Hub uses selected — Koleex's and the CEO's. One left out stops working here.", zh: "在 Meta 窗口中，请保持选中 Hub 使用的所有主页和 Instagram 账号——包括 Koleex 的和 CEO 的。漏选的账号将在此停止工作。", ar: "في نافذة Meta، اترك كل الصفحات وحسابات Instagram اللي الـ Hub بيستخدمها محددة — بتاعة كولكس وبتاعة المدير التنفيذي. أي واحدة تشيلها هتقف هنا." },
  "removed.line":     { en: "Meta no longer shares this account with the Hub (a later Facebook sign-in left it out): sign in with Facebook again and keep it selected.", zh: "Meta 已不再向 Hub 共享此账号（之后的一次 Facebook 登录未选中它）：请重新使用 Facebook 登录，并保持选中它。", ar: "لم تعد Meta تشارك هذا الحساب مع الـ Hub (تسجيل دخول لاحق بـ Facebook لم يحدده): سجّل الدخول بـ Facebook من جديد واتركه محددًا." },
  "add.manual":       { en: "Add by hand", zh: "手动添加", ar: "إضافة يدوية" },
  "add.soon":         { en: "Coming soon", zh: "即将推出", ar: "قريبًا" },
  "add.needsKeys":    { en: "Needs the Meta app keys in Vercel.", zh: "需要在 Vercel 中设置 Meta 应用密钥。", ar: "يحتاج مفاتيح تطبيق Meta في Vercel." },
  "add.signInIg":     { en: "Sign in with Instagram", zh: "使用 Instagram 登录", ar: "تسجيل الدخول بـ Instagram" },
  "add.needsIgKeys":  { en: "Needs the Instagram app keys in Vercel.", zh: "需要在 Vercel 中设置 Instagram 应用密钥。", ar: "يحتاج مفاتيح تطبيق Instagram في Vercel." },
  "note.igLogin":     { en: "A Creator or Business account, no Facebook Page needed: the Hub publishes and reads the comments and numbers.", zh: "创作者或商业账号，无需 Facebook 主页：Hub 负责发布并读取评论和数据。", ar: "حساب Creator أو Business دون صفحة Facebook: يتولى الـ Hub النشر وقراءة التعليقات والأرقام." },
  "add.signInLi":     { en: "Sign in with LinkedIn", zh: "使用 LinkedIn 登录", ar: "تسجيل الدخول بـ LinkedIn" },
  "add.needsLiKeys":  { en: "Needs the LinkedIn app keys in Vercel.", zh: "需要在 Vercel 中设置 LinkedIn 应用密钥。", ar: "يحتاج مفاتيح تطبيق LinkedIn في Vercel." },
  "note.liLogin":     { en: "Your own profile: the Hub publishes words and pictures. LinkedIn sends no posts or numbers back; sign in again every 60 days.", zh: "您的个人主页：Hub 发布文字和图片。LinkedIn 不回传帖子或数据；每 60 天需重新登录。", ar: "حسابك الشخصي: ينشر الـ Hub النصوص والصور. لا يرسل LinkedIn المنشورات أو الأرقام؛ أعد تسجيل الدخول كل 60 يومًا." },
  "add.close":        { en: "Close", zh: "关闭", ar: "إغلاق" },
  "pname.facebook":   { en: "Facebook", zh: "Facebook", ar: "Facebook" },
  "pname.instagram":  { en: "Instagram", zh: "Instagram", ar: "Instagram" },
  "pname.linkedin":   { en: "LinkedIn", zh: "LinkedIn", ar: "LinkedIn" },
  "pname.youtube":    { en: "YouTube", zh: "YouTube", ar: "YouTube" },
  "pname.tiktok":     { en: "TikTok", zh: "TikTok", ar: "TikTok" },
  "pname.x":          { en: "X", zh: "X", ar: "X" },
  "pname.wechat":     { en: "WeChat", zh: "微信", ar: "WeChat" },
  "pname.whatsapp":   { en: "WhatsApp", zh: "WhatsApp", ar: "WhatsApp" },
  "pname.douyin":     { en: "Douyin", zh: "抖音", ar: "Douyin" },
  "note.facebook":    { en: "Pages you manage", zh: "您管理的主页", ar: "الصفحات التي تديرها" },
  "note.instagram":   { en: "A Business account linked to a Facebook Page", zh: "已关联 Facebook 主页的商业账号", ar: "حساب Business مرتبط بصفحة Facebook" },
  "note.linkedin":    { en: "Needs Koleex's LinkedIn app. Personal profiles work at once; company pages need LinkedIn's approval.", zh: "需要 Koleex 的 LinkedIn 应用。个人主页可立即使用；公司主页需经 LinkedIn 批准。", ar: "يحتاج تطبيق LinkedIn الخاص بكولكس. الحساب الشخصي يعمل فورًا، وصفحة الشركة تحتاج موافقة LinkedIn." },
  "note.youtube":     { en: "Needs Koleex's Google app, approved by Google.", zh: "需要经 Google 批准的 Koleex Google 应用。", ar: "يحتاج تطبيق Google الخاص بكولكس بعد موافقة Google عليه." },
  "note.tiktok":      { en: "Needs Koleex's TikTok app. Until TikTok reviews it, posts publish as private.", zh: "需要 Koleex 的 TikTok 应用。在 TikTok 审核通过前，帖子只能以私密方式发布。", ar: "يحتاج تطبيق TikTok الخاص بكولكس. حتى يراجعه TikTok تُنشر المنشورات بشكل خاص فقط." },
  "note.x":           { en: "Needs a paid X API plan.", zh: "需要付费的 X API 套餐。", ar: "يحتاج اشتراكًا مدفوعًا في X API." },
  "note.manual":      { en: "No posting API: the Hub prepares each post and you share it with one tap.", zh: "没有发布接口：Hub 会准备好每条帖子，由您一键分享。", ar: "لا توجد واجهة نشر: يجهّز الـHub كل منشور وتشاركه أنت بضغطة واحدة." },
  "manual.title":     { en: "Add a {platform} account", zh: "添加{platform}账号", ar: "إضافة حساب {platform}" },
  "manual.name":      { en: "Account name", zh: "账号名称", ar: "اسم الحساب" },
  "manual.handle":    { en: "Username (optional)", zh: "用户名（选填）", ar: "اسم المستخدم (اختياري)" },
  "manual.link":      { en: "Profile link (optional)", zh: "主页链接（选填）", ar: "رابط الحساب (اختياري)" },
  "manual.add":       { en: "Add account", zh: "添加账号", ar: "إضافة الحساب" },
  "manual.errName":   { en: "Enter the account name.", zh: "请输入账号名称。", ar: "أدخل اسم الحساب." },
  "manual.errLink":   { en: "The link must start with https://", zh: "链接必须以 https:// 开头", ar: "يجب أن يبدأ الرابط بـ https://" },
  "manual.failed":    { en: "Could not add the account. Try again.", zh: "无法添加该账号，请重试。", ar: "تعذّرت إضافة الحساب. حاول مرة أخرى." },
  "kind.facebook":    { en: "Facebook Page", zh: "Facebook 主页", ar: "صفحة Facebook" },
  "kind.instagram":   { en: "Instagram account", zh: "Instagram 账号", ar: "حساب Instagram" },
  "kind.linkedin":    { en: "LinkedIn profile", zh: "LinkedIn 个人主页", ar: "حساب LinkedIn شخصي" },
  "li.only":          { en: "Publishing only", zh: "仅发布", ar: "للنشر فقط" },
  "li.until":         { en: "Publishing only · sign in again by {date}", zh: "仅发布 · 请在 {date} 前重新登录", ar: "للنشر فقط · أعد تسجيل الدخول قبل {date}" },
  "li.ended":         { en: "Publishing only · the key ended on {date}: sign in with LinkedIn again", zh: "仅发布 · 密钥已于 {date} 失效：请重新使用 LinkedIn 登录", ar: "للنشر فقط · انتهى المفتاح في {date}: سجّل الدخول بـ LinkedIn مرة أخرى" },
  "li.again":         { en: "Publishing only · LinkedIn refused the key: sign in with LinkedIn again", zh: "仅发布 · LinkedIn 拒绝了密钥：请重新使用 LinkedIn 登录", ar: "للنشر فقط · رفض LinkedIn المفتاح: سجّل الدخول بـ LinkedIn مرة أخرى" },
  "badge.manual":     { en: "Shared by hand", zh: "手动分享", ar: "مشاركة يدوية" },
  "status.connected":    { en: "Connected", zh: "已连接", ar: "مربوط" },
  "status.expired":      { en: "Key expired", zh: "密钥已过期", ar: "انتهى المفتاح" },
  "status.revoked":      { en: "Access removed", zh: "访问已撤销", ar: "أُلغي الوصول" },
  "status.error":        { en: "Needs attention", zh: "需要处理", ar: "يحتاج متابعة" },
  "status.disconnected": { en: "Removed", zh: "已移除", ar: "تمت الإزالة" },
  "lastSync":         { en: "Last synced {when}", zh: "上次同步：{when}", ar: "آخر مزامنة: {when}" },
  "ads.on":           { en: "Comments on ads: on", zh: "广告评论：已开启", ar: "تعليقات الإعلانات: مفعّلة" },
  "ads.until":        { en: "Comments on ads: on · new ads found until {date}", zh: "广告评论：已开启 · 可发现新广告至 {date}", ar: "تعليقات الإعلانات: مفعّلة · يجد الإعلانات الجديدة حتى {date}" },
  "ads.missing":      { en: "Comments on ads: add {perms} in Meta, then connect again", zh: "广告评论：请先在 Meta 添加 {perms}，再重新连接", ar: "تعليقات الإعلانات: أضف {perms} في Meta ثم أعد الربط" },
  "ads.lapsed":       { en: "Comments on ads: connect again to keep finding new Instagram ads", zh: "广告评论：请重新连接以继续发现新的 Instagram 广告", ar: "تعليقات الإعلانات: أعد الربط ليواصل إيجاد إعلانات Instagram الجديدة" },
  "ads.refused":      { en: "Comments on ads: Meta refused — {why}", zh: "广告评论：Meta 拒绝了——{why}", ar: "تعليقات الإعلانات: Meta رفضت — {why}" },
  "msg.on":           { en: "Messages: on", zh: "私信：已开启", ar: "الرسائل: مفعّلة" },
  "msg.missing":      { en: "Messages: add {perms} in Meta, then connect again", zh: "私信：请先在 Meta 添加 {perms}，再重新连接", ar: "الرسائل: أضف {perms} في Meta ثم أعد الربط" },
  "msg.refused":      { en: "Messages: Meta refused — {why}", zh: "私信：Meta 拒绝了——{why}", ar: "الرسائل: رفضت Meta — {why}" },
  "notSynced":        { en: "Not synced yet", zh: "尚未同步", ar: "لم تتم المزامنة بعد" },
  "open":             { en: "Open", zh: "打开", ar: "فتح" },
  "remove":           { en: "Remove", zh: "移除", ar: "إزالة" },
  "remove.title":     { en: "Remove {name}?", zh: "移除 {name}？", ar: "إزالة {name}؟" },
  "remove.body":      { en: "The Hub deletes its access key and the account leaves this list. Its posts and numbers stay as history, and you can add it again at any time.", zh: "Hub 将删除其访问密钥，该账号将从列表中移除。其帖子和数据会作为历史记录保留，您可以随时重新添加。", ar: "يحذف الـHub مفتاح الوصول ويختفي الحساب من القائمة. تبقى منشوراته وأرقامه كسجل، ويمكنك إضافته مرة أخرى في أي وقت." },
  "remove.failed":    { en: "Could not remove the account. Try again.", zh: "无法移除该账号，请重试。", ar: "تعذّرت إزالة الحساب. حاول مرة أخرى." },
  "cancel":           { en: "Cancel", zh: "取消", ar: "إلغاء" },
  "setup.title":      { en: "Server settings", zh: "服务器设置", ar: "إعدادات الخادم" },
  "setup.tokenKey":   { en: "Encryption key for the accounts' access keys", zh: "账号访问密钥的加密密钥", ar: "مفتاح تشفير مفاتيح الوصول للحسابات" },
  "setup.meta":       { en: "Meta app keys (App ID, App Secret, Configuration ID)", zh: "Meta 应用密钥（App ID、App Secret、Configuration ID）", ar: "مفاتيح تطبيق Meta (App ID وApp Secret وConfiguration ID)" },
  "setup.instagram":  { en: "Instagram app keys (Instagram App ID, App Secret)", zh: "Instagram 应用密钥（Instagram App ID、App Secret）", ar: "مفاتيح تطبيق Instagram (Instagram App ID وApp Secret)" },
  "setup.linkedin":   { en: "LinkedIn app keys (Client ID, Client Secret)", zh: "LinkedIn 应用密钥（Client ID、Client Secret）", ar: "مفاتيح تطبيق LinkedIn (Client ID وClient Secret)" },
  "setup.cron":       { en: "Key that protects scheduled publishing", zh: "保护定时发布的密钥", ar: "مفتاح حماية النشر المجدول" },
  "setup.cronNote":   { en: "Needed before scheduled posts, not for adding accounts.", zh: "定时发布前需要，添加账号时不需要。", ar: "مطلوب قبل النشر المجدول، وليس لإضافة الحسابات." },
  "setup.ok":         { en: "In place", zh: "已设置", ar: "جاهز" },
  "setup.missing":    { en: "Missing", zh: "缺失", ar: "ناقص" },
  "loadError":        { en: "Could not load the connected accounts.", zh: "无法加载已连接的账号。", ar: "تعذّر تحميل الحسابات المربوطة." },
  "retry":            { en: "Try again", zh: "重试", ar: "إعادة المحاولة" },
  "dismiss":          { en: "Dismiss", zh: "关闭", ar: "إغلاق" },
  "result.ok":        { en: "Added {n} accounts. Their posts are coming into the Feed now.", zh: "已添加 {n} 个账号。其帖子正在进入动态。", ar: "تمت إضافة {n} حساب. منشوراتها في طريقها إلى الـFeed الآن." },
  "result.okOne":     { en: "Added 1 account. Its posts are coming into the Feed now.", zh: "已添加 1 个账号。其帖子正在进入动态。", ar: "تمت إضافة حساب واحد. منشوراته في طريقها إلى الـFeed الآن." },
  "result.none":      { en: "Nothing new to add: the pages you chose are already connected (Koleex's stay in Social Marketing).", zh: "没有新账号可添加：所选主页已连接（Koleex 的主页保留在社交媒体营销中）。", ar: "لا جديد لإضافته: الصفحات التي اخترتها مربوطة بالفعل (صفحات Koleex تبقى في التسويق عبر السوشيال ميديا)." },
  "result.cancelled": { en: "Signing in was cancelled.", zh: "登录已取消。", ar: "أُلغي تسجيل الدخول." },
  "result.expired":   { en: "Signing in took too long or the page was reloaded. Try again.", zh: "登录超时或页面已刷新，请重试。", ar: "استغرق تسجيل الدخول وقتًا طويلًا أو أُعيد تحميل الصفحة. حاول مرة أخرى." },
  "result.failed":    { en: "The sign-in did not finish adding the accounts. Try again; if it happens again, check the Meta app settings.", zh: "登录未能完成账号添加。请重试；如仍失败，请检查 Meta 应用设置。", ar: "لم يُكمل تسجيل الدخول إضافة الحسابات. حاول مرة أخرى، وإذا تكرر راجع إعدادات تطبيق Meta." },
  "result.setup":     { en: "The Meta app keys or the encryption key are not in Vercel yet.", zh: "Vercel 中尚未设置 Meta 应用密钥或加密密钥。", ar: "لم تُضف مفاتيح تطبيق Meta أو مفتاح التشفير في Vercel بعد." },
  "result.denied":    { en: "You don't have permission to add accounts here.", zh: "您没有在此添加账号的权限。", ar: "ليس لديك صلاحية إضافة حسابات هنا." },
  "result.li.ok":     { en: "LinkedIn is connected. Posts can publish to it now — LinkedIn sends no posts or numbers back to the Hub.", zh: "LinkedIn 已连接。现在可以向其发布帖子——LinkedIn 不会向 Hub 回传帖子或数据。", ar: "تم ربط LinkedIn. يمكن النشر عليه الآن — ولا يرسل LinkedIn المنشورات أو الأرقام إلى الـ Hub." },
  "result.li.failed": { en: "The sign-in did not finish connecting LinkedIn. Try again; if it happens again, check the LinkedIn app's products and redirect URL.", zh: "登录未能完成 LinkedIn 连接。请重试；如仍失败，请检查 LinkedIn 应用的产品和重定向网址。", ar: "لم يُكمل تسجيل الدخول ربط LinkedIn. حاول مرة أخرى، وإذا تكرر راجع منتجات تطبيق LinkedIn ورابط إعادة التوجيه." },
  "result.li.setup":  { en: "The LinkedIn app keys or the encryption key are not in Vercel yet.", zh: "Vercel 中尚未设置 LinkedIn 应用密钥或加密密钥。", ar: "لم تُضف مفاتيح تطبيق LinkedIn أو مفتاح التشفير في Vercel بعد." },
};


const STATUS_TONE = {
  connected: "success",
  expired: "warning",
  revoked: "error",
  error: "error",
  disconnected: "neutral",
} as const;

const inputCls =
  "h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-focus)] focus:outline-none";

export default function ConnectedAccounts({ space }: { space: MarketingSpace }) {
  const { t } = useTranslation(T);
  const [accounts, setAccounts] = useState<MarketingAccountView[] | null>(null);
  const [setup, setSetup] = useState<MarketingSetup | null>(null);
  const [ads, setAds] = useState<Record<string, AdsState>>({});
  const [msgs, setMsgs] = useState<Record<string, MessagesState>>({});
  const [liStates, setLiStates] = useState<Record<string, LinkedInState>>({});
  const [canRemove, setCanRemove] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<{ code: ConnectResult; n: number; via: ConnectVia | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const [manual, setManual] = useState<MarketingPlatform | null>(null);
  const [form, setForm] = useState({ name: "", handle: "", link: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<MarketingAccountView | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/marketing/accounts?space=${space}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as {
        accounts: MarketingAccountView[]; ads?: Record<string, AdsState>; messages?: Record<string, MessagesState>; linkedin?: Record<string, LinkedInState>; setup: MarketingSetup;
        canRemove?: boolean;
      };
      setAccounts(body.accounts);
      setAds(body.ads ?? {});
      setMsgs(body.messages ?? {});
      setLiStates(body.linkedin ?? {});
      setCanRemove(body.canRemove === true);
      setSetup(body.setup);
    } catch {
      setLoadError(true);
    }
  }, [space]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Read the sign-in result from the address bar once, then drop it so a
     reload does not show the banner again. Read in an effect, never in a
     state initializer (a client navigation would hand it the old URL). */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("connect") as ConnectResult | null;
    if (!code || !CONNECT_RESULTS.includes(code)) return;
    setResult({ code, n: Number(params.get("accounts")) || 0, via: params.get("via") === "linkedin" ? "linkedin" : null });
    params.delete("connect");
    params.delete("accounts");
    params.delete("via");
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
  }, []);

  const metaReady = !!setup?.tokenKey && !!setup?.meta;

  const openAdd = () => {
    setManual(null);
    setForm({ name: "", handle: "", link: "" });
    setFormError(null);
    setAdding(true);
  };
  const signInWithMeta = () => {
    window.location.href = `/api/marketing/connect/meta/start?space=${space}`;
  };
  const igReady = !!setup?.tokenKey && !!setup?.instagram;
  const signInWithInstagram = () => {
    window.location.href = `/api/marketing/connect/instagram/start?space=${space}`;
  };
  const liReady = !!setup?.tokenKey && !!setup?.linkedin;
  const signInWithLinkedIn = () => {
    window.location.href = `/api/marketing/connect/linkedin/start?space=${space}`;
  };

  const addManual = async () => {
    if (!manual) return;
    const name = form.name.trim();
    const link = form.link.trim();
    if (!name) { setFormError(t("manual.errName")); return; }
    if (link && !/^https:\/\//i.test(link)) { setFormError(t("manual.errLink")); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/marketing/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space, platform: manual, name, handle: form.handle.trim(), profile_url: link }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setAdding(false);
      await load();
    } catch {
      setFormError(t("manual.failed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    setRemoveError(false);
    try {
      const res = await fetch(`/api/marketing/accounts/${confirm.id}/disconnect`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setConfirm(null);
      await load();
    } catch {
      setRemoveError(true);
    } finally {
      setBusy(false);
    }
  };

  const setupRows: Array<{ key: keyof MarketingSetup; label: string; note?: string }> = [
    { key: "tokenKey", label: t("setup.tokenKey") },
    { key: "meta", label: t("setup.meta") },
    { key: "cron", label: t("setup.cron"), note: t("setup.cronNote") },
    /* The CEO's Instagram signs in with Instagram Login, his LinkedIn with
       LinkedIn's app — each with its own keys. */
    ...(space === "ceo" ? [{ key: "instagram" as const, label: t("setup.instagram") }, { key: "linkedin" as const, label: t("setup.linkedin") }] : []),
  ];
  const kindOf = (a: MarketingAccountView) =>
    a.platform === "facebook" || a.platform === "instagram" || (a.platform === "linkedin" && a.connection === "api") ? t(`kind.${a.platform}`) : t(`pname.${a.platform}`);
  /* LinkedIn's sign-in speaks of LinkedIn (publishing only, no Feed). */
  const resultKey = (r: { code: ConnectResult; n: number; via: ConnectVia | null }) =>
    r.via === "linkedin" && (r.code === "ok" || r.code === "failed" || r.code === "setup") ? `result.li.${r.code}`
      : r.code === "ok" ? (r.n === 1 ? "result.okOne" : r.n === 0 ? "result.none" : "result.ok") : `result.${r.code}`;

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <MarketingHeader space={space} />

      {result && (
        <div
          role="status"
          className={`mt-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-[13px] ${
            result.code === "ok"
              ? "border-[#10B981]/35 bg-[#10B981]/10 text-[var(--text-primary)]"
              : "border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[var(--text-primary)]"
          }`}
        >
          <span>{t(resultKey(result)).replace("{n}", String(result.n))}</span>
          <button type="button" onClick={() => setResult(null)} className="shrink-0 text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            {t("dismiss")}
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-w-0 flex-col gap-4" data-kx-pane>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("accounts.title")}</h2>
            <Button type="button" onClick={openAdd}>{t("add.button")}</Button>
          </div>

          {loadError ? (
            <EmptyState
              title={t("loadError")}
              action={<Button type="button" variant="secondary" onClick={() => void load()}>{t("retry")}</Button>}
            />
          ) : accounts === null ? (
            <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-[92px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={<span className="inline-flex gap-2"><BrandGlyph name="facebook" size={22} /><BrandGlyph name="instagram" size={22} /><BrandGlyph name="linkedin" size={22} /></span>}
              title={t("accounts.empty")}
              hint={t("accounts.emptyHint")}
              action={<Button type="button" onClick={openAdd}>{t("add.button")}</Button>}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {accounts.map((a) => (
                <li key={a.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                  <div className="relative shrink-0">
                    {a.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.avatar_url} alt="" className="h-11 w-11 rounded-full bg-[var(--bg-surface-subtle)] object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-surface-subtle)]">
                        <BrandGlyph name={a.platform} size={20} />
                      </span>
                    )}
                    <span className="absolute -bottom-1 -end-1 rounded-full bg-[var(--bg-surface)] p-[2px]">
                      <BrandGlyph name={a.platform} size={14} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{a.name}</span>
                      {a.connection === "assisted"
                        ? <StatusPill tone="brand">{t("badge.manual")}</StatusPill>
                        : <StatusPill tone={STATUS_TONE[a.status]}>{t(`status.${a.status}`)}</StatusPill>}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-[var(--text-dim)]">
                      {kindOf(a)}{a.handle ? ` · @${a.handle}` : ""}
                    </div>
                    {a.connection === "api" && a.status === "expired" && pageAccessRemoved(a.last_error) && (
                      <div className="mt-0.5 text-[11px] text-[#F59E0B]">{t("removed.line")}</div>
                    )}
                    {a.connection === "api" && a.platform === "linkedin" ? (
                      <LinkedInLine state={liStates[a.id]} expired={a.status === "expired"} t={t} />
                    ) : a.connection === "api" && (
                      <div className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                        {a.last_synced_at ? t("lastSync").replace("{when}", dmyHm(a.last_synced_at)) : t("notSynced")}
                      </div>
                    )}
                    {a.connection === "api" && ads[a.id] && <AdsLine state={ads[a.id]} t={t} />}
                    {a.connection === "api" && msgs[a.id] && <MessagesLine state={msgs[a.id]} t={t} />}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {a.profile_url && (
                      <a href={a.profile_url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        {t("open")}
                      </a>
                    )}
                    {canRemove && (
                      <button type="button" onClick={() => { setRemoveError(false); setConfirm(a); }} className="text-[12px] font-medium text-[var(--text-dim)] hover:text-[#FF3333]">
                        {t("remove")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("setup.title")}</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {setupRows.map((row) => (
                <li key={row.key} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] leading-relaxed text-[var(--text-muted)]">{row.label}</div>
                    {row.note && <div className="text-[11px] text-[var(--text-dim)]">{row.note}</div>}
                  </div>
                  {setup ? (
                    <StatusPill tone={setup[row.key] ? "success" : "warning"}>{setup[row.key] ? t("setup.ok") : t("setup.missing")}</StatusPill>
                  ) : (
                    <span className="h-[22px] w-14 rounded-full bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title={t("add.title")} maxWidth="max-w-2xl">
        <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">{t("add.hint")}</p>
        {metaReady && <p className="rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-3 py-2 text-[12px] leading-relaxed text-[var(--text-primary)]">{t("add.keepAll")}</p>}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_ORDER.map((p) => {
            const flow = platformFlow(space, p);
            const disabled = flow === "soon" || (flow === "meta" && !metaReady) || (flow === "instagram" && !igReady) || (flow === "linkedin" && !liReady);
            const selected = manual === p;
            const note = flow === "manual" ? t("note.manual") : flow === "meta" && !metaReady ? t("add.needsKeys")
              : flow === "instagram" ? (igReady ? t("note.igLogin") : t("add.needsIgKeys"))
              : flow === "linkedin" ? (liReady ? t("note.liLogin") : t("add.needsLiKeys")) : t(`note.${p}`);
            const action = flow === "meta" ? t("add.signIn") : flow === "instagram" ? t("add.signInIg") : flow === "linkedin" ? t("add.signInLi")
              : flow === "manual" ? t("add.manual") : t("add.soon");
            return (
              <li key={p}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={flow === "manual" ? selected : undefined}
                  onClick={() => {
                    if (flow === "meta") signInWithMeta();
                    else if (flow === "instagram") signInWithInstagram();
                    else if (flow === "linkedin") signInWithLinkedIn();
                    else if (flow === "manual") { setManual(p); setFormError(null); }
                  }}
                  className={`flex h-full w-full flex-col items-start gap-2 rounded-xl border p-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] enabled:hover:border-[var(--border-focus)]"
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <BrandGlyph name={p} size={20} />
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">{t(`pname.${p}`)}</span>
                    </span>
                    <span className="text-[11px] font-medium text-[var(--text-dim)]">{action}</span>
                  </span>
                  <span className="text-[11px] leading-relaxed text-[var(--text-dim)]">{note}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {manual && (
          <form
            className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] p-4"
            onSubmit={(e) => { e.preventDefault(); void addManual(); }}
          >
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{t("manual.title").replace("{platform}", t(`pname.${manual}`))}</p>
            <label className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
              {t("manual.name")}
              <input id="mkt-manual-name" className={inputCls} value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
              {t("manual.handle")}
              <input id="mkt-manual-handle" className={inputCls} value={form.handle} maxLength={80} dir="ltr" onChange={(e) => setForm({ ...form, handle: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
              {t("manual.link")}
              <input id="mkt-manual-link" className={inputCls} value={form.link} maxLength={500} dir="ltr" inputMode="url" placeholder="https://" onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </label>
            {formError && <p role="alert" className="text-[12px] text-[#FF3333]">{formError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>{t("manual.add")}</Button>
              <Button type="button" variant="ghost" onClick={() => setManual(null)}>{t("cancel")}</Button>
            </div>
          </form>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>{t("add.close")}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={t("remove.title").replace("{name}", confirm?.name ?? "")}
        message={
          <>
            {t("remove.body")}
            {removeError && <span className="mt-2 block text-[#FF3333]">{t("remove.failed")}</span>}
          </>
        }
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

/* Comments on ads, in one line: on (Instagram: until when new ads are
   found), what to add in Meta, a reconnect, or Meta's refusal. */
function AdsLine({ state, t }: { state: AdsState; t: (k: string) => string }) {
  let line: string;
  if (state.error === "key_lapsed" || (!state.ready && state.missing.length === 0)) line = t("ads.lapsed");
  else if (!state.ready) line = t("ads.missing").replace("{perms}", state.missing.join(", "));
  else if (state.error) line = t("ads.refused").replace("{why}", state.error.slice(0, 120));
  else line = state.findUntil ? t("ads.until").replace("{date}", dmyHm(state.findUntil).slice(0, 10)) : t("ads.on");
  return <div className={`mt-0.5 text-[11px] ${state.ready && !state.error ? "text-[var(--text-dim)]" : "text-[#F59E0B]"}`}>{line}</div>;
}

/* A LinkedIn profile, in one line: publishing only (LinkedIn sends nothing
   back), and the day its key ends — or that it has (or LinkedIn refused it
   earlier), and to sign in again. */
function LinkedInLine({ state, expired, t }: { state: LinkedInState | undefined; expired: boolean; t: (k: string) => string }) {
  const ends = state?.endsAt ?? null;
  const date = ends ? dmyHm(ends).slice(0, 10) : "";
  const line = state?.ended ? t("li.ended").replace("{date}", date) : expired ? t("li.again")
    : ends ? t("li.until").replace("{date}", date) : t("li.only");
  return <div className={`mt-0.5 text-[11px] ${state?.ended || expired ? "text-[#F59E0B]" : "text-[var(--text-dim)]"}`}>{line}</div>;
}

/* Private messages, in one line: on, what to add in Meta, or Meta's refusal. */
function MessagesLine({ state, t }: { state: MessagesState; t: (k: string) => string }) {
  const line = !state.ready ? t("msg.missing").replace("{perms}", state.missing.join(", "))
    : state.error ? t("msg.refused").replace("{why}", state.error.slice(0, 120)) : t("msg.on");
  return <div className={`mt-0.5 text-[11px] ${state.ready && !state.error ? "text-[var(--text-dim)]" : "text-[#F59E0B]"}`}>{line}</div>;
}
