"use client";

/* ---------------------------------------------------------------------------
   ConnectedAccounts — the accounts of one marketing space and the button that
   connects Facebook Pages with their Instagram accounts. Social Marketing
   renders it for 'company'; CEO Brand will render it for 'ceo'.

   The connect button is a plain navigation to /api/marketing/connect/meta/
   start, which returns here with ?connect=<result>. The result shows once
   as a banner and is then removed from the address bar, so a reload never
   repeats it. Access keys never reach this screen: /api/marketing/accounts
   sends names, handles and status only.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/kds/Button";
import StatusPill from "@/components/kds/StatusPill";
import EmptyState from "@/components/kds/EmptyState";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import {
  CONNECT_RESULTS,
  type ConnectResult, type MarketingAccountView, type MarketingSetup, type MarketingSpace,
} from "@/lib/marketing/spaces";

const T: Translations = {
  "title.company":    { en: "Social Marketing", zh: "社交媒体营销", ar: "التسويق عبر السوشيال ميديا" },
  "title.ceo":        { en: "CEO Brand", zh: "CEO 个人品牌", ar: "براند المدير التنفيذي" },
  "sub.company":      { en: "Koleex's pages and accounts, connected to the Hub", zh: "已连接到 Hub 的 Koleex 主页和账号", ar: "صفحات وحسابات كولكس المربوطة بالـHub" },
  "sub.ceo":          { en: "The CEO's own accounts, connected to the Hub", zh: "已连接到 Hub 的 CEO 个人账号", ar: "حسابات المدير التنفيذي المربوطة بالـHub" },
  "connect.title":    { en: "Connect Facebook & Instagram", zh: "连接 Facebook 和 Instagram", ar: "ربط Facebook وInstagram" },
  "connect.body":     { en: "In Facebook's window, choose the Koleex Page and its Instagram account. The Hub keeps their access keys encrypted, then brings in the earlier posts with their numbers.", zh: "在 Facebook 窗口中选择 Koleex 主页及其 Instagram 账号。Hub 会加密保存它们的访问密钥，然后导入以往的帖子及其数据。", ar: "في نافذة Facebook اختر صفحة كولكس وحساب Instagram المرتبط بها. يحفظ الـHub مفاتيح الوصول مشفّرة، ثم يجلب المنشورات السابقة بأرقامها." },
  "connect.button":   { en: "Connect Facebook & Instagram", zh: "连接 Facebook 和 Instagram", ar: "ربط Facebook وInstagram" },
  "connect.again":    { en: "Add or reconnect a Page", zh: "添加或重新连接主页", ar: "إضافة صفحة أو إعادة ربطها" },
  "connect.blocked":  { en: "The button works once the encryption key and the Meta app keys are in Vercel.", zh: "在 Vercel 中设置加密密钥和 Meta 应用密钥后，此按钮即可使用。", ar: "يعمل الزر بعد إضافة مفتاح التشفير ومفاتيح تطبيق Meta في Vercel." },
  "setup.title":      { en: "Server settings", zh: "服务器设置", ar: "إعدادات الخادم" },
  "setup.tokenKey":   { en: "Encryption key for the accounts' access keys", zh: "账号访问密钥的加密密钥", ar: "مفتاح تشفير مفاتيح الوصول للحسابات" },
  "setup.meta":       { en: "Meta app keys (App ID, App Secret, Configuration ID)", zh: "Meta 应用密钥（App ID、App Secret、Configuration ID）", ar: "مفاتيح تطبيق Meta (App ID وApp Secret وConfiguration ID)" },
  "setup.cron":       { en: "Key that protects scheduled publishing", zh: "保护定时发布的密钥", ar: "مفتاح حماية النشر المجدول" },
  "setup.ok":         { en: "In place", zh: "已设置", ar: "جاهز" },
  "setup.missing":    { en: "Missing", zh: "缺失", ar: "ناقص" },
  "setup.cronNote":   { en: "Needed before scheduled posts, not for connecting.", zh: "定时发布前需要，连接账号时不需要。", ar: "مطلوب قبل النشر المجدول، وليس للربط." },
  "accounts.title":   { en: "Connected accounts", zh: "已连接的账号", ar: "الحسابات المربوطة" },
  "accounts.empty":   { en: "No account connected yet", zh: "尚未连接任何账号", ar: "لا يوجد حساب مربوط بعد" },
  "accounts.emptyHint": { en: "Connect the Koleex Page and its Instagram account to begin.", zh: "连接 Koleex 主页及其 Instagram 账号即可开始。", ar: "اربط صفحة كولكس وحساب Instagram الخاص بها للبدء." },
  "platform.facebook":  { en: "Facebook Page", zh: "Facebook 主页", ar: "صفحة Facebook" },
  "platform.instagram": { en: "Instagram account", zh: "Instagram 账号", ar: "حساب Instagram" },
  "status.connected":    { en: "Connected", zh: "已连接", ar: "مربوط" },
  "status.expired":      { en: "Key expired", zh: "密钥已过期", ar: "انتهى المفتاح" },
  "status.revoked":      { en: "Access removed", zh: "访问已撤销", ar: "أُلغي الوصول" },
  "status.error":        { en: "Needs attention", zh: "需要处理", ar: "يحتاج متابعة" },
  "status.disconnected": { en: "Disconnected", zh: "已断开", ar: "مفصول" },
  "lastSync":         { en: "Last synced {when}", zh: "上次同步：{when}", ar: "آخر مزامنة: {when}" },
  "notSynced":        { en: "Not synced yet", zh: "尚未同步", ar: "لم تتم المزامنة بعد" },
  "open":             { en: "Open", zh: "打开", ar: "فتح" },
  "disconnect":       { en: "Disconnect", zh: "断开连接", ar: "فصل" },
  "disconnect.title": { en: "Disconnect {name}?", zh: "断开 {name}？", ar: "فصل {name}؟" },
  "disconnect.body":  { en: "The Hub deletes this account's access key. Its posts and numbers stay as history, and you can connect it again at any time.", zh: "Hub 将删除该账号的访问密钥。其帖子和数据会作为历史记录保留，您可以随时重新连接。", ar: "يحذف الـHub مفتاح الوصول لهذا الحساب. تبقى منشوراته وأرقامه كسجل، ويمكنك ربطه مرة أخرى في أي وقت." },
  "cancel":           { en: "Cancel", zh: "取消", ar: "إلغاء" },
  "disconnectFailed": { en: "Could not disconnect the account. Try again.", zh: "无法断开该账号，请重试。", ar: "تعذّر فصل الحساب. حاول مرة أخرى." },
  "loadError":        { en: "Could not load the connected accounts.", zh: "无法加载已连接的账号。", ar: "تعذّر تحميل الحسابات المربوطة." },
  "retry":            { en: "Try again", zh: "重试", ar: "إعادة المحاولة" },
  "dismiss":          { en: "Dismiss", zh: "关闭", ar: "إغلاق" },
  "result.ok":        { en: "Connected {n} accounts.", zh: "已连接 {n} 个账号。", ar: "تم ربط {n} حساب." },
  "result.cancelled": { en: "The connection was cancelled in Facebook's window.", zh: "已在 Facebook 窗口中取消连接。", ar: "أُلغي الربط من نافذة Facebook." },
  "result.expired":   { en: "The connection took too long or the page was reloaded. Try again.", zh: "连接超时或页面已刷新，请重试。", ar: "استغرق الربط وقتًا طويلًا أو أُعيد تحميل الصفحة. حاول مرة أخرى." },
  "result.failed":    { en: "Facebook did not complete the connection. Try again; if it happens again, check the Meta app settings.", zh: "Facebook 未完成连接。请重试；如仍失败，请检查 Meta 应用设置。", ar: "لم يُكمل Facebook الربط. حاول مرة أخرى، وإذا تكرر راجع إعدادات تطبيق Meta." },
  "result.setup":     { en: "The Meta app keys or the encryption key are not in Vercel yet.", zh: "Vercel 中尚未设置 Meta 应用密钥或加密密钥。", ar: "لم تُضف مفاتيح تطبيق Meta أو مفتاح التشفير في Vercel بعد." },
  "result.denied":    { en: "You don't have permission to connect accounts here.", zh: "您没有在此连接账号的权限。", ar: "ليس لديك صلاحية ربط الحسابات هنا." },
  "next.title":       { en: "Coming next, on these accounts", zh: "接下来将基于这些账号推出", ar: "القادم على هذه الحسابات" },
  "next.feed":        { en: "Feed: every post with its numbers, including the earlier ones", zh: "动态：每条帖子及其数据，包括以往的帖子", ar: "الـFeed: كل منشور بأرقامه، ومنها المنشورات السابقة" },
  "next.composer":    { en: "One post for several accounts, with captions from Koleex AI", zh: "一次发布到多个账号，并由 Koleex AI 撰写文案", ar: "منشور واحد لعدة حسابات، بتعليقات من Koleex AI" },
  "next.calendar":    { en: "Calendar and scheduling", zh: "日历与定时发布", ar: "التقويم وجدولة النشر" },
  "next.approval":    { en: "Approval by the CEO or the marketing manager before publishing", zh: "发布前由 CEO 或营销经理审批", ar: "موافقة المدير التنفيذي أو مدير التسويق قبل النشر" },
  "next.comments":    { en: "Replies to comments from the Hub", zh: "在 Hub 中回复评论", ar: "الرد على التعليقات من الـHub" },
};

function dmyHm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STATUS_TONE = {
  connected: "success",
  expired: "warning",
  revoked: "error",
  error: "error",
  disconnected: "neutral",
} as const;

export default function ConnectedAccounts({ space }: { space: MarketingSpace }) {
  const { t } = useTranslation(T);
  const [accounts, setAccounts] = useState<MarketingAccountView[] | null>(null);
  const [setup, setSetup] = useState<MarketingSetup | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<{ code: ConnectResult; n: number } | null>(null);
  const [confirm, setConfirm] = useState<MarketingAccountView | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/marketing/accounts?space=${space}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { accounts: MarketingAccountView[]; setup: MarketingSetup };
      setAccounts(body.accounts);
      setSetup(body.setup);
    } catch {
      setLoadError(true);
    }
  }, [space]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Read the connect result from the address bar once, then drop it so a
     reload does not show the banner again. Read in an effect, never in a
     state initializer (a client navigation would hand it the old URL). */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("connect") as ConnectResult | null;
    if (!code || !CONNECT_RESULTS.includes(code)) return;
    setResult({ code, n: Number(params.get("accounts")) || 0 });
    params.delete("connect");
    params.delete("accounts");
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
  }, []);

  const ready = !!setup?.tokenKey && !!setup?.meta;
  const live = (accounts ?? []).filter((a) => a.status !== "disconnected");
  const connect = () => {
    window.location.href = `/api/marketing/connect/meta/start?space=${space}`;
  };

  const disconnect = async () => {
    if (!confirm) return;
    setBusy(true);
    setActionError(false);
    try {
      const res = await fetch(`/api/marketing/accounts/${confirm.id}/disconnect`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setConfirm(null);
      await load();
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  };

  const titleIcon = space === "ceo" ? <CrownIcon size={16} /> : <Share2Icon size={16} />;
  const setupRows: Array<{ key: keyof MarketingSetup; label: string; note?: string }> = [
    { key: "tokenKey", label: t("setup.tokenKey") },
    { key: "meta", label: t("setup.meta") },
    { key: "cron", label: t("setup.cron"), note: t("setup.cronNote") },
  ];

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <PageHeader
        title={t(`title.${space}`)}
        subtitle={t(`sub.${space}`)}
        icon={titleIcon}
        backHref="/"
        showTabs={false}
      />

      {result && (
        <div
          role="status"
          className={`mt-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-[13px] ${
            result.code === "ok"
              ? "border-[#10B981]/35 bg-[#10B981]/10 text-[var(--text-primary)]"
              : "border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[var(--text-primary)]"
          }`}
        >
          <span>{t(`result.${result.code}`).replace("{n}", String(result.n))}</span>
          <button type="button" onClick={() => setResult(null)} className="shrink-0 text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            {t("dismiss")}
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col gap-6 min-w-0" data-kx-pane>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2" aria-hidden="true">
                <BrandGlyph name="facebook" size={28} />
                <BrandGlyph name="instagram" size={28} />
              </span>
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{t("connect.title")}</h2>
            </div>
            <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-[var(--text-muted)]">{t("connect.body")}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={connect} disabled={!ready}>
                {live.length ? t("connect.again") : t("connect.button")}
              </Button>
              {setup && !ready && <span className="text-[12px] text-[var(--text-dim)]">{t("connect.blocked")}</span>}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">{t("accounts.title")}</h2>
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
                icon={<span className="inline-flex gap-2"><BrandGlyph name="facebook" size={22} /><BrandGlyph name="instagram" size={22} /></span>}
                title={t("accounts.empty")}
                hint={t("accounts.emptyHint")}
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 min-w-0">
                    <div className="relative shrink-0">
                      {a.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover bg-[var(--bg-surface-subtle)]" />
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
                        <StatusPill tone={STATUS_TONE[a.status]}>{t(`status.${a.status}`)}</StatusPill>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-[var(--text-dim)]">
                        {t(`platform.${a.platform}`, a.platform)}{a.handle ? ` · @${a.handle}` : ""}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                        {a.last_synced_at ? t("lastSync").replace("{when}", dmyHm(a.last_synced_at)) : t("notSynced")}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {a.profile_url && (
                        <a href={a.profile_url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                          {t("open")}
                        </a>
                      )}
                      {a.status !== "disconnected" && (
                        <button type="button" onClick={() => { setActionError(false); setConfirm(a); }} className="text-[12px] font-medium text-[var(--text-dim)] hover:text-[#FF3333]">
                          {t("disconnect")}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6 min-w-0">
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

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("next.title")}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-[12px] leading-relaxed text-[var(--text-muted)]">
              <li>{t("next.feed")}</li>
              <li>{t("next.composer")}</li>
              <li>{t("next.calendar")}</li>
              <li>{t("next.approval")}</li>
              <li>{t("next.comments")}</li>
            </ul>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={t("disconnect.title").replace("{name}", confirm?.name ?? "")}
        message={
          <>
            {t("disconnect.body")}
            {actionError && <span className="mt-2 block text-[#FF3333]">{t("disconnectFailed")}</span>}
          </>
        }
        confirmLabel={t("disconnect")}
        cancelLabel={t("cancel")}
        busy={busy}
        onConfirm={() => void disconnect()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
