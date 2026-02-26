import { Router, Request, Response } from 'express';

import { prisma } from '../lib/db';

const router = Router();

/**
 * GET /api/health
 * No auth required. Skill 04: health endpoint required.
 * Used by Cloud Run health checks.
 * Echoes requestId and confirms DB connectivity.
 */
router.get('/', async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || 'none';
    let dbStatus = 'disconnected';

    try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
    } catch (err) {
        console.error('[HEALTH] DB Connectivity error:', err);
    }

    res.json({
        status: dbStatus === 'connected' ? 'ok' : 'degraded',
        service: 'iprocore-api',
        database: dbStatus,
        requestId,
        ts: new Date().toISOString(),
    });
});

export default router;
