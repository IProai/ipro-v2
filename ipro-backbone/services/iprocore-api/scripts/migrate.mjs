/**
 * Canonical Migration Script — IProCore
 * 
 * Verifies environment, runs Prisma migrate deploy, and ensures clear logging.
 * Exits with 0 on success, 1 on failure.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');

async function runMigrate() {
    console.log('🚀 [MIGRATE] Starting canonical migration sequence...');

    // 1. Verify DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ [MIGRATE] Error: DATABASE_URL is not set.');
        process.exit(1);
    }

    if (!dbUrl.includes('sslmode=require') && process.env.NODE_ENV === 'production') {
        console.warn('⚠️ [MIGRATE] Warning: DATABASE_URL is missing sslmode=require in production.');
    }

    // 2. Clear logs for security
    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`📡 [MIGRATE] Using database: ${maskedUrl}`);
    console.log(`📄 [MIGRATE] Schema path: ${SCHEMA_PATH}`);

    try {
        // 3. Run Prisma Migrate Deploy
        console.log('⚙️ [MIGRATE] Running prisma migrate deploy...');

        // Use npx prisma migrate deploy --schema=...
        // We run it with inherit stdio so user sees prisma's native progress
        execSync(`npx prisma migrate deploy --schema=${SCHEMA_PATH}`, {
            stdio: 'inherit',
            env: process.env
        });

        console.log('✅ [MIGRATE] Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ [MIGRATE] Migration failed!');
        if (error.message) {
            console.error(error.message);
        }
        process.exit(1);
    }
}

runMigrate().catch((err) => {
    console.error('💥 [MIGRATE] Fatal error:', err);
    process.exit(1);
});
