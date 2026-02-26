/**
 * JAD — Connectors Route
 * GET /api/jad/connectors/:id
 *
 * Returns a single ConnectorDefinition from the global catalog.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireJadAuth } from '../middleware/requireJadAuth';
import { prisma } from '../lib/db';

const router = Router();

router.get(
    '/:id',
    requireJadAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const connector = await prisma.connectorDefinition.findUnique({
                where: { id: req.params.id },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    description: true,
                    logoUrl: true,
                    configSchema: true,
                    enabled: true,
                },
            });

            if (!connector || !connector.enabled) {
                res.status(404).json({ error: 'Connector not found' });
                return;
            }

            res.json({ connector });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
