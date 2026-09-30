-- =============================================================
--  EduTrack API — PostgreSQL schema (v15+)
--  Ejecutar sobre una base existente:  psql -d edutrack_db -f database/schema.sql
--  o con:  npm run db:reset   (borra y recrea todo — solo desarrollo)
-- =============================================================

-- ---------- Limpieza (idempotente) ----------
DROP VIEW     IF EXISTS vw_course_stats;
DROP FUNCTION IF EXISTS get_student_progress(INT, INT);
DROP TABLE    IF EXISTS progress, enrollments, lessons, courses, users, categories CASCADE;
DROP TYPE     IF EXISTS user_role, enrollment_status, payment_status;

-- ---------- Tipos personalizados ----------
CREATE TYPE user_role         AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE payment_status    AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- ---------- categories ----------
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- users ----------
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(200) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        user_role    NOT NULL DEFAULT 'STUDENT',
  bio         TEXT,
  avatar_url  VARCHAR(500),
  is_active   BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ---------- courses ----------
CREATE TABLE courses (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(200)   NOT NULL,
  description   TEXT,
  teacher_id    INT            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category_id   INT            REFERENCES categories(id) ON DELETE SET NULL,
  price         NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  max_students  INT            NOT NULL DEFAULT 30  CHECK (max_students > 0),
  is_published  BOOLEAN        DEFAULT FALSE,
  created_at    TIMESTAMPTZ    DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    DEFAULT NOW()
);
CREATE INDEX idx_courses_teacher   ON courses(teacher_id);
CREATE INDEX idx_courses_category  ON courses(category_id);
CREATE INDEX idx_courses_published ON courses(is_published);

-- ---------- lessons ----------
CREATE TABLE lessons (
  id                SERIAL PRIMARY KEY,
  course_id         INT          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title             VARCHAR(200) NOT NULL,
  content           TEXT,
  order_index       INT          NOT NULL DEFAULT 0,
  duration_minutes  INT          CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_lessons_course_order ON lessons(course_id, order_index);

-- ---------- enrollments (N:M students <-> courses) ----------
CREATE TABLE enrollments (
  id              SERIAL PRIMARY KEY,
  student_id      INT               NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  course_id       INT               NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at     TIMESTAMPTZ       DEFAULT NOW(),
  status          enrollment_status DEFAULT 'ACTIVE',
  payment_status  payment_status    DEFAULT 'PENDING',
  UNIQUE (student_id, course_id)   -- un estudiante no puede inscribirse dos veces al mismo curso
);
CREATE INDEX idx_enrollments_course_status ON enrollments(course_id, status);

-- ---------- progress (progreso por lección) ----------
CREATE TABLE progress (
  id            SERIAL PRIMARY KEY,
  student_id    INT         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  lesson_id     INT         NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ DEFAULT NOW(),
  is_completed  BOOLEAN     DEFAULT FALSE,
  UNIQUE (student_id, lesson_id)
);

-- ---------- Vista: cursos publicados con inscriptos y ocupación ----------
CREATE VIEW vw_course_stats AS
SELECT
  c.id,
  c.title,
  u.name                          AS teacher_name,
  COUNT(DISTINCT e.student_id)    AS total_enrolled,
  COUNT(DISTINCT l.id)            AS total_lessons,
  c.max_students,
  ROUND(COUNT(DISTINCT e.student_id)::numeric / NULLIF(c.max_students, 0) * 100, 1) AS occupancy_pct
FROM courses c
LEFT JOIN users       u ON c.teacher_id = u.id
LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'ACTIVE'
LEFT JOIN lessons     l ON c.id = l.course_id
WHERE c.is_published = TRUE
GROUP BY c.id, c.title, u.name, c.max_students;

-- ---------- Función: % de progreso de un estudiante en un curso ----------
CREATE OR REPLACE FUNCTION get_student_progress(p_student_id INT, p_course_id INT)
RETURNS NUMERIC AS $$
DECLARE
  total_lessons     INT;
  completed_lessons INT;
BEGIN
  SELECT COUNT(*) INTO total_lessons FROM lessons WHERE course_id = p_course_id;

  SELECT COUNT(*) INTO completed_lessons
  FROM progress p
  JOIN lessons  l ON p.lesson_id = l.id
  WHERE p.student_id = p_student_id
    AND l.course_id  = p_course_id
    AND p.is_completed = TRUE;

  RETURN CASE WHEN total_lessons = 0 THEN 0
              ELSE ROUND(completed_lessons::numeric / total_lessons * 100, 1) END;
END;
$$ LANGUAGE plpgsql STABLE;
