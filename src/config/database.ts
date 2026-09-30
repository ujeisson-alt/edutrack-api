import { Options, Sequelize } from 'sequelize';
import { env } from './env';
import { logger } from '../utils/logger';

const common: Options = {
  dialect: 'postgres',
  logging: env.NODE_ENV === 'development' ? (sql: string) => logger.debug(sql) : false,
  define: { underscored: true, timestamps: true }, // snake_case automático en columnas
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
};

/**
 * Railway / Render entregan una única DATABASE_URL (con SSL).
 * En local se usan las variables PG_* por separado.
 */
export const sequelize = env.DATABASE_URL
  ? new Sequelize(env.DATABASE_URL, {
      ...common,
      // Red privada de Railway (*.railway.internal) no usa SSL; URLs públicas / Render / Neon sí.
      dialectOptions:
        env.PG_SSL || /sslmode=require/.test(env.DATABASE_URL) ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    })
  : new Sequelize({
      ...common,
      host: env.PG_HOST,
      port: env.PG_PORT,
      username: env.PG_USER,
      password: env.PG_PASSWORD,
      database: env.PG_DATABASE,
      dialectOptions: env.PG_SSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    });

export const connectPostgres = async (): Promise<void> => {
  await sequelize.authenticate();
  logger.info('✅ PostgreSQL conectado correctamente');
};
