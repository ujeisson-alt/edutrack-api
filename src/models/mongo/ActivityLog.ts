import mongoose, { Document, Schema } from 'mongoose';
import { USER_ROLES, UserRole } from '../../types';

export const ACTIVITY_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'USER_REGISTERED',
  'COURSE_ENROLLED',
  'COURSE_COMPLETED',
  'LESSON_COMPLETED',
  'COURSE_CREATED',
  'COURSE_UPDATED',
  'COURSE_DELETED',
  'PROFILE_UPDATED',
  'USER_DEACTIVATED',
  'REVIEW_CREATED',
] as const;
export const RESOURCE_TYPES = ['COURSE', 'LESSON', 'USER', 'ENROLLMENT', 'REVIEW'] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface IActivityLog extends Document {
  userId?: number | null; // null en LOGIN_FAILED con email inexistente
  userRole?: UserRole | null;
  action: ActivityAction;
  resourceType?: ResourceType;
  resourceId?: number;
  timestamp: Date;
  ipAddress?: string;
  details?: Record<string, unknown>;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Number, default: null, index: true },
    userRole: { type: String, enum: [...USER_ROLES, null], default: null },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true, index: true },
    resourceType: { type: String, enum: RESOURCE_TYPES },
    resourceId: { type: Number },
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false },
);

// TTL: los logs se eliminan automáticamente a los 90 días
ActivityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
