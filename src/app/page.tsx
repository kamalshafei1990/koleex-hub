"use client";

/* ---------------------------------------------------------------------------
   App Launcher — system-level 4-zone launcher.

   Zone A: Search (⌘K)
   Zone B: Favorites (compact row < 3, grid >= 3)
   Zone C: Recent (horizontal scrollable strip)
   Zone D: All Apps (category chips + flat grid)
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useRouter, usePathname } from "next/navigation";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import KoleexOrb, { type OrbState } from "@/components/ai/KoleexOrb";
import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import {
  APP_REGISTRY,
  ALL_APPS_CATEGORIES,
  getAppCategory,
  getActiveAppId,
  getAppBadge,
  type AppDef,
} from "@/lib/navigation";
import { getCurrentAccountIdSync, useCurrentAccount } from "@/lib/identity";
import { trackAppOpen } from "@/lib/app-launcher";
import { usePermittedModules } from "@/lib/use-scope";
import { getMeBootstrapLastError, retryMeBootstrap, useMeBootstrap } from "@/lib/me-bootstrap";
import { useShortcutHint } from "@/lib/ui/use-shortcut-hint";
import { fetchMyChannels, subscribeToMyChannels } from "@/lib/discuss";
import { fetchUnreadTaskCount, subscribeToInboxMessages } from "@/lib/inbox";


function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return "greeting.morning";
  if (h < 18) return "greeting.afternoon";
  return "greeting.evening";
}

/* Motivational quotes about work & life (general, not app-specific), localized
   (en / zh / ar). Same 40 entries per language, kept in the same order so the
   rotating index lines up across locales. The page picks the active pool. */
const DAILY_QUOTES: Record<string, string[]> = {
  en: [
    "Hard work beats talent when talent doesn't work hard, so show up every single day and let your effort speak for you.",
    "Success is not one great leap but the quiet sum of small efforts you repeat, faithfully, day after day after day.",
    "The only way to do truly great work is to love what you do, and to keep doing it long after the excitement fades.",
    "Dream as big as you dare and start as small as you must, but above everything else, find the courage to simply begin.",
    "Your future isn't waiting somewhere ahead of you; it is being built right now, quietly, by the choices you make today.",
    "Don't watch the clock and count the hours you have left — do what the clock does, and just keep moving forward.",
    "The harder you work for something, the greater the pride and the joy you will feel the moment you finally achieve it.",
    "Believe that you are truly capable, and you have already travelled half the distance toward whatever you set out to do.",
    "Opportunities rarely arrive on their own; far more often, they are created by the people brave enough to go looking.",
    "Discipline is the bridge that connects the goals you only imagine to the accomplishments you actually get to live.",
    "A little honest progress each day, however small it may seem, quietly adds up to results that will astonish you later.",
    "Work hard in silence, and let the quality of your results — not the volume of your words — make all of the noise.",
    "The secret of getting ahead is simply getting started, even before you feel completely ready to take the first step.",
    "Don't let your challenges decide the limit of who you become; instead, rise up and dare to challenge your own limits.",
    "Great things are never born inside the comfort zone, so be willing to step into the discomfort that real growth demands.",
    "Push yourself forward, because no one else is going to do it for you, and the effort you give is the gift you keep.",
    "Success will not come walking to your door; you have to decide where it lives and travel the whole way to meet it.",
    "Every expert you admire was once a clumsy beginner who simply refused to give up before they had a chance to improve.",
    "Stay patient, trust the long road you are walking, and remember that slow progress is still progress worth keeping.",
    "Wake up each morning with quiet determination, and go to bed each night with the deep satisfaction of effort well spent.",
    "If a goal does not challenge you in some real and uncomfortable way, then it almost certainly will not change you either.",
    "Become so good, so consistent, and so genuinely reliable at what you do that the world simply cannot afford to ignore you.",
    "Small, steady steps taken every single day will carry you much further than the giant leaps you only ever dream about.",
    "Don't stop running the moment you feel tired; stop only when the work is genuinely, honestly, and completely finished.",
    "The only limit that truly holds you back is the one you quietly agree to place upon yourself — so refuse to accept it.",
    "The hardest days are often the very ones that build the strongest people, so meet them with courage instead of fear.",
    "Focus on being truly productive rather than merely busy, because constant motion and real progress are not the same thing.",
    "Treat every single day as a blank canvas, and do the patient work to make it a small masterpiece you are proud of.",
    "The difference between the ordinary and the extraordinary is almost always found in that little bit of extra effort.",
    "Do something today, however small, that the person you become tomorrow will look back on and sincerely thank you for.",
    "Energy, patience, and stubborn persistence will, in the end, conquer nearly everything that once seemed impossible.",
    "Don't waste your wishes on the work being easier; spend your energy instead on becoming stronger and more capable.",
    "Success has a strange habit of arriving for the people who are far too busy doing the work to go chasing after it.",
    "The most reliable way to predict your future is to stop guessing about it and quietly get busy creating it yourself.",
    "Action is the foundation beneath every success — ideas may inspire you, but only doing the work will ever carry you.",
    "No matter how many times life knocks you down, the only number that truly matters is the one more time that you rise.",
    "Work for a cause you genuinely believe in rather than for the applause of others, and let purpose, not praise, drive you.",
    "Every great accomplishment, without a single exception, begins with the quiet, simple, and very brave decision to try.",
    "True quality is what you create when no one is watching, measured only by the high standards you refuse to lower.",
    "Believe in yourself and in everything you already are, then go and become everything you are still capable of being.",
  ],
  zh: [
    "当天赋不肯努力时，努力终将胜出；所以每一天都全力以赴，让你的付出替你说话。",
    "成功不是一次伟大的飞跃，而是你日复一日、忠实地重复着的那些微小努力的安静累积。",
    "做出真正伟大工作的唯一方法，就是热爱你所做的事，并在热情褪去之后依然坚持下去。",
    "敢想多大就想多大，必须多小就从多小开始，但最重要的，是找到迈出第一步的勇气。",
    "你的未来并不在前方某处等你，而是此刻正由你今天所做的每一个选择，悄悄地建造着。",
    "不要盯着时钟去数自己还剩多少小时——像时钟那样，只管不停地向前走。",
    "你为一件事付出得越多，真正达成它的那一刻，你所感到的骄傲与喜悦就越深。",
    "相信自己真的有能力做到，你便已经走完了通往目标的一半路程。",
    "机会很少自己降临，更多时候，是由那些有勇气主动去寻找的人亲手创造的。",
    "自律，是连接你所想象的目标与你真正得以实现的成就之间的那座桥梁。",
    "每天一点点真实的进步，无论看起来多么微小，都会在日后悄悄汇成令你惊叹的成果。",
    "在沉默中努力，让你成果的质量、而不是言语的多少，去发出所有的声音。",
    "领先的秘诀，不过是先开始——哪怕你还没完全准备好迈出第一步。",
    "别让困难来决定你能成为谁；相反，要挺身而起，敢于去挑战你自己的极限。",
    "伟大从不诞生于舒适区，所以请甘愿走进真正的成长所必需的那份不适之中。",
    "推动自己向前，因为没有人会替你这么做；而你付出的努力，正是你为自己留下的礼物。",
    "成功不会自己走到你门前；你得决定它住在哪里，然后走完全程去与它相遇。",
    "你所敬佩的每一位专家，都曾是笨拙的初学者，只是他们在进步之前从不肯放弃。",
    "保持耐心，信任你正在走的这条漫长道路，并记住：缓慢的进步，依然是值得珍惜的进步。",
    "每天清晨带着安静的决心醒来，每个夜晚带着付出之后那份深深的满足入睡。",
    "如果一个目标没有以某种真实而不适的方式挑战你，那它几乎也不会以任何持久的方式改变你。",
    "把你所做的事做到如此出色、如此稳定、如此可靠，让这个世界再也无法忽视你。",
    "每一天迈出的微小而坚定的步伐，会带你走得比你只敢空想的那些巨大飞跃更远。",
    "不要在感到疲惫的那一刻就停下；只有当工作真正、诚实、彻底地完成时，才停下来。",
    "真正困住你的唯一极限，是你默默同意加在自己身上的那一个——所以请拒绝接受它。",
    "最艰难的日子，往往正是造就最坚强的人的日子；所以请用勇气、而非恐惧去迎接它们。",
    "专注于真正的高效，而不只是看起来忙碌，因为不停的奔忙与真正的进步从来不是一回事。",
    "把每一天都当作一张空白的画布，用耐心去把它画成一幅你引以为傲的小小杰作。",
    "平凡与非凡之间的差别，几乎总是藏在那多付出的一点点努力里。",
    "今天去做一件事——哪怕很小——让明天的你回望时，会由衷地感谢今天的自己。",
    "精力、耐心与倔强的坚持，终将征服几乎一切曾经看似不可能的事情。",
    "别把愿望浪费在「但愿事情更容易」上；把你的精力用在让自己变得更强、更有能力上。",
    "成功有个奇怪的习惯：它总是降临在那些忙于做事、无暇去追逐它的人身上。",
    "预测你未来最可靠的方法，就是别再去猜测，而是安静地动手，亲自去创造它。",
    "行动是一切成功的根基——想法或许能激励你，但唯有真正动手去做，才能带你前行。",
    "无论生活把你击倒多少次，真正重要的，永远只是你再次站起来的那一次。",
    "为你所真正相信的事业而努力，而非为他人的掌声；让目标、而非赞美，驱动你前行。",
    "每一项伟大的成就，无一例外，都始于那个安静、简单而无比勇敢的决定：去尝试。",
    "真正的品质，是你在无人注视时所创造的东西，只以你拒绝降低的那份高标准来衡量。",
    "相信你自己以及你已然拥有的一切，然后去成为你仍有能力成为的那个自己。",
  ],
  ar: [
    "الاجتهاد يتغلّب على الموهبة حين لا تجتهد الموهبة؛ فاحضر كل يوم، ودَع جهدك يتحدّث عنك.",
    "النجاح ليس قفزةً واحدة كبرى، بل هو الحصيلة الهادئة لجهودٍ صغيرة تكرّرها بإخلاص يومًا بعد يوم.",
    "الطريق الوحيد للعمل العظيم حقًّا أن تحبّ ما تفعله، وأن تستمرّ فيه حتى بعد أن يخبو الحماس.",
    "احلم بقدر ما تجرؤ، وابدأ بأصغر ما تستطيع، ولكن قبل كل شيء، اعثر على شجاعة أن تبدأ.",
    "مستقبلك لا ينتظرك في مكانٍ ما أمامك، بل يُبنى الآن بهدوء عبر الخيارات التي تتّخذها اليوم.",
    "لا تراقب الساعة وتَعُدّ ما تبقّى لك من ساعات — افعل كما تفعل هي، وواصل التقدّم ببساطة.",
    "كلما اجتهدت أكثر لأجل شيء، كان فخرك وفرحتك أعظم في اللحظة التي تحقّقه فيها أخيرًا.",
    "آمِن بأنك قادر حقًّا، فتكون قد قطعت بالفعل نصف الطريق نحو كل ما عزمت على بلوغه.",
    "الفرص نادرًا ما تأتي وحدها؛ بل غالبًا ما يصنعها أولئك الشجعان بما يكفي للبحث عنها.",
    "الانضباط هو الجسر الذي يربط بين الأهداف التي تتخيّلها والإنجازات التي تعيشها فعلًا.",
    "تقدّمٌ بسيط وصادق كل يوم، مهما بدا ضئيلًا، يتراكم بهدوء ليصير نتائج تذهلك لاحقًا.",
    "اجتهد في صمت، ودَع جودة نتائجك — لا كثرة كلامك — هي التي تُحدث كل الضجيج.",
    "سرّ التقدّم ببساطة أن تبدأ، حتى قبل أن تشعر بأنك جاهز تمامًا لاتخاذ الخطوة الأولى.",
    "لا تدع تحدّياتك تقرّر مَن ستصبح؛ بل انهض وتجرّأ على أن تتحدّى حدودك أنت.",
    "الأشياء العظيمة لا تُولد داخل منطقة الراحة، فكن مستعدًّا لخوض ما يتطلّبه النموّ الحقيقي من مشقّة.",
    "ادفع نفسك إلى الأمام، فلن يفعل ذلك أحد غيرك، والجهد الذي تبذله هو الهدية التي تبقى لك.",
    "النجاح لن يأتي إلى بابك؛ عليك أن تقرّر أين يسكن، وأن تقطع الطريق كله للقائه.",
    "كل خبيرٍ تُعجَب به كان يومًا مبتدئًا أخرق، لكنه رفض ببساطة أن يستسلم قبل أن تتاح له فرصة التحسّن.",
    "تحلَّ بالصبر، وثِق بالطريق الطويل الذي تسلكه، وتذكّر أن التقدّم البطيء يظلّ تقدّمًا يستحقّ التمسّك به.",
    "استيقظ كل صباح بعزيمة هادئة، ونم كل ليلة برضا عميق عمّا بذلته من جهد.",
    "إن لم يتحدَّك الهدف بشكل حقيقي وغير مريح، فإنه على الأرجح لن يغيّرك بأي شكل دائم.",
    "كن بارعًا وثابتًا وموثوقًا حقًّا في عملك إلى حدٍّ يجعل العالم عاجزًا عن تجاهلك.",
    "الخطوات الصغيرة الثابتة التي تخطوها كل يوم ستحملك أبعد بكثير من القفزات الكبرى التي تكتفي بالحلم بها.",
    "لا تتوقّف في اللحظة التي تشعر فيها بالتعب؛ توقّف فقط حين يكتمل العمل حقًّا وبصدق وتمام.",
    "الحدّ الوحيد الذي يكبحك فعلًا هو ذاك الذي توافق بصمت على وضعه على نفسك — فارفض أن تقبله.",
    "أصعب الأيام غالبًا هي ذاتها التي تصنع أقوى الناس، فاستقبلها بالشجاعة لا بالخوف.",
    "ركّز على أن تكون منتجًا حقًّا لا مجرّد مشغول، فالحركة الدائمة والتقدّم الحقيقي ليسا الشيء ذاته.",
    "تعامل مع كل يوم كلوحة بيضاء، واعمل بصبر على أن تجعله تحفةً صغيرة تفخر بها.",
    "الفرق بين العادي والاستثنائي يكمن دائمًا تقريبًا في ذلك القدر الإضافي البسيط من الجهد.",
    "افعل اليوم شيئًا، مهما صغُر، يشكرك عليه الشخص الذي ستصبحه غدًا حين ينظر إلى الوراء.",
    "الطاقة والصبر والمثابرة العنيدة ستقهر في النهاية كل ما بدا ذات يوم مستحيلًا.",
    "لا تُهدر أمنياتك على أن يكون الأمر أسهل؛ أنفِق طاقتك على أن تصير أقوى وأكثر قدرة.",
    "للنجاح عادة غريبة: فهو يأتي لأولئك المنشغلين بالعمل أكثر من أن يلهثوا وراءه.",
    "أوثق وسيلة للتنبؤ بمستقبلك أن تكفّ عن تخمينه، وأن تنشغل بهدوء في صناعته بنفسك.",
    "الفعل هو الأساس الذي يقوم عليه كل نجاح؛ فالأفكار قد تُلهمك، لكن العمل وحده هو ما يحملك.",
    "مهما أسقطتك الحياة من مرّات، فالرقم الوحيد الذي يهمّ حقًّا هو مرّة النهوض الإضافية.",
    "اعمل من أجل قضية تؤمن بها حقًّا لا من أجل تصفيق الآخرين، ودَع الغاية لا المديح تقودك.",
    "كل إنجاز عظيم، بلا استثناء واحد، يبدأ بقرار هادئ وبسيط وشجاع للغاية: أن تحاول.",
    "الجودة الحقيقية هي ما تصنعه حين لا يراك أحد، ولا يقيسها سوى المعايير العالية التي ترفض خفضها.",
    "آمِن بنفسك وبكل ما أنت عليه الآن، ثم اذهب لتصبح كل ما لا تزال قادرًا على أن تكونه.",
  ],
};

/* ── Clock Widget: clean SF-style numeric clock ──
   Apple-flavoured: light-weight tabular numerals, monochrome, a softly
   blinking colon and quiet meta. Date above, timezone below. No skeuomorphism
   so it sits in the same material language as the rest of the launcher. */
function ClockWidget({ dk = true }: { dk?: boolean }) {
  const [t, setT] = useState<{ h12: string; mm: string; pm: boolean; blink: boolean }>({
    h12: "",
    mm: "",
    pm: false,
    blink: true,
  });
  const [tzLabel, setTzLabel] = useState("");
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h24 = now.getHours();
      const pm = h24 >= 12;
      let h = h24 % 12;
      if (h === 0) h = 12; // 12-hour clock
      setT({
        h12: h.toString(),
        mm: now.getMinutes().toString().padStart(2, "0"),
        pm,
        blink: now.getSeconds() % 2 === 0, // colon flashes each second
      });
      setDateLabel(
        now.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);

    /* Timezone label — e.g. "Dubai (GMT+4)" */
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const city = tz.split("/").pop()?.replace(/_/g, " ") || tz;
      const offset = -new Date().getTimezoneOffset();
      const sign = offset >= 0 ? "+" : "-";
      const hrs = Math.floor(Math.abs(offset) / 60);
      const mins = Math.abs(offset) % 60;
      const gmtStr = `GMT${sign}${hrs}${mins ? `:${mins.toString().padStart(2, "0")}` : ""}`;
      setTzLabel(`${city} (${gmtStr})`);
    } catch {
      setTzLabel("");
    }

    return () => clearInterval(id);
  }, []);

  return (
    <div className="shrink-0 hidden sm:flex flex-col items-center justify-center">
      {/* date sits above the time */}
      {dateLabel && (
        <span className={`mb-1.5 text-[12px] font-medium ${dk ? "text-white/45" : "text-black/45"}`}>
          {dateLabel}
        </span>
      )}

      {/* SF-style numerals: light weight, tabular, monochrome, softly blinking colon */}
      <div className="flex items-baseline gap-2">
        <span
          className={`text-[58px] md:text-[68px] font-light leading-none tracking-tight tabular-nums ${
            dk ? "text-white/90" : "text-black/90"
          }`}
        >
          {t.h12}
          <span
            className="mx-0.5 transition-opacity duration-300"
            style={{ opacity: t.blink ? 1 : 0.25 }}
          >
            :
          </span>
          {t.mm}
        </span>
        <span
          className={`mb-1.5 text-[14px] font-medium tracking-wide ${
            dk ? "text-white/40" : "text-black/40"
          }`}
        >
          {t.pm ? "PM" : "AM"}
        </span>
      </div>

      {tzLabel && (
        <span className={`mt-2 text-[11px] font-medium tracking-wide ${dk ? "text-white/30" : "text-black/35"}`}>
          {tzLabel}
        </span>
      )}
    </div>
  );
}

/* ── Full App Card (for grid) ── */
const AppCard = memo(function AppCard({
  app,
  t,
  isCurrentApp,
  appUnread,
  appUnreadNoun,
  dk,
  onAppClick,
  onPrefetch,
}: {
  app: AppDef;
  t: (key: string, fb: string) => string;
  isCurrentApp: boolean;
  appUnread: number;
  appUnreadNoun: string;
  dk: boolean;
  onAppClick: (app: AppDef) => void;
  onPrefetch: (app: AppDef) => void;
}) {
  const Icon = app.icon;
  const label = t(app.tKey, app.name);
  const isAi = app.id === "ai";
  const badge = getAppBadge(app);

  return (
    <div
      role="button"
      tabIndex={app.active ? 0 : -1}
      onClick={() => onAppClick(app)}
      onKeyDown={(e) => { if (e.key === "Enter") onAppClick(app); }}
      onPointerEnter={() => onPrefetch(app)}
      onTouchStart={() => onPrefetch(app)}
      onFocus={() => onPrefetch(app)}
      className={`relative flex flex-col items-center justify-center gap-2.5 p-3 aspect-square rounded-2xl transition-all duration-200 select-none outline-none focus-visible:ring-2 ${
        dk ? "focus-visible:ring-white/35" : "focus-visible:ring-black/25"
      } ${
        isAi
          ? "ai-card-neon cursor-default"
          : app.active
            ? isCurrentApp
              ? `cursor-pointer group border ${
                  dk
                    ? "bg-white/[0.08] border-white/[0.18] hover:bg-white/[0.12] ring-1 ring-white/[0.08]"
                    : "bg-black/[0.05] border-black/[0.15] hover:bg-black/[0.08] ring-1 ring-black/[0.05]"
                }`
              : `cursor-pointer group border ${
                  dk
                    ? "bg-[#111] border-white/[0.06] hover:border-white/[0.18] hover:bg-[#1a1a1a] hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
                    : "bg-white border-black/[0.06] hover:border-black/[0.14] hover:bg-[#fafafa] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
                }`
            : `cursor-default border ${dk ? "bg-[#0c0c0c] border-white/[0.03]" : "bg-[#f8f8f8] border-black/[0.03]"}`
      }`}
    >

      {(badge === "new" || badge === "updated") && (
        <span
          className={`absolute top-2 start-2 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase pointer-events-none select-none whitespace-nowrap ${
            badge === "new"
              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
              : "bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40"
          }`}
          aria-label={badge === "new" ? "New app" : "Updated app"}
          title={badge === "new" ? "New app" : "Recently updated"}
        >
          {badge === "new" ? "NEW" : "UPDATED"}
        </span>
      )}
      <span className={`transition-all duration-200 ${
        isAi
          ? "opacity-100"
          : app.active
            ? dk ? "text-white opacity-100" : "text-black opacity-100"
            : dk ? "text-white opacity-[0.15]" : "text-black opacity-[0.15]"
      }`}
        style={isAi ? {
          filter:
            "drop-shadow(0 0 10px rgba(0,212,255,0.4)) drop-shadow(0 0 20px rgba(123,97,255,0.25))",
        } : undefined}
      >
        <span className="relative inline-flex">
          {appUnread > 0 && (
            <span
              className={`absolute -top-2 -end-2.5 z-10 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-[#FF3333] text-white text-[10px] font-bold leading-none ring-2 ${dk ? "ring-[#111]" : "ring-white"} pointer-events-none select-none`}
              aria-label={`${appUnread} unread`}
              title={`${appUnread} unread ${appUnreadNoun}${appUnread === 1 ? "" : "s"}`}
            >
              {appUnread > 99 ? "99+" : appUnread}
            </span>
          )}
          {(() => {
            if (isAi) {
              const AnimatedIcon = Icon as React.ComponentType<{
                size?: number;
                animated?: boolean;
                scaleClass?: string;
              }>;
              return <AnimatedIcon size={34} animated scaleClass="scale-100" />;
            }
            return <Icon size={34} />;
          })()}
        </span>
      </span>
      <span className={`text-[12px] font-medium text-center leading-tight transition-all duration-200 ${
        app.active
          ? isCurrentApp
            ? dk ? "text-white font-semibold" : "text-black font-semibold"
            : dk ? "text-white/90" : "text-black/90"
          : dk ? "text-white/15" : "text-black/15"
      }`}>
        {label}
      </span>
    </div>
  );
});

/* ── Compact horizontal card (for favorites row / recent strip) ── */
const CompactCard = memo(function CompactCard({
  app,
  t,
  dk,
  onAppClick,
  onPrefetch,
}: {
  app: AppDef;
  t: (key: string, fb: string) => string;
  dk: boolean;
  onAppClick: (app: AppDef) => void;
  onPrefetch: (app: AppDef) => void;
}) {
  const Icon = app.icon;
  const label = t(app.tKey, app.name);

  return (
    <div
      role="button"
      tabIndex={app.active ? 0 : -1}
      onClick={() => onAppClick(app)}
      onKeyDown={(e) => { if (e.key === "Enter") onAppClick(app); }}
      onPointerEnter={() => onPrefetch(app)}
      onTouchStart={() => onPrefetch(app)}
      onFocus={() => onPrefetch(app)}
      className={`relative flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl transition-all duration-200 shrink-0 select-none ${
        app.active
          ? `cursor-pointer group ${
              dk
                ? "bg-[#111] border-white/[0.06] hover:border-white/[0.18] hover:bg-[#1a1a1a] hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)]"
                : "bg-white border-black/[0.06] hover:border-black/[0.14] hover:bg-[#fafafa] hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
            }`
          : `cursor-default opacity-20 ${dk ? "bg-[#0e0e0e] border-white/[0.02]" : "bg-[#f5f5f5] border-black/[0.02]"}`
      }`}
    >
      <span className={`transition-all duration-200 ${
        app.active
          ? dk ? "text-white opacity-100" : "text-black opacity-100"
          : dk ? "text-white opacity-25" : "text-black opacity-25"
      }`}>
        <Icon size={17} />
      </span>
      <span className={`text-[12px] font-medium whitespace-nowrap transition-colors duration-200 ${
        app.active
          ? dk ? "text-white/90" : "text-black/90"
          : dk ? "text-white/25" : "text-black/25"
      }`}>
        {label}
      </span>
    </div>
  );
});

/* Module-scope guard so the tile entrance animation plays once per full page
   load, then is permanently disabled — not every time the grid re-renders or
   remounts (which was making it loop). The flag is flipped when the intro
   ENDS, so re-mounts during the brief intro window don't trap it on. */
let kxIntroDone = false;

/* ── AI Greeter (Isolated to prevent typing from re-rendering the whole page) ── */
const AIGreeter = memo(function AIGreeter({
  dk,
  firstName,
  t,
  lang,
}: {
  dk: boolean;
  firstName: string | null;
  t: (key: string, fb: string) => string;
  lang: string;
}) {
  const greetingText = `${t(getGreetingKey(), "")}${firstName ? `, ${firstName}` : ""}`;
  const [greet, setGreet] = useState(0);
  const [typed, setTyped] = useState("");
  const [introDone, setIntroDone] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [quote, setQuote] = useState("");
  const [quoteTyped, setQuoteTyped] = useState("");

  useEffect(() => {
    const pool = DAILY_QUOTES[lang] ?? DAILY_QUOTES.en;
    let i = Math.floor(Date.now() / 45_000) % pool.length;
    setQuote(pool[i]);
    const id = setInterval(() => {
      i = (i + 1) % pool.length;
      setQuote(pool[i]);
    }, 45_000);
    return () => clearInterval(id);
  }, [lang]);

  const quoteTyping = quoteTyped.length < quote.length;
  useEffect(() => {
    if (!introDone || !quote) return;
    setQuoteTyped("");
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      i += 1;
      setQuoteTyped(quote.slice(0, i));
      if (i < quote.length) timer = setTimeout(step, 26 + Math.random() * 42);
    };
    timer = setTimeout(step, 220);
    return () => clearTimeout(timer);
  }, [quote, introDone]);

  useEffect(() => {
    if (!greetingText) return;
    setTyped("");
    setIntroDone(false);
    let i = 0;
    let stepTimer: ReturnType<typeof setTimeout>;
    const step = () => {
      i += 1;
      setTyped(greetingText.slice(0, i));
      if (i < greetingText.length) {
        stepTimer = setTimeout(step, 45 + Math.random() * 50);
      } else {
        setIntroDone(true);
        setGreet((g) => g + 1);
        setCelebrating(true);
        stepTimer = setTimeout(() => setCelebrating(false), 1100);
      }
    };
    const startTimer = setTimeout(step, 550);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(stepTimer);
    };
  }, [greetingText]);

  const [spark, setSpark] = useState<OrbState | null>(null);
  useEffect(() => {
    if (!introDone) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const pool: OrbState[] = ["wink", "surprised", "celebrate", "success", "wink"];
    const schedule = () => {
      timer = setTimeout(
        () => {
          if (!alive) return;
          setSpark(pool[Math.floor(Math.random() * pool.length)]);
          timer = setTimeout(() => {
            if (!alive) return;
            setSpark(null);
            schedule();
          }, 1100);
        },
        6000 + Math.random() * 7000,
      );
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [introDone]);

  const orbState: OrbState = !introDone
    ? typed.length === 0
      ? "surprised"
      : "typing"
    : celebrating
      ? "celebrate"
      : spark ?? "idle";

  return (
    <>
      <KoleexOrb state={orbState} greetKey={greet} size={72} className="shrink-0 hidden sm:block" />
      <div
        className="relative min-w-0 w-full rounded-2xl px-4 py-3 md:px-5 md:py-3.5"
        style={{
          background: dk
            ? "linear-gradient(180deg,#15151c,#0c0c11)"
            : "linear-gradient(180deg,#ffffff,#f4f5f7)",
          border: dk
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(0,0,0,0.08)",
          boxShadow: dk
            ? "0 1px 0 rgba(255,255,255,0.04) inset, 0 0 30px -14px rgba(139,92,246,.30)"
            : "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(0,0,0,.25)",
        }}
      >
        <h1
          aria-label={greetingText}
          className={`text-[22px] md:text-[30px] font-bold tracking-tight ${dk ? "text-white" : "text-black"}`}
        >
          <span aria-hidden>{typed || " "}</span>
          {!introDone && (
            <span
              aria-hidden
              className={`inline-block w-[2px] -mb-[2px] ms-[2px] h-[0.95em] align-middle animate-pulse ${dk ? "bg-white/70" : "bg-black/70"}`}
            />
          )}
        </h1>
        <div className={`transition-opacity duration-500 ${introDone ? "opacity-100" : "opacity-0"}`}>
          <p className={`text-[13px] md:text-[15px] mt-2 font-medium leading-snug min-h-[2.8em] ${dk ? "text-white/45" : "text-black/50"}`}>
            <span aria-hidden>{quoteTyped || " "}</span>
            {quoteTyping && (
              <span
                aria-hidden
                className={`inline-block w-[2px] -mb-[1px] ms-[2px] h-[0.9em] align-middle animate-pulse ${dk ? "bg-white/50" : "bg-black/50"}`}
              />
            )}
          </p>
        </div>
      </div>
    </>
  );
});

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useTranslation(hubT);
  const currentAppId = getActiveAppId(pathname);
  const { account } = useCurrentAccount();

  /* One-shot intro motion: on for the first load only (initializer reads the
     module guard so any later mount starts already-off), then switched off
     after the animation window and the guard latched so it never replays. */
  const [introMotion, setIntroMotion] = useState(() => !kxIntroDone);
  useEffect(() => {
    if (!introMotion) return;
    const off = setTimeout(() => {
      kxIntroDone = true;
      setIntroMotion(false);
    }, 1000);
    return () => clearTimeout(off);
  }, [introMotion]);

  /* ── Derive user's first name for greeting ── */
  const firstName = useMemo(() => {
    if (!account) return null;
    if (account.person?.first_name) return account.person.first_name;
    if (account.person?.display_name) return account.person.display_name.split(" ")[0];
    if (account.person?.full_name) return account.person.full_name.split(" ")[0];
    if (account.username) return account.username;
    return null;
  }, [account]);

  /* ── Theme ── */
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("koleex-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as "light" | "dark";
      if (d) setTheme(d);
    };
    window.addEventListener("themechange", h);
    return () => window.removeEventListener("themechange", h);
  }, []);
  const dk = theme === "dark";

  /* ── Search + filter ── */
  const shortcut = useShortcutHint(); // platform-aware ⌘K / Ctrl K label + tooltip
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  /* ── Per-user data ── */
  const [dataLoaded, setDataLoaded] = useState(false);
  const accountIdRef = useRef<string | null>(null);
  /* Unread Discuss messages → notification badge on the Discuss app tile.
     Mirrors the NotificationBell source of truth (fetchMyChannels +
     subscribeToMyChannels + the "discuss:unread-changed" event) so the
     home badge stays in lock-step with the bell and the in-app sidebar. */
  const [discussUnread, setDiscussUnread] = useState(0);
  /* Unread task assignments → notification badge on the To-do app tile.
     Sourced from inbox_messages (category "task") which the todo
     assignment fan-out writes, so the count = "tasks assigned to me I
     haven't read". Kept live via inbox realtime + the inbox recount
     event + a slow poll, mirroring the Discuss badge below. */
  const [todoUnread, setTodoUnread] = useState(0);

  useEffect(() => {
    const id = getCurrentAccountIdSync();
    accountIdRef.current = id;
    setDataLoaded(true);
  }, []);

  /* ── Discuss unread badge ──
     Recompute the total across all my channels, then keep it live via
     realtime inserts, the cross-component "discuss:unread-changed" event
     (fired when a channel is read to the bottom), and a slow poll that
     covers any realtime gaps. Cheap: one small query set per refresh. */
  useEffect(() => {
    const id = account?.id ?? getCurrentAccountIdSync();
    if (!id) return;
    let cancelled = false;

    const recount = async () => {
      try {
        const rows = await fetchMyChannels(id);
        if (cancelled) return;
        setDiscussUnread(rows.reduce((acc, c) => acc + (c.unread_count ?? 0), 0));
      } catch {
        /* keep prior count on transient failure */
      }
    };

    void recount();

    const unsubscribe = subscribeToMyChannels({
      onMessageInsert: (msg) => {
        if (msg.author_account_id === id) return;
        void recount();
      },
      onChannelChange: () => void recount(),
    });

    const onUnreadChanged = () => void recount();
    window.addEventListener("discuss:unread-changed", onUnreadChanged);

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void recount();
    }, 60_000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("discuss:unread-changed", onUnreadChanged);
      window.clearInterval(poll);
    };
  }, [account?.id]);

  /* ── To-do unread badge ──
     Count unread task-assignment inbox messages, kept live via the inbox
     realtime INSERT stream (recount only when a new TASK arrives), the
     shared "inbox:force-recount" event (fired when a task is read/edited),
     and a slow visible-tab poll. */
  useEffect(() => {
    const id = account?.id ?? getCurrentAccountIdSync();
    if (!id) return;
    let cancelled = false;

    const recount = async () => {
      try {
        const n = await fetchUnreadTaskCount(id);
        if (!cancelled) setTodoUnread(n);
      } catch {
        /* keep prior count on transient failure */
      }
    };

    void recount();

    const unsubscribe = subscribeToInboxMessages(id, (msg) => {
      if (msg.category === "task") void recount();
    });

    const onRecount = () => void recount();
    window.addEventListener("inbox:force-recount", onRecount);

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void recount();
    }, 60_000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("inbox:force-recount", onRecount);
      window.clearInterval(poll);
    };
  }, [account?.id]);

  /* ── Handlers ── */
  const handleAppClick = useCallback(
    (app: AppDef) => {
      if (!app.active) return;
      const id = accountIdRef.current;
      // trackAppOpen writes to the server async; the next time the user
      // lands on / the dashboard will re-fetch the updated recent list.
      // We intentionally do NOT call setRecentIds here — doing so causes
      // the "Recent" row to appear/grow on the current page, shifting
      // the click target down right before router.push navigates away,
      // which looks like the page auto-scrolls.
      if (id) trackAppOpen(id, app.id);
      router.push(app.route);
    },
    [router],
  );

  /* Warm a route's JS chunk + RSC payload BEFORE the user clicks, so opening
     an app is near-instant instead of cold-loading on tap. Guarded so each
     route is only prefetched once. */
  const prefetchedRef = useRef<Set<string>>(new Set());
  const prefetchApp = useCallback(
    (app: AppDef) => {
      if (!app.active || prefetchedRef.current.has(app.route)) return;
      prefetchedRef.current.add(app.route);
      try { router.prefetch(app.route); } catch { /* ignore */ }
    },
    [router],
  );

  /* ⌘K */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("hub-search")?.focus();
      }
      if (e.key === "Escape") setSearch("");
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  /* ── Role-based app visibility ──
     The app launcher honors the same permitted-modules rule as the
     sidebar: if the viewer's role has can_view = false on a module (or
     an account-level override hides it), that app is removed from the
     Launcher grid, favorites, recents, category groups, and search —
     not just the sidebar. SA still sees everything.

     While the permission check is still loading we show NOTHING
     (returned early by the grid render path below) — never the full
     catalogue, since that would briefly expose apps a user isn't
     allowed to see. */
  const { modules: permittedModules, loading: permLoading } =
    usePermittedModules();

  const { data: meBoot } = useMeBootstrap();
  const isSuperAdmin = !!meBoot?.isSuperAdmin;

  const visibleRegistry = useMemo(() => {
    // Fail-closed: while perms load, show no apps at all.
    if (permLoading) return [];
    return APP_REGISTRY.filter((a) => {
      if (a.hideFromLauncher) return false;
      // Super-Admin-only apps (e.g. Activity Monitor) gate on the bootstrap flag,
      // not on a module permission name.
      if (a.superAdminOnly) return isSuperAdmin;
      return permittedModules.has(a.name);
    });
  }, [permLoading, permittedModules, isSuperAdmin]);

  /* ── Derived ── */
  const filteredApps = useMemo(() => {
    let result = visibleRegistry;
    if (activeCategory !== "all")
      result = result.filter((a) => getAppCategory(a.id) === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.includes(q) ||
          t(a.tKey, a.name).toLowerCase().includes(q),
      );
    }
    return result;
  }, [search, activeCategory, t, visibleRegistry]);

  const isSearching = search.trim() !== "";
  const isFiltered = activeCategory !== "all";
  const isSearchOrFilter = isSearching || isFiltered;

  /* Group apps by category for the "All" view. Uses the role-filtered
     visibleRegistry so categories with no accessible apps disappear. */
  const groupedApps = useMemo(() => {
    if (isSearchOrFilter) return [];
    return ALL_APPS_CATEGORIES.map((cat) => ({
      ...cat,
      apps: visibleRegistry.filter((a) => getAppCategory(a.id) === cat.id),
    })).filter((g) => g.apps.length > 0);
  }, [isSearchOrFilter, visibleRegistry]);

  const dateLocale = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : "en-US";
  const today = new Date().toLocaleDateString(dateLocale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const activeCount = filteredApps.filter((a) => a.active).length;
  const totalCount = filteredApps.length;




  return (
    <div className={`${dk ? "bg-[#0A0A0A]" : "bg-white"} min-h-screen transition-colors duration-300`}>
      {/* Subtle staggered tile entrance — pure CSS, disabled for reduced-motion. */}
      <style>{`
        @keyframes kx-tile-in { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
        .kx-grid > * { animation: kx-tile-in .5s cubic-bezier(.22,.61,.36,1) both; }
        .kx-grid > *:nth-child(1){animation-delay:0s}
        .kx-grid > *:nth-child(2){animation-delay:.025s}
        .kx-grid > *:nth-child(3){animation-delay:.05s}
        .kx-grid > *:nth-child(4){animation-delay:.075s}
        .kx-grid > *:nth-child(5){animation-delay:.1s}
        .kx-grid > *:nth-child(6){animation-delay:.125s}
        .kx-grid > *:nth-child(7){animation-delay:.15s}
        .kx-grid > *:nth-child(8){animation-delay:.175s}
        .kx-grid > *:nth-child(n+9){animation-delay:.2s}
        @media (prefers-reduced-motion: reduce) { .kx-grid > * { animation: none; } }
      `}</style>
      <div className="px-4 md:px-10 py-5 md:py-6 pb-20 max-w-[1400px] mx-auto">

        {/* ── Header: Greeting + Clock + Date ── */}
        <div className="mb-5 md:mb-6 min-h-[160px] md:min-h-[180px] flex items-center">
          <div className="flex items-center justify-between gap-5 md:gap-8 w-full">
            <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
              <AIGreeter dk={dk} firstName={firstName} t={t} lang={lang} />
            </div>
            <ClockWidget dk={dk} />
          </div>
        </div>

        {/* ── Zone A: Search (primary action — elevated) ── */}
        <div className="mb-7">
          <div className={`relative flex items-center w-full h-14 border rounded-2xl px-5 gap-3.5 transition-all duration-200 focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.12)] ${
            dk
              ? "bg-white/[0.04] border-white/[0.07] focus-within:border-white/[0.22] focus-within:bg-white/[0.06]"
              : "bg-black/[0.02] border-black/[0.07] focus-within:border-black/[0.22] focus-within:bg-black/[0.04]"
          }`}>
            <SearchIcon size={19} className={dk ? "text-white/30" : "text-black/30"} />
            <input
              id="hub-search"
              type="text"
              placeholder={t("searchDesktop")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`flex-1 bg-transparent text-[15px] outline-none ${
                dk ? "text-white placeholder:text-white/30" : "text-black placeholder:text-black/30"
              }`}
            />
            {search && (
              <button onClick={() => setSearch("")} className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors ${
                dk ? "text-white/40 hover:text-white/70 hover:bg-white/[0.06]" : "text-black/40 hover:text-black/70 hover:bg-black/[0.06]"
              }`}>
                Clear
              </button>
            )}
            {/* Issue d54f3e66 (reopened): badge now shows the platform-
                correct key and carries a hover tooltip explaining what it
                does. Clicking it focuses the search input so it's usable
                without knowing the keyboard shortcut. */}
            <button
              type="button"
              onClick={() => document.getElementById("hub-search")?.focus()}
              title={shortcut.hint}
              aria-label={shortcut.hint}
              className={`hidden md:inline cursor-pointer text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
                dk ? "bg-white/[0.07] text-white/45 hover:text-white/80" : "bg-black/[0.06] text-black/45 hover:text-black/80"
              }`}
            >
              <kbd>{shortcut.label}</kbd>
            </button>
          </div>
        </div>


        {/* Mobile-resilience: while the permission bootstrap is in
            flight or has failed (timeout / 5xx / lost mobile signal),
            render a calm loading skeleton or a Retry banner instead
            of a silent empty grid. */}
        {permLoading ? (
          <AppGridSkeleton dk={dk} />
        ) : visibleRegistry.length === 0 ? (
          <BootstrapErrorBanner
            dk={dk}
            onRetry={async () => {
              await retryMeBootstrap();
              if (typeof window !== "undefined") window.location.reload();
            }}
          />
        ) : isSearchOrFilter ? (
          /* Flat grid when searching or filtering by category */
          <div className={`${introMotion ? "kx-grid " : ""}grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3`}>
            {filteredApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                t={t}
                isCurrentApp={currentAppId === app.id}
                appUnread={app.id === "discuss" ? discussUnread : app.id === "todo" ? todoUnread : 0}
                appUnreadNoun={app.id === "todo" ? "task" : "message"}
                dk={dk}
                onAppClick={handleAppClick}
                onPrefetch={prefetchApp}
              />
            ))}
          </div>
        ) : (
          /* Grouped by category when showing all */
          <div className="space-y-7">
            {groupedApps.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className={`text-[11px] font-semibold tracking-[1px] uppercase ${dk ? "text-white/25" : "text-black/25"}`}>
                    {t(group.tKey, group.label)}
                  </span>
                  <div className={`flex-1 h-px ${dk ? "bg-white/[0.04]" : "bg-black/[0.04]"}`} />
                </div>
                <div className={`${introMotion ? "kx-grid " : ""}grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3`}>
                  {group.apps.map((app) => (
                    <AppCard
                      key={app.id}
                      app={app}
                      t={t}
                      isCurrentApp={currentAppId === app.id}
                      appUnread={app.id === "discuss" ? discussUnread : app.id === "todo" ? todoUnread : 0}
                      appUnreadNoun={app.id === "todo" ? "task" : "message"}
                      dk={dk}
                      onAppClick={handleAppClick}
                      onPrefetch={prefetchApp}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI card animated neon border */}
      <style>{`
        @property --ai-card-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes ai-card-spin {
          0% { --ai-card-angle: 0deg; }
          100% { --ai-card-angle: 360deg; }
        }
        .ai-card-neon {
          animation: ai-card-spin 3s linear infinite;
          border: 1.5px solid transparent;
          background-origin: border-box;
          background-clip: padding-box, border-box;
          background-image:
            linear-gradient(${dk ? "#0c0c0c" : "#f8f8f8"}, ${dk ? "#0c0c0c" : "#f8f8f8"}),
            conic-gradient(
              from var(--ai-card-angle),
              rgba(0,212,255,0.6),
              rgba(123,97,255,0.6),
              rgba(255,110,199,0.5),
              rgba(0,212,255,0.15),
              rgba(123,97,255,0.6),
              rgba(0,212,255,0.6)
            );
          box-shadow:
            0 0 12px rgba(123,97,255,0.15),
            0 0 24px rgba(0,212,255,0.08);
        }
        .ai-card-neon:hover {
          box-shadow:
            0 0 16px rgba(123,97,255,0.25),
            0 0 32px rgba(0,212,255,0.15);
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}

/* ─── Mobile-resilience: loading + error states for the apps grid ─── */

function AppGridSkeleton({ dk }: { dk: boolean }) {
  /* Ghost cards so the page feels alive while permissions load.
     Replaces the previously silent empty area that left mobile
     operators staring at a blank screen on flaky connections. */
  const cellCls = dk ? "bg-white/[0.03] border-white/[0.04]" : "bg-black/[0.025] border-black/[0.05]";
  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 text-[11px] font-medium ${dk ? "text-white/30" : "text-black/30"}`}>
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400/70" />
        Loading your apps…
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-[1/1.1] rounded-2xl border ${cellCls} animate-pulse`}
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function BootstrapErrorBanner({ dk, onRetry }: { dk: boolean; onRetry: () => void }) {
  const err = getMeBootstrapLastError();
  const wasFailure = !!err;
  const isAuth = err?.kind === "http_401";
  return (
    <div
      className={`rounded-2xl border px-5 py-6 text-center ${
        wasFailure
          ? dk ? "border-amber-300/30 bg-amber-300/[0.04]" : "border-amber-600/30 bg-amber-50"
          : dk ? "border-white/[0.06] bg-white/[0.012]" : "border-black/[0.06] bg-black/[0.01]"
      }`}
    >
      <div className={`text-[13px] font-semibold ${dk ? "text-white/85" : "text-black/85"}`}>
        {wasFailure ? "We couldn't load your apps" : "No apps available for your account"}
      </div>
      <p className={`mt-1 text-[12px] ${dk ? "text-white/55" : "text-black/55"}`}>
        {wasFailure
          ? err!.message
          : "Your role doesn't have any modules enabled. Ask an admin to grant access."}
      </p>
      {wasFailure && err?.raw && (
        /* Diagnostic line — small, muted, so the operator can screenshot
           it for support without it dominating the panel. */
        <p className={`mt-1 text-[10.5px] ${dk ? "text-white/30" : "text-black/30"}`}>
          {err.kind}{err.status ? ` · ${err.status}` : ""}
        </p>
      )}
      {wasFailure && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {isAuth ? (
            <a
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-200 hover:bg-emerald-300/[0.16]"
            >
              Sign in again
            </a>
          ) : (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-200 hover:bg-emerald-300/[0.16]"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
