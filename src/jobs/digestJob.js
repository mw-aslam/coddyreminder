const moment = require('moment-timezone');
const reminderRepository = require('../database/repositories/reminderRepository');
const logger = require('../utils/logger');

const sentDigests = new Map();

function startDigestJob(bot) {
  const interval = setInterval(async () => {
    try {
      await sendMorningDigests(bot);
    } catch (err) {
      logger.error('Digest job error:', err);
    }
  }, 60 * 1000);
  interval.unref();

  logger.info('Morning Digest job started (checks daily at 08:00 AM)');
  return interval;
}

async function sendMorningDigests(bot) {
  const localStore = require('../database/localStore');
  const data = localStore.loadDatabase ? localStore.loadDatabase() : null;
  const users = data ? data.users : [];

  for (const user of users) {
    const tz = user.timezone || 'Asia/Tashkent';
    const now = moment().tz(tz);

    if (now.hour() === 8 && now.minute() === 0) {
      const todayStr = now.format('YYYY-MM-DD');
      const cacheKey = `${user.telegram_user_id}:${todayStr}`;

      if (sentDigests.has(cacheKey)) continue;
      sentDigests.set(cacheKey, true);

      const allReminders = await reminderRepository.getUserReminders(user.telegram_user_id, 'pending');
      const todayReminders = allReminders.filter((r) => {
        const rDate = moment(r.remind_at).tz(tz);
        return rDate.isSame(now, 'day');
      });

      if (todayReminders.length === 0) continue;

      const lang = user.language || 'ru';
      const lines = todayReminders.map((r, i) => `${i + 1}. 🕒 *${moment(r.remind_at).tz(tz).format('HH:mm')}* — ${r.text}`);

      const header = lang === 'uz'
        ? `☀️ *Xayrli kun! Bugungi rejalaringiz (${todayReminders.length} ta):*`
        : `☀️ *Доброе утро! Ваши задачи на сегодня (${todayReminders.length}):*`;

      const msg = `${header}\n\n${lines.join('\n')}\n\nУдачного дня! 💪`;

      await bot.telegram.sendMessage(user.telegram_user_id, msg, { parse_mode: 'Markdown' }).catch((err) => {
        logger.warn(`Failed to send morning digest to user ${user.telegram_user_id}:`, err.message);
      });
    }
  }
}

module.exports = { startDigestJob };
