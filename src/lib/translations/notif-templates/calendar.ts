import type { Translations } from "@/lib/i18n";

/* Calendar — lib/server/calendar-notify.ts, api/cron/calendar-reminders.
   {when} is already D/M/Y + HH:MM in the organizer's zone (formatWhen);
   an all-day event adds {allDay:calendarSpan}. {day} is a D/M/Y date,
   {url} the meeting link, {where} the event's location as written. A change
   to ONE occurrence of a series has its own `.occurrence` template: its date,
   and "the rest of the series is unchanged". */
export const calendarTpl: Translations = {
  "enum.calendarSpan.all_day": { en: "(all day)", zh: "（全天）", ar: "(طوال اليوم)" },

  "calendar_invite.s": { en: "Invitation: {title:free}", zh: "日程邀请：{title:free}", ar: "دعوة: {title:free}" },
  "calendar_invite.b": {
    en: "You are invited — {when}[[ {allDay:calendarSpan}]][[ · {where}]][[ · Join: {url}]]. Open it to accept or decline.",
    zh: "你受邀参加——{when}[[{allDay:calendarSpan}]][[ · {where}]][[ · 加入：{url}]]。打开即可接受或拒绝。",
    ar: "أنت مدعو — {when}[[ {allDay:calendarSpan}]][[ · {where}]][[ · رابط الانضمام: {url}]]. افتح الدعوة لقبولها أو الاعتذار عنها.",
  },

  "calendar_cancelled.s": { en: "Cancelled: {title:free}", zh: "已取消：{title:free}", ar: "أُلغي: {title:free}" },
  "calendar_cancelled.b": {
    en: "\"{title:free}\" has been cancelled by the organizer.",
    zh: "“{title:free}”已被组织者取消。",
    ar: "ألغى المنظِّم \"{title:free}\".",
  },
  "calendar_cancelled.occurrence.s": { en: "Cancelled: {title:free} on {day}", zh: "已取消：{title:free}（{day}）", ar: "أُلغي: {title:free} يوم {day}" },
  "calendar_cancelled.occurrence.b": {
    en: "\"{title:free}\" on {day} has been cancelled by the organizer. The rest of the series is unchanged.",
    zh: "{day} 的“{title:free}”已被组织者取消。该系列的其他日程不变。",
    ar: "ألغى المنظِّم \"{title:free}\" يوم {day}. بقية السلسلة دون تغيير.",
  },

  "calendar_rescheduled.s": { en: "Rescheduled: {title:free}", zh: "时间已变更：{title:free}", ar: "تغيّر الموعد: {title:free}" },
  "calendar_rescheduled.b": {
    en: "\"{title:free}\" is now {when}[[ {allDay:calendarSpan}]][[ · {where}]].[[ Join: {url}]]",
    zh: "“{title:free}”已改至 {when}[[{allDay:calendarSpan}]][[ · {where}]]。[[加入：{url}]]",
    ar: "الموعد الجديد لـ\"{title:free}\": {when}[[ {allDay:calendarSpan}]][[ · {where}]].[[ رابط الانضمام: {url}]]",
  },
  "calendar_rescheduled.occurrence.s": { en: "Rescheduled: {title:free} on {day}", zh: "时间已变更：{title:free}（{day}）", ar: "تغيّر الموعد: {title:free} يوم {day}" },
  "calendar_rescheduled.occurrence.b": {
    en: "\"{title:free}\" on {day} is now {when}[[ {allDay:calendarSpan}]][[ · {where}]].[[ Join: {url}]] The rest of the series is unchanged.",
    zh: "{day} 的“{title:free}”已改至 {when}[[{allDay:calendarSpan}]][[ · {where}]]。[[加入：{url} ]]该系列的其他日程不变。",
    ar: "الموعد الجديد لـ\"{title:free}\" يوم {day}: {when}[[ {allDay:calendarSpan}]][[ · {where}]].[[ رابط الانضمام: {url}]] بقية السلسلة دون تغيير.",
  },

  "calendar_rescheduled.location.s": { en: "New location: {title:free}", zh: "地点已变更：{title:free}", ar: "مكان جديد: {title:free}" },
  "calendar_rescheduled.location.b": {
    en: "\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) is now at {where}.[[ Join: {url}]]",
    zh: "“{title:free}”（{when}[[{allDay:calendarSpan}]]）的地点已改为 {where}。[[加入：{url}]]",
    ar: "المكان الجديد لـ\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]): {where}.[[ رابط الانضمام: {url}]]",
  },
  "calendar_rescheduled.location.occurrence.s": { en: "New location: {title:free}", zh: "地点已变更：{title:free}", ar: "مكان جديد: {title:free}" },
  "calendar_rescheduled.location.occurrence.b": {
    en: "\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) is now at {where}.[[ Join: {url}]] The rest of the series is unchanged.",
    zh: "“{title:free}”（{when}[[{allDay:calendarSpan}]]）的地点已改为 {where}。[[加入：{url} ]]该系列的其他日程不变。",
    ar: "المكان الجديد لـ\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]): {where}.[[ رابط الانضمام: {url}]] بقية السلسلة دون تغيير.",
  },
  "calendar_rescheduled.location_removed.s": { en: "New location: {title:free}", zh: "地点已变更：{title:free}", ar: "مكان جديد: {title:free}" },
  "calendar_rescheduled.location_removed.b": {
    en: "\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) no longer has a location.[[ Join: {url}]]",
    zh: "“{title:free}”（{when}[[{allDay:calendarSpan}]]）已不再设置地点。[[加入：{url}]]",
    ar: "لم يعد لـ\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) مكان محدد.[[ رابط الانضمام: {url}]]",
  },
  "calendar_rescheduled.location_removed.occurrence.s": { en: "New location: {title:free}", zh: "地点已变更：{title:free}", ar: "مكان جديد: {title:free}" },
  "calendar_rescheduled.location_removed.occurrence.b": {
    en: "\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) no longer has a location.[[ Join: {url}]] The rest of the series is unchanged.",
    zh: "“{title:free}”（{when}[[{allDay:calendarSpan}]]）已不再设置地点。[[加入：{url} ]]该系列的其他日程不变。",
    ar: "لم يعد لـ\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) مكان محدد.[[ رابط الانضمام: {url}]] بقية السلسلة دون تغيير.",
  },

  "calendar_rescheduled.link.s": { en: "New meeting link: {title:free}", zh: "会议链接已更新：{title:free}", ar: "رابط اجتماع جديد: {title:free}" },
  "calendar_rescheduled.link.b": {
    en: "\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) has a new meeting link. Join: {url}",
    zh: "“{title:free}”（{when}[[{allDay:calendarSpan}]]）有新的会议链接。加入：{url}",
    ar: "رابط اجتماع جديد لـ\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]). رابط الانضمام: {url}",
  },
  "calendar_rescheduled.link.occurrence.s": { en: "New meeting link: {title:free}", zh: "会议链接已更新：{title:free}", ar: "رابط اجتماع جديد: {title:free}" },
  "calendar_rescheduled.link.occurrence.b": {
    en: "\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) has a new meeting link. Join: {url} The rest of the series is unchanged.",
    zh: "“{title:free}”（{when}[[{allDay:calendarSpan}]]）有新的会议链接。加入：{url} 该系列的其他日程不变。",
    ar: "رابط اجتماع جديد لـ\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]). رابط الانضمام: {url} بقية السلسلة دون تغيير.",
  },
  "calendar_rescheduled.link_removed.s": { en: "New meeting link: {title:free}", zh: "会议链接已更新：{title:free}", ar: "رابط اجتماع جديد: {title:free}" },
  "calendar_rescheduled.link_removed.b": {
    en: "\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) no longer has a meeting link.",
    zh: "“{title:free}”（{when}[[{allDay:calendarSpan}]]）已不再有会议链接。",
    ar: "لم يعد لـ\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) رابط اجتماع.",
  },
  "calendar_rescheduled.link_removed.occurrence.s": { en: "New meeting link: {title:free}", zh: "会议链接已更新：{title:free}", ar: "رابط اجتماع جديد: {title:free}" },
  "calendar_rescheduled.link_removed.occurrence.b": {
    en: "\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) no longer has a meeting link. The rest of the series is unchanged.",
    zh: "“{title:free}”（{when}[[{allDay:calendarSpan}]]）已不再有会议链接。该系列的其他日程不变。",
    ar: "لم يعد لـ\"{title:free}\" ({when}[[ {allDay:calendarSpan}]]) رابط اجتماع. بقية السلسلة دون تغيير.",
  },

  "calendar_rsvp_accepted.s": { en: "{actor} accepted: {title:free}", zh: "{actor} 已接受：{title:free}", ar: "قبِل {actor} الدعوة: {title:free}" },
  "calendar_rsvp_accepted.b": {
    en: "{actor} accepted the invitation to \"{title:free}\".",
    zh: "{actor} 已接受“{title:free}”的邀请。",
    ar: "قبِل {actor} الدعوة إلى \"{title:free}\".",
  },
  "calendar_rsvp_declined.s": { en: "{actor} declined: {title:free}", zh: "{actor} 已拒绝：{title:free}", ar: "اعتذر {actor} عن الدعوة: {title:free}" },
  "calendar_rsvp_declined.b": {
    en: "{actor} declined the invitation to \"{title:free}\".",
    zh: "{actor} 已拒绝“{title:free}”的邀请。",
    ar: "اعتذر {actor} عن الدعوة إلى \"{title:free}\".",
  },

  /* The reminder: one template per way of saying how long is left. */
  "calendar_reminder.now.s": { en: "Starting soon: {title:free}", zh: "即将开始：{title:free}", ar: "يبدأ قريبًا: {title:free}" },
  "calendar_reminder.now.b": {
    en: "{when}[[ {allDay:calendarSpan}]] (starting now).[[ Join: {url}]]",
    zh: "{when}[[{allDay:calendarSpan}]]（现在开始）。[[加入：{url}]]",
    ar: "{when}[[ {allDay:calendarSpan}]] (يبدأ الآن).[[ رابط الانضمام: {url}]]",
  },
  "calendar_reminder.min.s": { en: "Starting soon: {title:free}", zh: "即将开始：{title:free}", ar: "يبدأ قريبًا: {title:free}" },
  "calendar_reminder.min.b": {
    en: "{when}[[ {allDay:calendarSpan}]] (in {min} min).[[ Join: {url}]]",
    zh: "{when}[[{allDay:calendarSpan}]]（{min} 分钟后）。[[加入：{url}]]",
    ar: "{when}[[ {allDay:calendarSpan}]] (بعد {min} د).[[ رابط الانضمام: {url}]]",
  },
  "calendar_reminder.hours.s": { en: "Starting soon: {title:free}", zh: "即将开始：{title:free}", ar: "يبدأ قريبًا: {title:free}" },
  "calendar_reminder.hours.b": {
    en: "{when}[[ {allDay:calendarSpan}]] (in {h} h).[[ Join: {url}]]",
    zh: "{when}[[{allDay:calendarSpan}]]（{h} 小时后）。[[加入：{url}]]",
    ar: "{when}[[ {allDay:calendarSpan}]] (بعد {h} س).[[ رابط الانضمام: {url}]]",
  },
  "calendar_reminder.hours_min.s": { en: "Starting soon: {title:free}", zh: "即将开始：{title:free}", ar: "يبدأ قريبًا: {title:free}" },
  "calendar_reminder.hours_min.b": {
    en: "{when}[[ {allDay:calendarSpan}]] (in {h} h {min} min).[[ Join: {url}]]",
    zh: "{when}[[{allDay:calendarSpan}]]（{h} 小时 {min} 分钟后）。[[加入：{url}]]",
    ar: "{when}[[ {allDay:calendarSpan}]] (بعد {h} س و{min} د).[[ رابط الانضمام: {url}]]",
  },
  "calendar_reminder.days.s": { en: "Starting soon: {title:free}", zh: "即将开始：{title:free}", ar: "يبدأ قريبًا: {title:free}" },
  "calendar_reminder.days.b": {
    en: "{when}[[ {allDay:calendarSpan}]] (in {days} days).[[ Join: {url}]]",
    zh: "{when}[[{allDay:calendarSpan}]]（{days} 天后）。[[加入：{url}]]",
    ar: "{when}[[ {allDay:calendarSpan}]] (بعد {days} يوم).[[ رابط الانضمام: {url}]]",
  },
};
