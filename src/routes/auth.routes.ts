import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';
import { validate } from '../middlewares/validate';
import { loginSchema, registerSchema } from '../schemas/auth.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(ctrl.register));
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(ctrl.login));
router.get('/me', authMiddleware, asyncHandler(ctrl.me));

export default router;
