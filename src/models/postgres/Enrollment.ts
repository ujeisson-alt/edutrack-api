import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../../config/database';
import { ENROLLMENT_STATUSES, EnrollmentStatus, PAYMENT_STATUSES, PaymentStatus } from '../../types';
import type { User } from './User';
import type { Course } from './Course';

export class Enrollment extends Model<InferAttributes<Enrollment>, InferCreationAttributes<Enrollment>> {
  declare id: CreationOptional<number>;
  declare studentId: ForeignKey<User['id']>;
  declare courseId: ForeignKey<Course['id']>;
  declare enrolledAt: CreationOptional<Date>;
  declare status: CreationOptional<EnrollmentStatus>;
  declare paymentStatus: CreationOptional<PaymentStatus>;
}

Enrollment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    enrolledAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.ENUM(...ENROLLMENT_STATUSES), defaultValue: 'ACTIVE' },
    paymentStatus: { type: DataTypes.ENUM(...PAYMENT_STATUSES), defaultValue: 'PENDING' },
  },
  // La tabla usa enrolled_at en lugar de created_at/updated_at
  { sequelize, tableName: 'enrollments', underscored: true, timestamps: false },
);
