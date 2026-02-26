/**
 * JAD — Global Error Handler
 *
 * Safe error responses: status + message only.
 * No stack traces, no internal paths, no secret values.
 * Blueprint §Secrecy + Skill 02: Safe errors.
 */

import { Request, Response, NextFunction } from 'express';

interface HttpError {
    status?: number;
    statusCode?: number;
    message?: string;
}

export function errorHandler(
    err: HttpError,
    _req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
): void {
    const status = err.status ?? err.statusCode ?? 500;
    const message =
        status < 500
            ? (err.message ?? 'Bad request')
            : 'Internal server error';

    res.status(status).json({ error: message });
}
