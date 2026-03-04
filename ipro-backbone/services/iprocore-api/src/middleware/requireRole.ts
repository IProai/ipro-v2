import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/db';

/**
 * Validates that the active user possesses a specific role in the active tenant.
 */
export function requireRole(roleKey: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!req.auth || !req.tenant) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { userId } = req.auth;
        const tenantId = req.tenant.id;

        try {
            // Check membership exists
            const membership = await prisma.membership.findFirst({
                where: { userId, tenantId }
            });

            if (!membership) {
                res.status(403).json({ error: 'Forbidden: no membership in tenant' });
                return;
            }

            // Check if user has the bound role
            const userRole = await prisma.userRole.findFirst({
                where: {
                    userId,
                    tenantId,
                    role: { name: roleKey }
                }
            });

            if (!userRole) {
                res.status(403).json({ error: `Forbidden: requires '${roleKey}' role` });
                return;
            }

            next();
        } catch (error) {
            console.error('requireRole error:', error);
            res.status(500).json({ error: 'Internal server error evaluating roles' });
        }
    };
}

/**
 * Validates that the active user possesses ANY of the specific roles in the active tenant.
 */
export function requireAnyRole(roleKeys: string[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!req.auth || !req.tenant) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { userId } = req.auth;
        const tenantId = req.tenant.id;

        try {
            // Check membership exists
            const membership = await prisma.membership.findFirst({
                where: { userId, tenantId }
            });

            if (!membership) {
                res.status(403).json({ error: 'Forbidden: no membership in tenant' });
                return;
            }

            // Check if user has any of the bound roles
            const userRole = await prisma.userRole.findFirst({
                where: {
                    userId,
                    tenantId,
                    role: { name: { in: roleKeys } }
                }
            });

            if (!userRole) {
                res.status(403).json({ error: `Forbidden: requires one of [${roleKeys.join(', ')}] roles` });
                return;
            }

            next();
        } catch (error) {
            console.error('requireAnyRole error:', error);
            res.status(500).json({ error: 'Internal server error evaluating roles' });
        }
    };
}
