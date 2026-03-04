import { prisma } from '../lib/db';

/**
 * Entitlement Service for enforcing billing and feature usage limits.
 * Operates independently of Stripe by looking at strictly local tables:
 * Subscription, Entitlement, UsageCounter.
 */

export async function getSubscription(tenantId: string) {
    return prisma.subscription.findUnique({
        where: { tenantId }
    });
}

export async function getEntitlement(plan: string, featureKey: string) {
    return prisma.entitlement.findUnique({
        where: { plan_featureKey: { plan, featureKey } }
    });
}

export async function getUsage(tenantId: string, featureKey: string) {
    const counter = await prisma.usageCounter.findUnique({
        where: { tenantId_featureKey: { tenantId, featureKey } }
    });
    return counter?.used ?? 0;
}

export async function incrementUsage(tenantId: string, featureKey: string, inc = 1) {
    return prisma.usageCounter.upsert({
        where: { tenantId_featureKey: { tenantId, featureKey } },
        update: { used: { increment: inc } },
        create: { tenantId, featureKey, used: inc }
    });
}

export async function assertEntitled(tenantId: string, featureKey: string): Promise<void> {
    const sub = await getSubscription(tenantId);

    // First, verify a valid subscription exists
    if (!sub || (sub.status !== 'ACTIVE' && sub.status !== 'TRIAL')) {
        const error: any = new Error('ENTITLEMENT_NO_SUBSCRIPTION');
        error.code = 'ENTITLEMENT_NO_SUBSCRIPTION';
        throw error;
    }

    // Secondary layer: enforce individual feature limit mapping based on the plan string
    const entitlement = await getEntitlement(sub.plan, featureKey);
    if (!entitlement) {
        // Strict failure if the feature key is not even mapped to the plan
        const error: any = new Error('ENTITLEMENT_FEATURE_BLOCKED');
        error.code = 'ENTITLEMENT_FEATURE_BLOCKED';
        throw error;
    }

    // Tertiary layer: limits based on usage counters
    if (entitlement.limit !== null) {
        const usage = await getUsage(tenantId, featureKey);
        if (usage >= entitlement.limit) {
            const error: any = new Error('ENTITLEMENT_LIMIT_REACHED');
            error.code = 'ENTITLEMENT_LIMIT_REACHED';
            throw error;
        }
    }
}
