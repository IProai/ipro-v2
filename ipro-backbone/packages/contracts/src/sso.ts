/**
 * IProCore — SSO Handoff Token Contract
 *
 * Blueprint §4 Interoperability Contracts / §SSO/Auth
 * Phase 03: structure + Zod schema + sign/verify helpers.
 * Products consume validateSsoToken (see validate-sso.ts).
 *
 * Token must be short-lived: exp MUST be <= 60 seconds from iss.
 */

import { z } from 'zod';

// ─── Schema ──────────────────────────────────────────────────────────────────

export const SsoTokenClaimsSchema = z.object({
    /** Issuer — always 'iprocore' */
    iss: z.literal('iprocore'),
    /** Audience — product slug or '*' for internal tools */
    aud: z.string().min(1),
    /** Expiration (Unix seconds) — MUST be <= now + 60s */
    exp: z.number().int().positive(),
    /** JWT ID — unique per token, used for one-time-use enforcement */
    jti: z.string().uuid(),
    /** Tenant identifier (server-resolved — never from client) */
    tenantId: z.string().uuid(),
    /** User identifier */
    userId: z.string().uuid(),
    /** User's role names within this tenant */
    roles: z.array(z.string()),
    /** Flat list of resolved permission keys e.g. 'portfolio:manage' */
    permKeys: z.array(z.string()),
    /** Plan-level entitlements e.g. ['analytics', 'multi_tenant'] */
    entitlements: z.array(z.string()),
    /** UI locale for the receiving product */
    locale: z.enum(['en', 'ar']),
    /** Text direction */
    dir: z.enum(['ltr', 'rtl']),
    /** X-Request-ID propagated from the originating HTTP request */
    requestId: z.string(),
});

export type SsoTokenClaims = z.infer<typeof SsoTokenClaimsSchema>;

// ─── Validation helper (server-side, not for browser) ───────────────────────

/**
 * Validates a raw SSO token string against the schema.
 * Does NOT verify the JWT signature — use validateSsoToken for that.
 */
export function parseSsoTokenClaims(payload: unknown): SsoTokenClaims {
    return SsoTokenClaimsSchema.parse(payload);
}
