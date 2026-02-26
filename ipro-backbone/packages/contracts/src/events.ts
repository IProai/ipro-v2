/**
 * IProCore — Event Contract Schema (structure only)
 *
 * Blueprint §4 Interoperability Contracts / Events (JAD-owned)
 * Phase 03: type declarations only.
 * Runtime publishing, retries, dedupe, and webhook delivery are JAD's domain.
 * IProCore ONLY defines the shape. It never publishes events directly.
 */

import { z } from 'zod';

// ─── Versioned payload wrapper ────────────────────────────────────────────────

export const VersionedPayloadSchema = z.object({
    /** Schema version — semver string e.g. '1.0.0' */
    version: z.string().min(1),
    /** Arbitrary event data — structure is version-specific */
    data: z.record(z.unknown()),
});

export type VersionedPayload = z.infer<typeof VersionedPayloadSchema>;

// ─── IProCore System Event ────────────────────────────────────────────────────

export const SystemEventSchema = z.object({
    /** Unique event ID — UUIDv4 */
    eventId: z.string().uuid(),
    /**
     * Event type — namespaced dot notation.
     * Examples: 'portfolio.launched', 'user.role_changed', 'tenant.plan_changed'
     */
    type: z.string().min(1),
    /** Tenant that owns this event */
    tenantId: z.string().uuid(),
    /** ISO-8601 timestamp */
    timestamp: z.string().datetime(),
    /** Actor that triggered the event */
    actor: z.object({
        userId: z.string().uuid(),
        roles: z.array(z.string()),
    }),
    /** Originating service/product identifier */
    source: z.string().min(1),
    /** Versioned payload */
    payload: VersionedPayloadSchema,
    /**
     * Optional HMAC-SHA256 signature of `eventId + type + tenantId + timestamp`.
     * Verification is JAD's responsibility.
     */
    signature: z.string().optional(),
    /** X-Request-ID from the originating HTTP call */
    requestId: z.string().optional(),
});

export type SystemEvent = z.infer<typeof SystemEventSchema>;

// ─── Event type registry (Phase 03 — IProCore-emitted events) ────────────────

export const IPROCORE_EVENT_TYPES = {
    PORTFOLIO_LAUNCHED: 'portfolio.launched',
    PORTFOLIO_KILL_SWITCH: 'portfolio.kill_switch_activated',
    USER_ROLE_CHANGED: 'user.role_changed',
    TENANT_PLAN_CHANGED: 'tenant.plan_changed',
} as const;

export type IproCoreEventType = typeof IPROCORE_EVENT_TYPES[keyof typeof IPROCORE_EVENT_TYPES];
