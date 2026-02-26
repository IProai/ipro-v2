/**
 * JAD — Webhook Ingestion
 * POST /api/jad/webhooks/:connectorId
 *
 * Unauthenticated — called by external services (Slack, HubSpot, etc.)
 * Validates HMAC signature if connector has webhookSecret configured (stub for Phase 04).
 * Persists WebhookEvent + enqueues WorkflowRun (status=pending).
 * Blueprint §JAD: webhook ingestion + outbound delivery.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/db';

const router = Router();

router.post(
    '/:connectorId',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { connectorId } = req.params;
        const requestId = req.headers['x-request-id'] as string;

        try {
            // Verify connector exists
            const connector = await prisma.connectorDefinition.findUnique({
                where: { id: connectorId },
            });
            if (!connector || !connector.enabled) {
                res.status(404).json({ error: 'Connector not found' });
                return;
            }

            // Phase 04: signature validation is a stub
            // In Phase 05/06 this will check X-Signature-256 against a per-connector webhookSecret
            const signatureValid = true; // placeholder

            // Persist the raw event
            const webhookEvent = await prisma.webhookEvent.create({
                data: {
                    // tenantId is derived from the connector's first active activation
                    // In production this would be resolved via the routing key in the URL
                    // Phase 04 stub: use a sentinel value — real routing added in Phase 06
                    tenantId: 'unrouted', // will be updated by workflow-runner tenant resolution
                    connectorId,
                    rawPayload: req.body as object,
                    signatureValid,
                },
                select: { id: true },
            });

            // Enqueue WorkflowRun (pending) — capture requestId + triggerSource for audit chain
            const workflowRun = await prisma.workflowRun.create({
                data: {
                    tenantId: 'unrouted',
                    activationId: (await getFirstActivation(connectorId)) ?? '',
                    webhookEventId: webhookEvent.id,
                    status: 'pending',
                    triggerSource: 'webhook',
                    initiatingUserId: null,        // external webhook — no user
                    approvedByUserId: null,         // confirmation gate — Phase 04: not required
                    requestId: requestId ?? null,    // propagated X-Request-ID chain
                    logs: [{ ts: new Date().toISOString(), level: 'info', message: `Webhook received; requestId=${requestId ?? 'none'}` }],
                },
                select: { id: true },
            });

            res.status(202).json({
                received: true,
                webhookEventId: webhookEvent.id,
                workflowRunId: workflowRun.id,
            });
        } catch (err) {
            next(err);
        }
    },
);

async function getFirstActivation(connectorId: string): Promise<string | null> {
    const act = await prisma.connectorActivation.findFirst({
        where: { connectorId, status: 'active' },
        select: { id: true },
    });
    return act?.id ?? null;
}

export default router;
