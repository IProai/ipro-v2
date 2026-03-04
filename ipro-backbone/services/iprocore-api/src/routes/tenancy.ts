import { Router } from 'express';
import { prisma } from '../lib/db';
import { requireAuth } from '../middleware/requireAuth';
import { issueAccessToken } from '../lib/jwt';

export const tenancyRouter = Router();

/**
 * GET /api/tenancy/list
 * Returns all tenants the current user is a member of + marks active tenant.
 */
tenancyRouter.get('/list', requireAuth, async (req, res) => {
    try {
        const userId = req.auth!.userId;
        const activeTenantId = req.auth!.activeTenantId;

        const memberships = await prisma.membership.findMany({
            where: { userId },
            include: {
                tenant: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        plan: true,
                        isActive: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        const userRoles = await prisma.userRole.findMany({
            where: { userId, tenantId: { in: memberships.map(m => m.tenantId) } },
            include: { role: { select: { name: true } } }
        });

        const tenants = memberships
            .filter((m) => m.tenant)
            .map((m) => {
                const roles = userRoles.filter(ur => ur.tenantId === m.tenantId).map(ur => ur.role.name);
                return {
                    id: m.tenant.id,
                    slug: m.tenant.slug,
                    name: m.tenant.name,
                    plan: m.tenant.plan,
                    isActive: m.tenant.isActive,
                    isCurrentActive: m.tenant.id === activeTenantId,
                    membership: {
                        id: m.id,
                        roles,
                    },
                };
            });

        return res.json({ tenants, activeTenantId });
    } catch (err: any) {
        return res.status(500).json({ error: 'TENANCY_LIST_FAILED', details: err?.message ?? String(err) });
    }
});

/**
 * POST /api/tenancy/switch
 * Body: { tenantId: string }
 * Validates membership, then issues a new access token with activeTenantId switched.
 */
tenancyRouter.post('/switch', requireAuth, async (req, res) => {
    try {
        const userId = req.auth!.userId;
        const email = req.auth!.email;

        const { tenantId } = req.body ?? {};
        if (!tenantId || typeof tenantId !== 'string') {
            return res.status(400).json({ error: 'INVALID_TENANT_ID' });
        }

        const membership = await prisma.membership.findFirst({
            where: { userId, tenantId },
            select: { id: true, tenantId: true },
        });

        if (!membership) {
            return res.status(403).json({ error: 'TENANT_SWITCH_FORBIDDEN' });
        }

        const accessToken = issueAccessToken({
            userId,
            activeTenantId: tenantId,
            email,
        });

        return res.json({
            ok: true,
            activeTenantId: tenantId,
            accessToken,
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'TENANT_SWITCH_FAILED', details: err?.message ?? String(err) });
    }
});