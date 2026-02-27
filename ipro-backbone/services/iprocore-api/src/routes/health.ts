import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';

// Build info — injected at container build time via env or defaults
const VERSION: string = process.env.npm_package_version ?? require('../../package.json').version ?? 'unknown';
const GIT_SHA: string = process.env.GIT_SHA ?? 'unknown';

const router = Router();

/**
 * GET /api/health
 * No auth required — used by Cloud Run liveness/readiness probes.
 *
 * Returns HTTP 200 when DB is up (ok), HTTP 503 when DB is down (degraded).
 * Consistent status code policy: Cloud Run load balancer respects 5xx for routing.
 *
 * Response shape:
 *   { ok, db, status, version, gitSha, requestId, ts }
 */
router.get('/', async (req: Request, res: Response) => {
    const requestId = (req.headers['x-request-id'] as string) ?? 'none';
    let dbUp = false;
    let errorDetail = '';

    try {
        await prisma.$queryRaw`SELECT 1`;
        dbUp = true;
    } catch (err) {
        errorDetail = err instanceof Error ? err.message : String(err);
        console.error('[HEALTH] DB connectivity check failed:', errorDetail);
    }

    const httpStatus = dbUp ? 200 : 503;

    res.status(httpStatus).json({
        ok: dbUp,
        status: dbUp ? 'ok' : 'degraded',
        db: dbUp ? 'up' : 'down',
        error: dbUp ? null : {
            code: 'DB_CONNECTION_FAILURE',
            message: 'Database connection check failed',
            details: errorDetail
        },
        service: 'iprocore-api',
        version: VERSION,
        gitSha: GIT_SHA,
        requestId,
        ts: new Date().toISOString(),
    });
});

export default router;
