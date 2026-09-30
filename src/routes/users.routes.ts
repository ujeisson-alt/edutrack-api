import { Router } from 'express';
import * as ctrl from '../controllers/users.controller';
import { authMiddleware, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../schemas/common.schema';
import { listUsersQuerySchema, updateUserSchema } from '../schemas/user.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRoles('ADMIN'), validate({ query: listUsersQuerySchema }), asyncHandler(ctrl.listUsers));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getUserById));
router.put('/:id', validate({ params: idParamSchema, body: updateUserSchema }), asyncHandler(ctrl.updateUser));
router.delete('/:id', requireRoles('ADMIN'), validate({ params: idParamSchema }), asyncHandler(ctrl.deleteUser));

export default router;
