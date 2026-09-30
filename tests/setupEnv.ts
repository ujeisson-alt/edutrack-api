// Variables para el entorno de test (se cargan ANTES que la app)
process.env.NODE_ENV = 'test';
process.env.PG_DATABASE = process.env.TEST_PG_DATABASE ?? 'edutrack_test';
process.env.JWT_SECRET = 'test_secret_test_secret_test_secret_1234567890';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/edutrack_test';
// Nunca usar la DATABASE_URL de producción/desarrollo en tests
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
