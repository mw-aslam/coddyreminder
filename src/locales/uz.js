module.exports = {
  start_greeting: "👋 *Salom, {name}!*",
  start_desc: "Men *Coddy Reminder* man — Sizga va guruhlaringizga rejalashtirilgan eslatmalar yuboraman.\n\n*Qisqacha:*\n1️⃣ Meni guruhingizga qo'shing yoki shu yerda ishlating\n2️⃣ /reminder buyrug'i bilan eslatma yarat\n3️⃣ Belgilangan vaqtda eslataman!\n\nBarcha buyruqlar: /help",
  help_text: "📖 *Coddy Reminder — Buyruqlar Qo'llanmasi*\n\n⏰ *Eslatmalar:*\n• /reminder — Yangi eslatma yaratish (bosqichma-bosqich)\n• /myreminders — Eslatmalarimni ko'rish va tahrirlash\n• /delete — Eslatmalarni o'chirish\n• 🎙 *Ovozli va matnli:* Ovoz yuboring yoki yozing: `bugun soat 15:28 ga demoday boladi`\n\n📝 *Vazifalar va Odatlar:*\n• `/todo Bozorlik qilish` — Vazifalar ro'yxatiga qo'shish\n• `/habits Kitob o'qish 30 min` — Kunlik odat yaratish (Streak 🔥)\n\n📅 *Eksport va Guruhlar:*\n• /export — Eslatmalarni Google/Apple Kalendarga yuklash (.ics)\n• /groups — Ulangan guruhlarni ko'rish\n• /settings — Til va avto-o'chirish sozlamalari\n• /cancel — Joriy amalni bekor qilish",

  step_text: "📝 *1-qadam / 5 — Eslatma matni*\n\nNima haqida eslatib o'tishim kerak?\n\nMasalan: _Loyihani topshirish_",
  step_text_error: "❌ Matn 1 dan 1000 belgigacha bo'lishi kerak.",

  step_date: "📅 *2-qadam / 5 — Sana*\n\nQachon yuboray?\n\nFormatlar:\n• `{today}`\n• `{today_iso}`\n• `today` (bugun)",
  step_date_error: "❌ Noto'g'ri sana. Foydalaning:\n• `{today}`\n• `today`",

  step_time: "🕒 *3-qadam / 5 — Vaqt*\n\nSoat nechada? Masalan: `{time1}`, `{time2}`",
  step_time_error: "❌ Noto'g'ri vaqt. HH:MM ko'rinishida yozing (masalan `{time1}`).",
  step_time_past_error: "❌ Bu vaqt o'tib ketgan. Kelajak vaqtni kiriting.",

  step_group: "👥 *5-qadam / 5 — Qayerga yuborish*\n\nEslatmani qayerga yuboray?",
  no_groups: "Guruhlar topilmadi. Avval meni guruhga qo'shing.",
  private_chat: "👤 Shaxsiy xabar (Shu yerga)",

  confirm_title: "📋 *Tasdiqlash*",
  confirm_reminder: "📝 *Xabar:*",
  confirm_date: "📅 *Sana:*",
  confirm_time: "🕒 *Vaqt:*",
  confirm_target: "📍 *Qayerga:*",

  success: "✅ *Eslatma saqlandi!*\n\n🆔 #{id}\n📝 {text}\n\n📅 {date}  🕒 {time}\n📍 {target}\n\nHammasini ko'rish: /myreminders",
  failed: "❌ Xatolik yuz berdi. Qayta urinib ko'ring.",
  cancelled: "❌ Bekor qilindi. Boshlash uchun /reminder yozing.",

  no_reminders: "📭 Faol eslatmalar yo'q.\n\n/reminder bilan yarating",
  status: "📊 Holati:",

  delete_select: "🗑 *O'chirish uchun eslatmani tanlang:*",
  delete_success: "✅ Eslatma #{id} o'chirildi.",

  groups_empty: "📭 Guruhlar topilmadi.\n\nMeni guruhga qo'shsangiz, ro'yxatga olaman.",
  groups_title: "👥 *Ro'yxatga olingan guruhlar:*\n\n",

  settings_title: "⚙️ *Sozlamalar*\n\n🌍 Til: *{lang}*\n⏱ Avto-o'chirish: *{autoDelete} daqiqa*\n\nNimani o'zgartirish kerak?",
  settings_lang_updated: "✅ Til O'zbekchaga o'zgartirildi! 🇺🇿",
  settings_autodelete_prompt: "⏱ *Avto-o'chirish vaqti*\n\nEslatma yuborilib necha daqiqadan so'ng o'chsin?",

  private_only: "Iltimos, bu buyruqni men bilan shaxsiy chatda ishlating.",
  unknown_cmd: "Tushunmadim. /help orqali buyruqlarni ko'ring.",

  btn_confirm: "✅ Tasdiqlash",
  btn_cancel: "❌ Bekor qilish",
  btn_delete: "🗑 O'chirish",
  btn_autodelete: "⏱ Avto-o'chirish",
  btn_language: "🌍 Til",

  reminder_header: "🔔 *ESLATMA*",
  msg_text: "📝 Matn:",
  msg_date: "📅 Sana:",
  msg_time: "🕒 Vaqt:",
  notif_enabled: "✅ Yoqilgan",
  notif_disabled: "❌ O'chirilgan",
  btn_back: "🔙 Orqaga",

  // Recurrence
  step_recurrence: "🔄 *4-qadam / 5 — Takrorlanish*\n\nUshbu eslatma qanchalik tez-tez yuborilsin?",
  rec_none: "🚫 Bir marta",
  rec_daily: "🔄 Har kuni",
  rec_weekdays: "📅 Ish kunlari",
  rec_weekly: "📆 Har hafta",
  
  // Editing
  edit_select: "✏️ *Nimani o'zgartirishni xohlaysiz?*",
  btn_edit: "✏️ Tahrirlash",
  btn_edit_text: "📝 Matnni",
  btn_edit_date: "📅 Sanani",
  btn_edit_time: "🕒 Vaqtni",
  edit_text_prompt: "📝 Yangi eslatma matnini kiriting:",
  edit_date_prompt: "📅 Yangi sanani kiriting (masalan, `today`, `tomorrow`, `31.12.2026`):",
  edit_time_prompt: "🕒 Yangi vaqtni kiriting (masalan, `08:00`, `14:30`):",
  edit_success: "✅ Eslatma muvaffaqiyatli yangilandi!",
  error_not_found: "Eslatma topilmadi.",
  error_occurred: "Xatolik yuz berdi.",
  remind_usage: "Qo'llash: `/remind HH:MM Matn`",
  autodelete_custom_prompt: "⏱ *O'z vaqtingizni kiriting*\n\nNecha daqiqadan so'ng o'chirilsin? (raqam kiriting, masalan: `15`)",
  autodelete_set: "✅ Avto-o'chirish: *{min} daqiqa*",
  btn_custom: "✏️ O'z vaqtim",
  autodelete_invalid: "1 dan 10080 gacha raqam kiriting (max 1 hafta).",
};
