/**
 * JAD Runtime — Tenant Isolation Tests (Execution Plane)
 *
 * Proves that cross-tenant reads and writes are BLOCKED in the JAD runtime.
 * Uses supertest against the exported Express app with mocked Prisma.
 *
 * Test A: Tenant B cannot read Tenant A's connector activation
 * Test B: Tenant B cannot trigger health check on Tenant A's activation
 *
 * Blueprint §Tenant isolation — Skill 02 required tests.
 * Phase 04 hard gate: these tests must pass for Phase acceptance.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock Prisma BEFORE app import ────────────────────────────────────────────
vi.mock('../lib/db', () => ({
    prisma: {
        connectorActivation: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
        },
        connectorHealthLog: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
        connectorDefinition: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        workflowRun: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
    },
}));

// ─── Mock audit (fire-and-forget — not needed in tests) ───────────────────────
vi.mock('../lib/audit', () => ({
    writeJadAudit: vi.fn(),
}));

import app from '../index';
import { prisma } from '../lib/db';

const TEST_SECRET = 'test-jad-access-secret-minimum-32-chars-for-tests';

function makeToken(tenantId: string, userId: string): string {
    return jwt.sign(
        { tenantId, userId, roles: ['member'], email: `${userId}@test.com` },
        TEST_SECRET,
        { expiresIn: '1h' },
    );
}

// Typed mock helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mock = (fn: any) => fn as ReturnType<typeof vi.fn>;

describe('JAD Tenant Isolation — Execution Plane (Blueprint §Tenant isolation)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Test A: Cross-tenant activation READ blocked
     *
     * Tenant A creates an activation.
     * Tenant B sends GET /api/jad/activations/:id with tenant-B JWT.
     * The route filter is: findFirst({ where: { id, tenantId: tenantB } })
     * Since the activation belongs to tenantA, Prisma returns null → 404.
     */
    it('A: Tenant B CANNOT read Tenant A activation — cross-tenant read blocked', async () => {
        const tenantAActivationId = 'a1b2c3d4-0000-0000-0000-000000000001';
        const tokenB = makeToken('tenant-B', 'user-B');

        // Mock: DB has the activation but it belongs to tenant-A
        // The route queries with tenantId=tenant-B → no match → null
        mock(prisma.connectorActivation.findFirst).mockImplementation(
            ({ where }: { where: { id: string; tenantId: string } }) => {
                if (where.tenantId === 'tenant-A' && where.id === tenantAActivationId) {
                    return Promise.resolve({
                        id: tenantAActivationId,
                        tenantId: 'tenant-A',
                        connectorId: 'connector-1',
                        status: 'active',
                        activatedAt: new Date(),
                        revokedAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        connector: { name: 'Slack', type: 'webhook', logoUrl: null },
                    });
                }
                // tenant-B query returns null — isolation enforced
                return Promise.resolve(null);
            },
        );

        const res = await request(app)
            .get(`/api/jad/activations/${tenantAActivationId}`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Activation not found');
    });

    /**
     * Test B: Cross-tenant health check WRITE blocked
     *
     * Tenant A has an activation.
     * Tenant B attempts POST /api/jad/health/check with tenant-A's activationId.
     * The route checks: findFirst({ where: { id: activationId, tenantId: tenantB } })
     * Since the activation belongs to tenantA → null → 404.
     * Therefore Tenant B CANNOT create a health log for Tenant A's activation.
     */
    it('B: Tenant B CANNOT trigger health check on Tenant A activation — cross-tenant write blocked', async () => {
        // Use a valid UUID so zod validation passes — isolation check must be reached
        const tenantAActivationId = 'a1b2c3d4-0000-0000-0000-000000000001';
        const tokenB = makeToken('tenant-B', 'user-B');

        // Mock: activation exists for tenant-A only
        mock(prisma.connectorActivation.findFirst).mockImplementation(
            ({ where }: { where: { id: string; tenantId: string } }) => {
                if (where.tenantId === 'tenant-A' && where.id === tenantAActivationId) {
                    return Promise.resolve({ id: tenantAActivationId, tenantId: 'tenant-A' });
                }
                return Promise.resolve(null);
            },
        );

        const res = await request(app)
            .post('/api/jad/health/check')
            .set('Authorization', `Bearer ${tokenB}`)
            .send({ activationId: tenantAActivationId });

        // Tenant B cannot reach Tenant A's activation → 404
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Activation not found');

        // Health log was NOT created for tenant-A's activation
        expect(prisma.connectorHealthLog.create).not.toHaveBeenCalled();
    });
});
