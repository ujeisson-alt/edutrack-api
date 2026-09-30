import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../../config/database';
import type { User } from './User';
import type { Lesson } from './Lesson';

export class Progress extends Model<InferAttributes<Progress>, InferCreationAttributes<Progress>> {
  declare id: CreationOptional<number>;
  declare studentId: ForeignKey<User['id']>;
  declare lessonId: ForeignKey<Lesson['id']>;
  declare completedAt: CreationOptional<Date | null>;
  declare isCompleted: CreationOptional<boolean>;
}

Progress.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    lessonId: { type: DataTypes.INTEGER, allowNull: false },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    isCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, tableName: 'progress', underscored: true, timestamps: false },
);
