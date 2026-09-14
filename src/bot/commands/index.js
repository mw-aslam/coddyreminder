const reminderHandler = require('../../handlers/reminderHandler');
const reminderService = require('../../services/reminderService');
const groupService = require('../../services/groupService');
const { buildReminderActionsKeyboard, buildDeleteConfirmKeyboard, buildSettingsKeyboard } = require('../../keyboards/groupKeyboard');
const userService = require('../../services/userService');
const logger = require('../../utils/logger');
const { t } = require('../../locales');

const DEFAULT_LANG = 'ru';

function getLang(ctx) {
  return ctx.dbUser?.language || DEFAULT_LANG;
}

async function startCommand(ctx) {
  const lang = getLang(ctx);
  const name = ctx.from.first_name || 'there';
  await ctx.reply(
    t(lang, 'start_greeting', { name }) + '\n\n' + t(lang, 'start_desc'),
    { parse_mode: 'Markdown' }
  );
}

async function helpCommand(ctx) {
  const lang = getLang(ctx);
  await ctx.reply(t(lang, 'help_text'), { parse_mode: 'Markdown' });
}

async function reminderCommand(ctx) {
  if (ctx.chat.type !== 'private') {
    const lang = getLang(ctx);
    await ctx.reply(t(lang, 'private_only'));
    return;
  }
  
  if (ctx.message) {
    ctx.deleteMessage().catch(() => {});
  }
  
  await reminderHandler.startReminderFlow(ctx);
}

async function myRemindersCommand(ctx) {
  const lang = getLang(ctx);
  if (ctx.chat.type !== 'private') {
    await ctx.reply(t(lang, 'private_only'));
    return;
  }

  try {
    const reminders = await reminderService.getUserReminders(ctx.from.id);

    if (reminders.length === 0) {
      await ctx.reply(t(lang, 'no_reminders'));
      return;
    }

    for (const r of reminders) {
      const date = new Date(r.remind_at);
      const dateStr = date.toLocaleDateString('ru-RU').replace(/\//g, '.');
      const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      await ctx.reply(
        `🔔 *#${r.id}*\n\n` +
        `📝 ${r.text}\n\n` +
        `📅 ${dateStr}   🕒 ${timeStr}\n` +
        `📍 ${r.group_title || t(lang, 'private_chat')}\n` +
        `${t(lang, 'status')} *${r.status}*`,
        {
          parse_mode: 'Markdown',
          ...buildReminderActionsKeyboard(lang, r.id),
        }
      );
    }
  } catch (err) {
    logger.error(`Failed to fetch reminders for user ${ctx.from.id}:`, err);
    await ctx.reply(t(lang, 'failed'));
  }
}

async function deleteCommand(ctx) {
  const lang = getLang(ctx);
  if (ctx.chat.type !== 'private') {
    await ctx.reply(t(lang, 'private_only'));
    return;
  }

  try {
    const reminders = await reminderService.getUserReminders(ctx.from.id);

    if (reminders.length === 0) {
      await ctx.reply(t(lang, 'no_reminders'));
      return;
    }

    await ctx.reply(t(lang, 'delete_select'), { parse_mode: 'Markdown' });

    for (const r of reminders) {
      const date = new Date(r.remind_at);
      const dateStr = date.toLocaleDateString('ru-RU').replace(/\//g, '.');
      const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      await ctx.reply(
        `🔔 *#${r.id}* — ${r.text}\n📅 ${dateStr}   🕒 ${timeStr}\n📍 ${r.group_title || t(lang, 'private_chat')}`,
        {
          parse_mode: 'Markdown',
          ...buildDeleteConfirmKeyboard(lang, r.id),
        }
      );
    }
  } catch (err) {
    logger.error(`Delete command error for user ${ctx.from.id}:`, err);
    await ctx.reply(t(lang, 'failed'));
  }
}

async function groupsCommand(ctx) {
  const lang = getLang(ctx);
  if (ctx.chat.type !== 'private') {
    await ctx.reply(t(lang, 'private_only'));
    return;
  }

  try {
    const groups = await groupService.getUserActiveGroups(ctx.from.id);

    if (groups.length === 0) {
      await ctx.reply(t(lang, 'groups_empty'));
      return;
    }

    let message = t(lang, 'groups_title');
    for (const g of groups) {
      message += `📌 *${g.title}*\n`;
      if (g.username) message += `🔗 @${g.username}\n`;
      message += `📅 ${new Date(g.created_at).toLocaleDateString('ru-RU')}\n\n`;
    }

    const tip = lang === 'uz'
      ? `💡 *Maslahat:* Agar bot boshqa guruhlaringizda ham bor bo'lsa, lekin u ushbu ro'yxatda ko'rinmayotgan bo'lsa — o'sha guruhlarda ixtiyoriy komandani (masalan /help) bir marta yuboring, bot guruhni darhol ro'yxatga oladi!`
      : `💡 *Совет:* Если бот добавлен в другие ваши группы, но их нет в списке — просто отправьте любую команду (например /help) в этих группах, и бот автоматически их зарегистрирует!`;

    message += `\n${tip}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error(`Groups command error for user ${ctx.from.id}:`, err);
    await ctx.reply(t(lang, 'failed'));
  }
}

async function settingsCommand(ctx) {
  const lang = getLang(ctx);
  if (ctx.chat.type !== 'private') {
    await ctx.reply(t(lang, 'private_only'));
    return;
  }

  if (ctx.message) {
    ctx.deleteMessage().catch(() => {});
  }

  const user = ctx.dbUser;
  const autoDeleteSec = user?.auto_delete_duration || 60;
  const autoDeleteMin = Math.round(autoDeleteSec / 60);

  const langDisplay = lang === 'ru' ? '🇷🇺 Русский' : lang === 'uz' ? "🇺🇿 O'zbek" : '🇬🇧 English';

  await ctx.reply(
    t(lang, 'settings_title', { lang: langDisplay, autoDelete: autoDeleteMin }),
    {
      parse_mode: 'Markdown',
      ...buildSettingsKeyboard(lang),
    }
  );
}

async function cancelCommand(ctx) {
  const lang = getLang(ctx);
  reminderHandler.clearSession(ctx.from.id);
  await ctx.reply(t(lang, 'cancelled'));
}

async function remindGroupCommand(ctx) {
  const lang = getLang(ctx);
  if (ctx.chat.type === 'private') {
    return reminderCommand(ctx);
  }

  const text = ctx.message.text;
  const match = text.match(/^\/(?:remind|remind@[\w_]+)\s+(\S+)\s+(.+)$/i);

  if (!match) {
    await ctx.reply(t(lang, 'remind_usage'), { parse_mode: 'Markdown' });
    return;
  }

  const timeStr = match[1];
  const reminderText = match[2];

  const { parseTime, combineDateAndTime, isFuture } = require('../../utils/dateParser');
  const timeObj = parseTime(timeStr);

  if (!timeObj) {
    await ctx.reply(t(lang, 'step_time_error'), { parse_mode: 'Markdown' });
    return;
  }

  const moment = require('moment-timezone');
  const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
  const dateMoment = moment().tz(timezone);
  let remindAt = combineDateAndTime(dateMoment, timeObj, timezone);

  if (!isFuture(remindAt)) {
    dateMoment.add(1, 'day');
    remindAt = combineDateAndTime(dateMoment, timeObj, timezone);
  }

  try {
    const reminder = await reminderService.createReminder(ctx.telegram, {
      userId: ctx.from.id,
      groupId: ctx.chat.id,
      text: reminderText,
      remindAt: remindAt.toDate(),
    });

    const displayDate = remindAt.format('DD.MM.YYYY');
    const displayTime = remindAt.format('HH:mm');

    await ctx.reply(
      t(lang, 'success', {
        id: reminder.id,
        text: reminderText,
        date: displayDate,
        time: displayTime,
        target: ctx.chat.title
      }),
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    logger.error('Failed to create direct reminder:', err);
    await ctx.reply(t(lang, 'failed'));
  }
}

module.exports = {
  startCommand,
  helpCommand,
  reminderCommand,
  myRemindersCommand,
  deleteCommand,
  groupsCommand,
  settingsCommand,
  cancelCommand,
  remindGroupCommand,
};
