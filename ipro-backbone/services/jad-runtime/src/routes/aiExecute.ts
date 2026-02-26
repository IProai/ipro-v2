/**
 * JAD — AI Confirmed Execution Bridge
 * 
 * Endpoint: POST /api/jad/ai/execute
 * Security: hmacGuard (Inter-service only)
 * 
 * Purpose: Allows IProCore to dispatch AI-confirmed actions to JAD.
 * Creates a WorkflowRun and emits governance audit logs.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { hmacGuard } from '../middleware/hmacGuard';
import { writeJadAudit } from '../lib/audit';

const router = Router();

// Strict validation schema for AI-triggered runs
const aiExecuteSchema = z.object({
    tenantId: z.string().uuid(),
    requestId: z.string().min(1),
    initiatingUserId: z.string().uuid(),
    approvedByUserId: z.string().uuid(),
    activationId: z.string().uuid(),
    triggerSource: z.literal('AI'),
    intent: z.enum(['RUN_WORKFLOW']),
    meta: z.record(z.unknown()).optional(),
});

router.post('/execute', hmacGuard, async (req, res) => {
    const parsed = aiExecuteSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'Invalid AI execution request',
            details: parsed.error.flatten()
        });
    }

    const {
        tenantId,
        requestId,
        initiatingUserId,
        approvedByUserId,
        activationId,
        triggerSource,
        intent,
        meta,
    } = parsed.data;

    try {
        // 1. Verify activation belongs to the tenant
        const activation = await prisma.connectorActivation.findFirst({
            where: { id: activationId, tenantId },
        });

        if (!activation) {
            return res.status(404).json({ error: 'Connector activation not found for this tenant' });
        }

        // 2. Create WorkflowRun
        const run = await prisma.workflowRun.create({
            data: {
                tenantId,
                activationId,
                status: 'pending',
                triggerSource,
                initiatingUserId,
                approvedByUserId,
                requestId,
                logs: [],
            },
        });

        // 3. Emit initial Audit (Governance)
        writeJadAudit({
            tenantId,
            actorId: initiatingUserId,
            action: 'ai.workflow.initiated',
            resource: 'WorkflowRun',
            resourceId: run.id,
            triggerSource: 'ai',
            status: 'started',
            requestId,
            approvedByUserId,
            meta: { ...meta, intent, activationId },
        });

        return res.status(202).json({
            message: 'AI workflow run accepted',
            runId: run.id,
            status: 'pending',
        });
    } catch (err) {
        console.error('[JAD] AI Execute error:', (err as Error).message);
        return res.status(500).json({ error: 'Internal server error during AI dispatch' });
    }
});

export default router;
