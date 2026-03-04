/**
 * IProCore — Role Simulator (Security Testing Tool)
 *
 * Phase 03 / Blueprint §11 Route Constitution: /console/security/role-simulator
 *
 * Founder-only: UserRole 'owner'.
 * Purpose: simulate whether a given user+permission would be ALLOWED or DENIED,
 * without performing the actual action.
 *
 * Routes:
 *   GET  /api/security/role-simulator        — get simulator metadata (permissions list)
 *   POST /api/security/role-simulator/check  — run a simulation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import createError from 'http-errors';
import { requireAuth } from '../middleware/requireAuth';
import { tenantResolver } from '../middleware/tenantResolver';
import { prisma } from '../lib/db';

const router = Router();

const authPipeline = [requireAuth, tenantResolver] as const;

// ─── Founder-only guard (reusable inline) ────────────────────────────────────

async function assertFounder(
    userId: string,
    tenantId: string,
    next: NextFunction,
): Promise<boolean> {
    const userRole = await prisma.userRole.findFirst({
        where: { userId, tenantId, role: { name: 'owner' } },
    });
    if (!userRole) {
        next(createError(403, 'Founder-only: role simulator is restricted'));
        return false;
    }
    return true;
}

// ─── GET /api/security/role-simulator — metadata ─────────────────────────────

router.get(
    '/',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { userId, activeTenantId: tenantId } = req.auth!;
            if (!(await assertFounder(userId, tenantId, next))) return;

            // Return all permission keys + all tenant roles for the UI selects
            const [permissions, roles, tenantUsers] = await Promise.all([
                prisma.permission.findMany({
                    select: { key: true, description: true },
                    orderBy: { key: 'asc' },
                }),
                prisma.role.findMany({
                    where: { tenantId },
                    select: { id: true, name: true, isSystem: true },
                    orderBy: { name: 'asc' },
                }),
                prisma.user.findMany({
                    where: {
                        memberships: {
                            some: { tenantId }
                        },
                        isActive: true
                    },
                    select: { id: true, email: true },
                    orderBy: { email: 'asc' },
                }),
            ]);

            res.json({ permissions, roles, tenantUsers });
        } catch (err) {
            next(err);
        }
    },
);

// ─── POST /api/security/role-simulator/check — simulate check ─────────────────

const checkSchema = z.object({
    /**
     * The userId to simulate — must belong to this tenant.
     * Omit to check the current user with a different role.
     */
    targetUserId: z.string().uuid(),
    /** Permission key to test e.g. 'portfolio:manage' */
    permissionKey: z.string().min(1),
});

router.post(
    '/check',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestId = req.headers['x-request-id'] as string;
        const { userId, activeTenantId: tenantId } = req.auth!;

        if (!(await assertFounder(userId, tenantId, next))) return;

        const parsed = checkSchema.safeParse(req.body);
        if (!parsed.success) {
            next(createError(422, parsed.error.issues.map((i) => i.message).join(', ')));
            return;
        }

        try {
            const { targetUserId, permissionKey } = parsed.data;

            // Verify targetUser exists and has membership
            const targetUser = await prisma.user.findFirst({
                where: { email: targetUserId },
                select: { id: true, email: true },
            });
            if (!targetUser) {
                next(createError(404, 'Target user not found globally'));
                return;
            }

            const userRolesRow = await prisma.userRole.findMany({
                where: { userId: targetUser.id, tenantId },
                include: { role: { select: { name: true } } }
            });
            const userRoles = userRolesRow.map((ur: any) => ur.role.name);

            if (userRoles.length === 0) {
                res.json({
                    requestId,
                    targetUser,
                    permissionKey,
                    allowed: false,
                    reason: 'User has no active membership in this tenant',
                    checks: { hasMembership: false },
                });
                return;
            }

            // owner/admin: always allowed
            if (userRoles.includes('owner') || userRoles.includes('admin')) {
                res.json({
                    requestId,
                    targetUser,
                    permissionKey,
                    allowed: true,
                    reason: `Roles [${userRoles.join(', ')}] have implicit full access`,
                    checks: { hasMembership: true, userRoles, implicitGrant: true },
                });
                return;
            }

            // Check explicit permissions via UserRole → Role → RolePermission → Permission
            const permRows = await prisma.$queryRaw<{ key: string }[]>`
                SELECT DISTINCT p.key
                FROM   "UserRole" ur
                JOIN   "Role"           r  ON r.id = ur."roleId"
                JOIN   "RolePermission" rp ON r.id = rp."roleId"
                JOIN   "Permission"     p  ON p.id = rp."permissionId"
                WHERE  ur."tenantId" = ${tenantId}
                  AND  ur."userId"   = ${targetUser.id}
                  AND  p.key         = ${permissionKey}
            `;

            const allowed = permRows.length > 0;

            // Also collect all perms this user has via assigned roles
            const allRolePerms = await prisma.$queryRaw<{ key: string }[]>`
                SELECT DISTINCT p.key
                FROM   "UserRole" ur
                JOIN   "Role"           r  ON r.id = ur."roleId"
                JOIN   "RolePermission" rp ON r.id = rp."roleId"
                JOIN   "Permission"     p  ON p.id = rp."permissionId"
                WHERE  ur."tenantId" = ${tenantId}
                  AND  ur."userId"   = ${targetUser.id}
            `;

            res.json({
                requestId,
                targetUser,
                permissionKey,
                allowed,
                reason: allowed
                    ? `User is assigned a role with explicit '${permissionKey}' permission`
                    : `User is NOT assigned any role with '${permissionKey}' permission`,
                checks: {
                    hasMembership: true,
                    userRoles,
                    implicitGrant: false,
                    permissionFound: allowed,
                    allRolePermissions: allRolePerms.map((p) => p.key),
                },
            });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
