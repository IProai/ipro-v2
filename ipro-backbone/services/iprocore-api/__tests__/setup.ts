// Jest setup file — sets required env vars BEFORE any module is loaded.
// This prevents env.ts from calling process.exit(1) during tests.
// MUST be at top before any app imports

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret'

// Mock Prisma completely
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    portfolioItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    aiSuggestion: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    aiConfirmation: {
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  }

  return {
    PrismaClient: jest.fn(() => mockPrisma),
  }
})

// Optional: mock auth middleware
jest.mock('../src/middleware/auth', () => ({
  requireAuth: () => (req, res, next) => {
    req.user = {
      id: 'user-1',
      tenantId: 'tenant-a',
      role: 'owner',
    }
    next()
  },
  requireRole: () => (req, res, next) => next(),
}))
// JAD_RUNTIME_URL intentionally omitted in tests — graceful fallback tested via 'not_configured' status
