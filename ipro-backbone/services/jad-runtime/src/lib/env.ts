/**
 * JAD Runtime — Environment Validation
 *
 * Validates all required environment variables at boot.
 * Process exits if any required var is missing or malformed.
 * NEVER logs secret values.
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    JAD_DATABASE_URL: z.string().url().min(10),
    JAD_IPROCORE_ACCESS_SECRET: z.string().min(32),
    JAD_IPROCORE_SHARED_SECRET: z.string().min(32),
    IPROCORE_AUDIT_URL: z.string().url(),
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function validateEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('[JAD] Environment validation failed:');
        result.error.errors.forEach((e) => {
            console.error(`  ${e.path.join('.')}: ${e.message}`);
        });
        process.exit(1);
    }
    return result.data;
}

export const env = validateEnv();
