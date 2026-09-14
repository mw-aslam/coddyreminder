const moment = require('moment-timezone');
const reminderService = require('./reminderService');
const groupService = require('./groupService');
const logger = require('../utils/logger');
const { t } = require('../locales');

/**
 * Parses Uzbek / Russian natural language string to extract date, time, and reminder text.
 * Examples:
 * - "bugun soat 15:28 ga demoday boladi" -> date: today, time: 15:28, text: "Demoday"
 * - "сегодня в 15:28 будет демодей" -> date: today, time: 15:28, text: "Демодей"
 * - "ertaga soat 10:00 da majlis bo'ladi" -> date: tomorrow, time: 10:00, text: "Majlis"
 */
function parseNaturalLanguage(text, timezone = 'Asia/Tashkent') {
  if (!text || typeof text !== 'string') return null;

  const now = moment().tz(timezone);
  let targetDate = now.clone().startOf('day');
  let hours = null;
  let minutes = null;

  let cleanText = text.trim();

  // 1. Match Time: 15:28, 15.28, 15-28, 15 28 (when preceded by soat/соат/в)
  const timeRegex = /(?:soat\s*|соат\s*|время\s*|в\s*)?(\d{1,2})[:.\s-](\d{2})(?::\d{2})?\s*(?:da|ga|да|га)?/i;
  const timeMatch = cleanText.match(timeRegex);

  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    cleanText = cleanText.replace(timeMatch[0], ' ');
  } else {
    // Match single hour: "soat 3 da", "соат 15 да", "в 15 часов"
    const hourRegex = /(?:soat\s*|соат\s*|в\s*)(\d{1,2})\s*(?:часа|часов|da|ga|да|га)?/i;
    const hourMatch = cleanText.match(hourRegex);
    if (hourMatch) {
      hours = parseInt(hourMatch[1], 10);
      minutes = 0;
      cleanText = cleanText.replace(hourMatch[0], ' ');
    }
  }

  if (hours === null || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null; // Valid time is required
  }

  // 2. Match Date (Uzbek Latin/Cyrillic + Russian)
  const lower = cleanText.toLowerCase();
  if (lower.includes('ertaga') || lower.includes('эртага') || lower.includes('завтра')) {
    targetDate.add(1, 'days');
    cleanText = cleanText.replace(/ertaga|эртага|завтра/gi, ' ');
  } else if (lower.includes('indinga') || lower.includes('индинга') || lower.includes('послезавтра')) {
    targetDate.add(2, 'days');
    cleanText = cleanText.replace(/indinga|индинга|послезавтра/gi, ' ');
  } else if (lower.includes('bugun') || lower.includes('бугун') || lower.includes('сегодня')) {
    cleanText = cleanText.replace(/bugun|бугун|сегодня/gi, ' ');
  } else {
    // Specific date format: 14.09 or 14-09
    const dateRegex = /(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/;
    const dateMatch = cleanText.match(dateRegex);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.year();
      targetDate.set({ year: year < 100 ? 2000 + year : year, month, date: day });
      cleanText = cleanText.replace(dateMatch[0], ' ');
    } else {
      // If time today has already passed, schedule for tomorrow
      const testRemind = targetDate.clone().set({ hour: hours, minute: minutes });
      if (testRemind.isBefore(now)) {
        targetDate.add(1, 'days');
      }
    }
  }

  // 3. Clean remaining text for reminder title
  cleanText = cleanText
    .replace(/\b(tipo|типо|диман|деман|болади|bo'ladi|boladi|булади|буўлади|будет|напомни|напомнить|нам|мне|о|про|haqida|туg'risida|remind|me|eslat|eslatib|qo'y|qoy|куй|эслатиб|эслат|degan|деган|bor|бор)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText || cleanText.length < 2) {
    cleanText = 'Eslatma / Напоминание';
  } else {
    cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
  }

  const remindAt = targetDate.clone().set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

  return {
    text: cleanText,
    remindAt: remindAt.toDate(),
    dateStr: remindAt.format('DD.MM.YYYY'),
    timeStr: remindAt.format('HH:mm'),
  };
}

/** Transcribes Telegram Voice OGG audio using OpenAI / Groq Whisper API. */
async function transcribeAudio(fileUrl) {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('No Speech-to-Text API key found (GROQ_API_KEY or OPENAI_API_KEY)');
    return null;
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isGroq = Boolean(process.env.GROQ_API_KEY);
    const endpoint = isGroq
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions';

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'audio/ogg' });
    formData.append('file', blob, 'voice.ogg');
    formData.append('model', isGroq ? 'whisper-large-v3-turbo' : 'whisper-1');
    formData.append('prompt', "Bu o'zbek va rus tilidagi audio eslatma: bugun, ertaga, soat 15:28 da demoday, majlis va uchrashuv bo'ladi. Bu o'zbekcha va ruscha audio.");

    const apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      logger.error('Transcription API error:', errText);
      return null;
    }

    const data = await apiRes.json();
    return data.text ? data.text.trim() : null;
  } catch (err) {
    logger.error('Failed to transcribe audio:', err);
    return null;
  }
}

/** Handles incoming voice message update from Telegram. */
async function handleVoiceMessage(ctx) {
  const lang = ctx.dbUser?.language || 'ru';
  const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';

  const statusMsg = await ctx.reply('🎧 *Распознаю голосовое сообщение...*', { parse_mode: 'Markdown' });

  try {
    const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const transcribedText = await transcribeAudio(fileLink.href);

    if (!transcribedText) {
      const isUz = lang === 'uz';
      const noKeyText = isUz
        ? `⚠️ *Ovozni tanib bo'lmadi.*\n\nOvozni matnga aylantirish uchun \`.env\` fayliga \`GROQ_API_KEY\` yoki \`OPENAI_API_KEY\` qo'shing.\n\n💡 *Yoki matn ko'rinishida yozing:*\n\`bugun soat 15:28 ga demoday boladi\``
        : `⚠️ *Не удалось распознать голос.*\n\nДля распознавания добавьте \`GROQ_API_KEY\` или \`OPENAI_API_KEY\` в файл \`.env\`.\n\n💡 *Или просто напишите текстом:*\n\`сегодня в 15:28 демодей\``;

      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, noKeyText, { parse_mode: 'Markdown' }).catch(() => {});
      return;
    }

    const parsed = parseNaturalLanguage(transcribedText, timezone);
    if (!parsed) {
      const noDateText = lang === 'uz'
        ? `🗣 «_${transcribedText}_»\n\n⚠️ *Vaqt aniqlanmadi.* Iltimos, vaqtni ko'rsating (masalan: *soat 15:28*).`
        : `🗣 «_${transcribedText}_»\n\n⚠️ *Время не распознано.* Пожалуйста, укажите время (например: *в 15:28*).`;

      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, noDateText, { parse_mode: 'Markdown' }).catch(() => {});
      return;
    }

    // Register private chat group
    await groupService.registerGroup(ctx, {
      id: ctx.from.id,
      title: 'Private Chat',
      username: ctx.from.username,
    });

    const reminder = await reminderService.createReminder(ctx.telegram, {
      userId: ctx.from.id,
      groupId: ctx.from.id,
      text: parsed.text,
      remindAt: parsed.remindAt,
      recurrence: 'none',
    });

    const successText = lang === 'uz'
      ? `🎤 *Ovozli xabar tanindi!*\n🗣 «_${transcribedText}_»\n\n✅ *Eslatma yaratildi!*\n\n🆔 #${reminder.id}\n📝 *Matn:* ${parsed.text}\n📅 *Sana:* ${parsed.dateStr}\n🕒 *Vaqt:* ${parsed.timeStr}\n📍 *Qayerga:* 👤 Shaxsiy xabar`
      : `🎤 *Голосовое сообщение распознано!*\n🗣 «_${transcribedText}_»\n\n✅ *Напоминание создано!*\n\n🆔 #${reminder.id}\n📝 *Текст:* ${parsed.text}\n📅 *Дата:* ${parsed.dateStr}\n🕒 *Время:* ${parsed.timeStr}\n📍 *Куда:* 👤 Личное сообщение`;

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, successText, { parse_mode: 'Markdown' }).catch(() => {});
  } catch (err) {
    logger.error('Error handling voice message:', err);
    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, '❌ Ошибка обработки голосового сообщения.').catch(() => {});
  }
}

/** Handles incoming plain text that may contain natural language reminder instructions. */
async function handleNaturalTextMessage(ctx, text) {
  const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
  const lang = ctx.dbUser?.language || 'ru';

  const parsed = parseNaturalLanguage(text, timezone);
  if (!parsed) return false;

  try {
    await groupService.registerGroup(ctx, {
      id: ctx.from.id,
      title: 'Private Chat',
      username: ctx.from.username,
    });

    const reminder = await reminderService.createReminder(ctx.telegram, {
      userId: ctx.from.id,
      groupId: ctx.from.id,
      text: parsed.text,
      remindAt: parsed.remindAt,
      recurrence: 'none',
    });

    const successText = lang === 'uz'
      ? `✅ *Eslatma yaratildi!*\n\n🆔 #${reminder.id}\n📝 *Matn:* ${parsed.text}\n📅 *Sana:* ${parsed.dateStr}\n🕒 *Vaqt:* ${parsed.timeStr}\n📍 *Qayerga:* 👤 Shaxsiy xabar`
      : `✅ *Напоминание создано!*\n\n🆔 #${reminder.id}\n📝 *Текст:* ${parsed.text}\n📅 *Дата:* ${parsed.dateStr}\n🕒 *Время:* ${parsed.timeStr}\n📍 *Куда:* 👤 Личное сообщение`;

    await ctx.reply(successText, { parse_mode: 'Markdown' });
    return true;
  } catch (err) {
    logger.error('Failed to create natural text reminder:', err);
    return false;
  }
}

module.exports = {
  parseNaturalLanguage,
  transcribeAudio,
  handleVoiceMessage,
  handleNaturalTextMessage,
};
