/**
 * Borra y recrea el esquema completo (tablas, tipos, vista y función).
 * ⚠️ Solo para desarrollo / primer deploy. Uso: npm run db:reset
 */
import fs from 'fs';
import path from 'path';
import { sequelize } from '../config/database';
import { logger } from '../utils/logger';

const run = async (): Promise<void> => {
  const file = path.resolve(process.cwd(), 'database', 'schema.sql');
  const sql = fs.readFileSync(file, 'utf8');
  await sequelize.query(sql, { logging: false });
  logger.info('✅ Esquema de PostgreSQL recreado desde database/schema.sql');
  await sequelize.close();
};

run().catch(async (error: unknown) => {
  logger.error('❌ Error recreando el esquema', error instanceof Error ? error.message : error);
  await sequelize.close();
  process.exit(1);
});
