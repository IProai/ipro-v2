/**
 * IProCore — SSO Token Validation Middleware Stub
 *
 * Blueprint §4 Interoperability Contracts / §SSO/Auth
 * Phase 03: Products import this to validate incoming handoff tokens.
 *
 * Usage (in a product service):
 *   import { validateSsoToken } from '@iprocore/contracts';
 *   app.use(validateSsoToken(process.env.IPROCORE_SSO_SECRET));
 *
 * IMPORTANT:
 * - The secret MUST be the same SSO_TOKEN_SECRET set in IProCore.
 * - Products MUST verify jti uniqueness themselves (one-time-use enforcement).
 * - Products MUST reject tokens where exp < now.
 * - Products MUST verify aud matches their own product slug.
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { parseSsoTokenClaims, SsoTokenClaims } from './sso';

// ─── Express augmentation (for products to consume) ──────────────────────────

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            /** Validated SSO claims — set by validateSsoToken middleware */
            ssoUser?: SsoTokenClaims;
        }
    }
}

// ─── Validation middleware factory ───────────────────────────────────────────

/**
 * Creates an Express middleware that validates an IProCore SSO handoff token.
 *
 * Token is expected in:
 * - Query param: ?sso_token=<jwt>       (redirect flow)
 * - Header: Authorization: Bearer <jwt>  (API-to-API flow)
 *
 * Products MUST pass a consistent `expectedAud` matching their registered slug.
 */
export function validateSsoToken(
    secret: string,
    expectedAud?: string,
): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
        const rawToken =
            (req.query['sso_token'] as string | undefined) ||
            (req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : undefined);

        if (!rawToken) {
            res.status(401).json({ error: 'Missing SSO token' });
            return;
        }

        try {
            const decoded = jwt.verify(rawToken, secret, {
                issuer: 'iprocore',
                audience: expectedAud,
                clockTolerance: 5, // 5s clock skew tolerance
            });

            const claims = parseSsoTokenClaims(decoded);

            // Expiry guard — belt-and-suspenders (jwt.verify already checks exp)
            if (claims.exp < Math.floor(Date.now() / 1000)) {
                res.status(401).json({ error: 'SSO token expired' });
                return;
            }

            req.ssoUser = claims;
            next();
        } catch {
            res.status(401).json({ error: 'Invalid SSO token' });
        }
    };
}
