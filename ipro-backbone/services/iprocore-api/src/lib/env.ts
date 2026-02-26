import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 chars'),
    REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 chars'),
    /** Phase 03: separate secret for SSO handoff tokens issued to products */
    SSO_TOKEN_SECRET: z.string().min(32, 'SSO_TOKEN_SECRET must be at least 32 chars'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
    /** Phase 04: JAD Runtime service URL for health badge — optional, gracefully degraded if absent */
    JAD_RUNTIME_URL: z.string().url().optional(),
});

// Fails fast at boot — Skill 04: strict env validation
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error('❌ [ENV] Invalid environment variables:');
    console.error(_env.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = _env.data;
