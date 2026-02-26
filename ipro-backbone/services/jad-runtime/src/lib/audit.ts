/**
 * JAD — Audit Forwarding
 *
 * Fire-and-forget HTTP POST to IProCore's audit endpoint.
 * Never blocks the request. Logs locally if IProCore is unreachable.
 * Blueprint §Audit: all privileged actions audited.
 *
 * Phase 04B: extended JadAuditEntry with triggerSource and status
 * fields required for full workflow execution audit trail.
 */

import { env } from './env';

export interface JadAuditEntry {
    tenantId: string;
    actorId: string;                         // userId or 'system' for automated runs
    action: string;                          // e.g. 'workflow.started', 'connector.activated'
    resource: string;                        // e.g. 'WorkflowRun', 'ConnectorActivation'
    resourceId?: string;
    triggerSource: 'manual' | 'webhook' | 'system' | 'ai';
    status: 'started' | 'success' | 'failed' | 'retrying';
    requestId?: string;                      // propagated X-Request-ID chain
    approvedByUserId?: string | null;        // confirmation gate — null until Phase gate requires it
    meta?: Record<string, unknown>;
}

export function writeJadAudit(entry: JadAuditEntry): void {
    // Fire-and-forget — do not await
    fetch(env.IPROCORE_AUDIT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Service': 'jad-runtime',
            ...(entry.requestId ? { 'X-Request-ID': entry.requestId } : {}),
        },
        body: JSON.stringify(entry),
    }).catch((err: unknown) => {
        // Audit forwarding failure must never crash JAD
        console.warn('[JAD] Audit forwarding failed:', (err as Error).message);
    });
}
