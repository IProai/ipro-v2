import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env';

export interface AuthPayload {
    userId: string;
    activeTenantId: string;
    email: string;
    iat?: number;
    exp?: number;
}

declare global {
    namespace Express {
        interface Request {
            auth?: AuthPayload;
        }
    }
}

/**
 * Validates short-lived JWT access token from Authorization: Bearer header.
 * Blueprint §Auth & sessions — access token short-lived, server-side validation only.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AuthPayload;
        req.auth = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Unauthorized' });
    }
}
