/**
 * JAD — Marketplace Route
 * GET /api/jad/marketplace
 *
 * Lists all enabled ConnectorDefinitions (global catalog — not tenant-scoped).
 * Requires valid IProCore access token.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireJadAuth } from '../middleware/requireJadAuth';
import { prisma } from '../lib/db';

const router = Router();

router.get(
    '/',
    requireJadAuth,
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const connectors = await prisma.connectorDefinition.findMany({
                where: { enabled: true },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    description: true,
                    logoUrl: true,
                    configSchema: true,
                },
                orderBy: { name: 'asc' },
            });
            res.json({ connectors });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
