import { AuthUser } from './index';

// Extiende Request de Express para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
