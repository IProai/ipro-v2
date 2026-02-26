import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Injects X-Request-ID on every request.
 * Blueprint §Observability — propagated to JAD and products in later phases.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string) || uuidv4();
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-ID', id);
    next();
}
