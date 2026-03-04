/**
 * IProCore API — Tenant Isolation Tests (Control Plane)
 *
 * Proves that cross-tenant reads are BLOCKED at the IProCore control plane.
 * Uses supertest against the exported Express app with mocked Prisma and tenantResolver.
 *
 * Test A: Tenant B cannot see Tenant A's portfolio items via dashboard
 * Test B: Dashboard summary is always scoped to the JWT tenant (never another tenant's data)
 *
 * Blueprint §Tenant isolation — Skill 02 required tests.
 * Phase 04 hard gate: these tests must pass for Phase acceptance.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─── Mock Prisma BEFORE app import ────────────────────────────────────────────
jest.mock('../src/lib/db', () => ({
    prisma: {
        portfolioItem: {
            findMany: jest.fn(),
        },
        onboardingStep: {
            count: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
        },
        tenant: {
            findUnique: jest.fn(),
        },
        refreshToken: {
            count: jest.fn(),
        },
        membership: {
            findMany: jest.fn(),
        },
        userRole: {
            findMany: jest.fn(),
        },
        auditLog: {
            create: jest.fn(),
        },
    },
}));

import app from '../src/index';
import { prisma } from '../src/lib/db';

const TEST_SECRET = 'test-access-secret-minimum-32-characters-long-for-tests';

function makeToken(tenantId: string, userId: string): string {
    return jwt.sign(
        { activeTenantId: tenantId, userId, email: `${userId}@test.com` },
        TEST_SECRET,
        { expiresIn: '1h' },
    );
}

// ─── Shared mock setup ────────────────────────────────────────────────────────

function mockTenantLookup(tenantId: string, tenantName: string) {
    // tenantResolver calls prisma.tenant.findUnique
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: tenantId,
        slug: tenantId,
        name: tenantName,
        plan: 'starter',
        isActive: true,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-X',
        email: `user-X@${tenantId}.com`,
        locale: 'en',
        twoFaEnabled: false,
        lastLoginAt: null,
    });
    (prisma.onboardingStep.count as jest.Mock).mockResolvedValue(0);
    (prisma.refreshToken.count as jest.Mock).mockResolvedValue(1);
    (prisma.membership.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);
}

describe('IProCore Tenant Isolation — Control Plane (Blueprint §Tenant isolation)', () => {
    beforeEach(() => jest.clearAllMocks());

    /**
     * Test A: Cross-tenant portfolio read blocked
     *
     * Portfolio items for tenant-A exist in the DB.
     * Tenant-B makes a GET /api/dashboard/summary request.
     * The dashboard route uses tenantId from the JWT (tenant-B),
     * so portfolioItem.findMany is called with where: { tenantId: 'tenant-B' }.
     * The mock returns [] for tenant-B — no cross-tenant leakage.
     */
    it('A: Tenant B CANNOT see Tenant A portfolio items — cross-tenant read blocked', async () => {
        const tokenB = makeToken('tenant-B', 'user-B');
        mockTenantLookup('tenant-B', 'Tenant B Corp');

        // Simulate DB: tenant-A has 1 item, tenant-B has none
        (prisma.portfolioItem.findMany as jest.Mock).mockImplementation(
            ({ where }: { where: { tenantId: string } }) => {
                const tenantAData = [{ id: 'item-1', tenantId: 'tenant-A', name: 'Product A' }];
                // Filter strictly by tenantId — cross-tenant items never returned
                return Promise.resolve(
                    tenantAData.filter((i) => i.tenantId === where.tenantId),
                );
            },
        );

        const res = await request(app)
            .get('/api/dashboard/summary')
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        // Tenant B sees NO portfolio tiles — cross-tenant data is blocked
        expect(res.body.portfolioTiles).toHaveLength(0);

        // Confirm the DB was queried with tenant-B's tenantId ONLY
        const dbCall = (prisma.portfolioItem.findMany as jest.Mock).mock.calls[0][0];
        expect(dbCall.where).toHaveProperty('tenantId', 'tenant-B');
        // And NOT tenant-A
        expect(dbCall.where.tenantId).not.toBe('tenant-A');
    });

    /**
     * Test B: Dashboard summary is always scoped to the JWT tenant
     *
     * Even if a malicious client sends tenant-A's items in a body,
     * the server-side JWT-sourced tenantId (tenant-B) is always used.
     * Prove: portfolioItem.findMany is called with tenantId from JWT,
     * not from any client-controlled input.
     */
    it('B: Dashboard always uses JWT tenantId — client cannot inject another tenantId', async () => {
        const tokenB = makeToken('tenant-B', 'user-B');
        mockTenantLookup('tenant-B', 'Tenant B Corp');

        (prisma.portfolioItem.findMany as jest.Mock).mockResolvedValue([]);

        // Attempt to inject tenant-A's tenantId via custom header (no-op — route ignores it)
        const res = await request(app)
            .get('/api/dashboard/summary')
            .set('Authorization', `Bearer ${tokenB}`)
            .set('X-Tenant-Override', 'tenant-A'); // malicious override attempt

        expect(res.status).toBe(200);

        // Despite the override header, the DB query always used tenant-B's tenantId
        const dbCall = (prisma.portfolioItem.findMany as jest.Mock).mock.calls[0][0];
        expect(dbCall.where.tenantId).toBe('tenant-B');
        expect(dbCall.where.tenantId).not.toBe('tenant-A');
    });
});
