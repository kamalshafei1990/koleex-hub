/* ---------------------------------------------------------------------------
   sounds/catalog — every sound Koleex AI makes about itself, as notes.

   THE OWNER'S ASK (2026-09-12): "a sound system for the Koleex AI app —
   connected sound, cancel sound, error sound, thinking sound". He chose
   synthesis over files: nothing to download, nothing that can 404, nothing
   a slow link in mainland China can delay past the moment it is for, and
   no licence to anyone else's recording. The call already works this way
   (voice/tones.ts); this is that idea for the whole app.

   ONE FAMILY. Every cue is a few short sine notes on the same scale, quiet,
   under half a second, with the same fades — so they sound like one product
   rather than a drawer of ringtones. The grammar is deliberate and the
   suite pins it:
     · RISING means something began or is yours: ready, recovered, sent,
       online, done.
     · FALLING means something ended or was taken away: ended, cancelled,
       muted, deleted.
     · LOW AND DOUBLED means attention: error, denied, failed. A triangle
       wave gives those a little edge without becoming a buzzer.
     · A SINGLE SHORT TICK means acknowledgement: thinking, copied.
   The starting cue of a call keeps the exact notes the owner already
   approved (READY_TONE); everything else is built to sit beside it.

   PURE DATA. This file schedules nothing and knows nothing about the DOM;
   the player (voice/tones.ts scheduleTone) does the work, and the preview
   page (scripts/sounds-preview.ts) renders the same notes so what the owner
   hears on the test page is exactly what ships.
   --------------------------------------------------------------------------- */

import { READY_TONE, RECOVERED_TONE, type ToneNote } from "@/lib/voice/tones";

export type SoundGroup = "call" | "chat" | "dictation" | "actions" | "general";

export type SoundKey =
  | "call-dialing"
  | "call-ready"
  | "call-reconnecting"
  | "call-recovered"
  | "call-failed"
  | "call-end"
  | "mic-mute"
  | "mic-unmute"
  | "ptt-start"
  | "ptt-stop"
  | "thinking"
  | "pictures-shown"
  | "voice-switched"
  | "call-interrupted"
  | "summary-ready"
  | "message-sent"
  | "reply-received"
  | "generation-stopped"
  | "error"
  | "back-online"
  | "copied"
  | "attachment-ready"
  | "attachment-failed"
  | "dictation-start"
  | "dictation-stop"
  | "approval-needed"
  | "action-done"
  | "action-cancelled"
  | "action-denied"
  | "deleted";

export type SoundDef = {
  key: SoundKey;
  group: SoundGroup;
  /** What the sound means, in the three product languages. */
  label: { en: string; zh: string; ar: string };
  /** When it plays, for the preview page and the settings sheet. */
  when: { en: string; zh: string; ar: string };
  notes: readonly ToneNote[];
  /** Whether the default is ON. A cue that would fire on every turn of a
   *  conversation (thinking, sent, received) starts off; the owner decides. */
  defaultOn: boolean;
};

/* The scale. Named so a recipe reads as music, not as a table of hertz. */
const A4 = 440;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;
const A6 = 1760;
const C7 = 2093;
const E7 = 2637;

/** The longest any cue may run, fades included. A cue is a cue. */
export const SOUND_MAX_SECONDS = 1.0;

export const SOUND_CATALOG: readonly SoundDef[] = [
  /* ── The call ─────────────────────────────────────────────────────── */
  {
    key: "call-dialing",
    group: "call",
    label: { en: "Dialling", zh: "拨号中", ar: "بيتصل" },
    when: { en: "The moment you tap to start a call", zh: "点按开始通话的那一刻", ar: "أول ما تدوس عشان تبدأ المكالمة" },
    /* Two soft pulses on one note, like a line being picked up. */
    notes: [
      { freq: E6, at: 0, dur: 0.08, level: 0.7 },
      { freq: E6, at: 0.22, dur: 0.08, level: 0.7 },
    ],
    defaultOn: true,
  },
  {
    key: "call-ready",
    group: "call",
    label: { en: "Ready to hear you", zh: "可以说话了", ar: "جاهز يسمعك" },
    when: { en: "The call is up and listening", zh: "通话已接通并在聆听", ar: "المكالمة اتوصلت وبيسمعك" },
    notes: READY_TONE,
    defaultOn: true,
  },
  {
    key: "call-reconnecting",
    group: "call",
    label: { en: "Line dropped, reconnecting", zh: "线路中断，重连中", ar: "الخط وقع وبيحاول يرجع" },
    when: { en: "The connection was lost and is being redialled", zh: "连接丢失，正在重新拨号", ar: "الاتصال اتقطع وبيعيد الاتصال" },
    /* One note settling downward: something slipped, not over yet. */
    notes: [{ freq: A5, at: 0, dur: 0.22, glideTo: G5 }],
    defaultOn: true,
  },
  {
    key: "call-recovered",
    group: "call",
    label: { en: "Line is back", zh: "线路恢复", ar: "الخط رجع" },
    when: { en: "The dropped connection came back", zh: "中断的连接已恢复", ar: "الاتصال اللي وقع رجع تاني" },
    notes: RECOVERED_TONE,
    defaultOn: true,
  },
  {
    key: "call-failed",
    group: "call",
    label: { en: "Call failed", zh: "通话失败", ar: "المكالمة فشلت" },
    when: { en: "The call could not start or could not be recovered", zh: "通话无法开始或无法恢复", ar: "المكالمة ما قدرتش تبدأ أو ما رجعتش" },
    /* Two falling notes, the second lower: it is over, and not by choice. */
    notes: [
      { freq: E6, at: 0, dur: 0.14, glideTo: C6, wave: "triangle", level: 0.8 },
      { freq: A5, at: 0.18, dur: 0.22, glideTo: G5, wave: "triangle", level: 0.8 },
    ],
    defaultOn: true,
  },
  {
    key: "call-end",
    group: "call",
    label: { en: "Call ended", zh: "通话结束", ar: "المكالمة خلصت" },
    when: { en: "You ended the call", zh: "你结束了通话", ar: "أنت قفلت المكالمة" },
    /* The ready cue in reverse: three notes stepping down the same triad. */
    notes: [
      { freq: E7, at: 0, dur: 0.07 },
      { freq: C7, at: 0.075, dur: 0.07 },
      { freq: G6, at: 0.15, dur: 0.22, glideTo: E6 },
    ],
    defaultOn: true,
  },
  {
    key: "mic-mute",
    group: "call",
    label: { en: "Microphone off", zh: "麦克风关闭", ar: "المايك اتقفل" },
    when: { en: "You muted yourself on a call", zh: "你在通话中静音", ar: "كتمت المايك أثناء المكالمة" },
    notes: [{ freq: C6, at: 0, dur: 0.12, glideTo: A5 }],
    defaultOn: true,
  },
  {
    key: "mic-unmute",
    group: "call",
    label: { en: "Microphone on", zh: "麦克风开启", ar: "المايك اتفتح" },
    when: { en: "You unmuted yourself", zh: "你取消了静音", ar: "فتحت المايك تاني" },
    notes: [{ freq: A5, at: 0, dur: 0.12, glideTo: C6 }],
    defaultOn: true,
  },
  {
    key: "ptt-start",
    group: "call",
    label: { en: "Hold to talk: listening", zh: "按住说话：聆听中", ar: "اضغط وتكلم: بيسمعك" },
    when: { en: "You pressed and held the talk button", zh: "你按住了说话按钮", ar: "ضغطت مطوّل على زرار الكلام" },
    notes: [{ freq: G6, at: 0, dur: 0.08, glideTo: C7, level: 0.8 }],
    defaultOn: true,
  },
  {
    key: "ptt-stop",
    group: "call",
    label: { en: "Hold to talk: released", zh: "按住说话：已松开", ar: "اضغط وتكلم: سيبت الزرار" },
    when: { en: "You let go of the talk button", zh: "你松开了说话按钮", ar: "سيبت زرار الكلام" },
    notes: [{ freq: C7, at: 0, dur: 0.08, glideTo: G6, level: 0.8 }],
    defaultOn: true,
  },
  {
    key: "thinking",
    group: "call",
    label: { en: "Thinking", zh: "思考中", ar: "بيفكّر" },
    when: { en: "Koleex AI took your question and is working on it (once, not a loop)", zh: "Koleex AI 收到问题正在处理（只响一次）", ar: "Koleex AI أخد سؤالك وبيشتغل عليه (مرة واحدة، مش لوب)" },
    /* One very quiet tick, well under the assistant's voice. */
    notes: [{ freq: C7, at: 0, dur: 0.05, level: 0.35 }],
    defaultOn: false,
  },
  {
    key: "pictures-shown",
    group: "call",
    label: { en: "Pictures on screen", zh: "图片已显示", ar: "الصور ظهرت" },
    when: { en: "Product pictures appeared during the call", zh: "通话中出现了产品图片", ar: "صور المنتج ظهرت على الشاشة أثناء المكالمة" },
    notes: [
      { freq: C7, at: 0, dur: 0.06, level: 0.7 },
      { freq: E7, at: 0.07, dur: 0.1, level: 0.7 },
    ],
    defaultOn: true,
  },
  {
    key: "voice-switched",
    group: "call",
    label: { en: "Voice or line changed", zh: "音色或线路已更改", ar: "الصوت أو الخط اتغير" },
    when: { en: "You switched the voice or the line mid-call", zh: "你在通话中切换了音色或线路", ar: "غيّرت الصوت أو الخط أثناء المكالمة" },
    notes: [
      { freq: C6, at: 0, dur: 0.07 },
      { freq: E6, at: 0.08, dur: 0.07 },
      { freq: C6, at: 0.16, dur: 0.1 },
    ],
    defaultOn: true,
  },
  {
    key: "call-interrupted",
    group: "call",
    label: { en: "Call was cut off", zh: "通话被中断", ar: "المكالمة اتقطعت من الجهاز" },
    when: { en: "The device killed the call; a 'continue the call' button is offered", zh: "设备中断了通话，并提供“继续通话”按钮", ar: "الجهاز قطع المكالمة وفيه زرار «كمّل المكالمة»" },
    notes: [
      { freq: A5, at: 0, dur: 0.1, wave: "triangle", level: 0.7 },
      { freq: A5, at: 0.16, dur: 0.16, glideTo: G5, wave: "triangle", level: 0.7 },
    ],
    defaultOn: true,
  },
  {
    key: "summary-ready",
    group: "call",
    label: { en: "Call summary written", zh: "通话摘要已生成", ar: "ملخص المكالمة اتكتب" },
    when: { en: "The summary of the call landed in the thread", zh: "通话摘要已加入对话", ar: "ملخص المكالمة نزل في الشات" },
    /* A slow rising triad: something finished well. */
    notes: [
      { freq: C6, at: 0, dur: 0.1 },
      { freq: E6, at: 0.11, dur: 0.1 },
      { freq: G6, at: 0.22, dur: 0.3 },
    ],
    defaultOn: true,
  },

  /* ── The typed chat ───────────────────────────────────────────────── */
  {
    key: "message-sent",
    group: "chat",
    label: { en: "Message sent", zh: "消息已发送", ar: "الرسالة اتبعتت" },
    when: { en: "You sent a message", zh: "你发送了一条消息", ar: "بعتّ رسالة" },
    notes: [{ freq: G6, at: 0, dur: 0.07, glideTo: A6, level: 0.6 }],
    defaultOn: false,
  },
  {
    key: "reply-received",
    group: "chat",
    label: { en: "Reply arrived", zh: "回复已到达", ar: "الرد وصل" },
    when: { en: "Koleex AI finished a reply (useful when the app is not in front of you)", zh: "Koleex AI 完成了回复（当应用不在眼前时有用）", ar: "Koleex AI خلّص الرد (مفيد لو التطبيق مش قدامك)" },
    notes: [
      { freq: C7, at: 0, dur: 0.08, level: 0.7 },
      { freq: G6, at: 0.09, dur: 0.14, level: 0.7 },
    ],
    defaultOn: false,
  },
  {
    key: "generation-stopped",
    group: "chat",
    label: { en: "Stopped", zh: "已停止", ar: "وقّفت الرد" },
    when: { en: "You stopped a reply while it was being written", zh: "你在回复生成中停止了它", ar: "وقّفت الرد وهو بيتكتب" },
    notes: [{ freq: A5, at: 0, dur: 0.1, level: 0.7 }],
    defaultOn: true,
  },
  {
    key: "error",
    group: "chat",
    label: { en: "Something went wrong", zh: "出错了", ar: "حصل خطأ" },
    when: { en: "A reply failed or the connection was lost", zh: "回复失败或连接丢失", ar: "الرد فشل أو النت اتقطع" },
    notes: [
      { freq: D5, at: 0, dur: 0.12, wave: "triangle", level: 0.8 },
      { freq: D5, at: 0.16, dur: 0.14, wave: "triangle", level: 0.8 },
    ],
    defaultOn: true,
  },
  {
    key: "back-online",
    group: "chat",
    label: { en: "Back online", zh: "已恢复在线", ar: "النت رجع" },
    when: { en: "The connection came back", zh: "网络连接已恢复", ar: "الاتصال بالنت رجع" },
    notes: [
      { freq: G5, at: 0, dur: 0.09, glideTo: C6 },
      { freq: E6, at: 0.1, dur: 0.14 },
    ],
    defaultOn: true,
  },
  {
    key: "copied",
    group: "chat",
    label: { en: "Copied", zh: "已复制", ar: "اتنسخ" },
    when: { en: "Text was copied to the clipboard", zh: "文字已复制到剪贴板", ar: "النص اتنسخ" },
    notes: [{ freq: E7, at: 0, dur: 0.04, level: 0.5 }],
    defaultOn: false,
  },
  {
    key: "attachment-ready",
    group: "chat",
    label: { en: "File read", zh: "文件已读取", ar: "الملف اتقرا" },
    when: { en: "An attached file was read and is ready", zh: "附件已读取并准备就绪", ar: "الملف المرفق اتقرا وجاهز" },
    notes: [
      { freq: C6, at: 0, dur: 0.07 },
      { freq: G6, at: 0.08, dur: 0.12 },
    ],
    defaultOn: true,
  },
  {
    key: "attachment-failed",
    group: "chat",
    label: { en: "File refused", zh: "文件被拒绝", ar: "الملف اترفض" },
    when: { en: "An attached file could not be read", zh: "附件无法读取", ar: "الملف المرفق ما اتقراش" },
    notes: [{ freq: D5, at: 0, dur: 0.16, wave: "triangle", level: 0.8 }],
    defaultOn: true,
  },

  /* ── Dictation in the composer ────────────────────────────────────── */
  {
    key: "dictation-start",
    group: "dictation",
    label: { en: "Dictation started", zh: "开始听写", ar: "الإملاء بدأ" },
    when: { en: "The microphone started listening for dictation", zh: "麦克风开始听写", ar: "المايك بدأ يسمع الإملاء" },
    notes: [{ freq: G6, at: 0, dur: 0.08, glideTo: C7, level: 0.8 }],
    defaultOn: true,
  },
  {
    key: "dictation-stop",
    group: "dictation",
    label: { en: "Dictation sent", zh: "听写已发送", ar: "الإملاء اتبعت" },
    when: { en: "Dictation ended and the words were sent", zh: "听写结束并已发送", ar: "الإملاء خلص والكلام اتبعت" },
    notes: [{ freq: C7, at: 0, dur: 0.08, glideTo: G6, level: 0.8 }],
    defaultOn: true,
  },

  /* ── Tools and actions ────────────────────────────────────────────── */
  {
    key: "approval-needed",
    group: "actions",
    label: { en: "Your approval is needed", zh: "需要你的确认", ar: "محتاج موافقتك" },
    when: { en: "An action is waiting for your tap to confirm", zh: "一个操作正在等待你确认", ar: "فيه إجراء مستني منك تأكيد" },
    notes: [
      { freq: E6, at: 0, dur: 0.09 },
      { freq: E6, at: 0.12, dur: 0.09 },
      { freq: G6, at: 0.26, dur: 0.2 },
    ],
    defaultOn: true,
  },
  {
    key: "action-done",
    group: "actions",
    label: { en: "Done", zh: "已完成", ar: "تم" },
    when: { en: "An action was carried out (a quotation created, a task saved)", zh: "操作已完成（报价已创建、任务已保存）", ar: "الإجراء اتنفذ (عرض سعر اتعمل، مهمة اتحفظت)" },
    notes: [
      { freq: C6, at: 0, dur: 0.09 },
      { freq: E6, at: 0.1, dur: 0.09 },
      { freq: G6, at: 0.2, dur: 0.24, glideTo: A6 },
    ],
    defaultOn: true,
  },
  {
    key: "action-cancelled",
    group: "actions",
    label: { en: "Cancelled", zh: "已取消", ar: "اتلغى" },
    when: { en: "You cancelled an action before it ran", zh: "你在执行前取消了操作", ar: "لغيت الإجراء قبل ما يتنفذ" },
    notes: [{ freq: G6, at: 0, dur: 0.16, glideTo: E6 }],
    defaultOn: true,
  },
  {
    key: "action-denied",
    group: "actions",
    label: { en: "Not allowed", zh: "不允许", ar: "مش مسموح" },
    when: { en: "The action was refused by your permissions", zh: "操作因权限被拒绝", ar: "الإجراء اترفض بسبب الصلاحيات" },
    notes: [
      { freq: E5, at: 0, dur: 0.1, wave: "triangle", level: 0.8 },
      { freq: D5, at: 0.13, dur: 0.14, wave: "triangle", level: 0.8 },
    ],
    defaultOn: true,
  },

  /* ── General ──────────────────────────────────────────────────────── */
  {
    key: "deleted",
    group: "general",
    label: { en: "Deleted", zh: "已删除", ar: "اتمسح" },
    when: { en: "A conversation was deleted", zh: "对话已删除", ar: "المحادثة اتمسحت" },
    notes: [{ freq: C6, at: 0, dur: 0.2, glideTo: A4 }],
    defaultOn: true,
  },
];

/** The catalog by key, for a player asked for one sound. */
export function soundByKey(key: SoundKey): SoundDef {
  const def = SOUND_CATALOG.find((s) => s.key === key);
  if (!def) throw new Error(`unknown sound: ${key}`);
  return def;
}

/** Seconds a sound runs, fades included. Pure. */
export function soundLength(notes: readonly ToneNote[]): number {
  return notes.reduce((end, n) => Math.max(end, n.at + n.dur), 0);
}

/** The direction a cue's pitch takes from its first note to its last, the
 *  grammar the family is built on. Pure, so the suite can pin it. */
export function soundDirection(notes: readonly ToneNote[]): "rising" | "falling" | "flat" {
  if (notes.length === 0) return "flat";
  const first = notes[0].freq;
  const last = notes[notes.length - 1];
  const end = last.glideTo ?? last.freq;
  if (end > first * 1.02) return "rising";
  if (end < first * 0.98) return "falling";
  return "flat";
}
