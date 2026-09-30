import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/postgres';
import { createError } from '../middlewares/errorHandler';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';
import { signToken } from '../utils/jwt';
import { logActivity } from '../utils/activityLogger';

const SALT_ROUNDS = 10;

/** Hash ficticio para que el login tarde lo mismo exista o no el email (evita enumeración) */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', SALT_ROUNDS);

const toPublicUser = (user: User) => {
  const { password: _password, ...rest } = user.get({ plain: true });
  return rest;
};

/** POST /api/v1/auth/register */
export const register = async (req: Request, res: Response): Promise<void> => {
  const data = req.body as RegisterInput;

  const exists = await User.findOne({ where: { email: data.email } });
  if (exists) throw createError('El email ya está registrado', 409);

  const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await User.create({ ...data, password: hashed });

  await logActivity({
    userId: user.id,
    userRole: user.role,
    action: 'USER_REGISTERED',
    resourceType: 'USER',
    resourceId: user.id,
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'Usuario registrado correctamente',
    data: { user: toPublicUser(user), token: signToken({ id: user.id, role: user.role }) },
  });
};

/** POST /api/v1/auth/login */
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as LoginInput;

  const user = await User.scope('withPassword').findOne({ where: { email } });
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

  if (!user || !valid || !user.isActive) {
    await logActivity({
      userId: user?.id ?? null,
      userRole: user?.role ?? null,
      action: 'LOGIN_FAILED',
      resourceType: 'USER',
      ipAddress: req.ip,
      details: {
        email,
        reason: !user ? 'EMAIL_NOT_FOUND' : !valid ? 'WRONG_PASSWORD' : 'USER_INACTIVE',
      },
    });
    // Mismo mensaje en todos los casos: no revelamos si el email existe
    throw createError('Credenciales inválidas', 401);
  }

  await logActivity({ userId: user.id, userRole: user.role, action: 'LOGIN', ipAddress: req.ip });

  res.json({
    success: true,
    message: 'Login exitoso',
    data: { user: toPublicUser(user), token: signToken({ id: user.id, role: user.role }) },
  });
};

/** GET /api/v1/auth/me */
export const me = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.user!.id);
  if (!user || !user.isActive) throw createError('Usuario no encontrado', 404);
  res.json({ success: true, data: user });
};
