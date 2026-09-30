import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';
import { connectMongoDB, disconnectMongoDB } from '../src/config/mongodb';
import { User } from '../src/models/postgres';
import { ActivityLog } from '../src/models/mongo/ActivityLog';
import { CourseReview } from '../src/models/mongo/CourseReview';

const PASSWORD = 'Test1234!';
const api = request(app);

const tokens: Record<'admin' | 'teacher' | 'teacher2' | 'student' | 'student2', string> = {
  admin: '',
  teacher: '',
  teacher2: '',
  student: '',
  student2: '',
};
const ids = { course: 0, smallCourse: 0, lessons: [] as number[], student: 0, teacher: 0 };

const login = async (email: string): Promise<string> => {
  const res = await api.post('/api/v1/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await sequelize.query(sql, { logging: false });
  await connectMongoDB(process.env.MONGODB_URI);
  await Promise.all([ActivityLog.deleteMany({}), CourseReview.deleteMany({})]);
  await CourseReview.syncIndexes();

  const password = await bcrypt.hash(PASSWORD, 10);
  const [, teacher, , student] = await User.bulkCreate(
    [
      { name: 'Admin', email: 'admin@test.dev', password, role: 'ADMIN' },
      { name: 'Teacher One', email: 'teacher@test.dev', password, role: 'TEACHER' },
      { name: 'Teacher Two', email: 'teacher2@test.dev', password, role: 'TEACHER' },
      { name: 'Student One', email: 'student@test.dev', password, role: 'STUDENT' },
      { name: 'Student Two', email: 'student2@test.dev', password, role: 'STUDENT' },
    ],
    { returning: true },
  );
  ids.teacher = teacher!.id;
  ids.student = student!.id;

  tokens.admin = await login('admin@test.dev');
  tokens.teacher = await login('teacher@test.dev');
  tokens.teacher2 = await login('teacher2@test.dev');
  tokens.student = await login('student@test.dev');
  tokens.student2 = await login('student2@test.dev');
});

afterAll(async () => {
  await sequelize.close();
  await disconnectMongoDB();
});

describe('Base', () => {
  it('GET / devuelve bienvenida', async () => {
    const res = await api.get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/EduTrack/);
  });

  it('ruta inexistente → 404 JSON', async () => {
    const res = await api.get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('JSON mal formado → 400', async () => {
    const res = await api.post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
  });
});

describe('Auth', () => {
  it('registra un STUDENT y no devuelve el password', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'Nuevo Alumno', email: 'Nuevo@Test.dev', password: 'Password1' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('nuevo@test.dev');
    expect(res.body.data.user.role).toBe('STUDENT');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.token).toBeDefined();
  });

  it('no permite auto-registrarse como ADMIN', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'Hacker', email: 'h@test.dev', password: 'Password1', role: 'ADMIN' });
    expect(res.status).toBe(400);
  });

  it('email duplicado → 409', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email: 'student@test.dev', password: 'Password1' });
    expect(res.status).toBe(409);
  });

  it('password débil → 400 con detalle', async () => {
    const res = await api.post('/api/v1/auth/register').send({ name: 'Weak', email: 'w@test.dev', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('login fallido → 401 y se registra LOGIN_FAILED en MongoDB', async () => {
    const res = await api.post('/api/v1/auth/login').send({ email: 'student@test.dev', password: 'wrong' });
    expect(res.status).toBe(401);
    const res2 = await api.post('/api/v1/auth/login').send({ email: 'ghost@test.dev', password: 'wrong' });
    expect(res2.status).toBe(401);
    expect(res2.body.message).toBe(res.body.message); // no revela si el email existe

    const failed = await ActivityLog.countDocuments({ action: 'LOGIN_FAILED' });
    expect(failed).toBeGreaterThanOrEqual(2);
  });

  it('GET /auth/me sin token → 401, token inválido → 401', async () => {
    expect((await api.get('/api/v1/auth/me')).status).toBe(401);
    expect((await api.get('/api/v1/auth/me').set(auth('abc.def.ghi'))).status).toBe(401);
    const ok = await api.get('/api/v1/auth/me').set(auth(tokens.student));
    expect(ok.status).toBe(200);
    expect(ok.body.data.email).toBe('student@test.dev');
  });
});

describe('Roles', () => {
  it('un STUDENT no puede crear cursos → 403', async () => {
    const res = await api.post('/api/v1/courses').set(auth(tokens.student)).send({ title: 'Curso trucho' });
    expect(res.status).toBe(403);
  });

  it('un TEACHER no puede ver reportes globales → 403', async () => {
    const res = await api.get('/api/v1/reports/enrollments').set(auth(tokens.teacher));
    expect(res.status).toBe(403);
  });

  it('solo ADMIN lista usuarios', async () => {
    expect((await api.get('/api/v1/users').set(auth(tokens.teacher))).status).toBe(403);
    const res = await api.get('/api/v1/users?role=STUDENT').set(auth(tokens.admin));
    expect(res.status).toBe(200);
    expect(res.body.data.every((u: { role: string }) => u.role === 'STUDENT')).toBe(true);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });
});

describe('Flujo 1 — Docente crea y publica un curso', () => {
  it('crea el curso sin publicar', async () => {
    const res = await api
      .post('/api/v1/courses')
      .set(auth(tokens.teacher))
      .send({ title: 'TypeScript Profesional', description: 'De cero a pro', price: 40, maxStudents: 10 });
    expect(res.status).toBe(201);
    expect(res.body.data.teacherId).toBe(ids.teacher);
    expect(res.body.data.isPublished).toBe(false);
    ids.course = res.body.data.id;
  });

  it('no se puede publicar sin lecciones → 409', async () => {
    const res = await api.put(`/api/v1/courses/${ids.course}`).set(auth(tokens.teacher)).send({ isPublished: true });
    expect(res.status).toBe(409);
  });

  it('otro docente no puede agregar lecciones → 403', async () => {
    const res = await api
      .post(`/api/v1/courses/${ids.course}/lessons`)
      .set(auth(tokens.teacher2))
      .send({ title: 'Intrusa' });
    expect(res.status).toBe(403);
  });

  it('agrega 3 lecciones (orderIndex automático)', async () => {
    for (const title of ['Tipos básicos', 'Interfaces', 'Genéricos']) {
      const res = await api
        .post(`/api/v1/courses/${ids.course}/lessons`)
        .set(auth(tokens.teacher))
        .send({ title, content: `Contenido de ${title}`, durationMinutes: 20 });
      expect(res.status).toBe(201);
      ids.lessons.push(res.body.data.id);
    }
    const res = await api.get(`/api/v1/courses/${ids.course}/lessons`).set(auth(tokens.teacher));
    expect(res.body.data.map((l: { orderIndex: number }) => l.orderIndex)).toEqual([1, 2, 3]);
  });

  it('el curso no publicado no es visible al público', async () => {
    expect((await api.get(`/api/v1/courses/${ids.course}`)).status).toBe(404);
    expect((await api.get(`/api/v1/courses/${ids.course}`).set(auth(tokens.teacher))).status).toBe(200);
  });

  it('publica el curso', async () => {
    const res = await api.put(`/api/v1/courses/${ids.course}`).set(auth(tokens.teacher)).send({ isPublished: true });
    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(true);
  });

  it('edita una lección', async () => {
    const res = await api
      .put(`/api/v1/courses/${ids.course}/lessons/${ids.lessons[0]}`)
      .set(auth(tokens.teacher))
      .send({ title: 'Tipos básicos (v2)' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Tipos básicos (v2)');
  });
});

describe('Flujo 2 — Estudiante se inscribe y progresa', () => {
  it('el curso publicado aparece en el catálogo público con docente y contadores', async () => {
    const res = await api.get('/api/v1/courses?search=typescript');
    expect(res.status).toBe(200);
    const course = res.body.data.find((c: { id: number }) => c.id === ids.course);
    expect(course).toBeDefined();
    expect(course.teacher.name).toBe('Teacher One');
    expect(course.lessonsCount).toBe(3);
    expect(course.price).toBe(40);
  });

  it('detalle público incluye lecciones ordenadas (sin contenido)', async () => {
    const res = await api.get(`/api/v1/courses/${ids.course}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lessons).toHaveLength(3);
    expect(res.body.data.lessons[0].content).toBeUndefined();
  });

  it('sin inscripción no puede ver el contenido → 403', async () => {
    expect((await api.get(`/api/v1/courses/${ids.course}/lessons`).set(auth(tokens.student))).status).toBe(403);
  });

  it('se inscribe → 201 ACTIVE / PENDING', async () => {
    const res = await api.post('/api/v1/enrollments').set(auth(tokens.student)).send({ courseId: ids.course });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('studentId', ids.student);
    expect(res.body.data).toHaveProperty('courseId', ids.course);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.paymentStatus).toBe('PENDING');
    expect(await ActivityLog.countDocuments({ action: 'COURSE_ENROLLED', userId: ids.student })).toBe(1);
  });

  it('inscripción duplicada → 409', async () => {
    const res = await api.post('/api/v1/enrollments').set(auth(tokens.student)).send({ courseId: ids.course });
    expect(res.status).toBe(409);
  });

  it('marca la lección 1 → progreso 33.3%', async () => {
    const res = await api.post('/api/v1/progress').set(auth(tokens.student)).send({ lessonId: ids.lessons[0] });
    expect(res.status).toBe(201);
    expect(res.body.data.courseProgress).toBe(33.3);

    const detail = await api.get(`/api/v1/progress/course/${ids.course}`).set(auth(tokens.student));
    expect(detail.status).toBe(200);
    expect(detail.body.data.progressPct).toBe(33.3);
    expect(detail.body.data.completedLessons).toBe(1);
    expect(detail.body.data.lessons[0].isCompleted).toBe(true);
    expect(detail.body.data.lessons[1].isCompleted).toBe(false);
  });

  it('marcar la misma lección dos veces no duplica (upsert)', async () => {
    const res = await api.post('/api/v1/progress').set(auth(tokens.student)).send({ lessonId: ids.lessons[0] });
    expect(res.body.data.courseProgress).toBe(33.3);
  });

  it('al completar el 100% la inscripción pasa a COMPLETED', async () => {
    await api.post('/api/v1/progress').set(auth(tokens.student)).send({ lessonId: ids.lessons[1] });
    const res = await api.post('/api/v1/progress').set(auth(tokens.student)).send({ lessonId: ids.lessons[2] });
    expect(res.body.data.courseProgress).toBe(100);
    expect(res.body.data.courseCompleted).toBe(true);

    const my = await api.get('/api/v1/enrollments/my').set(auth(tokens.student));
    expect(my.status).toBe(200);
    expect(my.body.data[0].status).toBe('COMPLETED');
    expect(my.body.data[0].progressPct).toBe(100);
  });

  it('un estudiante no inscripto no puede registrar progreso → 403', async () => {
    const res = await api.post('/api/v1/progress').set(auth(tokens.student2)).send({ lessonId: ids.lessons[0] });
    expect(res.status).toBe(403);
  });

  it('el docente ve a sus inscriptos; otro docente no → 403', async () => {
    const res = await api.get(`/api/v1/enrollments/course/${ids.course}`).set(auth(tokens.teacher));
    expect(res.status).toBe(200);
    expect(res.body.data[0].student.email).toBe('student@test.dev');
    expect((await api.get(`/api/v1/enrollments/course/${ids.course}`).set(auth(tokens.teacher2))).status).toBe(403);
  });
});

describe('Capacidad del curso', () => {
  it('curso con cupo 1: el segundo estudiante recibe 409', async () => {
    const created = await api
      .post('/api/v1/courses')
      .set(auth(tokens.teacher))
      .send({ title: 'Curso con cupo mínimo', price: 10, maxStudents: 1 });
    ids.smallCourse = created.body.data.id;
    await api.post(`/api/v1/courses/${ids.smallCourse}/lessons`).set(auth(tokens.teacher)).send({ title: 'Única lección' });
    await api.put(`/api/v1/courses/${ids.smallCourse}`).set(auth(tokens.teacher)).send({ isPublished: true });

    const first = await api.post('/api/v1/enrollments').set(auth(tokens.student)).send({ courseId: ids.smallCourse });
    expect(first.status).toBe(201);
    const second = await api.post('/api/v1/enrollments').set(auth(tokens.student2)).send({ courseId: ids.smallCourse });
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/completo/);
  });

  it('no se puede bajar maxStudents por debajo de los inscriptos activos', async () => {
    const res = await api.put(`/api/v1/courses/${ids.course}`).set(auth(tokens.teacher)).send({ maxStudents: 1 });
    expect(res.status).toBe(200); // el único inscripto ya está COMPLETED, no ACTIVE
  });

  it('curso inexistente → 404', async () => {
    const res = await api.post('/api/v1/enrollments').set(auth(tokens.student)).send({ courseId: 99999 });
    expect(res.status).toBe(404);
  });
});

describe('Pagos (ADMIN)', () => {
  it('PENDING → PAID es válido; PAID → PENDING no', async () => {
    const list = await api.get(`/api/v1/enrollments/course/${ids.course}`).set(auth(tokens.admin));
    const enrollmentId = list.body.data[0].id;

    const paid = await api
      .patch(`/api/v1/enrollments/${enrollmentId}/status`)
      .set(auth(tokens.admin))
      .send({ paymentStatus: 'PAID' });
    expect(paid.status).toBe(200);
    expect(paid.body.data.paymentStatus).toBe('PAID');

    const back = await api
      .patch(`/api/v1/enrollments/${enrollmentId}/status`)
      .set(auth(tokens.admin))
      .send({ paymentStatus: 'PENDING' });
    expect(back.status).toBe(409);
  });
});

describe('Reseñas (MongoDB)', () => {
  it('estudiante no inscripto no puede reseñar → 403', async () => {
    const res = await api.post('/api/v1/reviews').set(auth(tokens.student2)).send({ courseId: ids.course, rating: 5 });
    expect(res.status).toBe(403);
  });

  it('estudiante inscripto reseña → 201 verificada; duplicada → 409', async () => {
    const res = await api
      .post('/api/v1/reviews')
      .set(auth(tokens.student))
      .send({ courseId: ids.course, rating: 4, comment: 'Muy buen curso' });
    expect(res.status).toBe(201);
    expect(res.body.data.isVerifiedEnrollment).toBe(true);
    expect(res.body.data.studentName).toBe('Student One');

    const dup = await api.post('/api/v1/reviews').set(auth(tokens.student)).send({ courseId: ids.course, rating: 5 });
    expect(dup.status).toBe(409);
  });

  it('rating fuera de rango → 400', async () => {
    const res = await api.post('/api/v1/reviews').set(auth(tokens.student)).send({ courseId: ids.course, rating: 6 });
    expect(res.status).toBe(400);
  });

  it('GET público de reseñas con promedio y distribución', async () => {
    const res = await api.get(`/api/v1/reviews/course/${ids.course}`);
    expect(res.status).toBe(200);
    expect(res.body.data.averageRating).toBe(4);
    expect(res.body.data.totalReviews).toBe(1);
    expect(res.body.data.distribution['4']).toBe(1);
  });
});

describe('Flujo 3 — Admin ve reportes', () => {
  it('reporte de inscripciones', async () => {
    const res = await api.get('/api/v1/reports/enrollments').set(auth(tokens.admin));
    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalEnrollments).toBe(2);
    expect(res.body.data.summary.completed).toBe(1);
    const row = res.body.data.byCourse.find((c: { courseId: number }) => c.courseId === ids.course);
    expect(row.avgProgressPct).toBe(100);
    expect(res.body.data.byMonth.length).toBe(1);
  });

  it('reporte de ingresos', async () => {
    const res = await api.get('/api/v1/reports/revenue').set(auth(tokens.admin));
    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalRevenue).toBe(40);
    expect(res.body.data.summary.pendingRevenue).toBe(10);
    expect(res.body.data.byTeacher[0].revenue).toBe(40);
  });

  it('filtro de fechas inválido → 400', async () => {
    const res = await api.get('/api/v1/reports/revenue?from=2030-01-01&to=2020-01-01').set(auth(tokens.admin));
    expect(res.status).toBe(400);
  });
});

describe('Usuarios', () => {
  it('un usuario no puede editar a otro → 403 ni cambiar su propio rol → 403', async () => {
    expect((await api.put(`/api/v1/users/${ids.teacher}`).set(auth(tokens.student)).send({ name: 'Otro Nombre' })).status).toBe(403);
    expect((await api.put(`/api/v1/users/${ids.student}`).set(auth(tokens.student)).send({ role: 'ADMIN' })).status).toBe(403);
  });

  it('actualiza el propio perfil y cambia la contraseña', async () => {
    const res = await api
      .put(`/api/v1/users/${ids.student}`)
      .set(auth(tokens.student))
      .send({ bio: 'Aprendiendo backend', currentPassword: PASSWORD, newPassword: 'NuevaPass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe('Aprendiendo backend');
    expect(res.body.data.password).toBeUndefined();

    const relog = await api.post('/api/v1/auth/login').send({ email: 'student@test.dev', password: 'NuevaPass123' });
    expect(relog.status).toBe(200);
  });

  it('perfil ajeno muestra solo datos públicos', async () => {
    const res = await api.get(`/api/v1/users/${ids.teacher}`).set(auth(tokens.student));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBeUndefined();
  });

  it('id inválido → 400', async () => {
    expect((await api.get('/api/v1/users/abc').set(auth(tokens.admin))).status).toBe(400);
  });

  it('ADMIN desactiva un usuario y este ya no puede loguearse', async () => {
    const res = await api.delete(`/api/v1/users/${ids.student}`).set(auth(tokens.admin));
    expect(res.status).toBe(200);
    const relog = await api.post('/api/v1/auth/login').send({ email: 'student@test.dev', password: 'NuevaPass123' });
    expect(relog.status).toBe(401);
  });
});

describe('Borrado de cursos (ADMIN)', () => {
  it('no se borra un curso con inscripciones activas → 409', async () => {
    const res = await api.delete(`/api/v1/courses/${ids.smallCourse}`).set(auth(tokens.admin));
    expect(res.status).toBe(409);
  });

  it('TEACHER no puede borrar → 403', async () => {
    expect((await api.delete(`/api/v1/courses/${ids.course}`).set(auth(tokens.teacher))).status).toBe(403);
  });
});
