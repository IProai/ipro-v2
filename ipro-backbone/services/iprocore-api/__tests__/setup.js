// Jest setup file — sets required env vars BEFORE any module is loaded.
// This prevents env.ts from calling process.exit(1) during tests.
// Plain JS to avoid tsconfig conflicts with @types/node scope.

process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/iprocore_test';
process.env['ACCESS_TOKEN_SECRET'] = 'test-access-secret-minimum-32-characters-long-for-tests';
process.env['REFRESH_TOKEN_SECRET'] = 'test-refresh-secret-minimum-32-characters-long-for-tests';
process.env['ACCESS_TOKEN_TTL_SECONDS'] = '900';
process.env['REFRESH_TOKEN_TTL_DAYS'] = '7';
process.env['PORT'] = '3001';
process.env['NODE_ENV'] = 'test';
process.env['ALLOWED_ORIGINS'] = 'http://localhost:5173';
