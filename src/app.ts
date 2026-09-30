import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env, isTest } from './config/env';
import { sequelize } from './config/database';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { generalLimiter } from './middlewares/rateLimiter';
import './models/postgres'; // registra modelos + asociaciones

import authRouter from './routes/auth.routes';
import usersRouter from './routes/users.routes';
import coursesRouter from './routes/courses.routes';
import lessonsRouter from './routes/lessons.routes';
import enrollmentsRouter from './routes/enrollments.routes';
import progressRouter from './routes/progress.routes';
import reportsRouter from './routes/reports.routes';
import reviewsRouter from './routes/reviews.routes';

const app = express();

// Railway / Render están detrás de un proxy: necesario para rate limit por IP real
app.set('trust proxy', 1);

// ─── Middlewares globales ─────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL === '*' ? '*' : env.FRONTEND_URL.split(',').map((o) => o.trim()) }));
app.use(express.json({ limit: '100kb' }));
if (!isTest) app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', generalLimiter);

// ─── Rutas base ───────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'EduTrack API 🎓', version: '1.0.0', docs: '/api/v1' });
});

app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    success: true,
    resources: ['/auth', '/users', '/courses', '/courses/:id/lessons', '/enrollments', '/progress', '/reports', '/reviews'],
  });
});

app.get('/health', async (_req: Request, res: Response) => {
  let postgres = 'up';
  try {
    await sequelize.authenticate();
  } catch {
    postgres = 'down';
  }
  const mongo = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const ok = postgres === 'up' && mongo === 'up';
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', postgres, mongo, uptime: Math.round(process.uptime()) });
});

// ─── Routers v1 ───────────────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/courses', coursesRouter);
app.use('/api/v1/courses', lessonsRouter); // /api/v1/courses/:id/lessons
app.use('/api/v1/enrollments', enrollmentsRouter);
app.use('/api/v1/progress', progressRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/reviews', reviewsRouter);

// ─── 404 + errores ────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
