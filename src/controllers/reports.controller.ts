import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { ReportQuery } from '../schemas/report.schema';

/**
 * Construye el filtro común (rango de fechas sobre enrolled_at y categoría).
 * Todo va por replacements → sin riesgo de SQL injection.
 */
const buildFilters = (q: ReportQuery) => {
  const conditions: string[] = [];
  const replacements: Record<string, unknown> = {};
  if (q.from) {
    conditions.push('e.enrolled_at >= :from');
    replacements.from = q.from;
  }
  if (q.to) {
    conditions.push('e.enrolled_at <= :to');
    replacements.to = q.to;
  }
  if (q.categoryId) {
    conditions.push('c.category_id = :categoryId');
    replacements.categoryId = q.categoryId;
  }
  return { where: conditions.length ? `AND ${conditions.join(' AND ')}` : '', replacements };
};

const toNumber = <T extends object>(rows: T[]): T[] =>
  rows.map(
    (r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v]),
      ) as T,
  );

/** GET /api/v1/reports/enrollments — ADMIN */
export const enrollmentsReport = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as ReportQuery;
  const { where, replacements } = buildFilters(query);

  const [summary] = await sequelize.query<Record<string, string | number>>(
    `SELECT
        COUNT(*)::int                                            AS "totalEnrollments",
        COUNT(*) FILTER (WHERE e.status = 'ACTIVE')::int         AS "active",
        COUNT(*) FILTER (WHERE e.status = 'COMPLETED')::int      AS "completed",
        COUNT(*) FILTER (WHERE e.status = 'CANCELLED')::int      AS "cancelled",
        COUNT(DISTINCT e.student_id)::int                        AS "uniqueStudents",
        COUNT(DISTINCT e.course_id)::int                         AS "coursesWithEnrollments",
        COALESCE(ROUND(
          COUNT(*) FILTER (WHERE e.status = 'COMPLETED')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE e.status <> 'CANCELLED'), 0) * 100, 1), 0) AS "completionRatePct"
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE 1 = 1 ${where}`,
    { replacements, type: QueryTypes.SELECT },
  );

  // Por curso: GROUP BY + subconsulta para el progreso promedio de los inscriptos
  const byCourse = await sequelize.query<Record<string, string | number>>(
    `SELECT
        c.id                                                    AS "courseId",
        c.title,
        u.name                                                  AS "teacherName",
        cat.name                                                AS "category",
        c.max_students                                          AS "maxStudents",
        COUNT(e.id)::int                                        AS "totalEnrollments",
        COUNT(e.id) FILTER (WHERE e.status = 'ACTIVE')::int     AS "active",
        COUNT(e.id) FILTER (WHERE e.status = 'COMPLETED')::int  AS "completed",
        COUNT(e.id) FILTER (WHERE e.status = 'CANCELLED')::int  AS "cancelled",
        ROUND(COUNT(e.id) FILTER (WHERE e.status = 'ACTIVE')::numeric / NULLIF(c.max_students, 0) * 100, 1) AS "occupancyPct",
        (
          SELECT COALESCE(ROUND(AVG(get_student_progress(e2.student_id, e2.course_id)), 1), 0)
          FROM enrollments e2
          WHERE e2.course_id = c.id AND e2.status <> 'CANCELLED'
        )                                                       AS "avgProgressPct"
     FROM courses c
     JOIN users u          ON u.id = c.teacher_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     JOIN enrollments e    ON e.course_id = c.id
     WHERE 1 = 1 ${where}
     GROUP BY c.id, c.title, u.name, cat.name, c.max_students
     ORDER BY "totalEnrollments" DESC, c.id`,
    { replacements, type: QueryTypes.SELECT },
  );

  const byMonth = await sequelize.query<Record<string, string | number>>(
    `SELECT
        TO_CHAR(DATE_TRUNC('month', e.enrolled_at), 'YYYY-MM') AS "month",
        COUNT(*)::int                                          AS "enrollments"
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE 1 = 1 ${where}
     GROUP BY 1
     ORDER BY 1`,
    { replacements, type: QueryTypes.SELECT },
  );

  res.json({
    success: true,
    data: {
      filters: query,
      summary: toNumber([summary ?? {}])[0],
      byCourse: toNumber(byCourse),
      byMonth: toNumber(byMonth),
    },
  });
};

/**
 * GET /api/v1/reports/revenue — ADMIN
 * Ingresos = suma del precio de los cursos con inscripciones PAID.
 */
export const revenueReport = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as ReportQuery;
  const { where, replacements } = buildFilters(query);

  const [summary] = await sequelize.query<Record<string, string | number>>(
    `SELECT
        COALESCE(SUM(c.price) FILTER (WHERE e.payment_status = 'PAID'), 0)     AS "totalRevenue",
        COALESCE(SUM(c.price) FILTER (WHERE e.payment_status = 'PENDING'), 0)  AS "pendingRevenue",
        COALESCE(SUM(c.price) FILTER (WHERE e.payment_status = 'REFUNDED'), 0) AS "refundedAmount",
        COUNT(*) FILTER (WHERE e.payment_status = 'PAID')::int                 AS "paidEnrollments",
        COALESCE(ROUND(AVG(c.price) FILTER (WHERE e.payment_status = 'PAID'), 2), 0) AS "avgTicket"
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE 1 = 1 ${where}`,
    { replacements, type: QueryTypes.SELECT },
  );

  const byCourse = await sequelize.query<Record<string, string | number>>(
    `SELECT
        c.id                                                                    AS "courseId",
        c.title,
        u.name                                                                  AS "teacherName",
        c.price,
        COUNT(e.id) FILTER (WHERE e.payment_status = 'PAID')::int               AS "paidEnrollments",
        COUNT(e.id) FILTER (WHERE e.payment_status = 'PENDING')::int            AS "pendingEnrollments",
        COALESCE(SUM(c.price) FILTER (WHERE e.payment_status = 'PAID'), 0)      AS "revenue",
        COALESCE(SUM(c.price) FILTER (WHERE e.payment_status = 'PENDING'), 0)   AS "pendingRevenue",
        COALESCE(SUM(c.price) FILTER (WHERE e.payment_status = 'REFUNDED'), 0)  AS "refunded"
     FROM courses c
     JOIN users u       ON u.id = c.teacher_id
     JOIN enrollments e ON e.course_id = c.id
     WHERE 1 = 1 ${where}
     GROUP BY c.id, c.title, u.name, c.price
     ORDER BY "revenue" DESC, c.id`,
    { replacements, type: QueryTypes.SELECT },
  );

  // Por docente: subconsulta agregada sobre el detalle por curso
  const byTeacher = await sequelize.query<Record<string, string | number>>(
    `SELECT t.teacher_id AS "teacherId", t.teacher_name AS "teacherName",
            COUNT(*)::int AS "courses", SUM(t.revenue) AS "revenue"
     FROM (
       SELECT u.id AS teacher_id, u.name AS teacher_name, c.id AS course_id,
              COALESCE(SUM(c.price) FILTER (WHERE e.payment_status = 'PAID'), 0) AS revenue
       FROM courses c
       JOIN users u       ON u.id = c.teacher_id
       JOIN enrollments e ON e.course_id = c.id
       WHERE 1 = 1 ${where}
       GROUP BY u.id, u.name, c.id
     ) t
     GROUP BY t.teacher_id, t.teacher_name
     ORDER BY "revenue" DESC`,
    { replacements, type: QueryTypes.SELECT },
  );

  res.json({
    success: true,
    data: {
      filters: query,
      currency: 'USD',
      summary: toNumber([summary ?? {}])[0],
      byCourse: toNumber(byCourse),
      byTeacher: toNumber(byTeacher),
    },
  });
};
