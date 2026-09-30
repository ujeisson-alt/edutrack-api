import { Router } from 'express';
import * as ctrl from '../controllers/reviews.controller';
import { authMiddleware, requireRoles } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema, paginationSchema } from '../schemas/common.schema';
import { createReviewSchema } from '../schemas/review.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/', authMiddleware, requireRoles('STUDENT'), validate({ body: createReviewSchema }), asyncHandler(ctrl.createReview));
router.get('/course/:id', validate({ params: idParamSchema, query: paginationSchema }), asyncHandler(ctrl.getCourseReviews));

export default router;
