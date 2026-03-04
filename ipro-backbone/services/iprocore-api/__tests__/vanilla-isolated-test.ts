import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/index';

const TEST_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret-minimum-32-characters-long-for-tests';

// Helper to simulate switch-tenant response tokens
function makeToken(tenantId: string | null, userId: string): string {
    const payload: any = { userId, email: `${userId}@test.com` };
    if (tenantId) payload.activeTenantId = tenantId;
    return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

async function run() {
    try {
        console.log("---- STARTING TENANT ISOLATION DEMO ----");

        // Step 1: Login user A (Tenant T1) - simulated by obtaining Token 1
        console.log("1) Generating Token for User A in Tenant demo-tenant-uuid (T1)");
        // We use 'demo-tenant-uuid' since tenantResolver has a built-in demo bypass mock that succeeds
        const tokenT1 = makeToken('demo-tenant-uuid', 'userA');

        // Step 2: Access resource in T1 -> 200 OK
        console.log("2) Accessing Portfolio List in T1...");
        const resAccessT1 = await request(app)
            .get('/api/portfolio')
            .set('Authorization', `Bearer ${tokenT1}`);
        console.log(`   -> Status: ${resAccessT1.status}`);

        // Step 3: Switch to T2 -> Token updates
        console.log("3) Switching active context to Tenant T2...");
        const tokenT2 = makeToken('some-other-tenant', 'userA');

        // Step 4: Access T1 data while in T2 -> Must 403 (or 404/401 isolated)
        // Since 'some-other-tenant' is not 'demo-tenant-uuid' and DB is likely down or empty, it should fail tenantResolver
        console.log("4) Accessing Portfolio List with T2 token...");
        const resAccessT1withT2 = await request(app)
            .get('/api/portfolio')
            .set('Authorization', `Bearer ${tokenT2}`);
        console.log(`   -> Status: ${resAccessT1withT2.status} (Body: ${JSON.stringify(resAccessT1withT2.body)})`);

        // Step 5: Attempt request without activeTenantId -> Must fail
        console.log("5) Attempting request WITHOUT activeTenantId context...");
        const tokenNoTenant = makeToken(null, 'userA');
        const resNoTenant = await request(app)
            .get('/api/portfolio')
            .set('Authorization', `Bearer ${tokenNoTenant}`);
        console.log(`   -> Status: ${resNoTenant.status} (Body: ${JSON.stringify(resNoTenant.body)})`);

        console.log("---- DEMO COMPLETE ----");
        process.exit(0);
    } catch (e) {
        console.error("Test execution failed:", e);
        process.exit(1);
    }
}

run();
