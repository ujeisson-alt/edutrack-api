/**
 * Carga datos de demostración. Uso: npm run db:seed
 * Todos los usuarios demo usan la contraseña definida en SEED_PASSWORD (.env).
 */
import bcrypt from 'bcrypt';
import { sequelize } from '../config/database';
import { Category, Course, Enrollment, Lesson, Progress, User } from '../models/postgres';
import { logger } from '../utils/logger';

const run = async (): Promise<void> => {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) throw new Error('Definí SEED_PASSWORD en el .env antes de ejecutar el seed');
  const password = await bcrypt.hash(seedPassword, 10);

  await sequelize.transaction(async (transaction) => {
    await sequelize.query('TRUNCATE progress, enrollments, lessons, courses, users, categories RESTART IDENTITY CASCADE', {
      transaction,
    });

    const [programming, data, design] = await Category.bulkCreate(
      [
        { name: 'Programación', description: 'Desarrollo de software y backend' },
        { name: 'Datos', description: 'Análisis de datos, SQL y BI' },
        { name: 'Diseño', description: 'UX/UI y diseño de producto' },
      ],
      { transaction, returning: true },
    );

    const users = await User.bulkCreate(
      [
        { name: 'Admin EduTrack', email: 'admin@edutrack.dev', password, role: 'ADMIN' },
        { name: 'Laura Gómez', email: 'teacher@edutrack.dev', password, role: 'TEACHER', bio: 'Backend developer y docente de Node.js' },
        { name: 'Carlos Pérez', email: 'teacher2@edutrack.dev', password, role: 'TEACHER', bio: 'Data Analyst — SQL y Power BI' },
        { name: 'Ana Torres', email: 'student@edutrack.dev', password, role: 'STUDENT' },
        { name: 'Diego Ruiz', email: 'student2@edutrack.dev', password, role: 'STUDENT' },
        { name: 'Sofía Martínez', email: 'student3@edutrack.dev', password, role: 'STUDENT' },
      ],
      { transaction, returning: true },
    );
    const [, teacher1, teacher2, s1, s2, s3] = users;

    const [nodeCourse, sqlCourse, uxCourse] = await Course.bulkCreate(
      [
        { title: 'Node.js y Express desde cero', description: 'APIs REST con TypeScript', teacherId: teacher1!.id, categoryId: programming!.id, price: 49.99, maxStudents: 30, isPublished: true },
        { title: 'SQL para análisis de datos', description: 'PostgreSQL, JOINs y GROUP BY', teacherId: teacher2!.id, categoryId: data!.id, price: 29.99, maxStudents: 2, isPublished: true },
        { title: 'Fundamentos de UX (borrador)', description: 'Curso en preparación', teacherId: teacher1!.id, categoryId: design!.id, price: 19.99, maxStudents: 20, isPublished: false },
      ],
      { transaction, returning: true },
    );

    const lessons = await Lesson.bulkCreate(
      [
        { courseId: nodeCourse!.id, title: 'Introducción a Node.js', content: 'Event loop, módulos y npm.', orderIndex: 1, durationMinutes: 15 },
        { courseId: nodeCourse!.id, title: 'Express y middlewares', content: 'Routers, middlewares y manejo de errores.', orderIndex: 2, durationMinutes: 25 },
        { courseId: nodeCourse!.id, title: 'TypeScript en el backend', content: 'Tipos, interfaces y tsconfig estricto.', orderIndex: 3, durationMinutes: 30 },
        { courseId: nodeCourse!.id, title: 'Autenticación con JWT', content: 'bcrypt, JWT y roles.', orderIndex: 4, durationMinutes: 35 },
        { courseId: sqlCourse!.id, title: 'SELECT y filtros', content: 'WHERE, ORDER BY, LIMIT.', orderIndex: 1, durationMinutes: 20 },
        { courseId: sqlCourse!.id, title: 'JOINs', content: 'INNER, LEFT y relaciones N:M.', orderIndex: 2, durationMinutes: 30 },
        { courseId: uxCourse!.id, title: 'Qué es UX', content: 'Borrador', orderIndex: 1, durationMinutes: 10 },
      ],
      { transaction, returning: true },
    );

    await Enrollment.bulkCreate(
      [
        { studentId: s1!.id, courseId: nodeCourse!.id, status: 'ACTIVE', paymentStatus: 'PAID' },
        { studentId: s2!.id, courseId: nodeCourse!.id, status: 'ACTIVE', paymentStatus: 'PENDING' },
        { studentId: s3!.id, courseId: sqlCourse!.id, status: 'COMPLETED', paymentStatus: 'PAID' },
      ],
      { transaction },
    );

    const now = new Date();
    await Progress.bulkCreate(
      [
        { studentId: s1!.id, lessonId: lessons[0]!.id, isCompleted: true, completedAt: now },
        { studentId: s1!.id, lessonId: lessons[1]!.id, isCompleted: true, completedAt: now },
        { studentId: s3!.id, lessonId: lessons[4]!.id, isCompleted: true, completedAt: now },
        { studentId: s3!.id, lessonId: lessons[5]!.id, isCompleted: true, completedAt: now },
      ],
      { transaction },
    );
  });

  logger.info('✅ Seed completado: 6 usuarios (admin, 2 teachers, 3 students), 3 cursos, 7 lecciones');
  logger.info('   Login demo: admin@edutrack.dev | teacher@edutrack.dev | student@edutrack.dev (password = SEED_PASSWORD)');
  await sequelize.close();
};

run().catch(async (error: unknown) => {
  logger.error('❌ Error ejecutando el seed', error instanceof Error ? error.message : error);
  await sequelize.close();
  process.exit(1);
});
