import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { writeAudit } from '../lib/audit';
import { requireAuth } from '../middleware/requireAuth';
import { tenantResolver } from '../middleware/tenantResolver';

const router = Router();
router.use(requireAuth, tenantResolver);

// ─── Default steps seeded for a new tenant ───────────────────────────────────
const DEFAULT_STEPS = [
    { key: 'complete_profile', titleEn: 'Complete your profile', titleAr: 'أكمل ملفك الشخصي', order: 1 },
    { key: 'add_portfolio_item', titleEn: 'Add first portfolio item', titleAr: 'أضف أول عنصر في المحفظة', order: 2 },
    { key: 'invite_team_member', titleEn: 'Invite a team member', titleAr: 'ادعُ عضوًا في الفريق', order: 3 },
    { key: 'connect_product', titleEn: 'Connect your first product', titleAr: 'اربط منتجك الأول', order: 4 },
];

/**
 * GET /api/onboarding/steps
 * Returns ordered onboarding steps for the authenticated tenant.
 * Seeds default steps if none exist yet.
 */
router.get('/steps', async (req, res, next) => {
    try {
        const { tenantId } = req.auth!;

        let steps = await prisma.onboardingStep.findMany({
            where: { tenantId },
            orderBy: { order: 'asc' },
        });

        // Seed defaults for brand-new tenants (idempotent upsert)
        if (steps.length === 0) {
            await prisma.onboardingStep.createMany({
                data: DEFAULT_STEPS.map((s) => ({ ...s, tenantId, titleAr: s.titleAr })),
                skipDuplicates: true,
            });
            steps = await prisma.onboardingStep.findMany({
                where: { tenantId },
                orderBy: { order: 'asc' },
            });
        }

        return res.json({ steps });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/onboarding/steps/:key/complete
 * Mark an onboarding step as complete. Idempotent — completing twice is safe.
 * Writes AuditLog per Blueprint §Audit.
 */
const completeSchema = z.object({
    key: z.string().min(1).max(120),
});

router.post('/steps/:key/complete', async (req, res, next) => {
    try {
        const { tenantId, userId } = req.auth!;
        const parsed = completeSchema.safeParse({ key: req.params.key });
        if (!parsed.success) return res.status(400).json({ error: 'Invalid step key' });

        const { key } = parsed.data;

        const step = await prisma.onboardingStep.findUnique({
            where: { tenantId_key: { tenantId, key } },
        });
        if (!step) return res.status(404).json({ error: 'Step not found' });

        if (step.completedAt) {
            // Already complete — idempotent
            return res.json({ step, alreadyComplete: true });
        }

        const updated = await prisma.onboardingStep.update({
            where: { tenantId_key: { tenantId, key } },
            data: { completedAt: new Date() },
        });

        await writeAudit({
            tenantId,
            actorId: userId,
            action: 'onboarding.step.complete',
            resource: 'OnboardingStep',
            resourceId: step.id,
            meta: { key },
            requestId: req.headers['x-request-id'] as string,
        });

        return res.json({ step: updated });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/onboarding/wizard
 * Returns wizard state: current step index, completion status.
 */
router.get('/wizard', async (req, res, next) => {
    try {
        const { tenantId } = req.auth!;

        const steps = await prisma.onboardingStep.findMany({
            where: { tenantId },
            orderBy: { order: 'asc' },
            select: { key: true, titleEn: true, titleAr: true, order: true, completedAt: true, isRequired: true },
        });

        const currentStep = steps.find((s: { completedAt: Date | null }) => !s.completedAt);
        const allComplete = steps.every((s: { completedAt: Date | null }) => s.completedAt !== null);

        return res.json({ steps, currentStep: currentStep ?? null, allComplete });
    } catch (err) {
        next(err);
    }
});

export default router;
