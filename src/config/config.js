require('dotenv').config();

const config = {
  bot: {
    token: process.env.BOT_TOKEN,
  },
  ai: {
    groqApiKey: process.env.GROQ_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  },
  database: {
    adapter: process.env.DB_ADAPTER || 'postgres',
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'reminderflow',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: (process.env.NODE_ENV === 'production' || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase.com'))) ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    jsonPath: process.env.JSON_DB_PATH || 'data/database.json',
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    autoDeleteDelay: parseInt(process.env.AUTO_DELETE_DELAY) || 300000,
    defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
  },
};

if (!config.bot.token) {
  throw new Error('BOT_TOKEN is required in environment variables');
}

module.exports = config;
