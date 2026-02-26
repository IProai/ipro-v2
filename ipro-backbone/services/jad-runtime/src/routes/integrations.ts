/**
 * JAD — Integrations Route
 * GET /api/jad/integrations
 *
 * Lists tenant's active ConnectorActivations.
 * tenantId sourced ONLY from JWT claim — never from body/query.
 * credentialRef NEVER returned in response.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireJadAuth } from '../middleware/requireJadAuth';
import { prisma } from '../lib/db';

const router = Router();

router.get(
    '/',
    requireJadAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { tenantId } = req.auth!;
        try {
            const activations = await prisma.connectorActivation.findMany({
                where: { tenantId }, // tenant isolation — from JWT only
                select: {
                    id: true,
                    tenantId: true,
                    connectorId: true,
                    status: true,
                    activatedAt: true,
                    revokedAt: true,
                    createdAt: true,
                    // credentialRef intentionally omitted
                    connector: {
                        select: { name: true, type: true, logoUrl: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            res.json({ activations });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
