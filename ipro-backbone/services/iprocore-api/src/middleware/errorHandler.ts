import { Request, Response, NextFunction } from 'express';

interface ApiError extends Error {
    status?: number;
    expose?: boolean; // if true, message is safe to return to client
}

/**
 * Global error handler — ALWAYS last middleware in the chain.
 * Skill 02: "Safe errors (no stack traces in responses)"
 * Blueprint §Auth: "Safe error responses (no internal leakage)"
 */
export function errorHandler(
    err: ApiError,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
): void {
    const status = err.status ?? 500;
    const requestId = req.headers['x-request-id'] as string | undefined;

    // Log internally with detail — never sent to client
    console.error(`[ERROR] ${req.method} ${req.path} → ${status}`, {
        requestId,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : '[hidden]',
    });

    // Safe response — client only gets what it needs
    res.status(status).json({
        error: err.expose ? err.message : getDefaultMessage(status),
        requestId,
    });
}

function getDefaultMessage(status: number): string {
    switch (status) {
        case 400: return 'Bad request';
        case 401: return 'Unauthorized';
        case 403: return 'Forbidden';
        case 404: return 'Not found';
        case 409: return 'Conflict';
        case 422: return 'Validation error';
        default: return 'Internal server error';
    }
}

/** Helper to create typed API errors */
export function createError(status: number, message: string, expose = true): ApiError {
    const err = new Error(message) as ApiError;
    err.status = status;
    err.expose = expose;
    return err;
}
