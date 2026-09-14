require('dotenv').config();
const { createBot } = require('./bot');
const { testConnection } = require('./database/db');
const { startReminderJob } = require('./jobs/reminderJob');
const { startDigestJob } = require('./jobs/digestJob');
const logger = require('./utils/logger');
const fs = require('fs');

// Ensure logs directory exists
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

async function main() {
  logger.info('Starting ReminderFlow Bot...');

  // Test DB connection
  const dbOk = await testConnection();
  if (!dbOk) {
    logger.error('Database connection failed. Fix DATABASE_URL or DB_* settings first.');
    logger.error('After the connection works, run: npm run migrate');
    process.exit(1);
  }

  // Create and launch bot
  const bot = createBot();

  // Start reminder delivery job & morning digest job
  startReminderJob(bot);
  startDigestJob(bot);

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down...`);
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Launch lightweight HTTP server for Render health checks
  const http = require('http');
  const port = process.env.PORT || 3000;
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ReminderFlow Bot is running!\n');
  }).listen(port, () => {
    logger.info(`Health check server running on port ${port}`);
  });

  // Launch polling
  await bot.launch();
  logger.info('ReminderFlow Bot is running! 🚀');
}

main().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
