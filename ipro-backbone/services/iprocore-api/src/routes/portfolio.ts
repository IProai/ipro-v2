import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/db';
import { writeAudit } from '../lib/audit';
import { requireAuth } from '../middleware/requireAuth';
import { tenantResolver } from '../middleware/tenantResolver';
import { requirePerm } from '../middleware/requirePerm';
import { requirePolicy } from '../middleware/requirePolicy';
import { createError } from '../middleware/errorHandler';

const router = Router();

// Auth pipeline: requireAuth → tenantResolver → requirePerm → requirePolicy
const authPipeline = [requireAuth, tenantResolver, requirePerm('portfolio:manage'), requirePolicy('portfolio')];

// ─── Input schemas (explicit allowlists — Skill 02) ───────────────────────────

const createSchema = z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['product', 'engine', 'platform']),
    icon: z.string().optional(),
    descriptionEn: z.string().min(1).max(1000),
    descriptionAr: z.string().min(1).max(1000),
    launchUrlProd: z.string().url().optional(),
    launchUrlStage: z.string().url().optional(),
    ssoMode: z.enum(['handoff', 'oidc']).default('handoff'),
    requiredPermissions: z.array(z.string()).default([]),
    requiredConnectors: z.array(z.string()).default([]),
    suggestedPlaybooks: z.array(z.string()).default([]),
    defaultPlansVisibility: z.array(z.string()).default([]),
    version: z.string().default('1.0.0'),
    status: z.enum(['draft', 'published', 'disabled']).default('draft'),
    rolloutMode: z.enum(['all', 'allowlistTenants', 'allowlistPlans']).default('all'),
    allowlistTenants: z.array(z.string()).default([]),
    allowlistPlans: z.array(z.string()).default([]),
    killSwitch: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
});

const updateSchema = createSchema.partial();

// ─── GET /api/portfolio ───────────────────────────────────────────────────────

router.get(
    '/',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id: tenantId } = req.tenant!;
            let items = [];
            try {
                items = await prisma.portfolioItem.findMany({
                    where: { tenantId },
                    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                });
            } catch (dbErr) {
                if (tenantId === 'demo-tenant-uuid') {
                    items = [
                        {
                            id: 'demo-p-1',
                            name: 'Core Spine',
                            type: 'platform',
                            icon: 'Activity',
                            descriptionEn: 'Intellect ProActive Core platform foundation.',
                            descriptionAr: 'أساس منصة Intellect ProActive Core.',
                            launchUrlProd: '/console/dashboard',
                            ssoMode: 'handoff',
                            version: '1.0.0'
                        }
                    ];
                } else {
                    throw dbErr;
                }
            }
            res.json({ items });
        } catch (err) {
            next(err);
        }
    },
);

// ─── POST /api/portfolio ──────────────────────────────────────────────────────

router.post(
    '/',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestId = req.headers['x-request-id'] as string;
        const parsed = createSchema.safeParse(req.body);

        if (!parsed.success) {
            next(createError(422, parsed.error.issues.map((i) => i.message).join(', ')));
            return;
        }

        try {
            const item = await prisma.portfolioItem.create({
                data: {
                    id: uuidv4(),
                    tenantId: req.tenant!.id, // always from server — never client
                    ...parsed.data,
                },
            });

            await writeAudit({
                tenantId: req.tenant!.id,
                actorId: req.auth!.userId,
                action: 'portfolio.create',
                resource: 'PortfolioItem',
                resourceId: item.id,
                meta: { name: item.name, status: item.status },
                requestId,
            });

            res.status(201).json({ item });
        } catch (err) {
            next(err);
        }
    },
);

// ─── GET /api/portfolio/:id ───────────────────────────────────────────────────

router.get(
    '/:id',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const item = await prisma.portfolioItem.findFirst({
                where: {
                    id: req.params.id,
                    tenantId: req.tenant!.id, // tenant isolation on individual lookup
                },
            });

            if (!item) {
                next(createError(404, 'Portfolio item not found'));
                return;
            }

            res.json({ item });
        } catch (err) {
            next(err);
        }
    },
);

// ─── PATCH /api/portfolio/:id ─────────────────────────────────────────────────

router.patch(
    '/:id',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestId = req.headers['x-request-id'] as string;
        const parsed = updateSchema.safeParse(req.body);

        if (!parsed.success) {
            next(createError(422, parsed.error.issues.map((i) => i.message).join(', ')));
            return;
        }

        try {
            // Verify ownership before update — prevents cross-tenant mutation
            const existing = await prisma.portfolioItem.findFirst({
                where: { id: req.params.id, tenantId: req.tenant!.id },
            });

            if (!existing) {
                next(createError(404, 'Portfolio item not found'));
                return;
            }

            const item = await prisma.portfolioItem.update({
                where: { id: existing.id },
                data: parsed.data,
            });

            await writeAudit({
                tenantId: req.tenant!.id,
                actorId: req.auth!.userId,
                action: 'portfolio.update',
                resource: 'PortfolioItem',
                resourceId: item.id,
                meta: { changes: Object.keys(parsed.data) },
                requestId,
            });

            res.json({ item });
        } catch (err) {
            next(err);
        }
    },
);

// ─── DELETE /api/portfolio/:id ────────────────────────────────────────────────

router.delete(
    '/:id',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestId = req.headers['x-request-id'] as string;

        try {
            const existing = await prisma.portfolioItem.findFirst({
                where: { id: req.params.id, tenantId: req.tenant!.id },
            });

            if (!existing) {
                next(createError(404, 'Portfolio item not found'));
                return;
            }

            await prisma.portfolioItem.delete({ where: { id: existing.id } });

            await writeAudit({
                tenantId: req.tenant!.id,
                actorId: req.auth!.userId,
                action: 'portfolio.delete',
                resource: 'PortfolioItem',
                resourceId: existing.id,
                meta: { name: existing.name },
                requestId,
            });

            res.json({ ok: true });
        } catch (err) {
            next(err);
        }
    },
);

// ─── PATCH /api/portfolio/:id/status — Founder-only status toggle ─────────────

const statusSchema = z.object({
    status: z.enum(['draft', 'published', 'disabled']),
});

router.patch(
    '/:id/status',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestId = req.headers['x-request-id'] as string;
        const parsed = statusSchema.safeParse(req.body);

        if (!parsed.success) {
            next(createError(422, 'status must be draft | published | disabled'));
            return;
        }

        try {
            // Blueprint §7: Founder-only — membership.memberRole must be 'owner'
            const membership = await prisma.membership.findUnique({
                where: { userId_tenantId: { userId: req.auth!.userId, tenantId: req.tenant!.id } },
            });
            if (!membership || membership.memberRole !== 'owner') {
                next(createError(403, 'Founder-only: cannot change portfolio status'));
                return;
            }

            const existing = await prisma.portfolioItem.findFirst({
                where: { id: req.params.id, tenantId: req.tenant!.id },
            });
            if (!existing) { next(createError(404, 'Portfolio item not found')); return; }

            const item = await prisma.portfolioItem.update({
                where: { id: existing.id },
                data: { status: parsed.data.status },
            });

            await writeAudit({
                tenantId: req.tenant!.id,
                actorId: req.auth!.userId,
                action: 'portfolio.status_change',
                resource: 'PortfolioItem',
                resourceId: item.id,
                meta: { from: existing.status, to: item.status },
                requestId,
            });

            res.json({ item });
        } catch (err) {
            next(err);
        }
    },
);

// ─── PATCH /api/portfolio/:id/kill-switch — instantly hides from dashboard ────

router.patch(
    '/:id/kill-switch',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestId = req.headers['x-request-id'] as string;

        try {
            // Blueprint §7: Founder-only kill-switch
            const membership = await prisma.membership.findUnique({
                where: { userId_tenantId: { userId: req.auth!.userId, tenantId: req.tenant!.id } },
            });
            if (!membership || membership.memberRole !== 'owner') {
                next(createError(403, 'Founder-only: kill-switch access denied'));
                return;
            }

            const existing = await prisma.portfolioItem.findFirst({
                where: { id: req.params.id, tenantId: req.tenant!.id },
            });
            if (!existing) { next(createError(404, 'Portfolio item not found')); return; }

            // Skill 05: kill switch sets killSwitch=true — hides from /api/dashboard/summary
            const item = await prisma.portfolioItem.update({
                where: { id: existing.id },
                data: { killSwitch: true },
            });

            await writeAudit({
                tenantId: req.tenant!.id,
                actorId: req.auth!.userId,
                action: 'portfolio.kill_switch',
                resource: 'PortfolioItem',
                resourceId: item.id,
                meta: { name: item.name },
                requestId,
            });

            res.json({ item, message: 'Kill switch activated — item hidden from dashboard' });
        } catch (err) {
            next(err);
        }
    },
);

// ─── PATCH /api/portfolio/:id/rollout — Rollout mode selector ────────────────

const rolloutSchema = z.object({
    rolloutMode: z.enum(['all', 'allowlistTenants', 'allowlistPlans']),
    allowlistTenants: z.array(z.string()).optional(),
    allowlistPlans: z.array(z.string()).optional(),
});

router.patch(
    '/:id/rollout',
    ...authPipeline,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestId = req.headers['x-request-id'] as string;
        const parsed = rolloutSchema.safeParse(req.body);

        if (!parsed.success) {
            next(createError(422, 'rolloutMode must be all | allowlistTenants | allowlistPlans'));
            return;
        }

        try {
            // Blueprint §7: Founder-only
            const membership = await prisma.membership.findUnique({
                where: { userId_tenantId: { userId: req.auth!.userId, tenantId: req.tenant!.id } },
            });
            if (!membership || membership.memberRole !== 'owner') {
                next(createError(403, 'Founder-only: cannot change rollout mode'));
                return;
            }

            const existing = await prisma.portfolioItem.findFirst({
                where: { id: req.params.id, tenantId: req.tenant!.id },
            });
            if (!existing) { next(createError(404, 'Portfolio item not found')); return; }

            const item = await prisma.portfolioItem.update({
                where: { id: existing.id },
                data: {
                    rolloutMode: parsed.data.rolloutMode,
                    allowlistTenants: parsed.data.allowlistTenants ?? existing.allowlistTenants,
                    allowlistPlans: parsed.data.allowlistPlans ?? existing.allowlistPlans,
                },
            });

            await writeAudit({
                tenantId: req.tenant!.id,
                actorId: req.auth!.userId,
                action: 'portfolio.rollout_change',
                resource: 'PortfolioItem',
                resourceId: item.id,
                meta: {
                    from: existing.rolloutMode,
                    to: item.rolloutMode,
                },
                requestId,
            });

            res.json({ item });
        } catch (err) {
            next(err);
        }
    },
);

export default router;

