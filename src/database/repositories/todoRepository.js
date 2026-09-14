const { isJsonAdapter, localStore, query } = require('../db');

async function createTodo({ userId, text, priority = 'medium' }) {
  if (isJsonAdapter) {
    return localStore.createTodo({ userId, text, priority });
  }

  const sql = `
    INSERT INTO todos (user_id, text, priority, completed)
    VALUES ($1, $2, $3, false)
    RETURNING *
  `;
  const result = await query(sql, [userId, text, priority]);
  return result.rows[0];
}

async function getUserTodos(userId) {
  if (isJsonAdapter) {
    return localStore.getUserTodos(userId);
  }

  const sql = `
    SELECT * FROM todos
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;
  const result = await query(sql, [userId]);
  return result.rows;
}

async function toggleTodo(id, userId) {
  if (isJsonAdapter) {
    return localStore.toggleTodo(id, userId);
  }

  const sql = `
    UPDATE todos
    SET completed = NOT completed, updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `;
  const result = await query(sql, [id, userId]);
  return result.rows[0] || null;
}

async function deleteTodo(id, userId) {
  if (isJsonAdapter) {
    return localStore.deleteTodo(id, userId);
  }

  const sql = `DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *`;
  const result = await query(sql, [id, userId]);
  return Boolean(result.rows[0]);
}

module.exports = {
  createTodo,
  getUserTodos,
  toggleTodo,
  deleteTodo,
};
