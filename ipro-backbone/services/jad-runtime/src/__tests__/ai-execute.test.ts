/**
 * JAD Runtime — AI Execution Bridge Tests
 * 
 * Verifies:
 * - Happy path (valid signature, valid body)
 * - Signature mismatch
 * - Missing approvedByUserId
 * - Audit log emission
 */

import request from 'supertest';
import crypto from 'crypto';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock Prisma BEFORE app import ────────────────────────────────────────────
vi.mock('../lib/db', () => ({
    prisma: {
        connectorActivation: {
            findFirst: vi.fn(),
        },
        workflowRun: {
            create: vi.fn(),
        },
    },
}));

// ─── Mock audit ───────────────────────────────────────────────────────────────
vi.mock('../lib/audit', () => ({
    writeJadAudit: vi.fn(),
}));

import app from '../index';
import { prisma } from '../lib/db';
import { writeJadAudit } from '../lib/audit';
import { env } from '../lib/env';

const mockSharedSecret = 'test-inter-service-shared-secret-long-enough';
vi.mock('../lib/env', () => ({
    env: {
        JAD_IPROCORE_SHARED_SECRET: 'test-inter-service-shared-secret-long-enough',
        PORT: 3001,
        NODE_ENV: 'test',
        JAD_DATABASE_URL: 'postgresql://...',
        JAD_IPROCORE_ACCESS_SECRET: '...',
        IPROCORE_AUDIT_URL: 'http://...',
    },
}));

// Typed mock helper
const mock = (fn: any) => fn as ReturnType<typeof vi.fn>;

describe('JAD AI Execution Bridge (POST /api/jad/ai/execute)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validPayload = {
        tenantId: 'd4844359-0000-0000-0000-000000000001',
        requestId: 'req-ai-123',
        initiatingUserId: '00000000-0000-0000-0000-000000000001',
        approvedByUserId: '00000000-0000-0000-0000-000000000001',
        activationId: '00000000-0000-0000-0000-000000000001',
        triggerSource: 'AI',
        intent: 'RUN_WORKFLOW',
    };

    function getSignature(body: any): string {
        return crypto
            .createHmac('sha256', mockSharedSecret)
            .update(JSON.stringify(body))
            .digest('hex');
    }

    it('Happy Path: Valid signature and body creates WorkflowRun', async () => {
        // 1. Mock activation check
        mock(prisma.connectorActivation.findFirst).mockResolvedValue({ id: 'act-0001', tenantId: validPayload.tenantId });
        // 2. Mock workflow creation
        mock(prisma.workflowRun.create).mockResolvedValue({ id: 'run-001' });

        const sig = getSignature(validPayload);

        const res = await request(app)
            .post('/api/jad/ai/execute')
            .set('x-jad-signature', sig)
            .send(validPayload);

        expect(res.status).toBe(202);
        expect(res.body.runId).toBe('run-001');

        // Verify audit emission
        expect(writeJadAudit).toHaveBeenCalledTimes(1);
        const auditCall = mock(writeJadAudit).mock.calls[0][0];
        expect(auditCall.action).toBe('ai.workflow.initiated');
        expect(auditCall.triggerSource).toBe('ai');
        expect(auditCall.approvedByUserId).toBe(validPayload.approvedByUserId);
    });

    it('Failure: Signature mismatch returns 401', async () => {
        const res = await request(app)
            .post('/api/jad/ai/execute')
            .set('x-jad-signature', 'wrong-signature')
            .send(validPayload);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Signature mismatch');
    });

    it('Failure: Missing approvedByUserId returns 400', async () => {
        const { approvedByUserId, ...invalidPayload } = validPayload;
        const sig = getSignature(invalidPayload);

        const res = await request(app)
            .post('/api/jad/ai/execute')
            .set('x-jad-signature', sig)
            .send(invalidPayload);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid AI execution request');
    });

    it('Failure: Activation not found for tenant returns 404', async () => {
        // Mock activation NOT found
        mock(prisma.connectorActivation.findFirst).mockResolvedValue(null);

        const sig = getSignature(validPayload);

        const res = await request(app)
            .post('/api/jad/ai/execute')
            .set('x-jad-signature', sig)
            .send(validPayload);

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('not found');
    });
});
