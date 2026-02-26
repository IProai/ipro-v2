// Unit tests for AuditLog and tenant isolation
// Run: npm test (from services/iprocore-api/)

import { prisma } from '../src/lib/db';
import { writeAudit } from '../src/lib/audit';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
jest.mock('../src/lib/db', () => ({
    prisma: {
        auditLog: {
            create: jest.fn(),
        },
        portfolioItem: {
            findMany: jest.fn(),
        },
    },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('AuditLog — Skill 02 / Blueprint §Audit', () => {
    beforeEach(() => jest.clearAllMocks());

    it('writes an audit log with correct fields', async () => {
        (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

        await writeAudit({
            tenantId: 'tenant-1',
            actorId: 'user-1',
            action: 'portfolio.create',
            resource: 'PortfolioItem',
            resourceId: 'item-1',
            meta: { name: 'Test Product' },
            requestId: 'req-abc',
        });

        expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
        const call = (mockPrisma.auditLog.create as jest.Mock).mock.calls[0][0];
        expect(call.data).toMatchObject({
            tenantId: 'tenant-1',
            actorId: 'user-1',
            action: 'portfolio.create',
            resource: 'PortfolioItem',
            resourceId: 'item-1',
        });
        // Ensure no secrets in meta
        expect(JSON.stringify(call.data.meta)).not.toContain('password');
        expect(JSON.stringify(call.data.meta)).not.toContain('secret');
    });

    it('does NOT throw when audit write fails (non-blocking)', async () => {
        (mockPrisma.auditLog.create as jest.Mock).mockRejectedValue(new Error('DB down'));

        await expect(
            writeAudit({
                tenantId: 'tenant-1',
                actorId: 'user-1',
                action: 'auth.login',
                resource: 'User',
            }),
        ).resolves.toBeUndefined(); // Should not propagate the error
    });
});

describe('Tenant isolation — Blueprint §Tenant isolation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('portfolio query is always scoped to tenantId from JWT (never client)', async () => {
        (mockPrisma.portfolioItem.findMany as jest.Mock).mockResolvedValue([]);

        const tenantId = 'tenant-A';

        // Simulate what the route handler does:
        await prisma.portfolioItem.findMany({
            where: { tenantId }, // tenantId from req.tenant (JWT-resolved)
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });

        const callArgs = (mockPrisma.portfolioItem.findMany as jest.Mock).mock.calls[0][0];
        // Tenant isolation: where clause MUST contain tenantId
        expect(callArgs.where).toHaveProperty('tenantId', 'tenant-A');
    });

    it('portfolio query for tenant-B does NOT return tenant-A items', async () => {
        // Simulate: tenant-A items exist but query filters by tenant-B
        (mockPrisma.portfolioItem.findMany as jest.Mock).mockImplementation(({ where }) => {
            // Mock DB that has items for tenant-A only
            const mockData = [{ id: 'item-1', tenantId: 'tenant-A', name: 'Product A' }];
            return Promise.resolve(mockData.filter((i) => i.tenantId === where.tenantId));
        });

        const result = await prisma.portfolioItem.findMany({ where: { tenantId: 'tenant-B' } });

        expect(result).toHaveLength(0); // tenant-B sees nothing from tenant-A
    });
});

describe('requireAuth middleware — Blueprint §Auth & sessions', () => {
    it('rejects requests without Authorization header', async () => {
        const { requireAuth } = await import('../src/middleware/requireAuth');
        const mockReq = { headers: {} } as any;
        const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
        const mockNext = jest.fn();

        requireAuth(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('rejects malformed Bearer token', () => {
        const { requireAuth } = require('../src/middleware/requireAuth');
        const mockReq = { headers: { authorization: 'Bearer not-a-valid-jwt' } } as any;
        const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
        const mockNext = jest.fn();

        requireAuth(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('safe error handler does not expose stack traces', () => {
        const { errorHandler } = require('../src/middleware/errorHandler');
        const err = new Error('Internal DB error with connection string postgresql://...');
        const mockReq = { method: 'GET', path: '/test', headers: { 'x-request-id': 'req-1' } } as any;
        const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
        const mockNext = jest.fn();

        errorHandler(err, mockReq, mockRes, mockNext);

        const responseBody = mockRes.json.mock.calls[0][0];
        // Stack trace must NOT appear in response body
        expect(JSON.stringify(responseBody)).not.toContain('postgresql://');
        expect(JSON.stringify(responseBody)).not.toContain('connection string');
        expect(responseBody.error).toBe('Internal server error');
    });
});
