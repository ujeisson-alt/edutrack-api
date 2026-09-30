import { Course, Enrollment } from '../models/postgres';
import { createError } from '../middlewares/errorHandler';
import { AuthUser } from '../types';

/** Busca un curso o lanza 404 */
export const findCourseOr404 = async (courseId: number): Promise<Course> => {
  const course = await Course.findByPk(courseId);
  if (!course) throw createError('Curso no encontrado', 404);
  return course;
};

/** El docente dueño del curso o un ADMIN pueden gestionarlo */
export const canManageCourse = (course: Course, user?: AuthUser): boolean =>
  !!user && (user.role === 'ADMIN' || (user.role === 'TEACHER' && course.teacherId === user.id));

export const assertCanManageCourse = (course: Course, user?: AuthUser): void => {
  if (!canManageCourse(course, user)) {
    throw createError('Solo el docente dueño del curso o un ADMIN pueden realizar esta acción', 403);
  }
};

/** Un estudiante con inscripción ACTIVE o COMPLETED tiene acceso al contenido */
export const hasCourseAccess = async (courseId: number, studentId: number): Promise<boolean> => {
  const enrollment = await Enrollment.findOne({ where: { courseId, studentId } });
  return !!enrollment && enrollment.status !== 'CANCELLED';
};

export const countActiveEnrollments = (courseId: number): Promise<number> =>
  Enrollment.count({ where: { courseId, status: 'ACTIVE' } });
