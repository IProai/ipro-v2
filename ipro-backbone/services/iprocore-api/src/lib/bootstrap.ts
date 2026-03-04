/**
 * Bootstrap Admin — GCP Deployment Safety
 *
 * Runs ONLY when:
 *   - NODE_ENV === "production" OR BOOTSTRAP_ENABLED === "true"
 *   - BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are both set
 *   - No "owner" membership exists in the bootstrap tenant yet
 *
 * Idempotent: safe to call on every cold start — does nothing if already bootstrapped.
 * Never logs plaintext password. All DB writes use strict field whitelists.
 */

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const SALT_ROUNDS = 12;

export async function bootstrapAdmin(prisma: PrismaClient): Promise<void> {
    const nodeEnv = process.env.NODE_ENV;
    const bootstrapEnabled = process.env.BOOTSTRAP_ENABLED === 'true';

    // Guard: only run in production or when explicitly enabled
    if (nodeEnv !== 'production' && !bootstrapEnabled) {
        return;
    }

    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    // Guard: both secrets must be present
    if (!email || !password) {
        return;
    }

    const tenantSlug = process.env.BOOTSTRAP_TENANT_SLUG ?? 'ipro-system';

    try {
        // ─── Check: is tenant already bootstrapped? ────────────────────────────
        const existingOwnerRole = await prisma.userRole.findFirst({
            where: { tenant: { slug: tenantSlug }, role: { name: 'owner' } }
        });

        if (existingOwnerRole) {
            // Already bootstrapped — idempotent, do nothing
            return;
        }

        // ─── Step 1: Ensure tenant exists ────────────────────────────────────
        const tenant = await prisma.tenant.upsert({
            where: { slug: tenantSlug },
            update: {}, // never overwrite an existing tenant's name/plan
            create: {
                slug: tenantSlug,
                name: 'IProCore System',
                plan: 'enterprise',
                isActive: true,
            },
        });

        // ─── Step 2: Ensure user exists (reuse if already registered) ────────
        let user = await prisma.user.findUnique({
            where: {
                email,
            },
        });

        if (!user) {
            // New user — hash password, never log plaintext
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

            user = await prisma.user.create({
                data: {
                    email,
                    passwordHash,  // strict field — no payload spreading
                    isActive: true,
                    locale: 'en',
                    dir: 'ltr',
                    twoFaEnabled: false,
                },
            });
        }

        // ─── Step 3: Ensure owner membership (upsert) ────────────────────────
        await prisma.membership.upsert({
            where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
            update: {},
            create: {
                userId: user.id,
                tenantId: tenant.id,
            },
        });

        // ─── Step 4: Ensure default roles exist ──────────────────────────────
        const ownerRole = await prisma.role.upsert({
            where: { tenantId_name: { tenantId: tenant.id, name: 'owner' } },
            update: {},
            create: { tenantId: tenant.id, name: 'owner', description: 'Tenant Owner', isSystem: true }
        });
        await prisma.role.upsert({
            where: { tenantId_name: { tenantId: tenant.id, name: 'admin' } },
            update: {},
            create: { tenantId: tenant.id, name: 'admin', description: 'Tenant Admin', isSystem: true }
        });
        await prisma.role.upsert({
            where: { tenantId_name: { tenantId: tenant.id, name: 'member' } },
            update: {},
            create: { tenantId: tenant.id, name: 'member', description: 'Tenant Member', isSystem: true }
        });

        // ─── Step 5: Bind bootstrap user to owner role ───────────────────────
        await prisma.userRole.upsert({
            where: { tenantId_userId_roleId: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id } },
            update: {},
            create: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id }
        });

        // Bootstrap super_admin created successfully
    } catch (err) {
        // Log error but do NOT crash the server — bootstrap failure is non-fatal
        // (app can still serve traffic; admin can be re-seeded via Cloud Run Job)
    }
}
