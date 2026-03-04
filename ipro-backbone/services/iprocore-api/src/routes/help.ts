import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { writeAudit } from '../lib/audit';
import { requireAuth } from '../middleware/requireAuth';
import { tenantResolver } from '../middleware/tenantResolver';
import { env } from '../lib/env';

const router = Router();

// ─── SECRETS GOVERNANCE: help.ts never queries ConnectorActivation.credentialRef ─

// ─── Public KB route (no auth required) ──────────────────────────────────────

/**
 * GET /api/help/articles
 * Returns global KB articles (tenantId=null) + tenant-specific ones.
 * Optional: ?category=general
 */
router.get('/articles', async (req, res, next) => {
    try {
        // Determine tenantId from JWT if present, otherwise global only
        const tenantId = (req as any).auth?.activeTenantId ?? null;
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;

        const articles = await prisma.kBArticle.findMany({
            where: {
                published: true,
                ...(category ? { category } : {}),
                OR: [
                    { tenantId: null },            // global articles
                    ...(tenantId ? [{ tenantId }] : []), // tenant-specific
                ],
            },
            orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
            select: {
                id: true,
                titleEn: true,
                titleAr: true,
                bodyEn: true,
                bodyAr: true,
                category: true,
            },
        });

        return res.json({ articles });
    } catch (err) {
        next(err);
    }
});

// ─── Authenticated ticket routes ──────────────────────────────────────────────
router.use(requireAuth, tenantResolver);

const createTicketSchema = z.object({
    subject: z.string().min(3).max(200),
    body: z.string().min(10).max(5000),
});

/**
 * POST /api/help/tickets
 * Create a support ticket — tenant-scoped, audit-logged.
 * Blueprint §6 Support.
 */
router.post('/tickets', async (req, res, next) => {
    try {
        const { activeTenantId: tenantId, userId } = req.auth!;
        const parsed = createTicketSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Invalid ticket', details: parsed.error.issues });

        const { subject, body } = parsed.data;

        const ticket = await prisma.helpTicket.create({
            data: { tenantId, userId, subject, body },
        });

        await writeAudit({
            tenantId,
            actorId: userId,
            action: 'help.ticket.create',
            resource: 'HelpTicket',
            resourceId: ticket.id,
            meta: { subject },
            requestId: req.headers['x-request-id'] as string,
        });

        return res.status(201).json({ ticket });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/help/tickets
 * List all tickets for the authenticated tenant. Tenant-isolated.
 */
router.get('/tickets', async (req, res, next) => {
    try {
        const { activeTenantId: tenantId } = req.auth!;

        let tickets = [];
        try {
            tickets = await prisma.helpTicket.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    subject: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    user: { select: { email: true } },
                },
            });
        } catch (dbErr) {
            throw dbErr;
        }

        return res.json({ tickets });
    } catch (err) {
        next(err);
    }
});

// ─── AI Suggest for Help Tickets (Phase 05) ──────────────────────────────────

/**
 * GET /api/help/tickets/:ticketId/ai-suggest
 *
 * Returns an AI draft reply suggestion for a specific ticket.
 * AI CANNOT modify the ticket — creates an AiSuggestion record only.
 * Governance: no secrets accessed, no autonomous action.
 * Blueprint §6 Help: "AI can suggest reply draft" + §9 AI rules enforced.
 */
router.get('/tickets/:ticketId/ai-suggest', async (req, res, next) => {
    try {
        const { activeTenantId: tenantId, userId } = req.auth!;
        const requestId = res.locals.requestId as string;
        const { ticketId } = req.params;

        // Fetch ticket — tenant-scoped (cross-tenant blocked)
        let ticket: any = null;
        try {
            ticket = await prisma.helpTicket.findFirst({
                where: { id: ticketId, tenantId }, // tenantId from JWT only
                select: { id: true, subject: true, body: true, status: true },
            });
        } catch (dbErr) {
            throw dbErr;
        }

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Build contextSummary — subject only, body truncated to 200 chars
        // Governance rule 5: store summary only — no raw payloads, no secrets
        const contextSummary =
            `Help ticket: ${ticket.subject}. ` +
            `Body preview: ${ticket.body.slice(0, 200)}${ticket.body.length > 200 ? '…' : ''}`;

        // TTL: 48 hours
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        // Generate assistive draft reply
        const suggestionText =
            `[AI Draft Reply] Thank you for contacting support regarding: "${ticket.subject}".\n` +
            `Based on the ticket description, the issue may relate to connector configuration or ` +
            `permission settings. Suggested next steps:\n` +
            `1. Verify your connector activation status at /console/jad/integrations\n` +
            `2. Check the audit log at /console/security/audit-log for recent events\n` +
            `3. If issue persists, escalate to the Owner role for step-up verification.\n` +
            `This is an AI draft — review before sending.`;

        // Create AiSuggestion record (assistive only — cannot modify ticket)
        let suggestion: any = null;
        try {
            suggestion = await prisma.aiSuggestion.create({
                data: {
                    tenantId,
                    requestingUserId: userId,
                    suggestionType: 'help_reply',
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
                action: 'ai.help.suggested',
                suggestionId: suggestion.id,
                triggerSource: 'AI',
                requestId,
                meta: { ticketId, subject: ticket.subject, suggestionType: 'help_reply' },
            },
        });

        // Standard audit
        await writeAudit({
            tenantId,
            actorId: userId,
            action: 'ai.help.suggested',
            resource: 'HelpTicket',
            resourceId: ticketId,
            meta: { triggerSource: 'AI', suggestionId: suggestion.id },
            requestId,
        });

        return res.json({
            suggestion,
            note: 'AI suggestion only. AI cannot modify this ticket. Confirm via POST /api/ai/suggestions/:id/confirm to execute.',
        });
    } catch (err) {
        next(err);
    }
});

export default router;
