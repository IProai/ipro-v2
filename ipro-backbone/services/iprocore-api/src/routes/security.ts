/**
 * IProCore — Role Simulator (Security Testing Tool)
 *
 * Phase 03 / Blueprint §11 Route Constitution: /console/security/role-simulator
 *
 * Founder-only: memberRole = 'owner'.
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
    const membership = await prisma.membership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        select: { memberRole: true },
    });
    if (!membership || membership.memberRole !== 'owner') {
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
            const { userId, tenantId } = req.auth!;
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
                    where: { tenantId, isActive: true },
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
        const { userId, tenantId } = req.auth!;

        if (!(await assertFounder(userId, tenantId, next))) return;

        const parsed = checkSchema.safeParse(req.body);
        if (!parsed.success) {
            next(createError(422, parsed.error.issues.map((i) => i.message).join(', ')));
            return;
        }

        try {
            const { targetUserId, permissionKey } = parsed.data;

            // Verify targetUser belongs to this tenant
            const targetUser = await prisma.user.findFirst({
                where: { id: targetUserId, tenantId, isActive: true },
                select: { id: true, email: true },
            });
            if (!targetUser) {
                next(createError(404, 'Target user not found in this tenant'));
                return;
            }

            // Resolve membership role
            const membership = await prisma.membership.findUnique({
                where: { userId_tenantId: { userId: targetUserId, tenantId } },
                select: { memberRole: true },
            });
            const memberRole = membership?.memberRole ?? null;

            if (!memberRole) {
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
            if (memberRole === 'owner' || memberRole === 'admin') {
                res.json({
                    requestId,
                    targetUser,
                    permissionKey,
                    allowed: true,
                    reason: `Role '${memberRole}' has implicit full access`,
                    checks: { hasMembership: true, memberRole, implicitGrant: true },
                });
                return;
            }

            // Check explicit permissions via Role → RolePermission → Permission
            const permRow = await prisma.$queryRaw<{ key: string }[]>`
                SELECT DISTINCT p.key
                FROM   "RolePermission" rp
                JOIN   "Role"           r  ON r.id = rp."roleId"
                JOIN   "Permission"     p  ON p.id = rp."permissionId"
                WHERE  r."tenantId" = ${tenantId}
                  AND  r.name = ${memberRole}
                  AND  p.key  = ${permissionKey}
            `;

            const allowed = permRow.length > 0;

            // Also collect all perms this role has for transparency
            const allRolePerms = await prisma.$queryRaw<{ key: string }[]>`
                SELECT DISTINCT p.key
                FROM   "RolePermission" rp
                JOIN   "Role"           r  ON r.id = rp."roleId"
                JOIN   "Permission"     p  ON p.id = rp."permissionId"
                WHERE  r."tenantId" = ${tenantId}
                  AND  r.name = ${memberRole}
            `;

            res.json({
                requestId,
                targetUser,
                permissionKey,
                allowed,
                reason: allowed
                    ? `Role '${memberRole}' has explicit '${permissionKey}' permission`
                    : `Role '${memberRole}' does NOT have '${permissionKey}' permission`,
                checks: {
                    hasMembership: true,
                    memberRole,
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
