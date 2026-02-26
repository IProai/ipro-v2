import { Request, Response, NextFunction } from 'express';

/**
 * Policy layer — Phase 01 stub (always allows through after RBAC).
 * In Phase 03 this will evaluate tenant-scoped policies (e.g. feature flags, entitlements).
 *
 * Blueprint §Authorization pipeline:
 * Auth → Resolve Tenant → Membership → Permission → Policy → Execute → Audit
 */
export function requirePolicy(_policyName: string) {
    return (_req: Request, _res: Response, next: NextFunction): void => {
        // Phase 01 stub — policy engine implemented in Phase 03
        next();
    };
}
