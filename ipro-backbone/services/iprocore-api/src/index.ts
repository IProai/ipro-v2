import './lib/env'; // Validates env at startup — exits if invalid (Skill 04)
import express from 'express';
import { bootstrapAdmin } from './lib/bootstrap';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './lib/env';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import portfolioRouter from './routes/portfolio';
import launchRouter from './routes/launch';        // Phase 03: SSO launch
import dashboardRouter from './routes/dashboard';
import onboardingRouter from './routes/onboarding';
import helpRouter from './routes/help';
import securityRouter from './routes/security';    // Phase 03: role simulator
import aiRouter from './routes/ai';                // Phase 05: AI Assist
import { tenancyRouter } from './routes/tenancy';  // ✅ NEW: tenancy switching
import billingRouter from './routes/billing';      // Skill 04: entitlements

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('CORS: not allowed'), false);
            }
        },
        credentials: true, // needed for HttpOnly cookie refresh token
    }),
);

// ─── Body / cookie parsers ────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Observability ────────────────────────────────────────────────────────────
app.use(requestId);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);

// ✅ NEW: Tenancy endpoints
app.use('/api/tenancy', tenancyRouter);

app.use('/api/portfolio', portfolioRouter);
app.use('/api/portfolio', launchRouter);  // Phase 03: POST /:id/launch alongside portfolio routes
app.use('/api/dashboard', dashboardRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/help', helpRouter);
app.use('/api/security', securityRouter);  // Phase 03: role simulator
app.use('/api/ai', aiRouter);             // Phase 05: AI Assist + Playbooks
app.use('/api/billing', billingRouter);

// 404 catch-all — no route leakage
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// Must be last — safe errors, no stack traces in responses (Skill 02)
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
if (require.main === module) {
    // Import shared DB singleton for bootstrap (avoids creating a second PrismaClient)
    const { prisma } = require('./lib/db');

    // Run bootstrap before binding port — idempotent, non-fatal
    bootstrapAdmin(prisma).catch(() => {
        // Silent catch for bootstrap
    }).finally(() => {
        app.listen(env.PORT, () => {
            // Server started
        });
    });
}

export default app; // exported for testing