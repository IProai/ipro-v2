// Jest setup file — sets required env vars BEFORE any module is loaded.
// This prevents env.ts from calling process.exit(1) during tests.
// MUST be at top before any app imports

// __tests__/setup.ts
import type { Request, Response, NextFunction } from "express";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret";

// ---- Mock Prisma completely (example; keep your existing mock if already working) ----
jest.mock("@prisma/client", () => {
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
    auditLog: {
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

// ---- Mock auth middleware (THIS fixes TS7006) ----
// IMPORTANT: adjust this import path to match your repo:
// e.g. "../src/middleware/auth" or "../src/middlewares/auth" etc.
jest.mock("../src/middleware/auth", () => ({
  requireAuth: () => (req: Request, _res: Response, next: NextFunction) => {
    // Attach a stable test user context
    (req as any).user = {
      id: "user-1",
      tenantId: "tenant-a",
      role: "owner",
    };
    next();
  },

  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => {
    // In tests we just allow; real enforcement is covered in prod
    next();
  },
}));
// JAD_RUNTIME_URL intentionally omitted in tests — graceful fallback tested via 'not_configured' status
