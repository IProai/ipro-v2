import { Request, Response, NextFunction } from 'express';
import { assertEntitled } from '../entitlements/entitlement.service';

/**
 * Express middleware to enforce feature entitlements based on tenant subscriptions.
 * Works exclusively off `req.auth.activeTenantId`.
 * 
 * Must run AFTER `requireAuth`.
 */
export function requireEntitlement(featureKey: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!req.auth || !req.auth.activeTenantId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        try {
            await assertEntitled(req.auth.activeTenantId, featureKey);
            next();
        } catch (e: any) {
            if (e.code === 'ENTITLEMENT_NO_SUBSCRIPTION') {
                res.status(403).json({ error: 'Subscription required' });
            } else if (e.code === 'ENTITLEMENT_FEATURE_BLOCKED') {
                res.status(403).json({ error: 'Feature not included in your plan' });
            } else if (e.code === 'ENTITLEMENT_LIMIT_REACHED') {
                res.status(403).json({ error: 'Feature usage limit reached' });
            } else {
                next(e);
            }
        }
    };
}
