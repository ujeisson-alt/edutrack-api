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
import type { Category } from './Category';

export class Course extends Model<InferAttributes<Course>, InferCreationAttributes<Course>> {
  declare id: CreationOptional<number>;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare teacherId: ForeignKey<User['id']>;
  declare categoryId: CreationOptional<ForeignKey<Category['id']> | null>;
  declare price: CreationOptional<number>;
  declare maxStudents: CreationOptional<number>;
  declare isPublished: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Course.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    teacherId: { type: DataTypes.INTEGER, allowNull: false },
    categoryId: { type: DataTypes.INTEGER, allowNull: true },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      // pg devuelve NUMERIC como string → lo convertimos a number
      get(): number {
        const raw = this.getDataValue('price') as unknown;
        return raw === null || raw === undefined ? 0 : Number(raw);
      },
    },
    maxStudents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
    isPublished: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'courses', underscored: true, timestamps: true },
);
