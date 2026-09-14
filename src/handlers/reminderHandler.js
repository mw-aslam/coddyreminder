const { parseDate, parseTime, combineDateAndTime, isFuture } = require('../utils/dateParser');
const { buildGroupKeyboard, buildConfirmKeyboard, buildCancelKeyboard } = require('../keyboards/groupKeyboard');
const reminderService = require('../services/reminderService');
const logger = require('../utils/logger');
const { t } = require('../locales');

const DEFAULT_LANG = 'ru';
const sessions = new Map();

function getLang(ctx) {
  return ctx.dbUser?.language || DEFAULT_LANG;
}

function getSession(userId) {
  if (!sessions.has(userId)) sessions.set(userId, { history: [] });
  return sessions.get(userId);
}

function clearSession(userId) {
  sessions.delete(userId);
}

async function sendOrEditPrompt(ctx, session, text, extra = {}) {
  if (session.promptMsgId) {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, session.promptMsgId, undefined, text, extra);
    } catch (e) {
      const msg = await ctx.reply(text, extra);
      session.promptMsgId = msg.message_id;
    }
  } else {
    const msg = await ctx.reply(text, extra);
    session.promptMsgId = msg.message_id;
  }
}

async function startReminderFlow(ctx) {
  const userId = ctx.from.id;
  const lang = getLang(ctx);
  clearSession(userId);
  const session = getSession(userId);
  session.step = 'await_text';
  session.history = [];
  
  if (ctx.message) {
    ctx.deleteMessage().catch(() => {});
  }
  
  await sendOrEditPrompt(ctx, session, t(lang, 'step_text'), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
}

async function handleReminderStep(ctx) {
  const userId = ctx.from.id;
  const lang = getLang(ctx);
  const session = getSession(userId);

  if (!session || !session.step) return false;

  const text = ctx.message.text.trim();
  
  if (ctx.message) {
    ctx.deleteMessage().catch(() => {});
  }

  switch (session.step) {
    case 'await_text': {
      if (text.length < 1 || text.length > 1000) {
        await sendOrEditPrompt(ctx, session, t(lang, 'step_text_error'), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
        return true;
      }
      session.reminderText = text;
      session.step = 'await_date';
      session.history.push({ step: 'await_text', msg: text });
      
      const moment = require('moment-timezone');
      const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
      const now = moment().tz(timezone);
      
      await sendOrEditPrompt(ctx, session, t(lang, 'step_date', {
        today: now.format('DD.MM.YYYY'),
        today_iso: now.format('YYYY-MM-DD')
      }), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
      return true;
    }

    case 'await_date': {
      const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
      const parsed = parseDate(text, timezone);
      const moment = require('moment-timezone');
      const now = moment().tz(timezone);

      if (!parsed) {
        await sendOrEditPrompt(ctx, session, t(lang, 'step_date_error', {
          today: now.format('DD.MM.YYYY')
        }), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
        return true;
      }
      session.date = parsed;
      session.step = 'await_time';
      session.history.push({ step: 'await_date', msg: text });
      
      await sendOrEditPrompt(ctx, session, t(lang, 'step_time', {
        time1: now.clone().add(1, 'hour').format('HH:00'),
        time2: now.clone().add(1, 'hour').add(15, 'minutes').format('HH:15')
      }), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
      return true;
    }

    case 'await_time': {
      const timeObj = parseTime(text);
      if (!timeObj) {
        const moment = require('moment-timezone');
        const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
        const now = moment().tz(timezone);
        await sendOrEditPrompt(ctx, session, t(lang, 'step_time_error', {
          time1: now.clone().add(1, 'hour').format('HH:00')
        }), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
        return true;
      }

      const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
      const remindAt = combineDateAndTime(session.date, timeObj, timezone);

      if (!isFuture(remindAt)) {
        await sendOrEditPrompt(ctx, session, t(lang, 'step_time_past_error'), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
        session.step = 'await_date';
        return true;
      }

      session.remindAt = remindAt;
      session.step = 'await_recurrence';
      session.history.push({ step: 'await_time', msg: text });

      const { buildRecurrenceKeyboard } = require('../keyboards/groupKeyboard');
      await sendOrEditPrompt(ctx, session, t(lang, 'step_recurrence'), {
        parse_mode: 'Markdown',
        ...buildRecurrenceKeyboard(lang),
      });
      return true;
    }

    case 'edit_text': {
      if (text.length < 1 || text.length > 1000) {
        await sendOrEditPrompt(ctx, session, t(lang, 'step_text_error'), { parse_mode: 'Markdown' });
        return true;
      }
      await reminderService.updateReminder(session.editReminderId, { text });
      await sendOrEditPrompt(ctx, session, t(lang, 'edit_success'), { parse_mode: 'Markdown' });
      clearSession(userId);
      return true;
    }

    case 'edit_date': {
      const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
      const parsed = parseDate(text, timezone);
      if (!parsed) {
        await sendOrEditPrompt(ctx, session, t(lang, 'step_date_error', { today: 'today' }), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
        return true;
      }
      
      const existing = await reminderService.getReminderById(session.editReminderId);
      if (!existing) return true;
      
      const moment = require('moment-timezone');
      const currentRemindAt = moment(existing.remind_at).tz(timezone);
      // parsed is a moment object from parseDate, use it directly
      const newRemindAt = parsed.clone().set({ 
        hour: currentRemindAt.hours(), 
        minute: currentRemindAt.minutes(), 
        second: 0, 
        millisecond: 0 
      });
      
      if (!isFuture(newRemindAt)) {
        await sendOrEditPrompt(ctx, session, t(lang, 'step_time_past_error'), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
        return true;
      }
      
      await reminderService.updateReminder(session.editReminderId, { remind_at: newRemindAt.toDate() });
      await sendOrEditPrompt(ctx, session, t(lang, 'edit_success'), { parse_mode: 'Markdown' });
      clearSession(userId);
      return true;
    }

    case 'edit_time': {
      const timeObj = parseTime(text);
      if (!timeObj) {
        await sendOrEditPrompt(ctx, session, t(lang, 'step_time_error', { time1: '12:00' }), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
        return true;
      }

      const existing = await reminderService.getReminderById(session.editReminderId);
      if (!existing) return true;

      const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
      const moment = require('moment-timezone');
      const currentRemindAt = moment(existing.remind_at).tz(timezone);
      
      // Use the moment object directly with .clone().set()
      const newRemindAt = currentRemindAt.clone().set({
        hour: timeObj.hours,
        minute: timeObj.minutes,
        second: 0,
        millisecond: 0
      });
      
      if (!isFuture(newRemindAt)) {
        await sendOrEditPrompt(ctx, session, t(lang, 'step_time_past_error'), { parse_mode: 'Markdown', ...buildCancelKeyboard(lang) });
        return true;
      }
      
      await reminderService.updateReminder(session.editReminderId, { remind_at: newRemindAt.toDate() });
      await sendOrEditPrompt(ctx, session, t(lang, 'edit_success'), { parse_mode: 'Markdown' });
      clearSession(userId);
      return true;
    }

    case 'await_autodelete_custom': {
      const minutes = parseInt(text);
      if (isNaN(minutes) || minutes < 1 || minutes > 10080) {
        await sendOrEditPrompt(ctx, session, t(lang, 'autodelete_invalid'), { parse_mode: 'Markdown' });
        return true;
      }
      const seconds = minutes * 60;
      const userService = require('../services/userService');
      const userMiddleware = require('../bot/middlewares/user');
      await userService.updateSettings(userId, { auto_delete_duration: seconds });
      if (ctx.dbUser) ctx.dbUser.auto_delete_duration = seconds;
      if (userMiddleware.updateCache) {
        userMiddleware.updateCache(userId, { auto_delete_duration: seconds });
      }
      
      const promptMsgId = session.promptMsgId;
      clearSession(userId);

      if (ctx.message) {
        ctx.deleteMessage().catch(() => {});
      }

      const msg = t(lang, 'autodelete_set', { min: minutes });
      if (promptMsgId) {
        await ctx.telegram.editMessageText(ctx.chat.id, promptMsgId, undefined, msg, { parse_mode: 'Markdown' }).catch(() => {});
      } else {
        await ctx.reply(msg, { parse_mode: 'Markdown' });
      }
      return true;
    }

    default:
      return false;
  }
}

async function handleGroupSelection(ctx) {
  const userId = ctx.from.id;
  const lang = getLang(ctx);
  const session = getSession(userId);

  if (!session || session.step !== 'await_group') {
    await ctx.answerCbQuery();
    return;
  }

  const selection = ctx.callbackQuery.data.split(':')[1];

  if (selection === 'private') {
    session.groupId = ctx.from.id;
    session.groupTitle = t(lang, 'private_chat');
    
    // Register private chat as a group to satisfy foreign key constraints
    const groupService = require('../services/groupService');
    await groupService.registerGroup(ctx, {
      id: ctx.from.id,
      title: 'Private Chat',
      username: ctx.from.username
    });
  } else {
    const groupId = parseInt(selection);
    session.groupId = groupId;
    const groupResult = await buildGroupKeyboard(lang, userId);
    const group = groupResult.groups.find((g) => g.telegram_group_id === groupId);
    session.groupTitle = group ? group.title : `Group ${groupId}`;
  }

  session.step = 'await_confirm';
  session.history.push({ step: 'await_group', msg: selection });

  const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
  const displayDate = session.remindAt.tz(timezone).format('DD.MM.YYYY');
  const displayTime = session.remindAt.tz(timezone).format('HH:mm');
  const recurrenceText = session.recurrence === 'none' ? t(lang, 'rec_none') :
                         session.recurrence === 'daily' ? t(lang, 'rec_daily') :
                         session.recurrence === 'weekdays' ? t(lang, 'rec_weekdays') :
                         session.recurrence === 'weekly' ? t(lang, 'rec_weekly') : session.recurrence;

  await ctx.editMessageText(
    `${t(lang, 'confirm_title')}\n\n` +
    `${t(lang, 'confirm_reminder')} ${session.reminderText}\n\n` +
    `${t(lang, 'confirm_date')} ${displayDate}\n` +
    `${t(lang, 'confirm_time')} ${displayTime}\n` +
    `🔄 ${t(lang, 'rec_' + (session.recurrence || 'none'))}\n` +
    `${t(lang, 'confirm_target')} ${session.groupTitle}`,
    {
      parse_mode: 'Markdown',
      ...buildConfirmKeyboard(lang),
    }
  );

  await ctx.answerCbQuery();
}

async function handleConfirmation(ctx) {
  const userId = ctx.from.id;
  const lang = getLang(ctx);
  const session = getSession(userId);

  if (!session || session.step !== 'await_confirm') {
    await ctx.answerCbQuery();
    return;
  }

  try {
    const reminder = await reminderService.createReminder(ctx.telegram, {
      userId,
      groupId: session.groupId,
      text: session.reminderText,
      remindAt: session.remindAt.toDate(),
      recurrence: session.recurrence || 'none',
    });

    const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';

    await ctx.editMessageText(
      t(lang, 'success', {
        id: reminder.id,
        text: session.reminderText,
        date: session.remindAt.tz(timezone).format('DD.MM.YYYY'),
        time: session.remindAt.tz(timezone).format('HH:mm'),
        target: session.groupTitle
      }),
      { parse_mode: 'Markdown' }
    );

    logger.info(`User ${userId} confirmed reminder #${reminder.id}`);
  } catch (err) {
    logger.error(`Failed to create reminder for user ${userId}:`, err);
    await ctx.editMessageText(t(lang, 'failed'));
  }

  clearSession(userId);
  await ctx.answerCbQuery();
}

async function cancelReminderFlow(ctx) {
  const userId = ctx.from?.id || ctx.callbackQuery?.from?.id;
  const lang = ctx.dbUser?.language || DEFAULT_LANG;
  clearSession(userId);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(t(lang, 'cancelled'));
    await ctx.answerCbQuery();
  } else {
    await ctx.reply(t(lang, 'cancelled'));
  }
}

async function handleRecurrenceSelection(ctx) {
  const userId = ctx.from.id;
  const lang = getLang(ctx);
  const session = getSession(userId);

  if (!session || session.step !== 'await_recurrence') {
    await ctx.answerCbQuery();
    return;
  }

  const selection = ctx.callbackQuery.data.split(':')[1];
  session.recurrence = selection;
  session.step = 'await_group';
  session.history.push({ step: 'await_recurrence', msg: selection });

  const groupResult = await buildGroupKeyboard(lang, userId);
  await ctx.editMessageText(t(lang, 'step_group'), {
    parse_mode: 'Markdown',
    ...groupResult.keyboard,
  });
  await ctx.answerCbQuery();
}

async function handleBack(ctx) {
  const userId = ctx.from.id;
  const lang = getLang(ctx);
  const session = getSession(userId);

  if (!session || !session.step || !session.history || session.history.length === 0) {
    await cancelReminderFlow(ctx);
    return;
  }

  const lastState = session.history.pop();
  session.step = lastState.step;

  // Re-render the correct step based on new state
  if (session.step === 'await_time') {
    const moment = require('moment-timezone');
    const timezone = ctx.dbUser?.timezone || 'Asia/Tashkent';
    const now = moment().tz(timezone);
    await ctx.editMessageText(t(lang, 'step_time', {
      time1: now.clone().add(1, 'hour').format('HH:00'),
      time2: now.clone().add(1, 'hour').add(15, 'minutes').format('HH:15')
    }), { parse_mode: 'Markdown' });
  } else if (session.step === 'await_recurrence') {
    const { buildRecurrenceKeyboard } = require('../keyboards/groupKeyboard');
    await ctx.editMessageText(t(lang, 'step_recurrence'), {
      parse_mode: 'Markdown',
      ...buildRecurrenceKeyboard(lang),
    });
  } else if (session.step === 'await_group') {
    const { buildGroupKeyboard } = require('../keyboards/groupKeyboard');
    const groupResult = await buildGroupKeyboard(lang, userId);
    await ctx.editMessageText(t(lang, 'step_group'), {
      parse_mode: 'Markdown',
      ...groupResult.keyboard,
    });
  }

  await ctx.answerCbQuery();
}

module.exports = {
  startReminderFlow,
  handleReminderStep,
  handleGroupSelection,
  handleRecurrenceSelection,
  handleConfirmation,
  handleBack,
  cancelReminderFlow,
  getSession,
  clearSession,
};
