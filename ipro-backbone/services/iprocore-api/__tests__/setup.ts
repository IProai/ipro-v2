import type { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/iprocore_test';
process.env.ACCESS_TOKEN_SECRET =
    process.env.ACCESS_TOKEN_SECRET ?? 'test-access-secret-minimum-32-characters-long-for-tests';
process.env.REFRESH_TOKEN_SECRET =
    process.env.REFRESH_TOKEN_SECRET ?? 'test-refresh-secret-minimum-32-characters-long-for-tests';
process.env.SSO_TOKEN_SECRET =
    process.env.SSO_TOKEN_SECRET ?? 'test-sso-secret-minimum-32-characters-long-for-tests';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173';
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-minimum-32-characters-long-for-tests';

type PrismaOperation = jest.Mock<unknown, unknown[]>;

const createModelMock = (): Record<string, PrismaOperation> => {
    const operations: Record<string, PrismaOperation> = {};

    return new Proxy(operations, {
        get(target, property: string | symbol): PrismaOperation {
            const key = String(property);
            if (!target[key]) {
                target[key] = jest.fn();
            }
            return target[key];
        },
    });
};

const basePrismaMock: Record<string, unknown> = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
};

const prismaMock = new Proxy(basePrismaMock, {
    get(target, property: string | symbol): unknown {
        const key = String(property);
        if (!(key in target)) {
            target[key] = createModelMock();
        }
        return target[key];
    },
});

(basePrismaMock.$transaction as jest.Mock).mockImplementation(
    async (input: unknown): Promise<unknown> => {
        if (typeof input === 'function') {
            const callback = input as (client: typeof prismaMock) => unknown;
            return callback(prismaMock);
        }
        if (Array.isArray(input)) {
            return Promise.all(input);
        }
        return undefined;
    },
);

jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn(() => prismaMock),
}));

interface TestTokenPayload extends JwtPayload {
    userId?: string;
    tenantId?: string;
    activeTenantId?: string;
    email?: string;
    role?: string;
}

jest.mock('../src/middleware/requireAuth', () => ({
    requireAuth: (req: Request, res: Response, next: NextFunction): void => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const token = authHeader.slice(7);
        try {
            const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as TestTokenPayload;
            const userId = payload.userId ?? 'user-1';
            const activeTenantId = payload.activeTenantId ?? payload.tenantId;
            if (!activeTenantId) {
                res.status(401).json({ error: 'Unauthorized: No active tenant specified in token' });
                return;
            }
            const role = payload.role ?? 'owner';

            req.auth = {
                userId,
                activeTenantId,
                email: payload.email ?? `${userId}@test.local`,
            };

            (req as Request & { user?: { id: string; tenantId: string; role: string } }).user = {
                id: userId,
                tenantId: activeTenantId,
                role,
            };

            next();
        } catch {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
}));

jest.mock('../src/middleware/requireRole', () => ({
    requireRole:
        (_roleKey: string) =>
        (_req: Request, _res: Response, next: NextFunction): void => {
            next();
        },
    requireAnyRole:
        (_roleKeys: string[]) =>
        (_req: Request, _res: Response, next: NextFunction): void => {
            next();
        },
}));
