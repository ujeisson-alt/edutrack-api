import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../../config/database';
import type { Course } from './Course';

export class Lesson extends Model<InferAttributes<Lesson>, InferCreationAttributes<Lesson>> {
  declare id: CreationOptional<number>;
  declare courseId: ForeignKey<Course['id']>;
  declare title: string;
  declare content: CreationOptional<string | null>;
  declare orderIndex: CreationOptional<number>;
  declare durationMinutes: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
}

Lesson.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: true },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    durationMinutes: { type: DataTypes.INTEGER, allowNull: true },
    createdAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'lessons', underscored: true, timestamps: true, updatedAt: false },
);
