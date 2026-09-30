import { Request, Response } from 'express';
import { literal } from 'sequelize';
import { sequelize } from '../config/database';
import { Category, Course, Enrollment, User } from '../models/postgres';
import { createError } from '../middlewares/errorHandler';
import { IdParam } from '../schemas/common.schema';
import { CreateEnrollmentInput, UpdateEnrollmentStatusInput } from '../schemas/enrollment.schema';
import { PaymentStatus } from '../types';
import { logActivity } from '../utils/activityLogger';
import { assertCanManageCourse, findCourseOr404 } from '../utils/courseAccess';

/** % de progreso calculado por la función PL/pgSQL get_student_progress() */
const progressAttribute = (): [ReturnType<typeof literal>, string] => [
  literal(`get_student_progress("Enrollment"."student_id", "Enrollment"."course_id")::float`),
  'progressPct',
];

/**
 * POST /api/v1/enrollments — STUDENT
 * Reglas: curso existe y está publicado, sin duplicados, con cupo disponible.
 * Se ejecuta en una transacción con bloqueo de fila sobre el curso (SELECT ... FOR UPDATE)
 * para que dos inscripciones simultáneas no superen el cupo.
 */
export const enrollInCourse = async (req: Request, res: Response): Promise<void> => {
  const studentId = req.user!.id;
  const { courseId } = req.body as CreateEnrollmentInput;

  const { enrollment, reactivated } = await sequelize.transaction(async (t) => {
    // 1. El curso existe y está publicado (bloqueamos la fila para controlar el cupo)
    const course = await Course.findByPk(courseId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!course || !course.isPublished) throw createError('Curso no encontrado o no disponible', 404);

    // 2. El estudiante no está ya inscripto
    const existing = await Enrollment.findOne({ where: { studentId, courseId }, transaction: t });
    if (existing && existing.status !== 'CANCELLED') throw createError('Ya estás inscripto en este curso', 409);

    // 3. Hay cupo disponible
    const enrolled = await Enrollment.count({ where: { courseId, status: 'ACTIVE' }, transaction: t });
    if (enrolled >= course.maxStudents) throw createError('El curso está completo', 409);

    // 4. Crear la inscripción (o reactivar una cancelada)
    if (existing) {
      await existing.update({ status: 'ACTIVE', paymentStatus: 'PENDING', enrolledAt: new Date() }, { transaction: t });
      return { enrollment: existing, reactivated: true };
    }
    const created = await Enrollment.create({ studentId, courseId, status: 'ACTIVE', paymentStatus: 'PENDING' }, { transaction: t });
    return { enrollment: created, reactivated: false };
  });

  // 5. Registrar el evento en MongoDB (fuera de la transacción SQL)
  await logActivity({
    userId: studentId,
    userRole: 'STUDENT',
    action: 'COURSE_ENROLLED',
    resourceType: 'COURSE',
    resourceId: courseId,
    details: { enrollmentId: enrollment.id, reactivated },
  });

  res.status(201).json({ success: true, message: 'Inscripción realizada', data: enrollment });
};

/** GET /api/v1/enrollments/my — STUDENT */
export const getMyEnrollments = async (req: Request, res: Response): Promise<void> => {
  const enrollments = await Enrollment.findAll({
    where: { studentId: req.user!.id },
    attributes: { include: [progressAttribute()] },
    include: [
      {
        model: Course,
        as: 'course',
        attributes: ['id', 'title', 'price', 'isPublished'],
        include: [
          { model: User, as: 'teacher', attributes: ['id', 'name'] },
          { model: Category, as: 'category', attributes: ['id', 'name'] },
        ],
      },
    ],
    order: [['enrolledAt', 'DESC']],
  });

  res.json({ success: true, data: enrollments, meta: { total: enrollments.length } });
};

/** GET /api/v1/enrollments/course/:id — TEACHER (dueño) / ADMIN */
export const getCourseEnrollments = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;
  const course = await findCourseOr404(id);
  assertCanManageCourse(course, req.user);

  const enrollments = await Enrollment.findAll({
    where: { courseId: id },
    attributes: { include: [progressAttribute()] },
    include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email', 'avatarUrl'] }],
    order: [['enrolledAt', 'ASC']],
  });

  const summary = {
    total: enrollments.length,
    active: enrollments.filter((e) => e.status === 'ACTIVE').length,
    completed: enrollments.filter((e) => e.status === 'COMPLETED').length,
    cancelled: enrollments.filter((e) => e.status === 'CANCELLED').length,
    maxStudents: course.maxStudents,
  };

  res.json({ success: true, data: enrollments, meta: summary });
};

/** Transiciones de pago válidas: PENDING → PAID → REFUNDED */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['PAID'],
  PAID: ['REFUNDED'],
  REFUNDED: [],
};

/** PATCH /api/v1/enrollments/:id/status — ADMIN */
export const updateEnrollmentStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;
  const { status, paymentStatus } = req.body as UpdateEnrollmentStatusInput;

  const enrollment = await Enrollment.findByPk(id);
  if (!enrollment) throw createError('Inscripción no encontrada', 404);

  if (paymentStatus && paymentStatus !== enrollment.paymentStatus) {
    const current = enrollment.paymentStatus as PaymentStatus;
    if (!PAYMENT_TRANSITIONS[current].includes(paymentStatus)) {
      throw createError(`Transición de pago inválida: ${enrollment.paymentStatus} → ${paymentStatus}`, 409);
    }
  }

  // Reactivar una inscripción requiere cupo
  if (status === 'ACTIVE' && enrollment.status !== 'ACTIVE') {
    const course = await findCourseOr404(enrollment.courseId);
    const active = await Enrollment.count({ where: { courseId: course.id, status: 'ACTIVE' } });
    if (active >= course.maxStudents) throw createError('El curso está completo', 409);
  }

  await enrollment.update({
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
  });

  res.json({ success: true, message: 'Inscripción actualizada', data: enrollment });
};
