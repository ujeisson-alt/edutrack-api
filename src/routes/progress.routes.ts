import { Router } from 'express';
import * as ctrl from '../controllers/progress.controller';
import { authMiddleware, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../schemas/common.schema';
import { markProgressSchema } from '../schemas/progress.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware, requireRoles('STUDENT'));

router.post('/', validate({ body: markProgressSchema }), asyncHandler(ctrl.markLessonProgress));
router.get('/course/:id', validate({ params: idParamSchema }), asyncHandler(ctrl.getCourseProgress));

export default router;
