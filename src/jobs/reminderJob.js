const { sendDueReminders } = require('../services/reminderService');
const logger = require('../utils/logger');

function startReminderJob(bot) {
  let isRunning = false;
  let lastErrorTime = 0;

  const checkReminders = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await sendDueReminders(bot);
    } catch (err) {
      const now = Date.now();
      if (now - lastErrorTime > 60000) {
        logger.error('Reminder job error:', err.message || err);
        lastErrorTime = now;
      }
    } finally {
      isRunning = false;
    }
  };

  // Run immediately on start
  checkReminders();

  // High-precision poll every 500ms so reminders trigger instantly at target time :00
  const interval = setInterval(checkReminders, 500);
  interval.unref();

  logger.info('Reminder job started (high-precision 500ms polling for instant delivery)');
  return {
    stop: () => clearInterval(interval),
  };
}

module.exports = { startReminderJob };
