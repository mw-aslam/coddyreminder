const { Telegraf, session } = require('telegraf');
const config = require('./config/config');
const logger = require('./utils/logger');

const loggerMiddleware = require('./bot/middlewares/logger');
const userMiddleware = require('./bot/middlewares/user');

const commands = require('./bot/commands/index');
const { handleCallbacks } = require('./bot/handlers/callbackHandler');
const { handleMyChatMember } = require('./bot/handlers/groupHandler');
const { handleReminderStep, getSession } = require('./handlers/reminderHandler');
const groupService = require('./services/groupService');
const groupRepository = require('./database/repositories/groupRepository');

function createBot() {
  const bot = new Telegraf(config.bot.token);

  // Middleware
  bot.use(loggerMiddleware());
  bot.use(userMiddleware());

  // Cache for group memberships to prevent DB queries on every message
  const groupMembershipCache = new Set();

  // Auto-track user-group memberships & block group usage
  bot.use(async (ctx, next) => {
    // Only process group-related tracking if not a private chat
    if (ctx.from && ctx.chat && ctx.chat.type !== 'private') {
      const userId = ctx.from.id;
      const groupId = ctx.chat.id;

      // Automatically register group and link user
      if (groupId < 0) {
        groupService.registerGroup(ctx, ctx.chat).catch(() => {});
      }

      // Allow my_chat_member events and slash commands in groups
      if (ctx.updateType !== 'my_chat_member' && !ctx.message?.text?.startsWith('/')) return;
    }

    return next();
  });

  // Register bot commands with Telegram for all language codes (default, ru, uz, en)
  const russianCommands = [
    { command: 'start', description: 'Запустить бота' },
    { command: 'help', description: 'Помощь и инструкции' },
    { command: 'reminder', description: 'Создать напоминание' },
    { command: 'todo', description: 'Список задач (Checklist)' },
    { command: 'habits', description: 'Трекер привычек (Habits)' },
    { command: 'export', description: 'Экспорт в Календарь (.ics)' },
    { command: 'myreminders', description: 'Мои напоминания' },
    { command: 'delete', description: 'Удалить напоминание' },
    { command: 'groups', description: 'Мои группы' },
    { command: 'settings', description: 'Настройки' },
    { command: 'cancel', description: 'Отмена операции' },
  ];

  Promise.all([
    bot.telegram.setMyCommands(russianCommands),
    bot.telegram.setMyCommands(russianCommands, { language_code: 'ru' }),
    bot.telegram.setMyCommands(russianCommands, { language_code: 'uz' }),
    bot.telegram.setMyCommands(russianCommands, { language_code: 'en' }),
  ])
    .then(() => logger.info('Bot commands registered with Telegram in Russian for all languages'))
    .catch(logger.error);

  const todoHandler = require('./bot/handlers/todoHandler');
  const habitHandler = require('./bot/handlers/habitHandler');
  const { generateICSForUser } = require('./services/calendarService');

  // Commands
  bot.command('start', commands.startCommand);
  bot.command('help', commands.helpCommand);
  bot.command('reminder', commands.reminderCommand);
  bot.command('remind', commands.remindGroupCommand);
  bot.command('todo', todoHandler.handleTodoCommand);
  bot.command('habits', habitHandler.handleHabitsCommand);
  bot.command('export', async (ctx) => {
    if (!ctx.from) return;
    const lang = ctx.dbUser?.language || 'ru';
    const result = await generateICSForUser(ctx.from.id);

    if (!result) {
      const emptyMsg = lang === 'uz'
        ? '📭 *Eksport qilish uchun yaratilgan eslatmalar topilmadi.*\n\nYangi eslatma yaratish uchun /reminder yuboring.'
        : '📭 *Нет созданных напоминаний для экспорта.*\n\nСоздайте новое с помощью /reminder.';
      await ctx.reply(emptyMsg, { parse_mode: 'Markdown' });
      return;
    }

    const { icsString, reminders } = result;
    const buffer = Buffer.from(icsString, 'utf-8');

    let textList = lang === 'uz'
      ? `📅 *Eksport qilingan eslatmalar ro'yxati (${reminders.length} ta):*\n\n`
      : `📅 *Список экспортированных напоминаний (${reminders.length}):*\n\n`;

    reminders.forEach((r, i) => {
      const d = new Date(r.remind_at).toLocaleDateString('ru-RU');
      const tStr = new Date(r.remind_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      textList += `${i + 1}. 📝 *${r.text}* — ${d} ${tStr}\n`;
    });

    textList += lang === 'uz'
      ? `\n👇 *Quyidagi .ics faylini bosib Google yoki Apple Calendar'ga yuklab olishingiz mumkin:*`
      : `\n👇 *Скачайте .ics файл ниже для импорта в Google или Apple Calendar:*`;

    await ctx.reply(textList, { parse_mode: 'Markdown' });

    await ctx.replyWithDocument(
      { source: buffer, filename: 'coddy_reminders.ics' },
      { caption: '📅 Coddy Reminders (.ics)', parse_mode: 'Markdown' }
    );
  });
  bot.command('myreminders', commands.myRemindersCommand);
  bot.command('delete', commands.deleteCommand);
  bot.command('groups', commands.groupsCommand);
  bot.command('settings', commands.settingsCommand);
  bot.command('cancel', commands.cancelCommand);

  // Callback queries (inline keyboard buttons)
  bot.on('callback_query', handleCallbacks);

  // Group events (bot added/removed)
  bot.on('my_chat_member', handleMyChatMember);

  // Handle voice messages (Ovozi xabar / Voice note)
  const voiceService = require('./services/voiceService');
  bot.on(['voice', 'audio'], voiceService.handleVoiceMessage);

  // Handle text messages (for multi-step flows and natural text reminders)
  bot.on('text', async (ctx) => {
    // If it's a group, ignore text that isn't a command
    if (ctx.chat.type !== 'private') return;

    const session = getSession(ctx.from.id);
    if (session && session.step) {
      const handled = await handleReminderStep(ctx);
      if (handled) return;
    }

    // Try natural language text parsing (e.g. "bugun soat 15:28 ga demoday boladi")
    const naturalHandled = await voiceService.handleNaturalTextMessage(ctx, ctx.message.text);
    if (naturalHandled) return;

    // Unknown message
    const { t } = require('./locales');
    const lang = ctx.dbUser?.language || 'ru';
    await ctx.reply(t(lang, 'unknown_cmd'));
  });

  // Error handler
  bot.catch((err, ctx) => {
    logger.error(`Global bot error for update ${ctx.update.update_id}:`, err);
  });

  return bot;
}

module.exports = { createBot };
