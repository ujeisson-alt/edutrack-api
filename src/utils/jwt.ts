import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthUser, USER_ROLES, UserRole } from '../types';

export const signToken = (user: AuthUser): string =>
  jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });

export const verifyToken = (token: string): AuthUser => {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string' || typeof decoded.id !== 'number' || !USER_ROLES.includes(decoded.role as UserRole)) {
    throw new Error('Payload de token inválido');
  }
  return { id: decoded.id, role: decoded.role as UserRole };
};
