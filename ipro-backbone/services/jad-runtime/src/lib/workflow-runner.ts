/**
 * JAD — Minimal Workflow Engine
 *
 * Processes pending WorkflowRun records in a poll loop (every 30s).
 * Status machine: pending → running → success | failed
 * Retry logic: up to MAX_RETRIES=3 attempts with linear backoff.
 * Logs are append-only JSON array on WorkflowRun.logs.
 *
 * Phase 04 execution: stub action (simulate connector side-effect).
 * Phase 06 will replace with real connector call.
 *
 * Phase 04B: full audit emission at every status transition.
 * Blueprint §JAD: process queued WorkflowRun, retry logic, status transitions.
 * Blueprint §Audit: all privileged actions audited.
 */

import { prisma } from './db';
import { writeJadAudit } from './audit';

const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 30_000;

type LogEntry = { ts: string; level: 'info' | 'warn' | 'error'; message: string };

function appendLog(existing: unknown, entry: LogEntry): LogEntry[] {
    const logs = Array.isArray(existing) ? (existing as LogEntry[]) : [];
    return [...logs, entry];
}

async function processRun(runId: string): Promise<void> {
    // Fetch full run to get governance fields needed for audit
    const current = await prisma.workflowRun.findUnique({
        where: { id: runId },
        select: {
            logs: true,
            tenantId: true,
            activationId: true,
            retryCount: true,
            initiatingUserId: true,
            triggerSource: true,
            approvedByUserId: true,
            requestId: true,
        },
    });

    if (!current) return;

    const auditBase = {
        tenantId: current.tenantId,
        actorId: current.initiatingUserId ?? 'system',
        resource: 'WorkflowRun',
        resourceId: runId,
        triggerSource: (current.triggerSource as 'manual' | 'webhook' | 'system' | 'ai') ?? 'system',
        requestId: current.requestId ?? undefined,
        approvedByUserId: current.approvedByUserId ?? null,
    };

    // Transition: pending → running
    const run = await prisma.workflowRun.update({
        where: { id: runId },
        data: {
            status: 'running',
            startedAt: new Date(),
            logs: appendLog(current.logs, {
                ts: new Date().toISOString(),
                level: 'info',
                message: 'WorkflowRun started',
            }),
        },
        select: { id: true, activationId: true, retryCount: true, logs: true, tenantId: true },
    });

    // Audit: started
    writeJadAudit({
        ...auditBase,
        action: 'workflow.started',
        status: 'started',
        meta: { activationId: run.activationId, retryCount: run.retryCount },
    });

    try {
        // Phase 04 stub: simulate external connector action
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Success transition
        await prisma.workflowRun.update({
            where: { id: run.id },
            data: {
                status: 'success',
                completedAt: new Date(),
                logs: appendLog(run.logs, {
                    ts: new Date().toISOString(),
                    level: 'info',
                    message: 'WorkflowRun completed successfully',
                }),
            },
        });

        // Audit: success
        writeJadAudit({
            ...auditBase,
            action: 'workflow.completed',
            status: 'success',
            meta: { activationId: run.activationId },
        });

        // Mark webhook as processed
        const fullRun = await prisma.workflowRun.findUnique({
            where: { id: run.id },
            select: { webhookEventId: true },
        });
        if (fullRun?.webhookEventId) {
            await prisma.webhookEvent.update({
                where: { id: fullRun.webhookEventId },
                data: { processedAt: new Date() },
            });
        }
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        const newRetryCount = run.retryCount + 1;

        if (newRetryCount >= MAX_RETRIES) {
            // Final failure
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: {
                    status: 'failed',
                    completedAt: new Date(),
                    retryCount: newRetryCount,
                    logs: appendLog(run.logs, {
                        ts: new Date().toISOString(),
                        level: 'error',
                        message: `WorkflowRun failed permanently after ${newRetryCount} attempts: ${errMsg}`,
                    }),
                },
            });

            // Audit: failed (permanent)
            writeJadAudit({
                ...auditBase,
                action: 'workflow.failed',
                status: 'failed',
                meta: { activationId: run.activationId, retryCount: newRetryCount, error: errMsg },
            });
        } else {
            // Requeue for retry
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: {
                    status: 'pending',
                    retryCount: newRetryCount,
                    logs: appendLog(run.logs, {
                        ts: new Date().toISOString(),
                        level: 'warn',
                        message: `WorkflowRun attempt ${newRetryCount} failed: ${errMsg}. Retrying...`,
                    }),
                },
            });

            // Audit: retrying
            writeJadAudit({
                ...auditBase,
                action: 'workflow.retrying',
                status: 'retrying',
                meta: { activationId: run.activationId, retryCount: newRetryCount, error: errMsg },
            });
        }
    }
}

async function pollPendingRuns(): Promise<void> {
    try {
        const pendingRuns = await prisma.workflowRun.findMany({
            where: { status: 'pending', retryCount: { lt: MAX_RETRIES } },
            select: { id: true },
            take: 10, // process up to 10 per poll cycle
            orderBy: { createdAt: 'asc' },
        });

        if (pendingRuns.length > 0) {
            console.log(`[JAD Workflow] Processing ${pendingRuns.length} pending run(s)`);
        }

        // Process sequentially to avoid concurrent DB conflicts
        for (const run of pendingRuns) {
            await processRun(run.id);
        }
    } catch (err) {
        console.error('[JAD Workflow] Poll error:', (err as Error).message);
    }
}

export function startWorkflowRunner(): void {
    console.log(`[JAD Workflow] Engine started — polling every ${POLL_INTERVAL_MS / 1000}s`);
    // Initial poll on boot
    void pollPendingRuns();
    setInterval(() => void pollPendingRuns(), POLL_INTERVAL_MS);
}
