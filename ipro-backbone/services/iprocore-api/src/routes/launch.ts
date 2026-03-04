/**
 * IProCore — Portfolio Launch Endpoint
 *
 * Phase 03 / Blueprint §4 SSO/Auth + §7 Portfolio Registry
 * POST /api/portfolio/:id/launch
 *
 * All 5 launch checks enforced server-side (never client-trust):
 *   1. status = published
 *   2. killSwitch = false
 *   3. Entitlement (rollout mode + plan/tenant allowlists)
 *   4. Required permissions satisfied
 *   5. Rollout mode gate
 *
 * On pass: issues a 60s SSO handoff token → returns redirectUrl + token.
 * On fail: 403 with specific reason (no internal leakage).
 * All launches audited: portfolio.launch
 */

import { Router, Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { requireAuth } from '../middleware/requireAuth';
import { tenantResolver } from '../middleware/tenantResolver';
import { prisma } from '../lib/db';
import { writeAudit } from '../lib/audit';
import { issueSsoToken } from '../lib/sso';

const router = Router();

const authPipeline = [requireAuth, tenantResolver] as const;

// ─── POST /api/portfolio/:id/launch ──────────────────────────────────────────

router.post(
    '/:id/launch',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestId = req.headers['x-request-id'] as string;
        const { activeTenantId: tenantId, userId } = req.auth!;

        try {
            // ── Resolve item ──────────────────────────────────────────────────
            const item = await prisma.portfolioItem.findFirst({
                where: { id: req.params.id, tenantId },
            });

            if (!item) {
                next(createError(404, 'Product not found'));
                return;
            }

            // ── Check 1: status must be published ─────────────────────────────
            if (item.status !== 'published') {
                next(createError(403, 'Product is not published'));
                return;
            }

            // ── Check 2: kill switch ──────────────────────────────────────────
            if (item.killSwitch) {
                next(createError(403, 'Product is temporarily unavailable'));
                return;
            }

            // ── Check 3 + 5: Entitlement + rollout gate ───────────────────────
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { plan: true },
            });
            const tenantPlan = tenant?.plan ?? 'starter';

            if (item.rolloutMode === 'allowlistTenants') {
                if (!item.allowlistTenants.includes(tenantId)) {
                    next(createError(403, 'Tenant not in rollout allowlist'));
                    return;
                }
            } else if (item.rolloutMode === 'allowlistPlans') {
                if (!item.allowlistPlans.includes(tenantPlan)) {
                    next(createError(403, 'Plan not in rollout allowlist'));
                    return;
                }
            }
            // rolloutMode=all: no further gate

            // Check defaultPlansVisibility (entitlement)
            if (
                item.defaultPlansVisibility.length > 0 &&
                !item.defaultPlansVisibility.includes(tenantPlan)
            ) {
                next(createError(403, 'Plan not entitled to this product'));
                return;
            }

            // ── Check 4: Required permissions ─────────────────────────────────
            if (item.requiredPermissions.length > 0) {
                // Resolve user's permissions via UserRole -> Role -> RolePermissions -> Permission
                const userRolesRow = await prisma.userRole.findMany({
                    where: { userId, tenantId },
                    include: { role: { select: { name: true } } }
                });
                const userRoles = userRolesRow.map((ur: any) => ur.role.name);
                let permKeys: string[] = [];

                if (!userRoles.includes('owner') && !userRoles.includes('admin')) {
                    const rolePermRows = await prisma.$queryRaw<{ key: string }[]>`
                        SELECT p.key
                        FROM   "RolePermission" rp
                        JOIN   "Role"           r  ON r.id = rp."roleId"
                        JOIN   "Permission"     p  ON p.id = rp."permissionId"
                        WHERE  r."tenantId" = ${tenantId}
                          AND  r.name IN (${userRoles.length > 0 ? userRoles.join(',') : "''"})
                    `;
                    permKeys = rolePermRows.map((r) => r.key);

                    const missingPerm = item.requiredPermissions.find(
                        (perm) => !permKeys.includes(perm),
                    );
                    if (missingPerm) {
                        next(createError(403, `Missing required permission: ${missingPerm}`));
                        return;
                    }
                } else {
                    // owner/admin: resolve all perms for SSO token claims
                    const rolePermRows = await prisma.$queryRaw<{ key: string }[]>`
                        SELECT p.key
                        FROM   "RolePermission" rp
                        JOIN   "Role"           r  ON r.id = rp."roleId"
                        JOIN   "Permission"     p  ON p.id = rp."permissionId"
                        WHERE  r."tenantId" = ${tenantId}
                          AND  r.name IN (${userRoles.length > 0 ? userRoles.join(',') : "''"})
                    `;
                    permKeys = rolePermRows.map((r) => r.key);
                }
            }

            // ── Resolve user locale/dir for SSO claims ────────────────────────
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { locale: true, dir: true },
            });
            const locale = (user?.locale ?? 'en') as 'en' | 'ar';
            const dir = (user?.dir ?? 'ltr') as 'ltr' | 'rtl';

            // Resolve roles + all perms for token claims
            const userRolesRowForToken = await prisma.userRole.findMany({
                where: { userId, tenantId },
                include: { role: { select: { name: true } } }
            });
            const rolesForToken = userRolesRowForToken.map((ur: any) => ur.role.name);

            const allPerms = await prisma.$queryRaw<{ key: string }[]>`
                SELECT DISTINCT p.key
                FROM   "RolePermission" rp
                JOIN   "Role"           r  ON r.id = rp."roleId"
                JOIN   "Permission"     p  ON p.id = rp."permissionId"
                WHERE  r."tenantId" = ${tenantId}
                  AND  r.name IN (${rolesForToken.length > 0 ? rolesForToken.join(',') : "''"})
            `;

            // Plan entitlements (from plan name — blueprint §Entitlements)
            const entitlements = resolvePlanEntitlements(tenantPlan);

            // ── Issue SSO token ───────────────────────────────────────────────
            const ssoToken = issueSsoToken({
                tenantId,
                userId,
                roles: rolesForToken,
                permKeys: allPerms.map((p) => p.key),
                entitlements,
                locale,
                dir,
                aud: item.id, // product id as audience
                requestId,
            });

            // ── Build redirect URL ────────────────────────────────────────────
            const baseUrl = item.launchUrlProd ?? item.launchUrlStage;
            if (!baseUrl) {
                next(createError(422, 'Product has no launch URL configured'));
                return;
            }
            const redirectUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}sso_token=${encodeURIComponent(ssoToken)}`;

            // ── Audit ─────────────────────────────────────────────────────────
            await writeAudit({
                tenantId,
                actorId: userId,
                action: 'portfolio.launch',
                resource: 'PortfolioItem',
                resourceId: item.id,
                meta: {
                    name: item.name,
                    ssoMode: item.ssoMode,
                    rolloutMode: item.rolloutMode,
                    plan: tenantPlan,
                },
                requestId,
            });

            // ── Respond ───────────────────────────────────────────────────────
            res.json({
                redirectUrl,
                // Expose token separately for non-redirect (API-to-API) callers
                // The redirect URL already contains the token — no double exposure
                expiresIn: 60,
            });
        } catch (err) {
            next(err);
        }
    },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves plan-level entitlements by plan name.
 * In Phase 03: static mapping. Phase 05/06 will source from Entitlement table.
 */
function resolvePlanEntitlements(plan: string): string[] {
    const map: Record<string, string[]> = {
        starter: ['dashboard', 'onboarding'],
        pro: ['dashboard', 'onboarding', 'analytics', 'api_access'],
        enterprise: ['dashboard', 'onboarding', 'analytics', 'api_access', 'multi_tenant', 'sla_support'],
    };
    return map[plan] ?? [];
}

export default router;
