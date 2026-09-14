const { query, isJsonAdapter, localStore } = require('../db');
const logger = require('../../utils/logger');

async function upsertGroup({ telegramGroupId, title, username, addedBy }) {
  if (isJsonAdapter) {
    return localStore.upsertGroup({ telegramGroupId, title, username, addedBy });
  }

  const sql = `
    INSERT INTO groups (telegram_group_id, title, username, added_by, is_active)
    VALUES ($1, $2, $3, $4, TRUE)
    ON CONFLICT (telegram_group_id)
    DO UPDATE SET title = $2, username = $3, is_active = TRUE, updated_at = NOW()
    RETURNING *
  `;
  const result = await query(sql, [telegramGroupId, title, username || null, addedBy || null]);
  return result.rows[0];
}

async function addUserToGroup(userId, groupId) {
  if (isJsonAdapter) {
    return localStore.addUserToGroup(userId, groupId);
  }

  const sql = `
    INSERT INTO user_groups (user_id, group_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, group_id) DO NOTHING
  `;
  await query(sql, [userId, groupId]);
}

async function deactivateGroup(telegramGroupId) {
  if (isJsonAdapter) {
    return localStore.deactivateGroup(telegramGroupId);
  }

  const sql = `
    UPDATE groups SET is_active = FALSE, updated_at = NOW()
    WHERE telegram_group_id = $1
    RETURNING *
  `;
  const result = await query(sql, [telegramGroupId]);
  return result.rows[0];
}

async function getAllActiveGroups() {
  if (isJsonAdapter) {
    return localStore.getAllActiveGroups();
  }

  const result = await query(
    'SELECT * FROM groups WHERE is_active = TRUE ORDER BY created_at DESC'
  );
  return result.rows;
}

async function getGroupById(telegramGroupId) {
  if (isJsonAdapter) {
    return localStore.getGroupById(telegramGroupId);
  }

  const result = await query(
    'SELECT * FROM groups WHERE telegram_group_id = $1',
    [telegramGroupId]
  );
  return result.rows[0] || null;
}

async function getUserActiveGroups(userId) {
  if (isJsonAdapter) {
    return localStore.getUserActiveGroups(userId);
  }

  // Return all active groups where the bot is present
  const result = await query(
    `SELECT DISTINCT g.*
     FROM groups g
     WHERE g.is_active = TRUE
       AND g.telegram_group_id::bigint < 0
     ORDER BY g.created_at DESC`
  );
  return result.rows;
}

module.exports = { upsertGroup, deactivateGroup, getAllActiveGroups, getUserActiveGroups, getGroupById, addUserToGroup };
