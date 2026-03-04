import { Router } from 'express';
import { prisma } from '../lib/db';
import { requireAuth } from '../middleware/requireAuth';
import { tenantResolver } from '../middleware/tenantResolver';
import { env } from '../lib/env';

const router = Router();

// Auth + tenant pipeline on all dashboard routes
router.use(requireAuth, tenantResolver);

/**
 * GET /api/dashboard/summary
 * Returns everything the Ecosystem Dashboard needs in one call:
 * - Product tiles (published + not kill-switched, tenant-scoped)
 * - Onboarding progress (total / completed steps)
 * - Security badge (twoFaEnabled, lastLogin, session count)
 * - JAD readiness badge (Phase 04 — live health check to JAD service)
 * Blueprint §5 Ecosystem Dashboard
 */
router.get('/summary', async (req, res, next) => {
    try {
        const { activeTenantId: tenantId, userId } = req.auth!;

        let portfolioTiles = [];
        let totalSteps = 0;
        let completedSteps = 0;
        let user: any = null;
        let tenant: any = null;
        let sessionCount = 0;
        let memberships: any[] = [];
        let userRolesAll: any[] = [];
        let jadReadiness: any = { status: 'mocked' };

        try {
            // 1) Product tiles
            portfolioTiles = await prisma.portfolioItem.findMany({
                where: { tenantId, status: 'published', killSwitch: false },
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                select: { id: true, name: true, type: true, icon: true, descriptionEn: true, descriptionAr: true, launchUrlProd: true, ssoMode: true, version: true },
            });

            // 2) Onboarding progress
            [totalSteps, completedSteps] = await Promise.all([
                prisma.onboardingStep.count({ where: { tenantId } }),
                prisma.onboardingStep.count({ where: { tenantId, completedAt: { not: null } } }),
            ]);

            // 3) User / tenant context
            [user, tenant] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, email: true, locale: true, twoFaEnabled: true, lastLoginAt: true },
                }),
                prisma.tenant.findUnique({
                    where: { id: tenantId },
                    select: { id: true, slug: true, name: true, plan: true },
                }),
            ]);

            // 4) Active session count
            sessionCount = await prisma.refreshToken.count({
                where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
            });

            // 5) Tenant switcher
            memberships = await prisma.membership.findMany({
                where: { userId },
                select: {
                    tenant: { select: { id: true, slug: true, name: true, plan: true } },
                },
            });

            // Fetch all roles across all tenants for this user
            userRolesAll = await prisma.userRole.findMany({
                where: { userId },
                include: { role: { select: { name: true } } }
            });

            // 6) JAD Readiness
            const requestId = (res.locals as { requestId?: string }).requestId ?? 'none';
            jadReadiness = await getJadReadiness(requestId);
        } catch (dbErr) {
            throw dbErr;
        }

        return res.json({
            user,
            tenant,
            tenantMemberships: memberships.map((m: any) => {
                const tenantRoles = userRolesAll
                    .filter((ur: any) => ur.tenantId === m.tenant.id)
                    .map((ur: any) => ur.role.name);

                let computedRole = 'member';
                if (tenantRoles.includes('owner')) computedRole = 'owner';
                else if (tenantRoles.includes('admin')) computedRole = 'admin';

                return {
                    tenantId: m.tenant.id,
                    tenantSlug: m.tenant.slug,
                    tenantName: m.tenant.name,
                    plan: m.tenant.plan,
                    role: computedRole,
                    isCurrent: m.tenant.id === tenantId,
                };
            }),
            portfolioTiles,
            onboardingProgress: {
                total: totalSteps,
                completed: completedSteps,
                pct: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
            },
            securityBadge: {
                twoFaEnabled: user?.twoFaEnabled ?? false,
                sessionCount,
                lastLoginAt: user?.lastLoginAt?.toISOString() ?? null,
            },
            jadReadiness,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * Calls JAD /health endpoint with a 3-second timeout.
 * Phase 04B: forwards X-Request-ID to JAD and echoes back the returned requestId
 * to prove the cross-service propagation chain is intact.
 * Never throws — failures are silently handled (graceful degradation).
 */
async function getJadReadiness(requestId: string): Promise<Record<string, unknown>> {
    const jadUrl = env.JAD_RUNTIME_URL;
    if (!jadUrl) {
        return { status: 'not_configured', message: 'JAD_RUNTIME_URL not set' };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3_000);

        const response = await fetch(`${jadUrl}/health`, {
            signal: controller.signal,
            headers: {
                // Phase 04B: propagate X-Request-ID across service boundary
                'X-Request-ID': requestId,
            },
        });
        clearTimeout(timeout);

        if (response.ok) {
            const data = await response.json() as Record<string, unknown>;
            return {
                status: 'connected',
                service: data['service'],
                phase: data['phase'],
                ts: data['ts'],
                // Echo JAD's returned requestId to prove the chain
                jadRequestId: data['requestId'],
            };
        }
        return { status: 'degraded', httpStatus: response.status };
    } catch {
        return { status: 'not_connected', message: 'JAD service unreachable' };
    }
}

export default router;
