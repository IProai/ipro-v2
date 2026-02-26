import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/db';

/**
 * RBAC permission check.
 * Blueprint §Authorization — RBAC + policy checks in route + service layer.
 * Skill 02 — "Missing permission blocked".
 *
 * Usage: requirePerm('portfolio:manage')
 *
 * Must run AFTER requireAuth + tenantResolver.
 */
export function requirePerm(permKey: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!req.auth || !req.tenant) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { userId } = req.auth;
        const { id: tenantId } = req.tenant;

        try {
            // --- DEMO MODE BYPASS ---
            if (tenantId === 'demo-tenant-uuid') {
                next();
                return;
            }

            // Find membership to get the member's role name
            const membership = await prisma.membership.findUnique({
                where: { userId_tenantId: { userId, tenantId } },
            });

            if (!membership) {
                res.status(403).json({ error: 'Forbidden: no membership in tenant' });
                return;
            }

            // Owners bypass permission checks (they have all permissions)
            if (membership.memberRole === 'owner') {
                next();
                return;
            }

            // Lookup role by membership.memberRole within this tenant
            const role = await prisma.role.findUnique({
                where: { tenantId_name: { tenantId, name: membership.memberRole } },
                include: {
                    rolePermissions: {
                        include: { permission: true },
                    },
                },
            });

            if (!role) {
                res.status(403).json({ error: 'Forbidden: role not found' });
                return;
            }

            const hasPerm = role.rolePermissions.some((rp) => rp.permission.key === permKey);

            if (!hasPerm) {
                res.status(403).json({ error: 'Forbidden: insufficient permissions' });
                return;
            }

            next();
        } catch {
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}
