import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const tenantSlug = 'alpha-corp';
    const email = 'admin@alphacorp.com';
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 12);

    console.log('🌱 Seeding test user...');

    // 1. Create Tenant
    const tenant = await prisma.tenant.upsert({
        where: { slug: tenantSlug },
        update: {},
        create: {
            slug: tenantSlug,
            name: 'Alpha Corporation',
            plan: 'enterprise',
            isActive: true,
        }
    });

    // 2. Create User
    const user = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email } },
        update: { passwordHash },
        create: {
            tenantId: tenant.id,
            email,
            passwordHash,
            isActive: true,
            locale: 'en',
            dir: 'ltr',
        }
    });

    // 3. Create Membership
    await prisma.membership.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
        update: {},
        create: {
            userId: user.id,
            tenantId: tenant.id,
            memberRole: 'admin',
        }
    });

    console.log('✅ Test user created successfully!');
    console.log(`
    -------------------------------------------
    TENANT SLUG : ${tenantSlug}
    EMAIL       : ${email}
    PASSWORD    : ${password}
    -------------------------------------------
    `);
}

main()
    .catch(e => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
