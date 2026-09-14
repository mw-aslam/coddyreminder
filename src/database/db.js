const { Pool } = require('pg');
const config = require('../config/config');
const logger = require('../utils/logger');
const localStore = require('./localStore');

const isJsonAdapter = config.database.adapter === 'json';

const poolConfig = !isJsonAdapter && config.database.connectionString
  ? {
      connectionString: config.database.connectionString,
      ssl: config.database.ssl,
      max: config.database.max,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    }
  : {
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl,
      max: config.database.max,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    };

const pool = isJsonAdapter
  ? {
      end: async () => {},
    }
  : new Pool(poolConfig);

function getDatabaseConnectionHint(err) {
  const message = err?.message || '';

  if (message.includes('tenant/user') && message.includes('not found')) {
    return 'Supabase pooler tenant/user not found. Use the Session pooler connection string from Supabase Dashboard; the username must be postgres.<PROJECT-REF> and the pooler region must match the project.';
  }

  if (err?.code === 'ENOTFOUND') {
    return 'Database host was not resolved by Node. Supabase direct db.<PROJECT-REF>.supabase.co endpoints are IPv6-only unless the IPv4 add-on is enabled; use the shared pooler for local IPv4 networks.';
  }

  if (err?.code === 'ENETUNREACH') {
    return 'Database host resolved to IPv6, but this machine has no IPv6 route. Use the Supabase shared pooler or enable the IPv4 add-on.';
  }

  if (/password authentication failed/i.test(message)) {
    return 'Database password is incorrect. Reset or copy the database password from Supabase settings.';
  }

  return 'Please check DATABASE_URL or the DB_* settings.';
}

if (!isJsonAdapter) {
  pool.on('connect', () => {
    logger.debug('New database connection established');
  });

  pool.on('error', (err) => {
    logger.error('Unexpected database pool error:', err);
  });
}

async function query(text, params) {
  if (isJsonAdapter) {
    throw new Error('SQL query called while DB_ADAPTER=json. Use localStore repository methods instead.');
  }

  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms: ${text.substring(0, 80)}`);
    return result;
  } catch (err) {
    logger.error(`Database query error: ${err.message}`, { query: text, params });
    throw err;
  }
}

async function getClient() {
  if (isJsonAdapter) {
    throw new Error('PostgreSQL clients are not available while DB_ADAPTER=json.');
  }

  return pool.connect();
}

async function testConnection() {
  if (isJsonAdapter) {
    await localStore.testConnection();
    logger.info(`Local JSON database ready: ${localStore.databasePath}`);
    return true;
  }

  try {
    const result = await query('SELECT NOW()');
    logger.info('Database connection successful:', result.rows[0].now);

    // Auto-initialize SQL schema & tables if missing
    try {
      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, '../../schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await query(schema);
        await query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recurrence VARCHAR(50) DEFAULT 'none'`);
        await query(`ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_group_id_fkey`);
        await query(`ALTER TABLE user_groups DROP CONSTRAINT IF EXISTS user_groups_group_id_fkey`);
        const habitsSqlPath = path.join(__dirname, 'migrations/003_add_habits_and_todos.sql');
        if (fs.existsSync(habitsSqlPath)) {
          const habitsSql = fs.readFileSync(habitsSqlPath, 'utf8');
          await query(habitsSql);
        }
        logger.info('Auto-migration executed successfully on startup.');
      }
    } catch (migErr) {
      logger.warn('Auto-migration warning:', migErr.message);
    }

    return true;
  } catch (err) {
    logger.error(`Database connection failed: ${getDatabaseConnectionHint(err)}`);
    return false;
  }
}

module.exports = { query, getClient, pool, testConnection, isJsonAdapter, localStore };
