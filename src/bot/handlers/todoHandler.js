const { Markup } = require('telegraf');
const todoRepository = require('../../database/repositories/todoRepository');
const logger = require('../../utils/logger');

async function handleTodoCommand(ctx) {
  if (!ctx.from) return;
  const text = ctx.message.text.replace(/^\/todo(@\w+)?\s*/, '').trim();

  if (text.length > 0) {
    await todoRepository.createTodo({ userId: ctx.from.id, text, priority: 'medium' });
  }

  await renderTodoList(ctx);
}

async function renderTodoList(ctx) {
  const userId = ctx.from.id;
  const todos = await todoRepository.getUserTodos(userId);

  if (todos.length === 0) {
    const msg = '📝 *Список задач пуст*\n\nЧтобы добавить задачу: `/todo Купить продукты`';
    if (ctx.callbackQuery) {
      await ctx.editMessageText(msg, { parse_mode: 'Markdown' }).catch(() => {});
      await ctx.answerCbQuery();
    } else {
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    }
    return;
  }

  const buttons = todos.map((todo) => {
    const icon = todo.completed ? '✅' : '⬜';
    return [
      Markup.button.callback(`${icon} ${todo.text}`, `todo:toggle:${todo.id}`),
      Markup.button.callback('🗑', `todo:del:${todo.id}`),
    ];
  });

  const keyboard = Markup.inlineKeyboard(buttons);
  const text = `📝 *Ваш список задач (${todos.filter(t => t.completed).length}/${todos.length}):*\n\nНажмите на задачу, чтобы отметить её выполненной:`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
    await ctx.answerCbQuery();
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
  }
}

async function handleTodoCallback(ctx) {
  const data = ctx.callbackQuery.data;
  const parts = data.split(':');
  const action = parts[1];
  const id = parseInt(parts[2], 10);
  const userId = ctx.from.id;

  if (action === 'toggle') {
    await todoRepository.toggleTodo(id, userId);
  } else if (action === 'del') {
    await todoRepository.deleteTodo(id, userId);
  }

  await renderTodoList(ctx);
}

module.exports = {
  handleTodoCommand,
  handleTodoCallback,
};
