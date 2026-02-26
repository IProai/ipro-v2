import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Phase 06: Seeding production-grade baseline...');

    const tenantSlug = 'ipro-demo';
    const founderEmail = 'founder@iprocore.com';
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 12);

    // 1. Create Tenant
    const tenant = await prisma.tenant.upsert({
        where: { slug: tenantSlug },
        update: {},
        create: {
            slug: tenantSlug,
            name: 'IProCore Demo Corp',
            plan: 'enterprise',
            isActive: true,
        },
    });

    // 2. Create Founder User
    const founder = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: founderEmail } },
        update: { passwordHash },
        create: {
            tenantId: tenant.id,
            email: founderEmail,
            passwordHash,
            isActive: true,
            locale: 'en',
            dir: 'ltr',
        },
    });

    // 3. Create Membership (Owner/Founder)
    await prisma.membership.upsert({
        where: { userId_tenantId: { userId: founder.id, tenantId: tenant.id } },
        update: { memberRole: 'owner' },
        create: {
            userId: founder.id,
            tenantId: tenant.id,
            memberRole: 'owner',
        },
    });

    // 4. Create Baseline Portfolio Item (Core Spine)
    await prisma.portfolioItem.upsert({
        where: { id: 'ipro-core-spine-001' },
        update: {},
        create: {
            id: 'ipro-core-spine-001',
            tenantId: tenant.id,
            name: 'Core Spine',
            type: 'platform',
            icon: 'Activity',
            descriptionEn: 'Intellect ProActive Core platform foundation.',
            descriptionAr: 'أساس منصة Intellect ProActive Core.',
            launchUrlProd: '/console/dashboard',
            ssoMode: 'handoff',
            version: '1.0.0',
            status: 'published',
            sortOrder: 0,
        },
    });

    console.log('✅ Baseline seeded!');
    console.log(`
    -------------------------------------------
    FOUNDER EMAIL : ${founderEmail}
    PASSWORD      : ${password}
    TENANT SLUG   : ${tenantSlug}
    -------------------------------------------
    `);
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
