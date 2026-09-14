require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, testConnection, isJsonAdapter } = require('./db');
const logger = require('../utils/logger');

async function runMigrations() {
  logger.info('Starting database migration...');

  const connected = await testConnection();
  if (!connected) {
    logger.error('Cannot connect to database.');
    return false;
  }

  if (isJsonAdapter) {
    logger.info('Local JSON database does not require SQL migrations.');
    return true;
  }

  const schemaPath = path.join(__dirname, '../../schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    await query(schema);
    logger.info('Migration completed successfully.');

    // Add new columns to existing tables
    await query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recurrence VARCHAR(50) DEFAULT 'none'`);

    // Drop foreign key constraints so personal chat reminders work without FK errors
    await query(`ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_group_id_fkey`);
    await query(`ALTER TABLE user_groups DROP CONSTRAINT IF EXISTS user_groups_group_id_fkey`);

    // Backfill user_groups from existing groups
    await query(`
      INSERT INTO user_groups (user_id, group_id)
      SELECT added_by, telegram_group_id
      FROM groups
      WHERE added_by IS NOT NULL
        AND telegram_group_id::bigint < 0
      ON CONFLICT DO NOTHING
    `);
    logger.info('user_groups backfill done.');

    // Execute 003_add_habits_and_todos.sql
    const habitsSqlPath = path.join(__dirname, 'migrations/003_add_habits_and_todos.sql');
    if (fs.existsSync(habitsSqlPath)) {
      const habitsSql = fs.readFileSync(habitsSqlPath, 'utf8');
      await query(habitsSql);
      logger.info('habits and todos tables migrated successfully.');
    }
    return true;
  } catch (err) {
    logger.error('Migration failed:', err);
    return false;
  }
}

if (require.main === module) {
  runMigrations().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runMigrations };
