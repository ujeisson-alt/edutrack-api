import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { Enrollment, Lesson, Progress } from '../models/postgres';
import { createError } from '../middlewares/errorHandler';
import { IdParam } from '../schemas/common.schema';
import { MarkProgressInput } from '../schemas/progress.schema';
import { logActivity } from '../utils/activityLogger';
import { findCourseOr404 } from '../utils/courseAccess';

/** Llama a la función PL/pgSQL get_student_progress(student, course) */
export const getStudentProgressPct = async (studentId: number, courseId: number): Promise<number> => {
  const [row] = await sequelize.query<{ pct: string }>('SELECT get_student_progress(:studentId, :courseId) AS pct', {
    replacements: { studentId, courseId },
    type: QueryTypes.SELECT,
  });
  return Number(row?.pct ?? 0);
};

/**
 * POST /api/v1/progress — STUDENT
 * Marca (o desmarca) una lección. Si el curso llega al 100% la inscripción pasa a COMPLETED.
 */
export const markLessonProgress = async (req: Request, res: Response): Promise<void> => {
  const studentId = req.user!.id;
  const { lessonId, isCompleted } = req.body as MarkProgressInput;

  const lesson = await Lesson.findByPk(lessonId);
  if (!lesson) throw createError('Lección no encontrada', 404);

  const enrollment = await Enrollment.findOne({ where: { studentId, courseId: lesson.courseId } });
  if (!enrollment || enrollment.status === 'CANCELLED') {
    throw createError('Debés estar inscripto en el curso para registrar progreso', 403);
  }

  // Upsert: una fila por (student, lesson) — UNIQUE (student_id, lesson_id) en la tabla
  const values = { isCompleted, completedAt: isCompleted ? new Date() : null };
  const [progress, created] = await Progress.findOrCreate({
    where: { studentId, lessonId },
    defaults: { studentId, lessonId, ...values },
  });
  if (!created) await progress.update(values);

  const courseProgress = await getStudentProgressPct(studentId, lesson.courseId);

  if (isCompleted) {
    await logActivity({
      userId: studentId,
      userRole: 'STUDENT',
      action: 'LESSON_COMPLETED',
      resourceType: 'LESSON',
      resourceId: lessonId,
      details: { courseId: lesson.courseId, courseProgress },
    });
  }

  // Sincronizar estado de la inscripción con el progreso
  let courseCompleted = false;
  if (courseProgress >= 100 && enrollment.status === 'ACTIVE') {
    await enrollment.update({ status: 'COMPLETED' });
    courseCompleted = true;
    await logActivity({
      userId: studentId,
      userRole: 'STUDENT',
      action: 'COURSE_COMPLETED',
      resourceType: 'COURSE',
      resourceId: lesson.courseId,
    });
  } else if (courseProgress < 100 && enrollment.status === 'COMPLETED') {
    await enrollment.update({ status: 'ACTIVE' });
  }

  res.status(201).json({
    success: true,
    message: isCompleted ? 'Lección marcada como completada' : 'Lección marcada como pendiente',
    data: { progress, courseId: lesson.courseId, courseProgress, courseCompleted },
  });
};

/** GET /api/v1/progress/course/:id — STUDENT */
export const getCourseProgress = async (req: Request, res: Response): Promise<void> => {
  const studentId = req.user!.id;
  const { id: courseId } = req.params as unknown as IdParam;

  const course = await findCourseOr404(courseId);
  const enrollment = await Enrollment.findOne({ where: { studentId, courseId } });
  if (!enrollment) throw createError('No estás inscripto en este curso', 403);

  const lessons = await Lesson.findAll({
    where: { courseId },
    attributes: ['id', 'title', 'orderIndex', 'durationMinutes'],
    include: [
      {
        model: Progress,
        as: 'progress',
        where: { studentId },
        required: false, // LEFT JOIN: incluye lecciones sin progreso
        attributes: ['isCompleted', 'completedAt'],
      },
    ],
    order: [['orderIndex', 'ASC'], ['id', 'ASC']],
  });

  const detail = lessons.map((l) => {
    const p = (l.get('progress') as Progress[] | undefined)?.[0];
    return {
      lessonId: l.id,
      title: l.title,
      orderIndex: l.orderIndex,
      durationMinutes: l.durationMinutes,
      isCompleted: p?.isCompleted ?? false,
      completedAt: p?.isCompleted ? p.completedAt : null,
    };
  });

  const progressPct = await getStudentProgressPct(studentId, courseId);

  res.json({
    success: true,
    data: {
      courseId,
      courseTitle: course.title,
      enrollmentStatus: enrollment.status,
      totalLessons: detail.length,
      completedLessons: detail.filter((d) => d.isCompleted).length,
      progressPct,
      lessons: detail,
    },
  });
};
