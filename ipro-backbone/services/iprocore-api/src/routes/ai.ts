/**
 * IProCore — AI Assist Routes (Phase 05)
 *
 * Blueprint §9: AI Layer — Assistive Only.
 * All AI routes are behind requireAuth + tenantResolver.
 *
 * Endpoints:
 *   POST /api/ai/suggestions           — create AI suggestion (draft only)
 *   GET  /api/ai/suggestions           — list tenant suggestions
 *   POST /api/ai/suggestions/:id/confirm — server-side confirmation gate → JAD WorkflowRun
 *   GET  /api/ai/activity              — AI activity log
 *   POST /api/ai/playbooks             — assistive playbook suggestions from PortfolioItem catalog
 *
 * GOVERNANCE CONSTRAINTS (non-negotiable):
 *   1. No autonomous execution — every action requires explicit user confirmation via server gate
 *   2. No secrets: credentialRef is NEVER queried or included in any response
 *   3. Any execution: triggerSource='AI', approvedByUserId required, requestId preserved
 *   4. Server-side gate is AiConfirmation record — UI modal alone is insufficient
 *   5. contextSummary/suggestionText: summary only — no raw secrets, OAuth tokens, webhook bodies
 *   6. Every interaction emits AuditLog (IProCore) and AiActivityLog
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { writeAudit } from '../lib/audit';
import { requireAuth } from '../middleware/requireAuth';
import { tenantResolver } from '../middleware/tenantResolver';
import { requireRole } from '../middleware/requireRole';
import { env } from '../lib/env';

const router = Router();

// All AI routes require auth + tenant context
router.use(requireAuth, tenantResolver);

// ─── Validation schemas ────────────────────────────────────────────────────────

const createSuggestionSchema = z.object({
    suggestionType: z.enum([
        'workflow_draft',
        'onboarding_draft',
        'help_reply',
        'integration_suggestion',
    ]),
    contextSummary: z
        .string()
        .min(10)
        .max(1000)
        .refine(
            // Hard rule: prevent raw secret patterns from being stored
            (v) =>
                !v.match(
                    /-----BEGIN|sk-[a-zA-Z0-9]{20,}|xox[bpoa]-|ghp_[a-zA-Z0-9]+|Bearer [a-zA-Z0-9._-]{20,}/i,
                ),
            { message: 'contextSummary must not contain raw credential values' },
        ),
});

const confirmSchema = z.object({
    confirmationAction: z.enum(['confirm', 'dismiss']),
});

// ─── Stub AI draft generator ───────────────────────────────────────────────────
// Phase 05: deterministic rule-based drafts. Real LLM integrates in Phase 06+
// without changing any contract. Governance shell is what Phase 05 mandates.

function generateDraft(type: string, contextSummary: string): string {
    switch (type) {
        case 'workflow_draft':
            return (
                `[AI Draft] Based on your context: "${contextSummary.slice(0, 80)}…"\n` +
                `Suggested workflow: Trigger on event → validate tenant permission → ` +
                `activate connector via JAD → log result to AuditLog. ` +
                `Review and confirm to execute via JAD runtime.`
            );
        case 'onboarding_draft':
            return (
                `[AI Draft] Recommended onboarding steps based on context:\n` +
                `1. Complete profile setup\n2. Configure primary connector\n` +
                `3. Enable 2FA for Owner role\n4. Publish first PortfolioItem.\n` +
                `Confirm to apply these as OnboardingStep records.`
            );
        case 'help_reply':
            return (
                `[AI Draft] Suggested reply for ticket:\n` +
                `"Thank you for reaching out. Based on your description, please try: ` +
                `(1) clearing your browser cache, (2) verifying your connector activation status ` +
                `in /console/jad/integrations, (3) checking the audit log for recent events." ` +
                `This is a draft — review before sending.`
            );
        case 'integration_suggestion':
            return (
                `[AI Draft] Based on your portfolio and usage context: ` +
                `Consider activating the CRM connector to automate lead-to-opportunity workflows. ` +
                `Required: ConnectorActivation with valid credentialRef (you will be prompted — ` +
                `the AI does not have access to your credentials). Confirm to route via JAD.`
            );
        default:
            return `[AI Draft] Suggestion generated for type: ${type}. Context: ${contextSummary.slice(0, 100)}.`;
    }
}

// ─── POST /api/ai/suggestions ─────────────────────────────────────────────────

/**
 * Create a new AI suggestion.
 * Stores contextSummary (secrets rejected) and generates a draft reply.
 * Does NOT execute anything — status stays 'pending' until confirmed via server gate.
 */
router.post('/suggestions', async (req, res, next) => {
    try {
        const { activeTenantId: tenantId, userId } = req.auth!;
        const requestId = res.locals.requestId as string;

        const parsed = createSuggestionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request', detail: parsed.error.flatten() });
        }

        const { suggestionType, contextSummary } = parsed.data;

        // TTL: 48 hours
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        // Generate assistive draft (no LLM call in Phase 05 — governance stub)
        const suggestionText = generateDraft(suggestionType, contextSummary);

        let suggestion: any = null;
        try {
            suggestion = await prisma.aiSuggestion.create({
                data: {
                    tenantId,
                    requestingUserId: userId,
                    suggestionType,
                    contextSummary,
                    suggestionText,
                    status: 'pending',
                    requestId,
                    expiresAt,
                },
                select: {
                    id: true,
                    suggestionType: true,
                    contextSummary: true,
                    suggestionText: true,
                    status: true,
                    expiresAt: true,
                    createdAt: true,
                },
            });
        } catch (dbErr) {
            throw dbErr;
        }

        // AI Activity Log
        await prisma.aiActivityLog.create({
            data: {
                tenantId,
                actorId: userId,
                action: 'ai.suggestion.created',
                suggestionId: suggestion.id,
                triggerSource: 'AI',
                requestId,
                meta: { suggestionType, contextLength: contextSummary.length },
            },
        });

        // IProCore standard audit
        await writeAudit({
            tenantId,
            actorId: userId,
            action: 'ai.suggestion.created',
            resource: 'AiSuggestion',
            resourceId: suggestion.id,
            meta: { suggestionType, triggerSource: 'AI' },
            requestId,
        });

        return res.status(201).json({ suggestion });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/ai/suggestions ──────────────────────────────────────────────────

/**
 * List AI suggestions for the authenticated tenant — tenant-scoped.
 * Expired suggestions are excluded.
 */
router.get('/suggestions', async (req, res, next) => {
    try {
        const { activeTenantId: tenantId } = req.auth!;

        let suggestions = [];
        try {
            suggestions = await prisma.aiSuggestion.findMany({
                where: {
                    tenantId,
                    expiresAt: { gt: new Date() }, // exclude expired
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    suggestionType: true,
                    contextSummary: true,
                    suggestionText: true,
                    status: true,
                    confirmedAt: true,
                    confirmedByUserId: true,
                    workflowRunId: true,
                    expiresAt: true,
                    createdAt: true,
                },
            });
        } catch (dbErr) {
            throw dbErr;
        }

        return res.json({ suggestions });
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/ai/suggestions/:id/confirm ─────────────────────────────────────

/**
 * Server-side confirmation gate for AI suggestions.
 *
 * Governance rules enforced here:
 * - Validates suggestion belongs to requesting tenant (no cross-tenant)
 * - Validates suggestion is still pending (not already confirmed/dismissed/expired)
 * - Creates AiConfirmation record (server-side gate — append-only)
 * - For 'confirm': dispatches JAD WorkflowRun with:
 *     triggerSource='AI', approvedByUserId=userId, requestId preserved
 * - Emits AuditLog and AiActivityLog
 * - AI DOES NOT have access to credentialRef — JAD dispatch contains NO secrets
 */
router.post('/suggestions/:id/confirm', requireRole('owner'), async (req, res, next) => {
    try {
        const { activeTenantId: tenantId, userId } = req.auth!;
        const requestId = res.locals.requestId as string;
        const { id: suggestionId } = req.params;

        const parsed = confirmSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid confirmation', detail: parsed.error.flatten() });
        }
        const { confirmationAction } = parsed.data;

        // Fetch suggestion — tenant-scoped (cross-tenant blocked)
        let suggestion: any = null;
        try {
            suggestion = await prisma.aiSuggestion.findFirst({
                where: {
                    id: suggestionId,
                    tenantId, // HARD: tenantId from JWT only
                    status: 'pending',
                    expiresAt: { gt: new Date() },
                },
            });
        } catch (dbErr) {
            throw dbErr;
        }

        if (!suggestion) {
            return res.status(404).json({
                error: 'Suggestion not found, already actioned, or expired',
            });
        }

        // Write server-side confirmation gate record (proof of human approval)
        try {
            await prisma.aiConfirmation.create({
                data: {
                    tenantId,
                    suggestionId,
                    requestingUserId: suggestion.requestingUserId,
                    approvedByUserId: userId,
                    confirmationAction,
                    requestId,
                },
            });
        } catch (dbErr) {
            throw dbErr;
        }

        let workflowRunId: string | null = null;
        let jadStatus: string = 'not_executed';

        if (confirmationAction === 'confirm') {
            // Dispatch to JAD runtime as a WorkflowRun with triggerSource='AI'
            // Governance: no credentialRef, no secrets — JAD receives only governance metadata
            if (env.JAD_RUNTIME_URL) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5_000);

                    const jadRes = await fetch(`${env.JAD_RUNTIME_URL}/api/jad/ai/execute`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Request-ID': requestId,
                            'X-Service': 'iprocore-api',
                        },
                        body: JSON.stringify({
                            tenantId,
                            suggestionId,
                            suggestionType: suggestion.suggestionType,
                            triggerSource: 'AI',           // MANDATORY per Founder governance
                            approvedByUserId: userId,       // MANDATORY — confirmation gate proof
                            requestId,                      // MANDATORY — end-to-end chain
                            // NO credentialRef, NO secrets
                        }),
                        signal: controller.signal,
                    });
                    clearTimeout(timeout);

                    if (jadRes.ok) {
                        const jadData = await jadRes.json() as { workflowRunId?: string };
                        workflowRunId = jadData.workflowRunId ?? null;
                        jadStatus = 'dispatched';
                    } else {
                        jadStatus = `jad_error_${jadRes.status}`;
                    }
                } catch {
                    jadStatus = 'jad_unreachable';
                }
            } else {
                jadStatus = 'not_configured';
            }

            // Update suggestion to confirmed
            try {
                await prisma.aiSuggestion.update({
                    where: { id: suggestionId },
                    data: {
                        status: 'confirmed',
                        confirmedAt: new Date(),
                        confirmedByUserId: userId,
                        workflowRunId,
                    },
                });
            } catch (dbErr) {
                throw dbErr;
            }
        } else {
            // Dismiss
            try {
                await prisma.aiSuggestion.update({
                    where: { id: suggestionId },
                    data: { status: 'dismissed' },
                });
            } catch (dbErr) {
                throw dbErr;
            }
        }

        // AI Activity Log
        const activityAction =
            confirmationAction === 'confirm' ? 'ai.execution.dispatched' : 'ai.confirmation.dismissed';

        try {
            await prisma.aiActivityLog.create({
                data: {
                    tenantId,
                    actorId: userId,
                    action: activityAction,
                    suggestionId,
                    workflowRunId,
                    triggerSource: 'AI',
                    requestId,
                    meta: {
                        confirmationAction,
                        jadStatus,
                        suggestionType: suggestion.suggestionType,
                        approvedByUserId: userId,
                    },
                },
            });
        } catch (dbErr) {
            throw dbErr;
        }

        // IProCore standard audit (with full AI governance fields)
        await writeAudit({
            tenantId,
            actorId: userId,
            action: activityAction,
            resource: 'AiSuggestion',
            resourceId: suggestionId,
            meta: {
                triggerSource: 'AI',
                approvedByUserId: userId,
                workflowRunId,
                jadStatus,
            },
            requestId,
        });

        return res.json({
            ok: true,
            confirmationAction,
            suggestionId,
            workflowRunId,
            jadStatus,
        });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/ai/activity ─────────────────────────────────────────────────────

/**
 * AI activity log for the authenticated tenant.
 * Tenant-scoped. Append-only — no modifications available via this route.
 */
router.get('/activity', async (req, res, next) => {
    try {
        const { activeTenantId: tenantId } = req.auth!;
        const limit = Math.min(Number(req.query.limit) || 50, 200);

        let activity = [];
        try {
            activity = await prisma.aiActivityLog.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    actorId: true,
                    action: true,
                    suggestionId: true,
                    workflowRunId: true,
                    triggerSource: true,
                    requestId: true,
                    meta: true,
                    createdAt: true,
                },
            });
        } catch (dbErr) {
            throw dbErr;
        }

        return res.json({ activity });
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/ai/playbooks ───────────────────────────────────────────────────

/**
 * Returns suggested playbooks based on tenant's published PortfolioItems.
 * Assistive read-only — reads suggestedPlaybooks[] from PortfolioItem.
 * Does NOT create or modify any data. No execution.
 * Governance: credentialRef fields are excluded in the select clause.
 */
router.post('/playbooks', async (req, res, next) => {
    try {
        const { activeTenantId: tenantId, userId } = req.auth!;
        const requestId = res.locals.requestId as string;

        // Read tenant's published portfolio items — suggestedPlaybooks is an array of labels
        // credentialRef and secrets are NOT part of PortfolioItem — no exclusion needed here
        const portfolioItems = await prisma.portfolioItem.findMany({
            where: {
                tenantId,
                status: 'published',
                killSwitch: false,
                suggestedPlaybooks: { isEmpty: false },
            },
            select: {
                id: true,
                name: true,
                type: true,
                suggestedPlaybooks: true,
            },
        });

        const playbooks = portfolioItems.flatMap((item) =>
            item.suggestedPlaybooks.map((pb) => ({
                source: item.name,
                sourceType: item.type,
                portfolioItemId: item.id,
                playbookLabel: pb,
                description: `AI-assisted suggestion: explore "${pb}" workflow for ${item.name}`,
            })),
        );

        // Emit activity log (assistive read — no confirmation required)
        await prisma.aiActivityLog.create({
            data: {
                tenantId,
                actorId: userId,
                action: 'ai.playbooks.suggested',
                triggerSource: 'AI',
                requestId,
                meta: { playbookCount: playbooks.length },
            },
        });

        return res.json({ playbooks });
    } catch (err) {
        next(err);
    }
});

export default router;
