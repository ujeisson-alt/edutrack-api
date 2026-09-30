/* eslint-disable no-console */
/**
 * Logger mínimo con niveles. Evita console.log sueltos en el código
 * y permite silenciar la salida en tests.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const current: Level =
  process.env.NODE_ENV === 'test' ? 'error' : process.env.NODE_ENV === 'production' ? 'info' : 'debug';

const write = (level: Level, message: string, meta?: unknown): void => {
  if (order[level] < order[current]) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  if (meta !== undefined) out(line, meta);
  else out(line);
};

export const logger = {
  debug: (msg: string, meta?: unknown) => write('debug', msg, meta),
  info: (msg: string, meta?: unknown) => write('info', msg, meta),
  warn: (msg: string, meta?: unknown) => write('warn', msg, meta),
  error: (msg: string, meta?: unknown) => write('error', msg, meta),
};
