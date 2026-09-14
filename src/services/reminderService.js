const reminderRepository = require('../database/repositories/reminderRepository');
const userRepository = require('../database/repositories/userRepository');
const logger = require('../utils/logger');
const { t } = require('../locales');

async function createReminder(bot, { userId, groupId, text, remindAt, recurrence = 'none' }) {
  try {
    const reminder = await reminderRepository.createReminder({ userId, groupId, text, remindAt, recurrence });
    logger.info(`Reminder created: ID=${reminder.id} for user=${userId} at ${remindAt} recurrence=${recurrence}`);
    return reminder;
  } catch (err) {
    logger.error(`Failed to create reminder for user ${userId}:`, err);
    throw err;
  }
}

async function sendDueReminders(bot) {
  let reminders = [];
  try {
    reminders = await reminderRepository.getPendingReminders();
  } catch (err) {
    logger.error('Failed to fetch pending reminders:', err);
    return;
  }
  for (const reminder of reminders) {
    await sendReminder(bot, reminder);
  }
}

function calculateNextOccurrence(currentRemindAt, recurrence, timezone = 'Asia/Tashkent') {
  const moment = require('moment-timezone');
  let nextDate = moment(currentRemindAt).tz(timezone);
  
  if (recurrence === 'daily') {
    nextDate.add(1, 'days');
  } else if (recurrence === 'weekly') {
    nextDate.add(1, 'weeks');
  } else if (recurrence === 'weekdays') {
    nextDate.add(1, 'days');
    // skip weekends
    while (nextDate.isoWeekday() > 5) {
      nextDate.add(1, 'days');
    }
  }
  return nextDate.toDate();
}


async function sendReminder(bot, reminder) {
  try {
    const date = new Date(reminder.remind_at);
    const dateStr = date.toLocaleDateString('ru-RU').replace(/\//g, '.');
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    let userLang = 'ru';
    let autoDeleteSec = 60;
    let timezone = 'Asia/Tashkent';
    try {
      const user = await userRepository.getUserById(reminder.user_id);
      if (user) {
        userLang = user.language || 'ru';
        autoDeleteSec = user.auto_delete_duration || 60;
        timezone = user.timezone || 'Asia/Tashkent';
      }
    } catch (e) {}

    const recurrenceText = reminder.recurrence !== 'none' ? `\n🔄 *Повторение:* ${t(userLang, `rec_${reminder.recurrence}`) || reminder.recurrence}` : '';

    const msgText =
      `${t(userLang, 'reminder_header')}\n\n` +
      `${t(userLang, 'msg_text')} ${reminder.text}\n` +
      `${t(userLang, 'msg_date')} ${dateStr}\n` +
      `${t(userLang, 'msg_time')} ${timeStr}` +
      recurrenceText;

    const message = await bot.telegram.sendMessage(
      reminder.group_id,
      msgText,
      { parse_mode: 'Markdown' }
    );

    if (reminder.recurrence === 'none') {
      await reminderRepository.updateReminderStatus(reminder.id, 'sent', message.message_id);
      logger.info(`Reminder ${reminder.id} sent to ${reminder.group_id}, marked as sent`);
    } else {
      const nextDate = calculateNextOccurrence(reminder.remind_at, reminder.recurrence, timezone);
      await reminderRepository.updateReminder(reminder.id, { remind_at: nextDate, sent_message_id: message.message_id });
      logger.info(`Recurring reminder ${reminder.id} sent to ${reminder.group_id}, rescheduled to ${nextDate}`);
    }

    const deleteDelay = autoDeleteSec * 1000;
    setTimeout(async () => {
      try {
        await bot.telegram.deleteMessage(reminder.group_id, message.message_id);
        logger.info(`Reminder msg ${message.message_id} auto-deleted from ${reminder.group_id}`);
      } catch (deleteErr) {
        logger.error(`Failed to delete reminder msg ${message.message_id}:`, deleteErr.message);
      }
    }, deleteDelay);

  } catch (err) {
    logger.error(`Failed to send reminder ${reminder.id} to ${reminder.group_id}:`, err.message);
    if (err.description && err.description.includes('chat not found')) {
      await reminderRepository.updateReminderStatus(reminder.id, 'deleted');
    }
  }
}

async function getUserReminders(userId) {
  return reminderRepository.getUserReminders(userId);
}

async function deleteReminder(reminderId, userId) {
  const deleted = await reminderRepository.deleteReminder(reminderId, userId);
  if (deleted) logger.info(`Reminder ${reminderId} deleted by user ${userId}`);
  return deleted;
}

async function getReminderById(id, userId) {
  return reminderRepository.getReminderById(id, userId);
}

async function updateReminder(id, updates) {
  return reminderRepository.updateReminder(id, updates);
}

module.exports = { 
  createReminder, 
  sendDueReminders, 
  getUserReminders, 
  deleteReminder, 
  getReminderById,
  updateReminder 
};
