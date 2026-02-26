/**
 * JAD — Health Route
 * GET /health
 *
 * Unauthenticated — reachable by load balancers, Cloud Run health checks.
 * Returns JAD service identity + ISO timestamp.
 */

import { Router, Request, Response } from 'express';

import { prisma } from '../lib/db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    const requestId = (req.headers['x-request-id'] as string) ?? null;
    let dbStatus = 'disconnected';

    try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
    } catch (err) {
        console.error('[HEALTH] JAD DB Connectivity error:', err);
    }

    res.json({
        status: dbStatus === 'connected' ? 'ok' : 'degraded',
        service: 'jad-runtime',
        database: dbStatus,
        phase: '06',
        ts: new Date().toISOString(),
        requestId,
    });
});

export default router;
