import { Router } from 'express';
import * as ctrl from '../controllers/courses.controller';
import { authMiddleware, optionalAuth, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../schemas/common.schema';
import { createCourseSchema, listCoursesQuerySchema, updateCourseSchema } from '../schemas/course.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Públicas (optionalAuth permite al docente dueño ver sus cursos no publicados)
router.get('/', validate({ query: listCoursesQuerySchema }), asyncHandler(ctrl.listCourses));
router.get('/:id', optionalAuth, validate({ params: idParamSchema }), asyncHandler(ctrl.getCourseById));

// Protegidas
router.post('/', authMiddleware, requireRoles('TEACHER', 'ADMIN'), validate({ body: createCourseSchema }), asyncHandler(ctrl.createCourse));
router.put(
  '/:id',
  authMiddleware,
  requireRoles('TEACHER', 'ADMIN'),
  validate({ params: idParamSchema, body: updateCourseSchema }),
  asyncHandler(ctrl.updateCourse),
);
router.delete('/:id', authMiddleware, requireRoles('ADMIN'), validate({ params: idParamSchema }), asyncHandler(ctrl.deleteCourse));

export default router;
