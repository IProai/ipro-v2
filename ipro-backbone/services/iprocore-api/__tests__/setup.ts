// Jest setup file — sets required env vars BEFORE any module is loaded.
// This prevents env.ts from calling process.exit(1) during tests.

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/iprocore_test';
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-minimum-32-characters-long-for-tests';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-minimum-32-characters-long-for-tests';
process.env.SSO_TOKEN_SECRET = 'test-sso-secret-minimum-32-characters-long-for-tests';
process.env.ACCESS_TOKEN_TTL_SECONDS = '900';
process.env.REFRESH_TOKEN_TTL_DAYS = '7';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
// JAD_RUNTIME_URL intentionally omitted in tests — graceful fallback tested via 'not_configured' status
