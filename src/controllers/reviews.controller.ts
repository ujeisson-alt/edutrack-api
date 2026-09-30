import { Request, Response } from 'express';
import { Course, Enrollment, User } from '../models/postgres';
import { CourseReview } from '../models/mongo/CourseReview';
import { createError } from '../middlewares/errorHandler';
import { IdParam, paginationSchema } from '../schemas/common.schema';
import { CreateReviewInput } from '../schemas/review.schema';
import { buildMeta, getOffset } from '../utils/pagination';
import { logActivity } from '../utils/activityLogger';
import { z } from 'zod';

type Pagination = z.infer<typeof paginationSchema>;

/**
 * POST /api/v1/reviews — STUDENT
 * Solo puede reseñar quien estuvo inscripto (ACTIVE o COMPLETED). Una reseña por curso.
 */
export const createReview = async (req: Request, res: Response): Promise<void> => {
  const studentId = req.user!.id;
  const { courseId, rating, comment } = req.body as CreateReviewInput;

  const course = await Course.findByPk(courseId);
  if (!course) throw createError('Curso no encontrado', 404);

  const enrollment = await Enrollment.findOne({ where: { studentId, courseId } });
  if (!enrollment || enrollment.status === 'CANCELLED') {
    throw createError('Solo podés reseñar cursos en los que estuviste inscripto', 403);
  }

  const already = await CourseReview.exists({ courseId, studentId });
  if (already) throw createError('Ya dejaste una reseña para este curso', 409);

  const student = await User.findByPk(studentId, { attributes: ['id', 'name'] });
  if (!student) throw createError('Usuario no encontrado', 404);

  const review = await CourseReview.create({
    courseId,
    studentId,
    studentName: student.name,
    rating,
    comment,
    isVerifiedEnrollment: true,
  });

  await logActivity({
    userId: studentId,
    userRole: 'STUDENT',
    action: 'REVIEW_CREATED',
    resourceType: 'COURSE',
    resourceId: courseId,
    details: { rating },
  });

  res.status(201).json({ success: true, message: 'Reseña publicada', data: review });
};

/** GET /api/v1/reviews/course/:id — Público: reseñas + promedio + distribución */
export const getCourseReviews = async (req: Request, res: Response): Promise<void> => {
  const { id: courseId } = req.params as unknown as IdParam;
  const { page, limit } = req.query as unknown as Pagination;

  const course = await Course.findByPk(courseId, { attributes: ['id', 'title', 'isPublished'] });
  if (!course || !course.isPublished) throw createError('Curso no encontrado', 404);

  const [reviews, total, stats] = await Promise.all([
    CourseReview.find({ courseId }).sort({ createdAt: -1 }).skip(getOffset(page, limit)).limit(limit).lean(),
    CourseReview.countDocuments({ courseId }),
    CourseReview.aggregate<{ _id: number; count: number }>([
      { $match: { courseId } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let sum = 0;
  for (const s of stats) {
    distribution[String(s._id)] = s.count;
    sum += s._id * s.count;
  }

  res.json({
    success: true,
    data: {
      courseId,
      courseTitle: course.title,
      averageRating: total ? Math.round((sum / total) * 10) / 10 : 0,
      totalReviews: total,
      distribution,
      reviews,
    },
    meta: buildMeta(page, limit, total),
  });
};
