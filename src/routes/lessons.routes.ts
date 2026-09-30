import { Router } from 'express';
import * as ctrl from '../controllers/lessons.controller';
import { authMiddleware, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { courseLessonParamsSchema, idParamSchema } from '../schemas/common.schema';
import { createLessonSchema, updateLessonSchema } from '../schemas/lesson.schema';
import { asyncHandler } from '../utils/asyncHandler';

// Montado en /api/v1/courses → /api/v1/courses/:id/lessons
const router = Router();

router.get('/:id/lessons', authMiddleware, validate({ params: idParamSchema }), asyncHandler(ctrl.listLessons));
router.post(
  '/:id/lessons',
  authMiddleware,
  requireRoles('TEACHER', 'ADMIN'),
  validate({ params: idParamSchema, body: createLessonSchema }),
  asyncHandler(ctrl.createLesson),
);
router.put(
  '/:id/lessons/:lessonId',
  authMiddleware,
  requireRoles('TEACHER', 'ADMIN'),
  validate({ params: courseLessonParamsSchema, body: updateLessonSchema }),
  asyncHandler(ctrl.updateLesson),
);

export default router;
