import { Request, Response } from 'express';
import { Lesson } from '../models/postgres';
import { createError } from '../middlewares/errorHandler';
import { CourseLessonParams, IdParam } from '../schemas/common.schema';
import { CreateLessonInput, UpdateLessonInput } from '../schemas/lesson.schema';
import { assertCanManageCourse, canManageCourse, findCourseOr404, hasCourseAccess } from '../utils/courseAccess';

/**
 * GET /api/v1/courses/:id/lessons — AUTH
 * Contenido completo: docente dueño, ADMIN o estudiante inscripto.
 */
export const listLessons = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;
  const user = req.user!;
  const course = await findCourseOr404(id);

  const allowed =
    canManageCourse(course, user) || (user.role === 'STUDENT' && course.isPublished && (await hasCourseAccess(id, user.id)));
  if (!allowed) throw createError('Debés estar inscripto en el curso para ver sus lecciones', 403);

  const lessons = await Lesson.findAll({
    where: { courseId: id },
    order: [['orderIndex', 'ASC'], ['id', 'ASC']],
  });

  res.json({ success: true, data: lessons, meta: { total: lessons.length } });
};

/** POST /api/v1/courses/:id/lessons — TEACHER (dueño) / ADMIN */
export const createLesson = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;
  const data = req.body as CreateLessonInput;

  const course = await findCourseOr404(id);
  assertCanManageCourse(course, req.user);

  // Si no se indica orderIndex, la lección va al final
  let orderIndex = data.orderIndex;
  if (orderIndex === undefined) {
    const max = (await Lesson.max('orderIndex', { where: { courseId: id } })) as number | null;
    orderIndex = max === null ? 1 : max + 1;
  }

  const lesson = await Lesson.create({ ...data, orderIndex, courseId: id });
  res.status(201).json({ success: true, message: 'Lección creada', data: lesson });
};

/** PUT /api/v1/courses/:id/lessons/:lessonId — TEACHER (dueño) / ADMIN */
export const updateLesson = async (req: Request, res: Response): Promise<void> => {
  const { id, lessonId } = req.params as unknown as CourseLessonParams;
  const data = req.body as UpdateLessonInput;

  const course = await findCourseOr404(id);
  assertCanManageCourse(course, req.user);

  const lesson = await Lesson.findOne({ where: { id: lessonId, courseId: id } });
  if (!lesson) throw createError('Lección no encontrada en este curso', 404);

  await lesson.update(data);
  res.json({ success: true, message: 'Lección actualizada', data: lesson });
};
