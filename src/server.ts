import { env } from './config/env';
import app from './app';
import { connectPostgres, sequelize } from './config/database';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb';
import { logger } from './utils/logger';

const start = async (): Promise<void> => {
  try {
    await connectPostgres();
    await connectMongoDB();
  } catch (error) {
    logger.error('❌ No se pudo conectar a las bases de datos', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 EduTrack API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Apagado ordenado (Railway envía SIGTERM en cada deploy)
  const shutdown = (signal: string) => {
    logger.info(`${signal} recibido, cerrando servidor...`);
    server.close(async () => {
      await Promise.allSettled([sequelize.close(), disconnectMongoDB()]);
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

void start();
