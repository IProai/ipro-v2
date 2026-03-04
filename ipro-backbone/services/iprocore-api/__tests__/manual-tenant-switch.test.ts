import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../src/lib/db', () => ({
    prisma: {
        portfolioItem: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
        },
        tenant: {
            findUnique: jest.fn(),
        },
        userRole: {
            findMany: jest.fn(),
        },
        membership: {
            findUnique: jest.fn(),
        }
    },
}));

import app from '../src/index';
import { prisma } from '../src/lib/db';

const TEST_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret-minimum-32-characters-long-for-tests';

// Helper to simulate switch-tenant response tokens
function makeToken(tenantId: string | null, userId: string): string {
    const payload: any = { userId, email: `${userId}@test.com` };
    if (tenantId) payload.activeTenantId = tenantId;
    return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

describe('Explicit Tenant Switch Isolation (Functional Flow)', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock tenant resolution successfully
        (prisma.tenant.findUnique as jest.Mock).mockImplementation(
            ({ where }: { where: { id: string } }) =>
                Promise.resolve({
                    id: where.id,
                    slug: where.id,
                    name: `${where.id} Tenant`,
                    plan: 'starter',
                    isActive: true,
                }),
        );

        // Mock membership exists
        (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ memberRole: 'owner' });

        // Mock user roles so requirePerm('portfolio:manage') passes natively
        (prisma.userRole.findMany as jest.Mock).mockResolvedValue([{
            role: { rolePermissions: [{ permission: { key: 'portfolio:manage' } }] }
        }]);
    });

    it('Executes the required tenant verification flow securely', async () => {

        // Step 1: Login user A (Tenant T1) - simulated by obtaining Token 1
        const tokenT1 = makeToken('T1', 'userA');

        // Step 2: Access resource in T1 -> 200 OK
        // Mock the DB to return a valid portfolio item for T1 lookup
        (prisma.portfolioItem.findFirst as jest.Mock).mockImplementation(({ where }) => {
            if (where.id === 'item-created-in-t1' && where.tenantId === 'T1') {
                return Promise.resolve({ id: 'item-created-in-t1', tenantId: 'T1', name: 'T1 Resource' });
            }
            return Promise.resolve(null);
        });

        const resAccessT1 = await request(app)
            .get('/api/portfolio/item-created-in-t1')
            .set('Authorization', `Bearer ${tokenT1}`);

        expect(resAccessT1.status).toBe(200);
        expect(resAccessT1.body.item.id).toBe('item-created-in-t1');

        // Step 3: Switch to T2 -> Token updates (simulated by getting a new token for T2)
        const tokenT2 = makeToken('T2', 'userA');

        // Step 4: Access T1 data while in T2 -> Must 403 (or 404 isolated)
        // User uses their new token to call the exact same endpoint. 
        // tenantResolver pulls 'T2' out of the JWT and passes it to the Prisma query.
        const resAccessT1withT2 = await request(app)
            .get('/api/portfolio/item-created-in-t1')
            .set('Authorization', `Bearer ${tokenT2}`);

        // The middleware passes T2 to the DB: findFirst({ where: { id: 'item(...)', tenantId: 'T2' } })
        // Prisma mock logic returns null, making the API return 404 (Not Found in this tenant scope)
        console.log("Switching to T2 and calling T1 resource...");
        console.log("T2 Response Status:", resAccessT1withT2.status);
        console.log("T2 Response Body:", resAccessT1withT2.body);

        expect(resAccessT1withT2.status).toBe(404);
        expect(resAccessT1withT2.body.error).toMatch(/not found/i);

        // Confirm Prisma was indeed challenged with tenantId: 'T2' to block the lookup
        expect((prisma.portfolioItem.findFirst as jest.Mock).mock.calls[1][0].where.tenantId).toBe('T2');

        // Step 5: Attempt request without activeTenantId -> Must fail (401 Unauthorized via Auth Middleware)
        const tokenNoTenant = makeToken(null, 'userA');
        const resNoTenant = await request(app)
            .get('/api/portfolio/item-created-in-t1')
            .set('Authorization', `Bearer ${tokenNoTenant}`);

        // Our requireAuth / tenantResolver stack explicitly fails requests lacking activeTenantId.
        expect(resNoTenant.status).toBe(401);
    });
});
