/**
 * IProCore — Observability Contract
 *
 * Blueprint §4 Interoperability Contracts / Observability
 * Blueprint §Audit & Observability: X-Request-ID everywhere.
 *
 * X-Request-ID MUST be:
 * 1. Injected by requestId middleware if not present on incoming request
 * 2. Echoed in the response header
 * 3. Included in all log entries
 * 4. Included in the SSO handoff token (requestId claim)
 * 5. Forwarded to JAD and products in downstream service calls
 */

// ─── Request context shared across service calls ─────────────────────────────

export interface RequestContext {
    /** X-Request-ID — UUID identifying the originating HTTP request */
    requestId: string;
    /** Tenant identifier resolved server-side */
    tenantId: string;
    /** Actor user ID */
    userId: string;
    /** ISO-8601 timestamp when the request was received */
    receivedAt: string;
}

// ─── Standard header names ────────────────────────────────────────────────────

export const OBSERVABILITY_HEADERS = {
    REQUEST_ID: 'X-Request-ID',
    TENANT_ID: 'X-Tenant-ID',      // outbound only — never trusted inbound
    TRACE_ID: 'X-Trace-ID',        // reserved for Phase 04+ Cloud Trace integration
} as const;

// ─── Log entry base shape ─────────────────────────────────────────────────────

export interface BaseLogEntry {
    requestId: string;
    tenantId: string;
    service: string;     // 'iprocore-api' | 'jad-connector' | product slug
    level: 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;   // ISO-8601
    meta?: Record<string, unknown>;
}
