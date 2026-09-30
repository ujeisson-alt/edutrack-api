import { Request, Response } from 'express';
import { Op, WhereOptions, literal } from 'sequelize';
import { Category, Course, Lesson, User } from '../models/postgres';
import { createError } from '../middlewares/errorHandler';
import { IdParam } from '../schemas/common.schema';
import { CreateCourseInput, ListCoursesQuery, UpdateCourseInput } from '../schemas/course.schema';
import { buildMeta, getOffset } from '../utils/pagination';
import { logActivity } from '../utils/activityLogger';
import { assertCanManageCourse, canManageCourse, countActiveEnrollments, findCourseOr404 } from '../utils/courseAccess';

/** Subconsultas reutilizables: inscriptos activos y cantidad de lecciones */
const statsAttributes: [ReturnType<typeof literal>, string][] = [
  [literal(`(SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = "Course"."id" AND e.status = 'ACTIVE')`), 'enrolledCount'],
  [literal(`(SELECT COUNT(*)::int FROM lessons l WHERE l.course_id = "Course"."id")`), 'lessonsCount'],
];

const teacherInclude = { model: User, as: 'teacher', attributes: ['id', 'name'] };
const categoryInclude = { model: Category, as: 'category', attributes: ['id', 'name'] };

const assertCategoryExists = async (categoryId?: number | null): Promise<void> => {
  if (categoryId && !(await Category.findByPk(categoryId))) throw createError('La categoría no existe', 400);
};

/** GET /api/v1/courses — Público: solo cursos publicados, con filtros y paginación */
export const listCourses = async (req: Request, res: Response): Promise<void> => {
  const { page, limit, search, categoryId, teacherId, minPrice, maxPrice, sortBy, order } =
    req.query as unknown as ListCoursesQuery;

  const priceFilter =
    minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            ...(minPrice !== undefined && { [Op.gte]: minPrice }),
            ...(maxPrice !== undefined && { [Op.lte]: maxPrice }),
          },
        }
      : {};

  const where: WhereOptions<Course> = {
    isPublished: true,
    ...(categoryId && { categoryId }),
    ...(teacherId && { teacherId }),
    ...priceFilter,
    ...(search && {
      [Op.or]: [{ title: { [Op.iLike]: `%${search}%` } }, { description: { [Op.iLike]: `%${search}%` } }],
    }),
  };

  const { rows, count } = await Course.findAndCountAll({
    where,
    attributes: { include: statsAttributes },
    include: [teacherInclude, categoryInclude],
    limit,
    offset: getOffset(page, limit),
    order: [[sortBy, order], ['id', 'ASC']],
    distinct: true,
  });

  res.json({ success: true, data: rows, meta: buildMeta(page, limit, count) });
};

/**
 * GET /api/v1/courses/:id — Público
 * Devuelve el curso con docente y temario (sin el contenido de cada lección).
 * Un curso NO publicado solo lo ven su docente o un ADMIN.
 */
export const getCourseById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;

  // Eager loading = JOIN: curso + docente + categoría + lecciones ordenadas
  const course = await Course.findByPk(id, {
    attributes: { include: statsAttributes },
    include: [
      { model: User, as: 'teacher', attributes: ['id', 'name', 'bio', 'avatarUrl'] },
      categoryInclude,
      { model: Lesson, as: 'lessons', attributes: ['id', 'title', 'orderIndex', 'durationMinutes'] },
    ],
    order: [[{ model: Lesson, as: 'lessons' }, 'orderIndex', 'ASC'], [{ model: Lesson, as: 'lessons' }, 'id', 'ASC']],
  });

  if (!course || (!course.isPublished && !canManageCourse(course, req.user))) {
    throw createError('Curso no encontrado', 404);
  }

  res.json({ success: true, data: course });
};

/** POST /api/v1/courses — TEACHER / ADMIN */
export const createCourse = async (req: Request, res: Response): Promise<void> => {
  const { teacherId: requestedTeacherId, ...data } = req.body as CreateCourseInput;
  const requester = req.user!;

  let teacherId = requester.id;
  if (requester.role === 'ADMIN') {
    if (!requestedTeacherId) throw createError('Como ADMIN debés indicar el teacherId del curso', 400);
    const teacher = await User.findByPk(requestedTeacherId);
    if (!teacher || teacher.role !== 'TEACHER' || !teacher.isActive) {
      throw createError('teacherId no corresponde a un docente activo', 400);
    }
    teacherId = teacher.id;
  } else if (requestedTeacherId && requestedTeacherId !== requester.id) {
    throw createError('Un docente solo puede crear cursos a su nombre', 403);
  }

  if (data.isPublished) throw createError('Un curso nuevo no tiene lecciones: crealo sin publicar y publicalo luego', 409);
  await assertCategoryExists(data.categoryId);

  const course = await Course.create({ ...data, teacherId });

  await logActivity({
    userId: requester.id,
    userRole: requester.role,
    action: 'COURSE_CREATED',
    resourceType: 'COURSE',
    resourceId: course.id,
    details: { title: course.title },
  });

  res.status(201).json({ success: true, message: 'Curso creado', data: course });
};

/** PUT /api/v1/courses/:id — TEACHER (propio) / ADMIN */
export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;
  const data = req.body as UpdateCourseInput;

  const course = await findCourseOr404(id);
  assertCanManageCourse(course, req.user);

  if (data.categoryId !== undefined) await assertCategoryExists(data.categoryId);

  if (data.maxStudents !== undefined) {
    const active = await countActiveEnrollments(id);
    if (data.maxStudents < active) {
      throw createError(`maxStudents no puede ser menor a los ${active} inscriptos activos`, 409);
    }
  }

  if (data.isPublished === true && !course.isPublished) {
    const lessons = await Lesson.count({ where: { courseId: id } });
    if (lessons === 0) throw createError('No se puede publicar un curso sin lecciones', 409);
  }

  await course.update(data);

  await logActivity({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: 'COURSE_UPDATED',
    resourceType: 'COURSE',
    resourceId: id,
    details: { fields: Object.keys(data) },
  });

  res.json({ success: true, message: 'Curso actualizado', data: course });
};

/** DELETE /api/v1/courses/:id — ADMIN */
export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as IdParam;
  const course = await findCourseOr404(id);

  const active = await countActiveEnrollments(id);
  if (active > 0) {
    throw createError(`No se puede eliminar: el curso tiene ${active} inscripciones activas. Despublicalo o cancelá las inscripciones.`, 409);
  }

  await course.destroy(); // lessons, enrollments y progress se borran en cascada (ON DELETE CASCADE)

  await logActivity({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: 'COURSE_DELETED',
    resourceType: 'COURSE',
    resourceId: id,
    details: { title: course.title },
  });

  res.json({ success: true, message: 'Curso eliminado' });
};
