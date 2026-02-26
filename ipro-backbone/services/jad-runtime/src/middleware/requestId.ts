/**
 * JAD — X-Request-ID Middleware
 *
 * Accepts incoming X-Request-ID (from IProCore or caller) or generates one.
 * Blueprint §Observability: propagate across all services.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestId(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string) || uuidv4();
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-ID', id);
    next();
}
