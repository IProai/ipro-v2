/**
 * IProCore — SSO Handoff Token Issuer
 *
 * Phase 03 / Blueprint §4 SSO/Auth
 * Issues short-lived (≤60s) signed JWTs for product launch redirects.
 * Uses SSO_TOKEN_SECRET — separate from the main access token secret.
 *
 * NEVER returns the secret. NEVER logs the token.
 * Token is one-time-use — products enforce jti uniqueness.
 *
 * Claim shape mirrors @iprocore/contracts SsoTokenClaims.
 * Products validate using the contracts package (validate-sso.ts).
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from './env';

export const SSO_TOKEN_TTL_SECONDS = 60 as const;

/** Mirrors @iprocore/contracts SsoTokenClaims — kept in sync manually. */
export interface SsoTokenClaims {
    iss: 'iprocore';
    aud: string;
    exp: number;
    jti: string;
    tenantId: string;
    userId: string;
    roles: string[];
    permKeys: string[];
    entitlements: string[];
    locale: 'en' | 'ar';
    dir: 'ltr' | 'rtl';
    requestId: string;
}

export interface IssueSsoTokenParams {
    tenantId: string;
    userId: string;
    roles: string[];
    permKeys: string[];
    entitlements: string[];
    locale: 'en' | 'ar';
    dir: 'ltr' | 'rtl';
    aud: string;           // product slug
    requestId: string;
}

/**
 * Issues a signed SSO handoff token.
 * @returns The signed JWT string (60s expiry).
 */
export function issueSsoToken(params: IssueSsoTokenParams): string {
    const now = Math.floor(Date.now() / 1000);

    const claims: SsoTokenClaims = {
        iss: 'iprocore',
        aud: params.aud,
        exp: now + SSO_TOKEN_TTL_SECONDS,
        jti: uuidv4(),
        tenantId: params.tenantId,
        userId: params.userId,
        roles: params.roles,
        permKeys: params.permKeys,
        entitlements: params.entitlements,
        locale: params.locale,
        dir: params.dir,
        requestId: params.requestId,
    };

    return jwt.sign(claims, env.SSO_TOKEN_SECRET, {
        algorithm: 'HS256',
        // exp is embedded in claims; do not pass expiresIn to avoid double-encoding
        noTimestamp: false,
    });
}
