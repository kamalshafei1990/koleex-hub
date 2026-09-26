"use client";

/* ---------------------------------------------------------------------------
   VoiceCallScreen — the call itself, not a button with a call behind it.

   WHY A SCREEN AND NOT A TOGGLE. A live call is a mode: the microphone is
   open, the far side may speak at any moment, and the composer underneath is
   not what the user is doing. A 36px button in a toolbar communicates none of
   that, which is what "I'm not satisfied with the interface" was about. This
   takes the screen for as long as the call lasts and gives it back on hang-up.

   THE ORB IS NOT NEW. `AIOrb` already had `listening` and `speaking` states
   and already accepted an `audioLevel` — the whole vocabulary existed and
   nothing was driving it. Bringing in an outside orb would have added a
   dependency, a second visual language, and a shape that does not belong to
   Koleex, to replace something already built for it.

   BRAND. Monochrome with one blue accent; spacing on the 8px grid; outline
   icons at a consistent stroke; no decorative colour. The single red is the
   functional danger colour and is used only on the control that ends the call.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ChosenOrb from "@/components/ai-orb/ChosenOrb";
import { useCallLevel } from "./useCallLevel";
import { useFocusTrap } from "./useFocusTrap";
import type { AIOrbState } from "@/components/ai-orb/ai-orb-types";
import VoiceTranscript, { PhotoTile } from "@/components/ai/VoiceTranscript";
import { type TranscriptLine, type TranscriptPhoto, type VoicePhase } from "@/lib/voice/events";
import { type Lang } from "@/lib/i18n";
import { type TalkMode } from "@/lib/voice/voice-pref";
import { KOLEEX_MODELS, KOLEEX_MODEL_INFO, type KoleexModelId } from "@/lib/ai/koleex-models";
import PhotoLightbox from "@/components/ai/PhotoLightbox";
import KoleexLogo from "@/components/layout/KoleexLogo";
import KeyboardIcon from "@/components/icons/ui/KeyboardIcon";
import { textDirection, textLang } from "@/lib/text-direction";
import { stripImageMarkdown } from "@/lib/voice/photos";


const COPY: Record<Lang, {
  connecting: string;
  connectingSlow: string;
  tryAgain: string;
  enableSound: string;
  reconnecting: string;
  listening: string;
  speaking: string;
  ready: string;
  end: string;
  mute: string;
  unmute: string;
  muted: string;
  searching: string;
  title: string;
  hint: string;
  voice: string;
  /* HOLD TO TALK (roadmap B2): the button, its held state, the caption
     between holds, the hint under the orb, and the mode picker's words. */
  holdToTalk: string;
  holdRelease: string;
  /* TODAY'S BRIEF (roadmap C4): the chip and the request it types into
     the call. */
  brief: string;
  briefRequest: string;
  /* A task waiting for the caller's tap (roadmap D1). */
  taskPreview: string;
  saveTask: string;
  cancelTask: string;
  taskSaved: string;
  taskFailed: string;
  /* A report draft waiting for the caller's tap (Reports 6B). */
  draftPreview: string;
  startDraft: string;
  draftSaved: string;
  goesTo: string;
  due: string;
  remind: string;
  forPeople: string;
  holdHint: string;
  modePick: string;
  modeHandsFree: string;
  modeHold: string;
  modeHint: string;
  /* SHORT FORMS FOR THE LABELS UNDER THE CONTROLS. Not the aria-labels: those
     say what the control DOES ("Unmute microphone") because a screen reader
     user has no icon to read. These name the control the way a phone does —
     one or two words that survive being set at 11px under a 56px circle. */
  micShort: string;
  /** Under the keyboard button that opens the type-in line. */
  typeShort: string;
  /** Under the settings button (it used to show the voice's name, which
   *  read as a label for a different control). */
  settingsShort: string;
  endShort: string;
  /* The far side has the turn and is composing — the gap the orb fills. */
  thinking: string;
  closePhoto: string;
  /* The two views, and how to get from one to the other. */
  showChat: string;
  showOrb: string;
  /* THE TYPED LANE INSIDE THE CALL. A placeholder, the send control's name,
     and what the screen says when text was typed before the call was up. */
  typePlaceholder: string;
  sendTyped: string;
  typedNotLive: string;
  /* The group name for the photo strip, and the alt text when a product has
     no name — a screen reader should hear what the pictures are. */
  photos: string;
  /* THE VOICE SHEET: its title, the note under the choices, and Close. */
  voicePick: string;
  voiceHint: string;
  voiceTapHint: string;
  voiceSampling: string;
  voiceSampleFailed: string;
  voiceUse: string;
  /** "Use {name}" once a voice other than the current one has been heard. */
  voiceUseNamed: string;
  voiceCurrent: string;
  /* THE TWO LANES' VOICES, under their own headings — the mainland line
     and the international line, never a vendor's name. And the note when
     the international line could not be reached and the call went on
     without it. */
  /** The model list in the call's settings (2026-09-23) — the Line
   *  control's successor: Blink is the mainland line, Deep the
   *  international one, Auto the line that works here. */
  modelPick: string;
  modelLineAuto: string;
  modelTextOnly: string;
  /** Under the status when the chosen model is Mind (text only). */
  mindCallNote: string;
  lineHint: string;
  /** The sheet holds voice, line and talk mode — it is the call's settings. */
  callSettings: string;
  laneMainland: string;
  laneInternational: string;
  laneUnreachable: string;
  close: string;
}> = {
  en: {
    connecting: "Connecting…",
    connectingSlow: "Still connecting — the voice service is slow right now…",
    tryAgain: "Try again",
    enableSound: "Turn on sound",
    reconnecting: "Connection unstable — reconnecting…",
    listening: "Listening",
    speaking: "Speaking",
    ready: "Go ahead",
    end: "End call",
    mute: "Mute microphone",
    unmute: "Unmute microphone",
    muted: "Microphone off",
    searching: "Looking it up…",
    title: "Voice call",
    hint: "Just talk. I answer when you pause.",
    voice: "Voice",
    thinking: "Thinking…",
    showChat: "Show conversation",
    showOrb: "Back to Koleex AI",
    closePhoto: "Close photo",
    micShort: "Mic",
    typeShort: "Type",
    settingsShort: "Settings",
    endShort: "End",
    typePlaceholder: "Type something into the call…",
    sendTyped: "Send typed message",
    typedNotLive: "The call is still connecting — try again in a moment.",
    photos: "Product photos",
    voicePick: "Choose a voice",
    voiceHint: "Switching takes a moment. The conversation carries on.",
    voiceTapHint: "Tap a voice to hear it, then choose. Switching takes a moment.",
    voiceSampling: "Playing a sample…",
    voiceSampleFailed: "Couldn't play a sample right now.",
    voiceUse: "Use this voice",
    voiceUseNamed: "Use {name}",
    voiceCurrent: "Current",
    modelPick: "Model",
    modelLineAuto: "Picks what works best on your network",
    modelTextOnly: "Text only — a call uses Auto",
    mindCallNote: "Koleex Mind is text only — this call is on Auto.",
    callSettings: "Call settings",
    lineHint: "Koleex Deep needs a network that reaches it. If it can't be reached, the call continues on Koleex Blink.",
    laneMainland: "Fastest in China",
    laneInternational: "The strongest",
    laneUnreachable: "Koleex Deep can't be reached from your network right now — continuing on Koleex Blink.",
    close: "Close",
    holdToTalk: "Hold to talk",
    holdRelease: "Let go when done",
    brief: "Today's brief",
    briefRequest: "Give me my brief for today: my meetings, tasks due, and what needs me first.",
    taskPreview: "New task",
    saveTask: "Save task",
    cancelTask: "Cancel",
    taskSaved: "Task saved",
    taskFailed: "Could not save it. Try again.",
    draftPreview: "New report draft",
    startDraft: "Start draft",
    draftSaved: "Draft started — open it in Reports",
    goesTo: "Goes to",
    due: "Due",
    remind: "Reminder",
    forPeople: "For",
    holdHint: "Hold the button while you speak, let go when you are done.",
    modePick: "How you talk",
    modeHandsFree: "Hands-free",
    modeHold: "Hold to talk",
    modeHint: "In a noisy place use Hold to talk: the microphone is open only while you hold.",
  },
  zh: {
    connecting: "正在连接…",
    connectingSlow: "仍在连接，语音服务现在有点慢…",
    tryAgain: "再试一次",
    enableSound: "打开声音",
    reconnecting: "网络不稳定，正在重新连接…",
    listening: "正在聆听",
    speaking: "正在回答",
    ready: "请讲",
    end: "结束通话",
    mute: "关闭麦克风",
    unmute: "打开麦克风",
    muted: "麦克风已关闭",
    searching: "正在查询…",
    title: "语音通话",
    hint: "直接说话，你一停下我就回答。",
    voice: "音色",
    thinking: "思考中…",
    showChat: "显示对话",
    showOrb: "返回 Koleex AI",
    closePhoto: "关闭图片",
    micShort: "麦克风",
    typeShort: "打字",
    settingsShort: "设置",
    endShort: "结束",
    typePlaceholder: "在通话中输入文字…",
    sendTyped: "发送文字",
    typedNotLive: "通话仍在连接中，请稍后再试。",
    photos: "产品图片",
    voicePick: "选择音色",
    voiceHint: "切换需要一点时间，对话会继续。",
    voiceTapHint: "点一下音色试听，再选择。切换需要一点时间。",
    voiceSampling: "正在播放试听…",
    voiceSampleFailed: "现在无法播放试听。",
    voiceUse: "使用这个音色",
    voiceUseNamed: "使用 {name}",
    voiceCurrent: "当前",
    modelPick: "模型",
    modelLineAuto: "自动选择最适合你网络的",
    modelTextOnly: "仅文字——通话使用自动",
    mindCallNote: "Koleex Mind 仅支持文字——本次通话使用自动。",
    callSettings: "通话设置",
    lineHint: "Koleex Deep 需要能连通它的网络；连不上时，通话会改用 Koleex Blink 继续。",
    laneMainland: "在中国最快",
    laneInternational: "最强",
    laneUnreachable: "当前网络无法连接 Koleex Deep，已改用 Koleex Blink 继续。",
    close: "关闭",
    holdToTalk: "按住说话",
    holdRelease: "说完松开",
    brief: "今日简报",
    briefRequest: "给我今天的简报：我的会议、到期的任务、以及最需要我先处理的事。",
    taskPreview: "新任务",
    saveTask: "保存任务",
    cancelTask: "取消",
    taskSaved: "任务已保存",
    taskFailed: "没保存成功，再试一次。",
    draftPreview: "新报告草稿",
    startDraft: "开始草稿",
    draftSaved: "草稿已创建——在“报告”中打开",
    goesTo: "发给",
    due: "截止",
    remind: "提醒",
    forPeople: "给",
    holdHint: "说话时按住按钮，说完松开。",
    modePick: "说话方式",
    modeHandsFree: "免提",
    modeHold: "按住说话",
    modeHint: "环境嘈杂时用「按住说话」：只有按住时麦克风才打开。",
  },
  ar: {
    connecting: "جارٍ الاتصال…",
    connectingSlow: "لسه بنحاول نتصل — خدمة الصوت بطيئة دلوقتي…",
    tryAgain: "جرّب تاني",
    enableSound: "شغّل الصوت",
    reconnecting: "الشبكة مش ثابتة — بنحاول نرجّع الاتصال…",
    listening: "بيسمعك",
    speaking: "بيتكلم",
    ready: "اتفضّل",
    end: "إنهاء المكالمة",
    mute: "اكتم الميكروفون",
    unmute: "شغّل الميكروفون",
    muted: "الميكروفون مقفول",
    searching: "بدوّر على المعلومة…",
    title: "مكالمة صوتية",
    hint: "اتكلم عادي، وأنا هرد لما تسكت.",
    voice: "الصوت",
    thinking: "بفكّر…",
    showChat: "عرض المحادثة",
    showOrb: "الرجوع لـ Koleex AI",
    closePhoto: "اقفل الصورة",
    micShort: "مايك",
    typeShort: "اكتب",
    settingsShort: "الإعدادات",
    endShort: "إنهاء",
    typePlaceholder: "اكتب حاجة في المكالمة…",
    sendTyped: "ابعت الرسالة المكتوبة",
    typedNotLive: "المكالمة لسه بتتصل — حاول كمان لحظة.",
    photos: "صور المنتج",
    voicePick: "اختار الصوت",
    voiceHint: "التبديل بياخد لحظة، والمحادثة بتكمل.",
    voiceTapHint: "دوس على صوت تسمعه، وبعدين اختاره. التبديل بياخد لحظة.",
    voiceSampling: "بيشغّل عيّنة…",
    voiceSampleFailed: "معرفتش أشغّل العيّنة دلوقتي.",
    voiceUse: "استخدم الصوت ده",
    voiceUseNamed: "استخدم {name}",
    voiceCurrent: "الحالي",
    modelPick: "الموديل",
    modelLineAuto: "بيختار الأنسب لشبكتك",
    modelTextOnly: "كتابة بس — المكالمة بتبقى على تلقائي",
    mindCallNote: "Koleex Mind كتابة بس — المكالمة دي على تلقائي.",
    callSettings: "إعدادات المكالمة",
    lineHint: "Koleex Deep محتاج شبكة توصل له. لو ما وصلش، المكالمة بتكمل على Koleex Blink.",
    laneMainland: "الأسرع في الصين",
    laneInternational: "الأقوى",
    laneUnreachable: "Koleex Deep مش واصل من شبكتك دلوقتي، كمّلنا على Koleex Blink.",
    close: "اقفل",
    holdToTalk: "اضغط واتكلم",
    holdRelease: "سيب لما تخلص",
    brief: "موجز النهاردة",
    briefRequest: "قولّي موجز النهاردة: اجتماعاتي، والمهام اللي مواعيدها النهاردة، وإيه اللي محتاجني الأول.",
    taskPreview: "مهمة جديدة",
    saveTask: "احفظ المهمة",
    cancelTask: "إلغاء",
    taskSaved: "المهمة اتحفظت",
    taskFailed: "ماتحفظتش. جرّب تاني.",
    draftPreview: "مسودة تقرير جديدة",
    startDraft: "ابدأ المسودة",
    draftSaved: "المسودة اتعملت — افتحها من التقارير",
    goesTo: "رايحة لـ",
    due: "موعدها",
    remind: "تذكير",
    forPeople: "لـ",
    holdHint: "اضغط على الزرار وانت بتتكلم، وسيبه لما تخلص.",
    modePick: "طريقة الكلام",
    modeHandsFree: "كلام حر",
    modeHold: "اضغط واتكلم",
    modeHint: "في المكان الدوشة استخدم «اضغط واتكلم»: الميكروفون بيفتح بس وانت ضاغط.",
  },
};

/** Past this many characters the caption may run over its three lines, so
 *  its top edge fades — earlier words leaving, not a cut. */
const CAPTION_FADE_AFTER = 110;

/** The orb's size on the call screen: its full 200px where there is room,
 *  down to 112px on a short screen. */
export const ORB_MAX = 200;
export const ORB_MIN = 112;
/** Room kept around the orb for its rings to swell into. */
const ORB_ROOM = 40;

/** The largest orb that fits a box of this size, rings included. A box not
 *  laid out yet (0×0) keeps the full size rather than collapsing to the
 *  minimum for one frame. */
export function fitOrb(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return ORB_MAX;
  const room = Math.floor(Math.min(width, height) - ORB_ROOM);
  return Math.max(ORB_MIN, Math.min(ORB_MAX, room));
}

export type VoiceCallScreenProps = {
  /** False while connecting — the orb wakes rather than pretending to listen. */
  live: boolean;
  /** The far side has accepted the session configuration and is listening as
   *  Koleex AI. Until then a live call still reads "connecting": the caption
   *  says "go ahead" at the same instant the tone sounds, not a beat before.
   *  Defaults to true for callers that do not track it. */
  ready?: boolean;
  /** The call is up but the network dropped underneath it and may come back.
   *  ITS OWN FLAG, not a shade of `live`: the screen must keep standing (the
   *  microphone is still held and the call is not over) while telling the user
   *  the truth, which "Listening" would not. */
  reconnecting?: boolean;
  phase: VoicePhase;
  /** 0..1 from whichever side is currently making sound. */
  audioLevel: number;
  lines: readonly TranscriptLine[];
  lang?: Lang;
  onEnd: () => void;
  /** Nothing you say is transmitted. The microphone stays open — see
   *  VoiceSession.setMuted for why that is the honest arrangement. */
  muted?: boolean;
  onToggleMute?: () => void;
  /** How the caller talks (roadmap B2). "hold" swaps the Mute control for a
   *  Hold-to-talk button and reads `muted` between holds as "Hold to talk"
   *  rather than "Microphone off": the microphone is closed on purpose. */
  talkMode?: TalkMode;
  onSelectTalkMode?: (mode: TalkMode) => void;
  /** The hold: true on press, false on release. The parent gates the
   *  microphone; the screen only reports the gesture. */
  onHold?: (held: boolean) => void;
  /** A lookup is running. Two seconds of silence on a call reads as a freeze;
   *  this is the difference between waiting and wondering. */
  searching?: boolean;
  /** Keys and labels only — the server's catalogue, never the vendor's ids.
   *  Empty means no picker is drawn: a control that cannot be used is noise. */
  voices?: readonly { key: string; label: string }[];
  selectedVoice?: string | null;
  /** The line the next call (or this one) is on — shown beside Auto, so
   *  the caller can see which line Auto found. */
  lane?: "rtc" | "ws";
  /** THE MODEL (2026-09-23), which on a call IS the line: Blink the
   *  mainland line, Deep the international one, Auto the lane rules'
   *  answer, Mind text only. Present, the sheet lists the models with the
   *  current one pressed; absent, no control (one line). */
  model?: KoleexModelId;
  onSelectModel?: (model: KoleexModelId) => void;
  /** The international line was asked for and did not answer; the call
   *  went on over the mainland line. Said under the status, once. */
  laneNote?: "international-unreachable" | null;
  /** Changing a voice restarts the call: the configuration is sent once per
   *  session, so a new one needs a new session. Said plainly in the UI rather
   *  than silently doing nothing until the next call. */
  onSelectVoice?: (key: string) => void;
  /** HEAR A VOICE BEFORE CHOOSING IT (owner, 2026-09-07). Present, a tap on a
   *  voice plays a sample and marks it as the candidate; a separate "Use
   *  this voice" confirms. Resolves once the sample has been heard, false
   *  when it could not be. Absent, a tap chooses at once, as before. */
  onPreviewVoice?: (key: string) => Promise<boolean>;
  /** The sheet closed or another voice was tapped: stop the sample. */
  onStopPreview?: () => void;
  /** Open the voice sheet from the first render — for tests and deep links;
   *  the caller opens it from the Voice control otherwise. */
  defaultVoiceSheetOpen?: boolean;
  /** Open the type-in line on first paint (a test, or a caller who was
   *  already typing when the screen remounted). */
  defaultTypingOpen?: boolean;
  /** Type into the call. Returns whether it went — false while the channel is
   *  not up yet, which the screen says rather than swallowing the text. Absent
   *  means no composer is drawn. */
  onSendText?: (text: string) => boolean;
  /** A write the model previewed, waiting for the caller's tap (roadmap D1).
   *  The screen shows what will be saved and two buttons; the parent carries
   *  the tap to the server. Nothing here decides anything. */
  pendingWrite?: { tool: string; args: Record<string, unknown>; message: string; preview?: Record<string, unknown> } | null;
  onConfirmWrite?: () => void;
  onCancelWrite?: () => void;
  writeBusy?: boolean;
  writeSaved?: boolean;
  /** Which write the last tap saved (a task, or a report draft — 6B). */
  writeSavedTool?: string | null;
  writeError?: boolean;
  /** The handshake has taken longer than usual: the caption says so. */
  connectingSlow?: boolean;
  /** One tap rebuilds a call whose handshake is slow. Absent, no control. */
  onRetry?: () => void;
  /** The speaker is held back by autoplay policy; a tap unlocks it. */
  soundBlocked?: boolean;
  onEnableSound?: () => void;
};

export default function VoiceCallScreen({
  live,
  ready = true,
  reconnecting = false,
  phase,
  audioLevel,
  lines,
  lang = "en",
  onEnd,
  muted = false,
  onToggleMute,
  talkMode = "hands-free",
  onSelectTalkMode,
  onHold,
  searching = false,
  voices = [],
  selectedVoice = null,
  onSelectVoice,
  onPreviewVoice,
  onStopPreview,
  onSendText,
  defaultVoiceSheetOpen = false,
  defaultTypingOpen = false,
  pendingWrite = null,
  onConfirmWrite,
  onCancelWrite,
  writeBusy = false,
  writeSaved = false,
  writeSavedTool = null,
  writeError = false,
  connectingSlow = false,
  laneNote = null,
  lane = "rtc",
  model = "auto",
  onSelectModel,
  onRetry,
  soundBlocked = false,
  onEnableSound,
}: VoiceCallScreenProps) {
  const copy = COPY[lang];
  /* THE VOICE SHEET — open or not. Chips in the bottom bar were the first
     picker; the owner: "I don't like this style, we need something more
     creative". Now a Voice control beside Mute opens a sheet where each
     voice is a small Koleex orb with its name — the product's own face,
     not a row of grey pills. */
  const [voiceSheet, setVoiceSheet] = useState(defaultVoiceSheetOpen);
  /* THE KEYBOARD STAYS ON THE CALL (audit, 2026-09-11). aria-modal was
     declared and focus went nowhere: the opener unmounted on connect, Tab
     reached the composer behind. The screen takes focus on mount and gives
     it back on hang-up; the sheet does the same over the screen. */
  const rootRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(rootRef, true);
  /* HOW LONG THE CONNECT HAS TAKEN, in seconds, shown beside the slow caption
     so a long wait is a number and not a feeling (audit, 2026-09-11). The
     timings themselves are unchanged: the mainland handshake has been slow
     and then succeeded, and a shorter cap would have cut those calls off. */
  const [connectingFor, setConnectingFor] = useState(0);
  useEffect(() => {
    if (live && ready) return;
    const t0 = Date.now();
    const tick = window.setInterval(() => setConnectingFor(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [live, ready]);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(sheetRef, voiceSheet, { initialFocus: "[data-sheet-close]" });
  /* SWIPE DOWN CLOSES THE SHEET. The drawn handle promised a gesture it did
     not have (audit, 2026-09-11). The header (handle + title) is the grab
     area, so the voices row keeps its horizontal scroll; past 80 px the
     sheet closes, else it springs back. */
  const sheetDragRef = useRef<{ y0: number; dy: number } | null>(null);
  const [sheetDy, setSheetDy] = useState(0);
  /* THE HOLD. Local, because it is a gesture in progress, not call state:
     the parent learns of it through onHold and owns the microphone. Every
     way a press can end releases it — pointer up, pointer cancel, capture
     lost, the key going up, the page going hidden — because a microphone
     left open by a press that never "ended" is the one failure this control
     cannot have. */
  const [holding, setHolding] = useState(false);
  const holdRef = useRef(false);
  const hold = useCallback((held: boolean) => {
    if (holdRef.current === held) return;
    holdRef.current = held;
    setHolding(held);
    onHold?.(held);
  }, [onHold]);
  useEffect(() => {
    if (talkMode !== "hold") return;
    const onHidden = () => { if (document.visibilityState === "hidden") hold(false); };
    const onBlur = () => hold(false);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onBlur);
      hold(false);
    };
  }, [talkMode, hold]);
  /* THE AUDITION. `candidate` is the voice last tapped and heard, drawn as
     chosen-looking so the eye follows the ear; `sampling` is the one whose
     sample is loading or playing; `sampleFailed` says so once, plainly. */
  const [candidate, setCandidate] = useState<string | null>(null);
  const [sampling, setSampling] = useState<string | null>(null);
  const [sampleFailed, setSampleFailed] = useState(false);
  const sampleRun = useRef(0);
  const closeVoiceSheet = useCallback(() => {
    setVoiceSheet(false);
    setCandidate(null);
    setSampling(null);
    setSampleFailed(false);
    sampleRun.current++;
    onStopPreview?.();
  }, [onStopPreview]);
  const tapVoice = useCallback((key: string) => {
    if (!onPreviewVoice) {
      onSelectVoice?.(key);
      closeVoiceSheet();
      return;
    }
    const run = ++sampleRun.current;
    setCandidate(key);
    setSampling(key);
    setSampleFailed(false);
    void onPreviewVoice(key).then((ok) => {
      if (sampleRun.current !== run) return;
      setSampling(null);
      if (!ok) setSampleFailed(true);
    });
  }, [onPreviewVoice, onSelectVoice, closeVoiceSheet]);
  const confirmVoice = useCallback(() => {
    if (!candidate || candidate === selectedVoice) return;
    onSelectVoice?.(candidate);
    closeVoiceSheet();
  }, [candidate, selectedVoice, onSelectVoice, closeVoiceSheet]);
  /* Escape closes the sheet, and ONLY the sheet: captured before the
     screen's own Escape (which ends the call) can see it. */
  useEffect(() => {
    if (!voiceSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setVoiceSheet(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [voiceSheet]);
  /* The picture being looked at, if any. Inside the app, over the call. */
  const [openPhoto, setOpenPhoto] = useState<TranscriptPhoto | null>(null);
  const closePhoto = useCallback(() => setOpenPhoto(null), []);

  /* TWO VIEWS, ONE ORB. ORB: the orb alone, large, centred, the caption and
     the latest pictures under it; the conversation is out of the way. CHAT:
     the whole conversation, pictures where they were said, scrolling, with
     the SAME orb shrunk into the corner so the call never looks ended.

     THE ORB IS ONE ELEMENT THAT TRAVELS, not two that swap. The first
     version remounted both views on every tap with a third, inert copy of
     the leaving one playing an exit animation on top — two orbs, two
     transcripts, and a ref that ended up on the copy about to be removed
     (owner, 2026-09-07: "the motion not smooth and ease enough, it has a
     glitch"). Now both layers stay mounted; the orb's flight is a single
     transform measured from where it is to where the corner slot is (the
     FLIP technique), so it lands exactly, and the words and the caption
     cross-fade underneath. The transcript keeps its scroll position across
     the switch, and the rings keep their level, because nothing remounts.

     NOTHING SWITCHES BY ITSELF. A picture used to open the conversation
     the moment it arrived — mid-sentence, the orb gone, the words in its
     place (owner: "suddenly it out of conversation and show me the text
     conversation"). Pictures now appear under the orb where the caller is
     looking; the conversation opens on their tap and only their tap. */
  const [chosenView, setView] = useState<"orb" | "chat" | null>(null);
  const view: "orb" | "chat" = chosenView ?? "orb";
  const switchView = useCallback((next: "orb" | "chat") => setView(next), []);

  /* THE FLIGHT. From the orb's own place in the orb layer to the corner
     slot in the words layer: one translate and one scale, measured, so the
     orb lands on the slot to the pixel in either direction and in RTL.
     Re-measured when the screen or the block under the orb changes size —
     a longer caption moves the orb's home, and the corner must follow. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const orbHomeRef = useRef<HTMLButtonElement | null>(null);
  const cornerRef = useRef<HTMLDivElement | null>(null);
  const belowRef = useRef<HTMLDivElement | null>(null);
  const [travel, setTravel] = useState<string>("none");
  /* THE ORB FITS THE ROOM IT HAS. A fixed 200px ran into the wordmark and
     the caption on a short screen, or with the type-in line open (review,
     2026-09-26). The box between them is measured and the orb takes what
     fits, between ORB_MIN and ORB_MAX; the rings follow through
     --kx-orb-size and the flight's scale is measured from the real size. */
  const orbBoxRef = useRef<HTMLDivElement | null>(null);
  const [orbSize, setOrbSize] = useState(ORB_MAX);
  useLayoutEffect(() => {
    const box = orbBoxRef.current;
    if (!box) return;
    const fit = () => setOrbSize(fitOrb(box.clientWidth, box.clientHeight));
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const measure = () => {
      if (view !== "chat") {
        setTravel("none");
        return;
      }
      const home = orbHomeRef.current?.getBoundingClientRect();
      const corner = cornerRef.current?.getBoundingClientRect();
      if (!home || !corner || home.width === 0) return;
      const dx = corner.left + corner.width / 2 - (home.left + home.width / 2);
      const dy = corner.top + corner.height / 2 - (home.top + home.height / 2);
      setTravel(`translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(corner.width / home.width).toFixed(3)})`);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    if (belowRef.current) ro.observe(belowRef.current);
    return () => ro.disconnect();
  }, [view, orbSize]);

  /* THE LATEST PICTURES, under the orb: the ones on the newest turn that
     showed any. Older ones stay in the conversation. */
  const latestPhotos: readonly TranscriptPhoto[] = (() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      const p = lines[i].photos;
      if (p && p.length > 0) return p;
    }
    return [];
  })();
  /* THE LAST THING SAID, as a caption under the orb: a caller on the orb view
     still sees the words, one turn at a time, the way subtitles work. */
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : null;
  const [typed, setTyped] = useState("");
  const [typedNotice, setTypedNotice] = useState<string | null>(null);
  const typedRef = useRef<HTMLInputElement | null>(null);
  /* THE TYPE-IN LINE WAITS BEHIND A KEYBOARD BUTTON (UI/UX pass,
     2026-09-24). A call is spoken; a text box across the bottom of every
     call said otherwise and pushed the controls up. One tap opens it with
     the cursor in it; it stays open while it holds text or a notice. */
  const [typingOpen, setTypingOpen] = useState(defaultTypingOpen);
  const showTyping = typingOpen || typed.length > 0 || typedNotice !== null;

  /* Escape ends the call. A full-screen mode with no keyboard exit is a trap,
     and this one is holding the microphone open.

     EXCEPT INSIDE THE COMPOSER. Escape while typing means "leave the field",
     on every keyboard on every platform; ending a live call because someone
     backed out of a text box would be the worst surprise on this screen. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (typedRef.current && e.target === typedRef.current) {
        typedRef.current.blur();
        return;
      }
      /* ONE STEP BACK, NOT THE WHOLE WAY. Escape closes the sheet and the
         photo; on the words view it goes back to the orb the same way. Only
         Escape on the orb itself ends the call (UI review, 2026-09-12: the
         key meant "close" everywhere else, then ended a call). */
      if (view === "chat") {
        switchView("orb");
        return;
      }
      onEnd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnd, view, switchView]);

  const submitTyped = () => {
    const text = typed.trim();
    if (!text || !onSendText) return;
    if (onSendText(text)) {
      setTyped("");
      setTypedNotice(null);
    } else {
      /* Kept in the box. The text is theirs and the call will be up shortly;
         losing it would make them type it again. */
      setTypedNotice(copy.typedNotLive);
    }
  };

  /* The orb's own vocabulary, mapped from the call's. `awakening` while
     connecting is honest: it is starting, not yet hearing anything.

     A LIVE CALL DEFAULTS TO `listening`, and the first version's `idle` was
     the bug behind "the orb didn't move at all". AIOrb only feeds `audioLevel`
     into its motion while the state is listening or speaking — anything else
     pins the level to zero — so an orb parked on `idle` until the far side
     happened to send a speech event was a still orb for the whole call, or
     for ever if that event never came.

     `listening` is also simply true: the microphone is open from the moment
     the call connects. That is what listening means. */
  /* THE RINGS' LEVEL, written to a CSS variable each frame with attack and
     release — see lib/voice/level.ts for the glitch this replaces. Active
     while the call is up; a connecting or reconnecting call has no voice to
     show. */
  const orbWrapRef = useRef<HTMLDivElement>(null);
  /* THE FAR SIDE'S VOICE MOVES THE RINGS EVEN WHILE THE CALLER IS MUTED.
     `audioLevel` is the far side's level while it speaks (VoiceCallButton),
     so a closed microphone has nothing to do with it; only the caller's own
     level stays still while their audio goes nowhere. */
  const ringsLive = live && ready && !reconnecting && (!muted || phase === "speaking");
  useCallLevel(orbWrapRef, audioLevel, ringsLive);

  const orbState: AIOrbState = !live || reconnecting || !ready
    ? "awakening"
    /* LOOKING SOMETHING UP IS VISIBLE. The owner: "I can't see any response
       or action, and get the answer at the end — we need a motion so I know
       it is thinking". The orb's processing state with the searching
       activity is exactly that motion; the caption already said the words. */
    /* AND THE GAP BETWEEN TURNS. The caller has stopped and the far side is
       composing — the pause ChatGPT fills with motion and this screen used
       to fill with nothing. Same state as a lookup: it is the same wait. */
    /* NOT GATED ON MUTE (owner, 2026-09-26: "anything need to fix in the
       interface?"). In hold mode the microphone is closed between holds —
       which is exactly when the far side thinks and answers — so gating
       this on `muted` left a caller who had just let go looking at a still
       orb until the voice arrived. What Koleex AI is doing outranks the
       caller's closed microphone; the Mic control still shows it. */
    : searching || phase === "thinking"
      ? "thinking"
    : phase === "speaking"
      ? "speaking"
      /* MUTED IS NOT LISTENING. AIOrb feeds audioLevel into its motion only
         while listening or speaking, so leaving it on "listening" would leave
         an orb reacting to a microphone whose audio goes nowhere — the same
         class of lie as the caption above. */
      : muted
        ? "idle"
        : "listening";

  /* The CAPTION keeps the three-way distinction the orb does not need: the orb
     shows that it is live and reacting, while the words can still say whether
     anyone has spoken yet. */
  const status = reconnecting
    ? copy.reconnecting
    : !live || !ready
    ? (connectingSlow ? copy.connectingSlow : copy.connecting)
    /* WHAT KOLEEX AI IS DOING COMES FIRST — looking up, thinking, speaking —
       and then the caller's closed microphone. Hold mode made the old order
       wrong: between holds the caption said "Hold to talk" all the way
       through the answer, so a caller could not tell a thinking call from a
       stuck one (review, 2026-09-26). */
    : searching
    ? copy.searching
    : phase === "thinking"
      ? copy.thinking
      : phase === "speaking"
      ? copy.speaking
    /* OUTRANKS listening and "go ahead". A user who forgot they muted, told
       "Listening", concludes the product is broken — and they are right to,
       because the screen said it was hearing them and it was not. In hold
       mode the closed microphone is the resting state, so the caption
       says what to do rather than what is off. */
      : muted
      ? (talkMode === "hold" ? copy.holdToTalk : copy.muted)
      : phase === "listening"
        ? copy.listening
        : copy.ready;

  /* The two buttons that get a stuck call moving again (see the strip). */
  const showRetry = connectingSlow && (!live || !ready) && !!onRetry;
  const showSoundUnlock = soundBlocked && !!onEnableSound;

  /* Pending, as opposed to settled: the caption gets motion only here. */
  const working = !live || !ready || reconnecting || searching || phase === "thinking";

  /* THE STATUS LINE, drawn once and placed twice: under the orb in the orb
     view, and in the strip above the controls in the conversation view —
     where it used to be hidden with the rest of the orb layer, so a caller
     reading the words could not see "Thinking", "Reconnecting" or "Still
     connecting" (review, 2026-09-26). */
  const statusLine = (
    <p className={`max-w-[340px] px-2 text-center text-[12px] uppercase ${lang === "ar" ? "" : "tracking-[0.14em]"} font-semibold leading-relaxed text-[#AAAAAA]`}>
      {live && ready && !working && (
        <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full me-2 align-middle ${phase === "speaking" ? "bg-[#0066FF]" : "bg-white"}`} />
      )}
      {working ? (
        <>
          <span className="kx-activity-text">{status.replace(/…$/, "")}</span>
          {" "}
          <span className="kx-activity-dots align-baseline" aria-hidden><i /><i /><i /></span>
          {connectingSlow && (!live || !ready) && connectingFor > 0 && (
            <span aria-hidden className="ms-2 normal-case tracking-normal font-normal">{connectingFor}s</span>
          )}
        </>
      ) : status}
    </p>
  );

  /* THE ORB, ONCE. Rings and face; the wrapper the rings read their level
     from; the travelling element the flight is applied to. */
  const orb = (
    <button
      ref={orbHomeRef}
      type="button"
      onClick={() => switchView(view === "orb" ? "chat" : "orb")}
      aria-label={view === "orb" ? copy.showChat : copy.showOrb}
      title={view === "orb" ? copy.showChat : copy.showOrb}
      className="kx-orb-stage block rounded-full pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0D0D0D]"
    >
      <div className="kx-orb-travel" style={{ transform: travel }} data-travel={view}>
        <div
          ref={orbWrapRef}
          className={[
            "kx-call-orb relative shrink-0 flex items-center justify-center",
            phase === "speaking" ? "is-far" : "is-near",
            ringsLive ? "is-live" : "",
            /* A LOOKUP IN PROGRESS, on the rings: slow blue waves leaving
               the orb until the answer comes. The orb itself is in
               `thinking` — the shared component's own considering state. */
            (searching || phase === "thinking") && live ? "is-thinking" : "",
          ].join(" ")}
          style={{ width: orbSize, height: orbSize, ["--kx-orb-size" as string]: `${orbSize}px` }}
        >
          {/* THE VOICE, AS RINGS — see lib/voice/level.ts. Transform and
              opacity only: nothing here forces a repaint of the blurred
              orb beneath. */}
          <span aria-hidden className="kx-call-ring kx-call-ring-1" />
          <span aria-hidden className="kx-call-ring kx-call-ring-2" />
          <span aria-hidden className="kx-call-ring kx-call-ring-3" />
          <ChosenOrb
            state={orbState}
            activity={searching && live ? "searching" : "none"}
            audioLevel={audioLevel}
            size={orbSize}
            interactive
            /* The call screen is dark in both themes; the dotted orb must
               draw light dots here even when the Hub is in light mode. */
            surface="dark"
            /* `is-lively` is the orb's own opt-in (see AIOrb.tsx): at
               call size, in the audio states, the face keeps the home
               page's life — the gaze, the blink, the aura's idle pace. */
            className="shrink-0 kx-call-aiorb is-lively"
          />
        </div>
      </div>
    </button>
  );

  /* ── WORDS LAYER: the conversation, pictures in it, a slot in the corner
     the orb flies to. Hidden (not unmounted) behind the orb view. ── */
  const wordsLayer = (
    <div
      className={`kx-call-words absolute inset-0 flex flex-col pt-4 ${view === "chat" ? "is-in" : ""}`}
      aria-hidden={view !== "chat"}
    >
      <VoiceTranscript lines={lines} lang={lang} className="kx-transcript flex-1 min-h-0 pb-28" fill onOpenPhoto={setOpenPhoto} photosVisible={view === "chat"} />
      {/* Where the small orb sits: measured, never drawn. The orb itself
          lands here; a caption for readers travels with it. */}
      <div ref={cornerRef} aria-hidden className="kx-orb-corner absolute bottom-4 end-6 h-[72px] w-[72px] pointer-events-none" />
    </div>
  );

  /* ── ORB LAYER: the logo, the orb in the middle, the caption and the
     pictures under it. Only the orb takes taps once the words are open. ── */
  const orbLayer = (
    <div className={`absolute inset-0 flex flex-col items-center px-6 ${view === "orb" ? "" : "pointer-events-none"}`}>
      {/* A LITTLE ROOM ABOVE THE WORDMARK (owner, 2026-09-11: "make koleex
          logo little down in desktop mode and mobile"): pt-6 on both, over
          the safe-area inset the frame already adds on a phone. */}
      <div className={`kx-call-fade shrink-0 pt-6 ${view === "orb" ? "is-in" : ""}`} aria-hidden={view !== "orb"}>
        <KoleexLogo className="h-6 w-auto shrink-0 text-white" />
      </div>
      <div ref={orbBoxRef} className="flex-1 min-h-0 w-full flex items-center justify-center">
        {orb}
      </div>
      {/* A FIXED FLOOR, so the orb's home does not move with every caption:
          the block under it reserves its height and grows only past that. */}
      <div
        ref={belowRef}
        className={`kx-call-fade shrink-0 min-h-[176px] w-full flex flex-col items-center gap-4 pb-2 ${view === "orb" ? "is-in" : ""}`}
        aria-hidden={view !== "orb"}
      >
        {/* Status — one line, quiet. The orb already says most of this;
            the text is for anyone who cannot read motion. */}
        {/* WORKING STATES MOVE. Connecting, reconnecting, thinking and looking
            something up get the same light sweep and breathing dots as the
            chat's activity line (globals.css .kx-activity-*): the owner asked
            for "a small title with a simple motion" wherever the AI is busy.
            Listening / speaking / ready stand still — nothing is pending. */}
        {/* CENTRED AND ALLOWED TO WRAP (owner, 2026-09-08, "adjust the text
            position"): as a flex row the long "still connecting" line
            wrapped left-aligned with its dots stranded at the far right.
            A block of centred text, the dots inline after the last word. */}
        {/* STATUS, NOT WORDS. Small caps with a state dot (blue: the far side
            is speaking; white: it is listening) so the state is told apart
            from the half-spoken sentence above it at a glance (audit,
            2026-09-11). */}
        {/* NO LETTER-SPACING ON ARABIC (UI review, 2026-09-12): a cursive
            script pulled apart renders as disconnected glyphs. The other two
            keep the small-caps tracking. */}
        {statusLine}
        {/* AT MOST ONE HELPER LINE (UI/UX pass, 2026-09-24): the line note
            first, then the text-only note, then the how-to hint below — never
            two stacked under the orb. */}
        {laneNote === "international-unreachable" && (
          <p className="mt-2 max-w-[28rem] text-[12px] text-[#AAAAAA]" role="status">{copy.laneUnreachable}</p>
        )}
        {model === "mind" && laneNote !== "international-unreachable" && (
          <p className="mt-2 max-w-[28rem] text-[12px] text-[#AAAAAA]" role="status">{copy.mindCallNote}</p>
        )}
        {lastLine && (
          <p
            dir={textDirection(stripImageMarkdown(lastLine.text) || lastLine.text)}
            lang={textLang(stripImageMarkdown(lastLine.text) || lastLine.text)}
            /* THE LATEST THREE LINES, NOT THE FIRST THREE. line-clamp kept
               the opening of a long answer and cut the rest, so the caption
               froze while the voice went on (review, 2026-09-26). The box
               now holds three lines and lets the text overflow from the top
               (globals.css .kx-call-caption-tail), with a fade where the
               earlier words leave. */
            className={`kx-call-caption kx-call-caption-tail max-w-[820px] px-2 text-center text-base leading-relaxed ${stripImageMarkdown(lastLine.text).length > CAPTION_FADE_AFTER ? "is-long" : ""} ${lastLine.final ? "text-white" : "text-[#AAAAAA]"}`}
          >
            {stripImageMarkdown(lastLine.text)}
          </p>
        )}
        {lines.length > 0 ? (
          <button
            type="button"
            onClick={() => switchView("chat")}
            className="h-10 px-4 rounded-full text-xs inline-flex items-center text-[#AAAAAA] hover:text-white border border-white/20 hover:border-white/30 bg-white/[0.04] hover:bg-white/[0.08] transition-[background-color,color,border-color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]"
          >
            {copy.showChat}
          </button>
        ) : (
          /* Told once, plainly: server-side turn detection has no
             push-to-talk, and a user waiting for a button to hold will
             wait forever. */
          <div className="flex flex-col items-center gap-3">
            {/* TODAY'S BRIEF (roadmap C4): one chip, only before the first
                word and only once the far side is listening. It types the
                request into the call, so the model answers it exactly as it
                would a spoken one — the transcript shows what was asked. */}
            {onSendText && live && ready && !reconnecting && (
              <button
                type="button"
                onClick={() => onSendText(copy.briefRequest)}
                data-brief-chip
                className="h-9 px-4 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 text-white border border-white/25 bg-white/[0.06] hover:bg-white/[0.1] transition-[background-color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]"
              >
                <svg aria-hidden viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
                {copy.brief}
              </button>
            )}
            {laneNote !== "international-unreachable" && model !== "mind" && (
              <p className="max-w-[820px] mx-auto text-center text-[13px] text-[#AAAAAA]">{talkMode === "hold" ? copy.holdHint : copy.hint}</p>
            )}
          </div>
        )}
        {latestPhotos.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3" role="group" aria-label={copy.photos}>
            {latestPhotos.map((p) => (
              <PhotoTile key={p.url} photo={p} onOpen={setOpenPhoto} label={copy.photos} size={88} visible={view === "orb"} />
            ))}
          </div>
        )}
      </div>
    </div>
  );


  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      /* ABOVE THE APP CHROME, and it was not.

         z-50 put this UNDER the main header (z-100) and under the floating
         panel's dock button (z-90), so a call ran with the Hub's header bar
         across the top of it and a stray chevron sitting on the transcript.
         The orb was clipped by a header belonging to the page underneath. A
         thing that declares aria-modal="true" and then lets other chrome
         punch through it is not a modal — it is a div that covers most of
         the screen.

         200 is where this codebase's real dialogs live (SignInHelpDialog),
         above the header and the dock. Deliberately BELOW ConfirmDialog's
         300: a confirmation raised during a call has to be readable over it. */
      ref={rootRef}
      tabIndex={-1}
      className="kx-call-root fixed inset-0 z-[200] flex flex-col bg-[#0D0D0D] text-white outline-none"
      /* Read by UpdateWatcher: a live call is never interrupted by a reload
         onto a new build — the stale bundle waits until the call ends. */
      data-kx-call-active="1"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* ONE LIVE REGION, outside both views. The visible status sits inside
          a layer that is aria-hidden in chat view, so nothing was announced
          there; this copy is for readers, the visible line for eyes
          (audit, 2026-09-11). */}
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
      <PhotoLightbox photo={openPhoto} onClose={closePhoto} closeLabel={copy.closePhoto} />
      {/* ── THE STAGE: the words underneath, the orb layer on top, one orb
          that travels between its home and the corner (see the state block:
          nothing remounts, nothing switches by itself). ── */}
      <div ref={stageRef} className="relative flex-1 min-h-0" data-view={view}>
        {wordsLayer}
        {orbLayer}
      </div>

      {/* ── THE STRIP ABOVE THE CONTROLS, in both views. The ways out of a
          stuck call — Try again, Turn on sound — lived under the orb and
          vanished with it when the conversation was open; here they are
          always in reach. In the conversation view the status line comes
          too, since the one under the orb is hidden there. ── */}
      {(view === "chat" || showRetry || showSoundUnlock) && (
        <div className="shrink-0 flex flex-col items-center gap-2 px-4 pt-2" data-call-strip>
          {view === "chat" && statusLine}
          {/* A SLOW HANDSHAKE OFFERS A WAY OUT THAT IS NOT "END": one tap
              rebuilds the call — on the other lane when this one never came
              up — with the words kept. */}
          {showRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-5 text-sm font-semibold text-white hover:bg-white/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] active:scale-95 transition-[background-color,transform]"
            >
              {copy.tryAgain}
            </button>
          )}
          {showSoundUnlock && (
            <button
              type="button"
              onClick={onEnableSound}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#0066FF] px-5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-95 transition-transform"
            >
              {copy.enableSound}
            </button>
          )}
        </div>
      )}

      {/* ── A TASK WAITING FOR A TAP (roadmap D1) ──────────────────────────
          Above the bar, in both views: what will be saved, in the caller's
          own words as the model heard them, and the two buttons. Save is
          the one Hub Blue control on the screen while it is up — it is the
          one thing that writes. */}
      {(pendingWrite || writeSaved) && (
        <div className="shrink-0 px-4 pb-2" data-task-card>
          <div className="max-w-[560px] mx-auto rounded-2xl border border-white/15 bg-[#111111] px-4 py-3 text-white">
            {pendingWrite ? (
              <>
                {/* A REPORT DRAFT (6B): what it is, its period and who it goes to — the tool's preview says it in words. */}
                {pendingWrite.tool === "startReportDraft" ? (() => {
                  const pv = pendingWrite.preview ?? {};
                  const goes = Array.isArray(pv.goes_to) ? (pv.goes_to as unknown[]).map(String).filter(Boolean) : [];
                  return (
                    <>
                      <div className="text-[12px] uppercase tracking-wide text-[#AAAAAA]">{copy.draftPreview}</div>
                      <div className="mt-1 text-[16px] font-semibold leading-snug" data-task-title>{[pv.type, pv.period].filter((x) => typeof x === "string" && x).join(" — ")}</div>
                      {goes.length > 0 && <div className="mt-1 text-[12px] text-[#AAAAAA]" data-task-details>{`${copy.goesTo} ${goes.join(", ")}`}</div>}
                    </>
                  );
                })() : (
                <>
                <div className="text-[12px] uppercase tracking-wide text-[#AAAAAA]">{copy.taskPreview}</div>
                <div className="mt-1 text-[16px] font-semibold leading-snug" data-task-title>{String(pendingWrite.args.title ?? "")}</div>
                {(() => {
                  /* WHAT WILL BE SAVED, IN WORDS. The tool's preview carries
                     the times in the caller's own zone and the people by
                     name; the raw arguments are the fallback. */
                  const pv = pendingWrite.preview ?? {};
                  const when = (pv.when && typeof pv.when === "object" ? pv.when : {}) as { due?: unknown; remind?: unknown };
                  const people = ([] as string[])
                    .concat(Array.isArray(pv.assignees) ? (pv.assignees as Array<{ name?: unknown }>).map((a) => String(a.name ?? "")).filter(Boolean) : [])
                    .concat(typeof pv.department === "string" && pv.department ? [pv.department] : [])
                    .concat(pv.assign_to_all === true ? ["*"] : []);
                  const due = typeof when.due === "string" && when.due ? when.due : pendingWrite.args.due_date ? String(pendingWrite.args.due_date) : "";
                  const remind = typeof when.remind === "string" && when.remind ? when.remind : "";
                  const bits = [
                    due ? `${copy.due} ${due}` : "",
                    remind ? `${copy.remind} ${remind}` : "",
                    pendingWrite.args.priority ? String(pendingWrite.args.priority) : "",
                    pendingWrite.args.label ? String(pendingWrite.args.label) : "",
                    people.length ? `${copy.forPeople} ${people.join(", ")}` : "",
                  ].filter(Boolean);
                  return bits.length > 0 ? <div className="mt-1 text-[12px] text-[#AAAAAA]" data-task-details>{bits.join(" · ")}</div> : null;
                })()}
                </>
                )}
                {writeError && <div className="mt-2 text-[12px] text-[#FF3333]">{copy.taskFailed}</div>}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={onConfirmWrite}
                    disabled={writeBusy}
                    className="h-10 flex-1 rounded-full bg-[#0066FF] text-white text-[13px] font-semibold active:scale-95 transition-transform disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {pendingWrite.tool === "startReportDraft" ? copy.startDraft : copy.saveTask}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelWrite}
                    disabled={writeBusy}
                    className="h-10 px-4 rounded-full border border-white/20 text-[#AAAAAA] hover:text-white text-[13px] active:scale-95 transition-transform disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]"
                  >
                    {copy.cancelTask}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-[13px] font-semibold text-white" role="status" data-task-saved>✓ {writeSavedTool === "startReportDraft" ? copy.draftSaved : copy.taskSaved}</div>
            )}
          </div>
        </div>
      )}

      {/* ── THE BOTTOM BAR, in both views: type, mute, end. ── */}
      <div className="shrink-0 flex flex-col pt-2">
        {/* ── TYPE INTO THE CALL ────────────────────────────────────────
            A model code, a quantity, a name in another alphabet: some things
            are easier typed than said. One pill on the 8px grid, the same
            border family as every other control here, the send button
            inverted only once there is something to send — a control that
            cannot be used should not look ready. Not a textarea: this is a
            line into a conversation, not a document. */}
        {onSendText && showTyping && (
          <form
            className="w-full max-w-[820px] mx-auto px-6 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitTyped();
            }}
          >
            <div className="flex items-center gap-2 h-12 ps-4 pe-1.5 rounded-full border border-white/20 bg-white/[0.04] focus-within:border-white/40 transition-colors">
              <input
                ref={(el) => {
                  typedRef.current = el;
                  /* Opened by the keyboard button: take the cursor, without
                     iOS scrolling the call screen to reveal the field. */
                  if (el && typingOpen && document.activeElement !== el && !typed) {
                    try { el.focus({ preventScroll: true }); } catch { el.focus(); }
                  }
                }}
                type="text"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  if (typedNotice) setTypedNotice(null);
                }}
                placeholder={copy.typePlaceholder}
                aria-label={copy.typePlaceholder}
                enterKeyHint="send"
                autoComplete="off"
                className="flex-1 min-w-0 bg-transparent text-base text-white placeholder:text-[#AAAAAA] outline-none"
              />
              <button
                type="submit"
                disabled={!typed.trim()}
                aria-label={copy.sendTyped}
                title={copy.sendTyped}
                className="h-9 w-9 rounded-full inline-flex items-center justify-center shrink-0 bg-white text-[#0D0D0D] disabled:bg-white/[0.08] disabled:text-[#AAAAAA] transition-[background-color,color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]"
              >
                <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="6 11 12 5 18 11" />
                </svg>
              </button>
            </div>
            {typedNotice && (
              <p role="status" className="mt-2 text-center text-[13px] text-[#AAAAAA]">
                {typedNotice}
              </p>
            )}
          </form>
        )}

        {/* ── THE CONTROLS ───────────────────────────────────────────────
            WHAT WAS WRONG WITH THEM. Two bare circles with no labels, a mute
            whose border (#2E2E2E on #0D0D0D) was very nearly invisible, and
            two icons that were each a correct glyph with a line ruled across
            the whole 24px box. That line is not a strike-through — it is a
            diagonal over the top of a drawing, and at 20px it reads as
            damage rather than state. On the end-call button it also said the
            wrong thing: a handset with a line through it is the icon for a
            call that FAILED, and this is the button you press when the call
            went fine and you are done.

            Both icons are now the real glyphs. Mic-off is drawn broken around
            its slash, the way the shape is meant to be cut, so the diagonal
            is part of the letterform instead of graffiti on it. End-call is
            the handset turned down — the gesture of hanging up, universal on
            every phone since they had cradles, and unambiguous inside a red
            circle without needing any line at all.

            LABELS, because an unlabelled icon pair is a guess. A caller who
            has never been on this screen should not have to find out what
            the grey circle does by pressing it while someone is listening. */}
        {/* Room under the controls: on the desktop app "Mic / End" sat on the
            window's edge and on a phone on the home-indicator strip (the
            safe-area inset is added by the root, on top of this). */}
        {/* TIGHTER ON A PHONE. With Hold to talk in Mute's place the row was
            wider than a 390px iPhone and ran off both edges (review,
            2026-09-26): 12px between the controls under 400px, the old 24px
            above it. */}
        <div className="flex items-end justify-center gap-3 min-[400px]:gap-6 sm:gap-10 pb-6">
          {talkMode === "hold" && onHold ? (
            /* HOLD TO TALK (roadmap B2), in Mute's place: the one control a
               caller in a loud room uses, so it is the widest thing on the
               bar and says what it does. Pointer events, captured, so a
               finger that slides off still releases; the touch-action and
               callout styles stop iOS selecting text or offering a menu on
               the long press it is designed for. Filled in Hub Blue while
               held — the open microphone is the loud state, as muted is
               for the other control. */
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                aria-pressed={holding}
                aria-label={copy.holdToTalk}
                title={copy.holdToTalk}
                onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); hold(true); }}
                onPointerUp={() => hold(false)}
                onPointerCancel={() => hold(false)}
                onLostPointerCapture={() => hold(false)}
                onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); hold(true); } }}
                onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); hold(false); } }}
                onContextMenu={(e) => e.preventDefault()}
                style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none", WebkitUserSelect: "none" }}
                /* ONE WIDTH AND ONE LABEL. The label used to change to "Let
                   go when done" under the finger, which widened the button
                   and shifted the whole row mid-press; the hint now sits in
                   the small line under it, and the button keeps its size. */
                className={`h-14 w-[clamp(124px,36vw,168px)] px-3 rounded-full inline-flex items-center justify-center gap-1.5 border text-[13px] sm:text-[14px] font-semibold whitespace-nowrap select-none transition-[background-color,color,border-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D] ${
                  holding
                    ? "bg-[#0066FF] text-white border-[#0066FF] scale-[1.03]"
                    : "text-white border-white/25 bg-white/[0.06] hover:bg-white/[0.1]"
                }`}
              >
                <svg aria-hidden className="shrink-0" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10.5V12a7 7 0 0 0 14 0v-1.5" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                <span className="min-w-0 truncate">{copy.holdToTalk}</span>
              </button>
              <span aria-hidden className={`text-[12px] ${lang === "ar" ? "" : "tracking-wide"} transition-colors ${holding ? "text-white" : "text-[#AAAAAA]"}`}>
                {holding ? copy.holdRelease : copy.micShort}
              </span>
            </div>
          ) : onToggleMute && (
            <div className="flex flex-col items-center gap-2">
              {/* MUTE. Monochrome: it is not destructive, so it does not get
                  the red, and it is not the primary action, so it does not
                  get the size. `aria-pressed` rather than a second label, so
                  a screen reader hears one control with a state. */}
              <button
                type="button"
                onClick={onToggleMute}
                aria-pressed={muted}
                aria-label={muted ? copy.unmute : copy.mute}
                title={muted ? copy.unmute : copy.mute}
                className={`h-14 w-14 rounded-full inline-flex items-center justify-center border transition-[background-color,color,border-color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D] ${
                  muted
                    /* FILLED WHEN OFF, and that is the louder of the two
                       states on purpose: muted is the one a caller forgets
                       they are in and then talks into nothing. */
                    ? "bg-white text-[#0D0D0D] border-white"
                    : "text-[#AAAAAA] hover:text-white border-white/20 hover:border-white/30 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                {muted ? (
                  /* Cut around the slash — one glyph, not a drawing with a
                     line over it. */
                  <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 9.5V5a3 3 0 0 0-5.86-.88" />
                    <path d="M9 9.9V12a3 3 0 0 0 4.6 2.54" />
                    <path d="M18.4 13.4A7 7 0 0 0 19 10.5" />
                    <path d="M5 10.5V12a7 7 0 0 0 10.9 5.8" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="4" y1="3.5" x2="20" y2="20.5" />
                  </svg>
                ) : (
                  <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10.5V12a7 7 0 0 0 14 0v-1.5" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                )}
              </button>
              {/* aria-hidden: the button above already carries the accessible
                  name, and a screen reader announcing both says it twice. */}
              <span aria-hidden className={`text-[12px] ${lang === "ar" ? "" : "tracking-wide"} transition-colors ${muted ? "text-white" : "text-[#AAAAAA]"}`}>
                {copy.micShort}
              </span>
            </div>
          )}

          {onSendText && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setTypingOpen((v) => !v)}
                aria-expanded={showTyping}
                aria-label={copy.typePlaceholder}
                title={copy.typePlaceholder}
                data-type-toggle
                className={`h-14 w-14 rounded-full inline-flex items-center justify-center border transition-[background-color,color,border-color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D] ${
                  showTyping
                    ? "text-white border-white/40 bg-white/[0.1]"
                    : "text-[#AAAAAA] hover:text-white border-white/20 hover:border-white/30 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                <KeyboardIcon size={22} />
              </button>
              <span aria-hidden className={`text-[12px] ${lang === "ar" ? "" : "tracking-wide"} text-[#AAAAAA]`}>
                {copy.typeShort}
              </span>
            </div>
          )}

          {(voices.length > 0 || onSelectTalkMode) && (
            <div className="flex flex-col items-center gap-2">
              {/* VOICE. The same family as Mute — a circle on the grid, the
                  name under it is the voice currently speaking, so the state
                  is readable without opening anything. */}
              <button
                type="button"
                onClick={() => setVoiceSheet(true)}
                aria-haspopup="dialog"
                aria-expanded={voiceSheet}
                aria-label={copy.callSettings}
                title={copy.callSettings}
                className="h-14 w-14 rounded-full inline-flex items-center justify-center border text-[#AAAAAA] hover:text-white border-white/20 hover:border-white/30 bg-white/[0.04] hover:bg-white/[0.08] transition-[background-color,color,border-color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]"
              >
                {/* SLIDERS, NOT THE WAVEFORM. The waveform meant "speak" on the
                    composer and "pick a voice" here — one shape, two meanings.
                    This opens Call settings, so it wears the settings glyph
                    (audit, 2026-09-11). */}
                <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <line x1="4" y1="7" x2="20" y2="7" /><circle cx="9" cy="7" r="2" fill="#0D0D0D" />
                  <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" fill="#0D0D0D" />
                  <line x1="4" y1="17" x2="20" y2="17" /><circle cx="7" cy="17" r="2" fill="#0D0D0D" />
                </svg>
              </button>
              <span aria-hidden className={`text-[12px] ${lang === "ar" ? "" : "tracking-wide"} text-[#AAAAAA] max-w-[72px] truncate`}>
                {copy.settingsShort}
              </span>
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onEnd}
              aria-label={copy.end}
              title={copy.end}
              className="h-16 w-16 rounded-full inline-flex items-center justify-center bg-[#FF3333] text-white shadow-[0_4px_20px_-4px_rgba(255,51,51,0.5)] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]"
            >
              {/* AN X, NOT A HANDSET. The owner: "the end button should be X, not
                  like a close-a-call icon". The screen is a mode you leave, and
                  the glyph for leaving a mode is the same everywhere in the Hub:
                  a plain cross. Same stroke family as the mic; the red circle
                  still says this is the one that ends things. */}
              <svg aria-hidden viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
            <span aria-hidden className={`text-[12px] ${lang === "ar" ? "" : "tracking-wide"} text-[#AAAAAA]`}>
              {copy.endShort}
            </span>
          </div>
        </div>
      </div>

      {/* ── THE VOICE SHEET ─────────────────────────────────────────────
          Above the call, below a photo (z-250 < z-260). A backdrop that
          closes, a handle, a title with Close, and the voices as a row of
          small orbs — the chosen one awake and ringed in Hub Blue, the
          others asleep. Choosing closes the sheet; the call rebuilds in
          place with the words kept (VoiceCallButton.selectVoice). */}
      {voiceSheet && (voices.length > 0 || onSelectTalkMode) && (
        <div className="fixed inset-0 z-[250] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={copy.callSettings}>
          <button type="button" aria-label={copy.close} onClick={closeVoiceSheet} className="absolute inset-0 bg-black/60" />
          {/* THE HUB'S OWN SURFACE (#111111 is --bg-secondary), and a bottom
              padding that clears the home indicator: the panel used to stop
              at 2rem and the indicator's strip showed through as a black
              band under it. The container is viewport-fixed; the panel
              simply reaches the edge now. */}
          <div
            ref={sheetRef}
            /* NEVER TALLER THAN THE SCREEN, AND NEVER EDGE TO EDGE ON A DESK
               (deep check, 2026-09-24: 961 px on an 844 px phone, title and
               close button above the top edge, no way to scroll to them). */
            className="kx-sheet-in relative w-full max-h-[85dvh] overflow-y-auto overscroll-contain md:mx-auto md:max-w-[480px] rounded-t-3xl border-t border-white/10 bg-[#111111] px-6 pt-3 text-white"
            style={{
              paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
              /* `translate`, not `transform`: the entrance animation owns transform. */
              translate: sheetDy > 0 ? `0 ${sheetDy}px` : undefined,
            }}
          >
            <div
              className="touch-none cursor-grab select-none"
              onPointerDown={(e) => {
                sheetDragRef.current = { y0: e.clientY, dy: 0 };
                /* A mouse drag that leaves the handle still ends here: without
                   capture the desktop app's sheet froze half-open (UI review,
                   2026-09-12). Hold-to-talk captures the same way. */
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  /* An engine without capture drags as before. */
                }
              }}
              onPointerMove={(e) => {
                const d = sheetDragRef.current;
                if (!d) return;
                d.dy = Math.max(0, e.clientY - d.y0);
                setSheetDy(d.dy);
              }}
              onPointerUp={() => {
                const d = sheetDragRef.current;
                sheetDragRef.current = null;
                setSheetDy(0);
                if (d && d.dy > 80) closeVoiceSheet();
              }}
              onPointerCancel={() => { sheetDragRef.current = null; setSheetDy(0); }}
            >
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold">{copy.callSettings}</h2>
              <button
                type="button"
                data-sheet-close
                onClick={closeVoiceSheet}
                aria-label={copy.close}
                title={copy.close}
                className="h-9 w-9 rounded-full inline-flex items-center justify-center text-[#AAAAAA] hover:text-white bg-white/[0.06] hover:bg-white/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
              >
                {/* A CHEVRON, NOT AN X. The X is the End button's — the one that
                    ends the call — and the sheet's Close wore the same glyph
                    with opposite stakes. Down is also the swipe that closes
                    it (audit, 2026-09-11). */}
                <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
            </div>
            {/* Room above the tiles (pt-2) for the badge and the glow: an
                overflow-x container clips vertically too. */}
            {voices.length > 0 && (
            <>
            <h3 className="text-[13px] font-semibold text-[#AAAAAA] mb-1">{copy.voicePick}</h3>
            <div className="flex gap-4 overflow-x-auto pt-2 pb-2 -mx-2 px-2 snap-x">
              {voices.map((v, i) => {
                const chosen = v.key === selectedVoice;
                /* Drawn as "on": the candidate being auditioned, or the
                   chosen voice when nothing is. Pressed means CHOSEN. */
                const on = candidate ? v.key === candidate : chosen;
                return (
                  <button
                    key={v.key}
                    type="button"
                    aria-pressed={chosen}
                    aria-busy={sampling === v.key || undefined}
                    onClick={() => tapVoice(v.key)}
                    className="group flex flex-col items-center gap-2 shrink-0 snap-start focus:outline-none"
                  >
                    {/* A VOICE IS A SHAPE, NOT A FACE. Five identical orbs said
                        nothing about which was which (the owner: "icons or
                        shapes or just names"). Each voice gets its own
                        waveform signature — a fixed pattern of five bars —
                        so the row reads as five different voices at a glance;
                        the chosen one is in Hub Blue and breathes. */}
                    <span className="relative">
                      {/* ONE ring, not two: a border plus an offset ring
                          read as a doubled, misdrawn circle. A Hub Blue
                          border with a soft glow says "this one". */}
                      <span className={`h-16 w-16 rounded-full inline-flex items-center justify-center border transition-[background-color,border-color,box-shadow,transform] duration-150 group-active:scale-95 ${on ? "border-[#0066FF] bg-[#0066FF]/10 shadow-[0_0_0_4px_rgba(0,102,255,0.18)]" : "border-white/15 bg-white/[0.04] group-hover:border-white/30"}`}>
                        <VoiceGlyph index={i} on={on || sampling === v.key} />
                      </span>
                      {/* THE CURRENT VOICE WEARS A CHECK, so it stays
                          identifiable once the ring has moved to a voice
                          being auditioned. */}
                      {chosen && (
                        <span aria-hidden data-voice-current className="absolute -top-0.5 -end-0.5 h-5 w-5 rounded-full bg-[#0066FF] ring-2 ring-[#111111] inline-flex items-center justify-center">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        </span>
                      )}
                    </span>
                    <span className="flex flex-col items-center leading-tight">
                      <span className={`text-[12px] ${on ? "text-white font-semibold" : "text-[#AAAAAA] group-hover:text-white"}`}>{v.label}</span>
                      <span className="text-[12px] text-[#AAAAAA] h-[14px] inline-flex items-center justify-center">
                        {chosen ? copy.voiceCurrent : sampling === v.key ? (
                          <span className="kx-activity-dots text-[#0066FF]" aria-hidden><i /><i /><i /></span>
                        ) : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            </>
            )}
            {voices.length > 0 && (
              <p className="mt-3 text-[13px] text-[#AAAAAA]" aria-live="polite">
                {sampling ? copy.voiceSampling : sampleFailed ? copy.voiceSampleFailed : onPreviewVoice ? copy.voiceTapHint : copy.voiceHint}
              </p>
            )}
            {/* THE CHOICE IS A SEPARATE TAP when voices can be heard first:
                a tap on an orb is "let me hear it", this is "this one". Off
                until a voice other than the current one has been heard. */}
            {voices.length > 0 && onPreviewVoice && (
              <button
                type="button"
                onClick={confirmVoice}
                disabled={!candidate || candidate === selectedVoice}
                className="mt-4 h-12 w-full rounded-2xl bg-[#0066FF] text-[16px] font-semibold text-white disabled:bg-white/[0.06] disabled:text-[#AAAAAA] transition-[background-color,transform] duration-150 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
              >
                {candidate && candidate !== selectedVoice
                  ? copy.voiceUseNamed.replace("{name}", voices.find((v) => v.key === candidate)?.label ?? "")
                  : copy.voiceUse}
              </button>
            )}

            {/* HOW YOU TALK (roadmap B2). Two choices, one pressed. Choosing
                does not close the sheet or rebuild the call — the parent
                gates the microphone at once — so the hint under it can be
                read after choosing. */}
            {/* THE MODEL (2026-09-23; the Line control's successor). The
                same list as the picker beside the message box, and on a
                call each model says which line it is: Auto the one that
                works here, Blink the mainland line, Deep the international
                one. Mind is text only — shown, not choosable, so the caller
                learns why it is not a voice. Choosing rebuilds the call on
                the model's line with the words kept
                (VoiceCallButton.selectModel). */}
            {onSelectModel && (
              <div className={voices.length > 0 ? "mt-6 pt-5 border-t border-white/10" : ""}>
                <h3 className="text-[13px] font-semibold text-[#AAAAAA] mb-3">{copy.modelPick}</h3>
                <div role="radiogroup" aria-label={copy.modelPick} className="flex flex-col gap-1 rounded-2xl bg-white/[0.04] p-1">
                  {KOLEEX_MODELS.map((m) => {
                    const on = model === m;
                    const off = !KOLEEX_MODEL_INFO[m].voice;
                    const line = m === "blink" ? copy.laneMainland
                      : m === "deep" ? copy.laneInternational
                      : m === "mind" ? copy.modelTextOnly
                      /* Auto, in use: which model it is answering with. */
                      : on ? `${copy.modelLineAuto} · ${KOLEEX_MODEL_INFO[lane === "ws" ? "deep" : "blink"].name[lang]}`
                      : copy.modelLineAuto;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-disabled={off || undefined}
                        data-model={m}
                        onClick={() => { if (!off) onSelectModel(m); }}
                        className={`min-h-[52px] rounded-xl px-4 py-2 text-start transition-[background-color,color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] ${
                          on ? "bg-white text-[#0D0D0D]" : off ? "text-[#AAAAAA]/60 cursor-not-allowed" : "text-white hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="block text-[14px] font-semibold">{KOLEEX_MODEL_INFO[m].name[lang]}</span>
                        <span className={`block text-[12px] ${on ? "text-[#0D0D0D]/70" : "text-[#AAAAAA]"}`}>{line}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[13px] text-[#AAAAAA]">{copy.lineHint}</p>
              </div>
            )}
            {onSelectTalkMode && (
              <div className={voices.length > 0 || onSelectModel ? "mt-6 pt-5 border-t border-white/10" : ""}>
                <h3 className="text-[13px] font-semibold text-[#AAAAAA] mb-3">{copy.modePick}</h3>
                <div role="group" aria-label={copy.modePick} className="grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.04] p-1">
                  {(["hands-free", "hold"] as const).map((mode) => {
                    const on = talkMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={on}
                        data-talk-mode={mode}
                        onClick={() => onSelectTalkMode(mode)}
                        className={`h-11 rounded-xl text-[13px] font-semibold transition-[background-color,color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] ${
                          on ? "bg-white text-[#0D0D0D]" : "text-[#AAAAAA] hover:text-white"
                        }`}
                      >
                        {mode === "hold" ? copy.modeHold : copy.modeHandsFree}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[13px] text-[#AAAAAA]">{copy.modeHint}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── The voice signatures ─────────────────────────────────────────────
   Six bar patterns, one per catalogue position (the catalogue is small; a
   seventh voice would reuse the first). Fixed, not derived from the label,
   so a renamed voice keeps its shape. Monochrome off, Hub Blue on. */
const GLYPH_PATTERNS: readonly (readonly number[])[] = [
  [8, 16, 24, 16, 8],
  [18, 10, 22, 10, 18],
  [6, 14, 10, 20, 12],
  [22, 14, 8, 14, 22],
  [12, 20, 16, 24, 10],
  [10, 8, 18, 12, 20],
];

function VoiceGlyph({ index, on }: { index: number; on: boolean }) {
  const bars = GLYPH_PATTERNS[index % GLYPH_PATTERNS.length];
  return (
    <svg aria-hidden viewBox="0 0 40 40" width="36" height="36" className={`kx-voice-glyph ${on ? "is-on" : ""}`}>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={6 + i * 7}
          y={20 - h / 2}
          width="3"
          height={h}
          rx="1.5"
          fill={on ? "#0066FF" : "rgba(255,255,255,0.72)"}
          style={{ transformOrigin: `${7.5 + i * 7}px 20px`, animationDelay: `${i * 90}ms` }}
        />
      ))}
    </svg>
  );
}
