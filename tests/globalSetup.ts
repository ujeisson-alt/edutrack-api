/**
 * Levanta un MongoDB en memoria para los tests (salvo que se indique MONGODB_URI_TEST).
 * PostgreSQL: se usa una base de test real (por defecto edutrack_test) — ver README.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  // eslint-disable-next-line no-var
  var __MONGOD__: MongoMemoryServer | undefined;
}

export default async function globalSetup(): Promise<void> {
  if (process.env.MONGODB_URI_TEST) {
    process.env.MONGODB_URI = process.env.MONGODB_URI_TEST;
    return;
  }
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;
  process.env.MONGODB_URI = mongod.getUri('edutrack_test');
}
