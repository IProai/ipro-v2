/**
 * Phase 05 — AI Governance Tests
 *
 * Tests E, F, G, H (+ E2):
 *   E:  AI suggestion creation rejects raw credential patterns in contextSummary
 *   E2: Valid suggestion accepted — DB create called, no credentialRef stored
 *   F:  Confirmation gate rejects confirm on non-existent suggestion with 404
 *   G:  Confirmed execution emits AiConfirmation + AuditLog with all governance fields
 *   H:  Cross-tenant — Tenant B cannot confirm Tenant A suggestion (tenantId gate)
 *
 * Mirrors tenant-isolation.test.ts pattern exactly: mock before import, use TEST_SECRET.
 */

// ─── Mock Prisma BEFORE app import (critical ordering) ───────────────────────
jest.mock('../src/lib/db', () => ({
    prisma: {
        aiSuggestion: {
            create: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        aiConfirmation: {
            create: jest.fn(),
        },
        aiActivityLog: {
            create: jest.fn(),
        },
        portfolioItem: {
            findMany: jest.fn(),
        },
        helpTicket: {
            findFirst: jest.fn(),
        },
        // Required by tenantResolver middleware
        tenant: {
            findUnique: jest.fn(),
        },
        // Required by other shared middleware
        user: {
            findUnique: jest.fn(),
        },
        auditLog: {
            create: jest.fn(),
        },
    },
}));

jest.mock('../src/lib/audit', () => ({
    writeAudit: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/index';
import { prisma } from '../src/lib/db';
import { writeAudit } from '../src/lib/audit';

// ─── Token helpers (matches ACCESS_TOKEN_SECRET from test env) ────────────────

const TEST_SECRET = 'test-access-secret-minimum-32-characters-long-for-tests';

function makeToken(tenantId: string, userId: string): string {
    return jwt.sign(
        { tenantId, userId, email: `${userId}@test.com` },
        TEST_SECRET,
        { expiresIn: '1h' },
    );
}

function mockTenantLookup(tenantId: string) {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: tenantId,
        slug: tenantId,
        name: `${tenantId} Corp`,
        plan: 'starter',
        isActive: true,
    });
}

const tenantA = { tenantId: 'tenant-alpha', userId: 'user-alpha' };
const tenantB = { tenantId: 'tenant-beta', userId: 'user-beta' };
const tokenA = makeToken(tenantA.tenantId, tenantA.userId);
const tokenB = makeToken(tenantB.tenantId, tenantB.userId);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Phase 05 — AI Governance (Blueprint §9)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── TEST E ─────────────────────────────────────────────────────────────────
    // Governance rule 5: raw credentials must never be stored in AI context

    it('E: contextSummary with raw credential pattern is REJECTED — secrets never stored', async () => {
        mockTenantLookup(tenantA.tenantId);

        const res = await request(app)
            .post('/api/ai/suggestions')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                suggestionType: 'workflow_draft',
                // OpenAI-style key pattern — must be rejected by Zod refine
                contextSummary: 'Set up workflow using sk-abcdefghij1234567890 key for the tenant.',
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid request');

        // DB MUST NOT have been called — nothing stored
        expect(prisma.aiSuggestion.create).not.toHaveBeenCalled();
    });

    it('E2: valid contextSummary (no credentials) is accepted — DB create called', async () => {
        mockTenantLookup(tenantA.tenantId);

        const fakeSuggestion = {
            id: 'sugg-1',
            suggestionType: 'workflow_draft',
            contextSummary: 'Tenant wants Slack connector workflow for lead notifications.',
            suggestionText: '[AI Draft] ...',
            status: 'pending',
            expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
            createdAt: new Date(),
        };

        (prisma.aiSuggestion.create as jest.Mock).mockResolvedValue(fakeSuggestion);
        (prisma.aiActivityLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

        const res = await request(app)
            .post('/api/ai/suggestions')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                suggestionType: 'workflow_draft',
                contextSummary: 'Tenant wants Slack connector workflow for lead notifications.',
            });

        expect(res.status).toBe(201);
        expect(res.body.suggestion.id).toBe('sugg-1');

        // Verify nothing sensitive in the DB payload
        const createCall = (prisma.aiSuggestion.create as jest.Mock).mock.calls[0][0];
        expect(JSON.stringify(createCall)).not.toMatch(/credentialRef/i);
        expect(JSON.stringify(createCall)).not.toMatch(/sk-[a-zA-Z0-9]{20}/);
    });

    // ── TEST F ─────────────────────────────────────────────────────────────────
    // Server-side gate must block confirm on non-existent/expired suggestion

    it('F: Confirmation gate rejects confirm on non-existent suggestion with 404', async () => {
        mockTenantLookup(tenantA.tenantId);

        // findFirst returns null — suggestion not found (or expired / already actioned)
        (prisma.aiSuggestion.findFirst as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .post('/api/ai/suggestions/does-not-exist/confirm')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ confirmationAction: 'confirm' });

        // Gate must return 404 — no execution ever started
        expect(res.status).toBe(404);
        expect(prisma.aiConfirmation.create).not.toHaveBeenCalled();
        expect(prisma.aiSuggestion.update).not.toHaveBeenCalled();
    });

    // ── TEST G ─────────────────────────────────────────────────────────────────
    // Confirmed execution: AiConfirmation record + AuditLog with governance fields

    it('G: Confirmation creates gate record + emits AuditLog with all governance fields', async () => {
        mockTenantLookup(tenantA.tenantId);

        const pendingSuggestion = {
            id: 'sugg-gov-1',
            tenantId: tenantA.tenantId,
            requestingUserId: tenantA.userId,
            suggestionType: 'workflow_draft',
            contextSummary: 'Launch Slack connector workflow.',
            suggestionText: '[AI Draft] ...',
            status: 'pending',
            expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        };

        (prisma.aiSuggestion.findFirst as jest.Mock).mockResolvedValue(pendingSuggestion);
        (prisma.aiConfirmation.create as jest.Mock).mockResolvedValue({ id: 'conf-1' });
        (prisma.aiSuggestion.update as jest.Mock).mockResolvedValue({
            ...pendingSuggestion,
            status: 'confirmed',
        });
        (prisma.aiActivityLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

        const res = await request(app)
            .post('/api/ai/suggestions/sugg-gov-1/confirm')
            .set('Authorization', `Bearer ${tokenA}`)
            .set('X-Request-ID', 'req-gov-test-123')
            .send({ confirmationAction: 'confirm' });

        expect(res.status).toBe(200);
        expect(res.body.confirmationAction).toBe('confirm');

        // ── Server-side gate record created ────────────────────────────────────
        expect(prisma.aiConfirmation.create).toHaveBeenCalledTimes(1);
        const confirmData = (prisma.aiConfirmation.create as jest.Mock).mock.calls[0][0].data;
        expect(confirmData.approvedByUserId).toBe(tenantA.userId);  // MANDATORY
        expect(confirmData.confirmationAction).toBe('confirm');

        // ── AI Activity Log: triggerSource='AI', approvedByUserId set ──────────
        expect(prisma.aiActivityLog.create).toHaveBeenCalled();
        const activityData = (prisma.aiActivityLog.create as jest.Mock).mock.calls[0][0].data;
        expect(activityData.triggerSource).toBe('AI');                          // MANDATORY
        expect(activityData.meta.approvedByUserId).toBe(tenantA.userId);        // MANDATORY

        // ── Standard AuditLog with AI governance fields ────────────────────────
        expect(writeAudit).toHaveBeenCalled();
        const auditCall = (writeAudit as jest.Mock).mock.calls[0][0];
        expect(auditCall.meta.triggerSource).toBe('AI');
        expect(auditCall.meta.approvedByUserId).toBe(tenantA.userId);
    });

    // ── TEST H ─────────────────────────────────────────────────────────────────
    // Cross-tenant isolation: Tenant B cannot confirm Tenant A's suggestion

    it('H: Cross-tenant — Tenant B CANNOT confirm Tenant A suggestion (tenantId gate)', async () => {
        mockTenantLookup(tenantB.tenantId);

        // findFirst returns null because WHERE { tenantId: 'tenant-beta' } won't match tenant-alpha row
        (prisma.aiSuggestion.findFirst as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .post('/api/ai/suggestions/sugg-gov-1/confirm')
            .set('Authorization', `Bearer ${tokenB}`)  // Tenant B's token
            .send({ confirmationAction: 'confirm' });

        // Tenant B sees nothing of Tenant A — 404
        expect(res.status).toBe(404);

        // Confirm server queried with tenantB's tenantId — never tenantA's
        const findCall = (prisma.aiSuggestion.findFirst as jest.Mock).mock.calls[0][0];
        expect(findCall.where.tenantId).toBe(tenantB.tenantId);
        expect(findCall.where.tenantId).not.toBe(tenantA.tenantId);

        // Confirmation record must NOT have been created
        expect(prisma.aiConfirmation.create).not.toHaveBeenCalled();
    });
});
