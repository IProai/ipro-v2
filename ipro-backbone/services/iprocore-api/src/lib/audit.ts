import { Prisma } from '@prisma/client';
import { prisma } from './db';

interface AuditParams {
    tenantId: string;
    actorId: string;
    action: string;      // e.g. 'portfolio.create'
    resource: string;    // e.g. 'PortfolioItem'
    resourceId?: string;
    meta?: Record<string, unknown>; // NEVER include secrets / passwords
    requestId?: string;
}

/**
 * Append-only audit write — Blueprint §Audit & Observability.
 * No update or delete is ever performed on AuditLog (enforced here).
 */
export async function writeAudit(params: AuditParams): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                tenantId: params.tenantId,
                actorId: params.actorId,
                action: params.action,
                resource: params.resource,
                resourceId: params.resourceId,
                // Cast to Prisma.InputJsonValue to satisfy Prisma Json field type
                meta: (params.meta ?? {}) as Prisma.InputJsonValue,
                requestId: params.requestId,
            },
        });
    } catch (err) {
        // Non-blocking: log internally but don't crash request on audit failure
        console.error('[AUDIT] Failed to write audit log:', (err as Error).message);
    }
}
