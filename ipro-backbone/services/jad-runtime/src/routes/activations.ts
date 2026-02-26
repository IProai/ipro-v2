/**
 * JAD — Activations Routes
 *
 * POST /api/jad/activations — activate a connector for the tenant
 * GET  /api/jad/activations/:id — get activation detail (no credentials)
 *
 * Security rules:
 * - tenantId from JWT only (Skill 02)
 * - credentialRef stored but NEVER returned
 * - Activation audited (fire-and-forget to IProCore)
 * - Blueprint §Secrets: no plaintext secrets returned
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireJadAuth } from '../middleware/requireJadAuth';
import { prisma } from '../lib/db';
import { writeJadAudit } from '../lib/audit';

const router = Router();

const activateSchema = z.object({
    connectorId: z.string().uuid(),
    credentialRef: z.string().min(1).max(500), // e.g. "env:SLACK_BOT_TOKEN"
});

// ── POST /api/jad/activations ─────────────────────────────────────────────────

router.post(
    '/',
    requireJadAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { tenantId, userId } = req.auth!;
        const requestId = req.headers['x-request-id'] as string;

        const parsed = activateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid request', detail: parsed.error.flatten() });
            return;
        }
        const { connectorId, credentialRef } = parsed.data;

        try {
            // Verify connector exists and is enabled
            const connector = await prisma.connectorDefinition.findUnique({
                where: { id: connectorId },
            });
            if (!connector || !connector.enabled) {
                res.status(404).json({ error: 'Connector not found' });
                return;
            }

            // Create activation
            const activation = await prisma.connectorActivation.create({
                data: {
                    tenantId,
                    connectorId,
                    credentialRef, // stored — never returned
                    status: 'active',
                    activatedAt: new Date(),
                },
                select: {
                    id: true,
                    tenantId: true,
                    connectorId: true,
                    status: true,
                    activatedAt: true,
                    createdAt: true,
                    // credentialRef intentionally omitted
                },
            });

            // Audit activation (fire-and-forget, Blueprint §Audit)
            writeJadAudit({
                tenantId,
                actorId: userId,
                action: 'jad.connector.activate',
                resource: 'ConnectorActivation',
                resourceId: activation.id,
                triggerSource: 'manual',
                status: 'success',
                meta: { connectorId, connectorName: connector.name },
                requestId,
            });

            res.status(201).json({ activation });
        } catch (err) {
            next(err);
        }
    },
);

// ── GET /api/jad/activations/:id ──────────────────────────────────────────────

router.get(
    '/:id',
    requireJadAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { tenantId } = req.auth!;

        try {
            const activation = await prisma.connectorActivation.findFirst({
                where: {
                    id: req.params.id,
                    tenantId, // cross-tenant read blocked here
                },
                select: {
                    id: true,
                    tenantId: true,
                    connectorId: true,
                    status: true,
                    activatedAt: true,
                    revokedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    // credentialRef intentionally omitted
                    connector: {
                        select: { name: true, type: true, logoUrl: true },
                    },
                },
            });

            if (!activation) {
                res.status(404).json({ error: 'Activation not found' });
                return;
            }

            res.json({ activation });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
