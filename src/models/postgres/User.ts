import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../../config/database';
import { USER_ROLES, UserRole } from '../../types';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  declare password: string;
  declare role: CreationOptional<UserRole>;
  declare bio: CreationOptional<string | null>;
  declare avatarUrl: CreationOptional<string | null>;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
      set(value: string) {
        this.setDataValue('email', value.trim().toLowerCase());
      },
    },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM(...USER_ROLES), allowNull: false, defaultValue: 'STUDENT' },
    bio: { type: DataTypes.TEXT, allowNull: true },
    avatarUrl: { type: DataTypes.STRING(500), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
    timestamps: true,
    // Nunca devolver el hash del password salvo que se pida explícitamente
    defaultScope: { attributes: { exclude: ['password'] } },
    scopes: { withPassword: { attributes: { include: ['password'] } } },
  },
);
