import { Router } from 'express';
import * as ctrl from '../controllers/reports.controller';
import { authMiddleware, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { reportQuerySchema } from '../schemas/report.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware, requireRoles('ADMIN'));

router.get('/enrollments', validate({ query: reportQuerySchema }), asyncHandler(ctrl.enrollmentsReport));
router.get('/revenue', validate({ query: reportQuerySchema }), asyncHandler(ctrl.revenueReport));

export default router;
