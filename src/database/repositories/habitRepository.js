const { isJsonAdapter, localStore, query } = require('../db');

async function createHabit({ userId, title }) {
  if (isJsonAdapter) {
    return localStore.createHabit({ userId, title });
  }

  const sql = `
    INSERT INTO habits (user_id, title, streak)
    VALUES ($1, $2, 0)
    RETURNING *
  `;
  const result = await query(sql, [userId, title]);
  return result.rows[0];
}

async function getUserHabits(userId) {
  if (isJsonAdapter) {
    return localStore.getUserHabits(userId);
  }

  const sql = `
    SELECT * FROM habits
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;
  const result = await query(sql, [userId]);
  return result.rows;
}

async function completeHabit(id, userId) {
  if (isJsonAdapter) {
    return localStore.completeHabit(id, userId);
  }

  const checkSql = `SELECT * FROM habits WHERE id = $1 AND user_id = $2`;
  const res = await query(checkSql, [id, userId]);
  const habit = res.rows[0];
  if (!habit) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const lastStr = habit.last_completed_at ? new Date(habit.last_completed_at).toISOString().split('T')[0] : null;

  if (lastStr === todayStr) return habit;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newStreak = lastStr === yesterdayStr ? habit.streak + 1 : 1;

  const updateSql = `
    UPDATE habits
    SET streak = $1, last_completed_at = NOW(), updated_at = NOW()
    WHERE id = $2 AND user_id = $3
    RETURNING *
  `;
  const updated = await query(updateSql, [newStreak, id, userId]);
  return updated.rows[0];
}

async function deleteHabit(id, userId) {
  if (isJsonAdapter) {
    return localStore.deleteHabit(id, userId);
  }

  const sql = `DELETE FROM habits WHERE id = $1 AND user_id = $2 RETURNING *`;
  const res = await query(sql, [id, userId]);
  return Boolean(res.rows[0]);
}

module.exports = {
  createHabit,
  getUserHabits,
  completeHabit,
  deleteHabit,
};
