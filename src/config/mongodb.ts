import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export const connectMongoDB = async (uri: string = env.MONGODB_URI): Promise<void> => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  logger.info('✅ MongoDB conectado correctamente');
};

export const disconnectMongoDB = async (): Promise<void> => {
  await mongoose.disconnect();
};
