import { ActivityAction, ActivityLog, ResourceType } from '../models/mongo/ActivityLog';
import { UserRole } from '../types';
import { logger } from './logger';

interface LogInput {
  userId?: number | null;
  userRole?: UserRole | null;
  action: ActivityAction;
  resourceType?: ResourceType;
  resourceId?: number;
  ipAddress?: string;
  details?: Record<string, unknown>;
}

/**
 * Registra un evento en MongoDB. Nunca rompe el flujo principal:
 * si Mongo falla, se loguea el error y la request continúa.
 */
export const logActivity = async (input: LogInput): Promise<void> => {
  try {
    await ActivityLog.create({ ...input, timestamp: new Date() });
  } catch (error) {
    logger.error('No se pudo registrar ActivityLog', error instanceof Error ? error.message : error);
  }
};
