import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/db';

declare global {
    namespace Express {
        interface Request {
            tenant?: {
                id: string;
                slug: string;
                name: string;
                plan: string;
                isActive: boolean;
            };
        }
    }
}

/**
 * Resolves tenant from the JWT claim — NEVER trusts client-provided tenantId.
 * Blueprint §Authorization: "Never trust client-provided tenantId"
 * Pipeline: Auth → Resolve Tenant → Membership → Permission → Policy → Execute → Audit
 *
 * Must run AFTER requireAuth.
 */
export async function tenantResolver(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    if (!req.auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    // tenantId sourced from verified JWT — not from body or query params
    const tenantId = req.auth.activeTenantId;

    if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No active tenant specified in token' });
        return;
    }
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, slug: true, name: true, plan: true, isActive: true },
        });

        if (!tenant || !tenant.isActive) {
            res.status(403).json({ error: 'Tenant not found or inactive' });
            return;
        }

        req.tenant = tenant;
        next();
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
}
