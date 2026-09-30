import { Router } from 'express';
import * as ctrl from '../controllers/enrollments.controller';
import { authMiddleware, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../schemas/common.schema';
import { createEnrollmentSchema, updateEnrollmentStatusSchema } from '../schemas/enrollment.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware);

router.post('/', requireRoles('STUDENT'), validate({ body: createEnrollmentSchema }), asyncHandler(ctrl.enrollInCourse));
router.get('/my', requireRoles('STUDENT'), asyncHandler(ctrl.getMyEnrollments));
router.get('/course/:id', requireRoles('TEACHER', 'ADMIN'), validate({ params: idParamSchema }), asyncHandler(ctrl.getCourseEnrollments));
router.patch(
  '/:id/status',
  requireRoles('ADMIN'),
  validate({ params: idParamSchema, body: updateEnrollmentStatusSchema }),
  asyncHandler(ctrl.updateEnrollmentStatus),
);

export default router;
