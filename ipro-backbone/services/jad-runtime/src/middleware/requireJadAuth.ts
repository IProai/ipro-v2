/**
 * JAD — Auth Middleware
 *
 * Verifies the IProCore-issued access token (Bearer JWT).
 * Uses JAD_IPROCORE_ACCESS_SECRET — must match IProCore ACCESS_TOKEN_SECRET.
 *
 * NEVER trusts tenantId from request body or query params.
 * tenantId is always sourced from the verified JWT claim.
 *
 * Attaches req.auth = { tenantId, userId, roles }.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env';

export interface JadAuthPayload {
    tenantId: string;
    userId: string;
    roles: string[];
    email: string;
}

declare global {
    namespace Express {
        interface Request {
            auth?: JadAuthPayload;
        }
    }
}

export function requireJadAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, env.JAD_IPROCORE_ACCESS_SECRET) as Record<string, unknown>;

        if (!payload.tenantId || !payload.userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        req.auth = {
            tenantId: payload.tenantId as string,
            userId: payload.userId as string,
            roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
            email: (payload.email as string) ?? '',
        };

        next();
    } catch {
        res.status(401).json({ error: 'Unauthorized' });
    }
}
