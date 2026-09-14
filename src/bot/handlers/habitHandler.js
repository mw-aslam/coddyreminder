const { Markup } = require('telegraf');
const habitRepository = require('../../database/repositories/habitRepository');

async function handleHabitsCommand(ctx) {
  if (!ctx.from) return;
  const text = ctx.message.text.replace(/^\/habits(@\w+)?\s*/, '').trim();

  if (text.length > 0) {
    await habitRepository.createHabit({ userId: ctx.from.id, title: text });
  }

  await renderHabitList(ctx);
}

async function renderHabitList(ctx) {
  const userId = ctx.from.id;
  const habits = await habitRepository.getUserHabits(userId);

  if (habits.length === 0) {
    const msg = '🎯 *Трекер привычек пуст*\n\nЧтобы добавить привычку: `/habits Чтение книг 30 мин`';
    if (ctx.callbackQuery) {
      await ctx.editMessageText(msg, { parse_mode: 'Markdown' }).catch(() => {});
      await ctx.answerCbQuery();
    } else {
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    }
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const buttons = habits.map((habit) => {
    const lastStr = habit.last_completed_at ? new Date(habit.last_completed_at).toISOString().split('T')[0] : null;
    const isDoneToday = lastStr === todayStr;
    const streakBadge = habit.streak > 0 ? `🔥 ${habit.streak}` : '⚡ 0';
    const statusBtn = isDoneToday
      ? Markup.button.callback(`✅ ${habit.title} (${streakBadge})`, `habit:noop`)
      : Markup.button.callback(`🎯 ${habit.title} (${streakBadge})`, `habit:done:${habit.id}`);

    return [statusBtn, Markup.button.callback('🗑', `habit:del:${habit.id}`)];
  });

  const keyboard = Markup.inlineKeyboard(buttons);
  const text = '🎯 *Ваши привычки:*\n\nОтмечайте выполнение каждый день, чтобы растить серию (Streak 🔥):';

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
    await ctx.answerCbQuery();
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
  }
}

async function handleHabitCallback(ctx) {
  const data = ctx.callbackQuery.data;
  const parts = data.split(':');
  const action = parts[1];
  const id = parseInt(parts[2], 10);
  const userId = ctx.from.id;

  if (action === 'done') {
    const updated = await habitRepository.completeHabit(id, userId);
    if (updated) {
      await ctx.answerCbQuery(`🔥 Серия привычки: ${updated.streak} д! Молодчина!`, { show_alert: true });
    }
  } else if (action === 'del') {
    await habitRepository.deleteHabit(id, userId);
    await ctx.answerCbQuery('🗑 Привычка удалена.');
  } else {
    await ctx.answerCbQuery();
  }

  await renderHabitList(ctx);
}

module.exports = {
  handleHabitsCommand,
  handleHabitCallback,
};
