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


            // Find membership to get the member's role name
            const membership = await prisma.membership.findUnique({
                where: { userId_tenantId: { userId, tenantId } },
            });

            if (!membership) {
                res.status(403).json({ error: 'Forbidden: no membership in tenant' });
                return;
            }



            // Lookup roles assigned to this user via UserRole binding
            const userRoles = await prisma.userRole.findMany({
                where: { tenantId, userId },
                include: {
                    role: {
                        include: {
                            rolePermissions: {
                                include: { permission: true },
                            },
                        },
                    }
                }
            });

            if (!userRoles || userRoles.length === 0) {
                res.status(403).json({ error: 'Forbidden: no assigned roles' });
                return;
            }

            const hasPerm = userRoles.some((ur: any) =>
                ur.role.rolePermissions.some((rp: any) => rp.permission.key === permKey)
            );

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
