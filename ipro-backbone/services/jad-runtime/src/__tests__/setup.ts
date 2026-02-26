// JAD Runtime — Vitest setup file
// Sets required env vars BEFORE any module is loaded.
// This prevents env.ts from calling process.exit(1) during tests.

process.env.JAD_DATABASE_URL = 'postgresql://test:test@localhost:5432/jad_test';
process.env.JAD_IPROCORE_ACCESS_SECRET = 'test-jad-access-secret-minimum-32-chars-for-tests';
process.env.IPROCORE_AUDIT_URL = 'http://localhost:3000/api/audit';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
