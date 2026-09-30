import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Op, WhereOptions } from 'sequelize';
import { User } from '../models/postgres';
import { createError } from '../middlewares/errorHandler';
import { IdParam } from '../schemas/common.schema';
import { ListUsersQuery, UpdateUserInput } from '../schemas/user.schema';
import { buildMeta, getOffset } from '../utils/pagination';
import { logActivity } from '../utils/activityLogger';

const PUBLIC_ATTRIBUTES = ['id', 'name', 'role', 'bio', 'avatarUrl', 'isActive', 'createdAt'];

/** GET /api/v1/users — ADMIN */
export const listUsers = async (req: Request, res: Response): Promise<void> => {
  const { page, limit, role, isActive, search } = req.query as unknown as ListUsersQuery;

  const where: WhereOptions<User> = {
    ...(role && { role }),
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { email: { [Op.iLike]: `%${search}%` } }],
    }),
  };

  const { rows, count } = await User.findAndCountAll({
    where,
    limit,
    offset: getOffset(page, limit),
    order: [['createdAt', 'DESC']],
  });

  res.json({ success: true, data: rows, meta: buildMeta(page, limit, count) });
};

/**
 * GET /api/v1/users/:id — AUTH
 * El propio usuario o un ADMIN ven el perfil completo;
 * el resto solo ve el perfil público (sin email).
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;
  const requester = req.user!;
  const fullAccess = requester.role === 'ADMIN' || requester.id === id;

  const user = await User.findByPk(id, fullAccess ? {} : { attributes: PUBLIC_ATTRIBUTES });
  if (!user || (!fullAccess && !user.isActive)) throw createError('Usuario no encontrado', 404);

  res.json({ success: true, data: user });
};

/** PUT /api/v1/users/:id — AUTH (solo el propio perfil, o ADMIN) */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;
  const requester = req.user!;
  const data = req.body as UpdateUserInput;
  const isAdmin = requester.role === 'ADMIN';

  if (!isAdmin && requester.id !== id) throw createError('Solo podés modificar tu propio perfil', 403);
  if (!isAdmin && (data.role !== undefined || data.isActive !== undefined)) {
    throw createError('Solo un ADMIN puede cambiar el rol o el estado de un usuario', 403);
  }

  const user = await User.scope('withPassword').findByPk(id);
  if (!user) throw createError('Usuario no encontrado', 404);

  if (data.email && data.email !== user.email) {
    const taken = await User.findOne({ where: { email: data.email } });
    if (taken) throw createError('El email ya está en uso', 409);
  }

  const { currentPassword, newPassword, ...fields } = data;
  if (newPassword) {
    const ok = await bcrypt.compare(currentPassword ?? '', user.password);
    if (!ok) throw createError('La contraseña actual es incorrecta', 400);
    user.password = await bcrypt.hash(newPassword, 10);
  }

  user.set(fields);
  await user.save();

  await logActivity({
    userId: requester.id,
    userRole: requester.role,
    action: 'PROFILE_UPDATED',
    resourceType: 'USER',
    resourceId: user.id,
    details: { fields: Object.keys(data).filter((k) => k !== 'currentPassword' && k !== 'newPassword'), passwordChanged: !!newPassword },
  });

  const { password: _password, ...plain } = user.get({ plain: true });
  res.json({ success: true, message: 'Perfil actualizado', data: plain });
};

/**
 * DELETE /api/v1/users/:id — ADMIN
 * Baja lógica (is_active = false): preserva historial de cursos, inscripciones y reportes.
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;
  const requester = req.user!;

  if (requester.id === id) throw createError('Un ADMIN no puede eliminarse a sí mismo', 400);

  const user = await User.findByPk(id);
  if (!user || !user.isActive) throw createError('Usuario no encontrado', 404);

  await user.update({ isActive: false });

  await logActivity({
    userId: requester.id,
    userRole: requester.role,
    action: 'USER_DEACTIVATED',
    resourceType: 'USER',
    resourceId: id,
  });

  res.json({ success: true, message: 'Usuario desactivado correctamente' });
};
