/**
 * JAD — Health Monitoring Routes
 *
 * GET  /api/jad/health       — list ConnectorHealthLogs for tenant (last 50)
 * POST /api/jad/health/check — trigger health check for an activation
 *
 * Health logs are append-only (Blueprint §JAD: health logs append-only).
 * tenantId from JWT only.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireJadAuth } from '../middleware/requireJadAuth';
import { prisma } from '../lib/db';

const router = Router();

// ── GET /api/jad/health ───────────────────────────────────────────────────────

router.get(
    '/',
    requireJadAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { tenantId } = req.auth!;
        try {
            const logs = await prisma.connectorHealthLog.findMany({
                where: { tenantId },
                orderBy: { checkedAt: 'desc' },
                take: 50,
                select: {
                    id: true,
                    activationId: true,
                    status: true,
                    latencyMs: true,
                    message: true,
                    checkedAt: true,
                },
            });
            res.json({ logs });
        } catch (err) {
            next(err);
        }
    },
);

// ── POST /api/jad/health/check ────────────────────────────────────────────────

const checkSchema = z.object({
    activationId: z.string().uuid(),
});

router.post(
    '/check',
    requireJadAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { tenantId } = req.auth!;

        const parsed = checkSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'activationId (UUID) required' });
            return;
        }

        try {
            // Verify activation belongs to this tenant
            const activation = await prisma.connectorActivation.findFirst({
                where: { id: parsed.data.activationId, tenantId },
            });
            if (!activation) {
                res.status(404).json({ error: 'Activation not found' });
                return;
            }

            // Stub health check — Phase 04: always returns ok
            // Phase 06 will implement real connector ping
            const startMs = Date.now();
            await new Promise((r) => setTimeout(r, 10)); // simulate latency
            const latencyMs = Date.now() - startMs;

            const log = await prisma.connectorHealthLog.create({
                data: {
                    tenantId,
                    activationId: activation.id,
                    status: 'ok',
                    latencyMs,
                    message: 'Health check passed (Phase 04 stub)',
                },
                select: {
                    id: true,
                    status: true,
                    latencyMs: true,
                    message: true,
                    checkedAt: true,
                },
            });

            res.json({ log });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
