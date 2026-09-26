import type { Translations } from "@/lib/i18n";

/* Reports words — the first weeks' guide on the Reports home (staff
   readiness, owner's pick 26/09/2026): what someone owes from their start
   and when, how to write it quickly, and getting the reminder on their
   device. One file per place that reads them (26 Sep 2026): each screen
   imports only its own, and ../reports.ts spreads them all for the server.
   validate:reports §26 fails when a screen reads a word it did not import. */
export const reportGuideT: Translations = {
  "guide.title.soon": { en: "Your reports start {day}", zh: "你的报告从{day}开始", ar: "تقاريرك هتبدأ {day}" },
  "guide.title.now": { en: "Your reports have started", zh: "你的报告已经开始", ar: "تقاريرك بدأت" },
  "guide.daily": { en: "Daily report — every working day by {time}", zh: "日报——每个工作日 {time} 前", ar: "تقرير يومي — كل يوم شغل قبل الساعة {time}" },
  "guide.weekly": { en: "Weekly report — every {day} by {time}", zh: "周报——每{day} {time} 前", ar: "تقرير أسبوعي — يوم {day} من كل أسبوع قبل الساعة {time}" },
  "guide.monthly": { en: "Monthly report — by the 3rd working day of each month", zh: "月报——每月第 3 个工作日前", ar: "تقرير شهري — قبل تالت يوم شغل في كل شهر" },
  "guide.remind": { en: "If one isn't sent yet, Koleex Hub reminds you at {time}.", zh: "如果还没提交，Koleex Hub 会在 {time} 提醒你。", ar: "لو لسه ما اتبعتش، Koleex Hub هيفكّرك الساعة {time}." },
  "guide.how": { en: "It takes two minutes: tap the microphone and speak, or \"Write it\" fills the lists from your calendar and tasks. Check it, then \"Send report\".", zh: "只需两分钟：点麦克风直接说，或点「帮我写」根据你的日历和任务填好列表。检查后点「发送报告」。", ar: "بياخد دقيقتين: دوس على المايك واتكلم، أو «اكتبهولي» يملا القوايم من تقويمك ومهامك. راجعه وبعدين دوس «ابعت التقرير»." },
  "guide.push.title": { en: "Get the reminder on this device", zh: "在此设备上接收提醒", ar: "استلم التذكير على الجهاز ده" },
  "guide.push.offer": { en: "Turn on notifications so the reminder reaches you even when Koleex Hub is closed.", zh: "开启通知，即使 Koleex Hub 未打开也能收到提醒。", ar: "شغّل الإشعارات علشان التذكير يوصلك حتى لو Koleex Hub مقفول." },
  "guide.push.turnOn": { en: "Turn on notifications", zh: "开启通知", ar: "شغّل الإشعارات" },
  "guide.push.on": { en: "Notifications are on for this device.", zh: "此设备已开启通知。", ar: "الإشعارات شغالة على الجهاز ده." },
  "guide.push.install": { en: "On iPhone or iPad: add Koleex Hub to your Home Screen (Share → Add to Home Screen), open it from there, then turn notifications on.", zh: "iPhone 或 iPad：先把 Koleex Hub 添加到主屏幕（分享 → 添加到主屏幕），从主屏幕打开后再开启通知。", ar: "على الآيفون أو الآيباد: ضيف Koleex Hub للشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية)، افتحه من هناك، وبعدين شغّل الإشعارات." },
  "guide.push.denied": { en: "Notifications are blocked in this browser — allow them in its settings.", zh: "此浏览器已阻止通知——请在浏览器设置中允许。", ar: "الإشعارات مقفولة في المتصفح ده — اسمح بيها من إعداداته." },
  "guide.push.desktop": { en: "Open Koleex Hub on your phone too and turn notifications on there, so the reminder reaches you.", zh: "也请在手机上打开 Koleex Hub 并开启通知，以便收到提醒。", ar: "افتح Koleex Hub على موبايلك كمان وشغّل الإشعارات هناك، علشان التذكير يوصلك." },
  "guide.push.failed": { en: "Could not turn them on — try again.", zh: "无法开启——请重试。", ar: "ما اشتغلتش — جرّب تاني." },
  "guide.write": { en: "Write today's daily report", zh: "写今天的日报", ar: "اكتب تقرير النهارده" },
  "guide.gotIt": { en: "Got it", zh: "知道了", ar: "تمام" },
};
