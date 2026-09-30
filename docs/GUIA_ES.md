# Guía rápida (español) — EduTrack API

Esta guía explica cómo levantar el proyecto, cómo se relaciona cada archivo con las 10 etapas del curso y qué responder en una entrevista.

## 1. Levantar el proyecto en tu PC (Windows)

1. Instalá **Node.js 20 LTS**, **PostgreSQL 15+** (incluye pgAdmin) y **MongoDB Community** (o creá un cluster gratis en MongoDB Atlas).
2. En pgAdmin creá dos bases: `edutrack_db` y `edutrack_test`.
3. En la carpeta del proyecto:

```bash
npm install
copy .env.example .env      # en Mac/Linux: cp .env.example .env
```

4. Editá `.env`: poné tu `PG_PASSWORD`, tu `MONGODB_URI` y un `JWT_SECRET` largo. Para generarlo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

5. Creá las tablas, cargá datos demo y arrancá:

```bash
npm run db:reset
npm run db:seed
npm run dev
```

6. Abrí `http://localhost:3000` → debe responder el mensaje de bienvenida. `http://localhost:3000/health` debe mostrar `postgres: up` y `mongo: up`.

## 2. Probar

| Qué | Comando |
|-----|---------|
| Tests automáticos (Jest + Supertest, 47 casos) | `npm test` |
| Colección Postman por consola (Newman) | `npm run test:postman` (con `npm run dev` corriendo) |
| Compilar para producción | `npm run build` |

En Postman: **Import** → `docs/postman/EduTrack.postman_collection.json` y el environment `EduTrack.local.postman_environment.json`. Ejecutá la colección completa con el **Runner**: los tokens e IDs se guardan solos en variables.

## 3. Qué archivo cubre cada etapa

| Etapa | Dónde está |
|-------|-----------|
| 1. Setup | `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `src/app.ts`, `src/server.ts` |
| 2. PostgreSQL | `database/schema.sql` (ENUMs, tablas, índices, vista `vw_course_stats`, función `get_student_progress`) |
| 3. MongoDB | `src/models/mongo/ActivityLog.ts`, `CourseReview.ts`, `src/config/mongodb.ts` |
| 4. Arquitectura | `src/types`, `src/middlewares/errorHandler.ts`, routers registrados en `src/app.ts` |
| 5. CRUD | `src/controllers/*`, `src/routes/*`, `src/schemas/*` (Zod) |
| 6. Auth y roles | `src/middlewares/auth.ts` (`authMiddleware`, `requireRoles`, `optionalAuth`), `rateLimiter.ts` |
| 7. Sequelize | `src/config/database.ts`, `src/models/postgres/*`, `associations.ts` |
| 8. Testing y docs | `tests/api.e2e.test.ts`, `docs/postman/`, `README.md`, `docs/images/der.png` |
| 9. Deploy | Sección *Deploy* del README, soporte de `DATABASE_URL`, scripts `db:reset:prod` / `db:seed:prod` |
| 10. Cierre | Roadmap v2 en el README + preguntas de entrevista abajo |

## 4. Repositorio en GitHub

El código está publicado en https://github.com/ujeisson-alt/edutrack-api. Para trabajar en tu PC:

```bash
git clone https://github.com/ujeisson-alt/edutrack-api.git
cd edutrack-api
npm install
```

Usá la convención de commits del curso (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) en los próximos cambios.

Después del deploy, reemplazá `https://YOUR-APP.up.railway.app` en el README y en `docs/postman/EduTrack.production.postman_environment.json`.

## 5. Decisiones que vale la pena explicar en una entrevista

- **¿Cómo evitás inscripciones duplicadas?** Doble barrera: `UNIQUE (student_id, course_id)` en la base y verificación previa en el controller que devuelve 409.
- **¿Cómo controlás el cupo con dos requests simultáneas?** La inscripción corre en una transacción que bloquea la fila del curso (`SELECT … FOR UPDATE`); la segunda request espera, cuenta de nuevo y recibe 409 si ya no hay lugar.
- **¿Dónde se calcula el progreso?** En PostgreSQL con la función `get_student_progress()`; el controller la llama y, si llega al 100 %, pasa la inscripción a `COMPLETED`.
- **¿Por qué dos bases?** PostgreSQL para datos relacionales con integridad; MongoDB para logs (estructura variable, alto volumen, TTL de 90 días) y reseñas.
- **¿Qué es eager loading?** Traer modelos relacionados en la misma query con `include` (un JOIN). Evita el problema N+1.
- **¿Por qué el login responde igual si el email no existe?** Para no revelar qué emails están registrados; además se compara contra un hash ficticio para que el tiempo de respuesta sea similar.
- **¿Por qué baja lógica de usuarios?** Borrar un docente rompería cursos e ingresos históricos; `is_active = false` conserva el historial y bloquea el login.
