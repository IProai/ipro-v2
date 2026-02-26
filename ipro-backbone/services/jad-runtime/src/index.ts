/**
 * JAD Runtime — Entry Point
 *
 * Boot sequence:
 *   1. Validate env (exits if invalid)
 *   2. Connect Prisma client
 *   3. Express middleware stack
 *   4. Route registration
 *   5. Start workflow runner (poll loop)
 *   6. Listen
 *
 * Blueprint §Skill 06: JAD = Execution Plane.
 * Runs separately from IProCore on PORT 3001.
 */

import './lib/env'; // validates env at startup — exits if invalid
import express from 'express';
import { env } from './lib/env';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { startWorkflowRunner } from './lib/workflow-runner';

import healthRouter from './routes/health';
import marketplaceRouter from './routes/marketplace';
import integrationsRouter from './routes/integrations';
import connectorsRouter from './routes/connectors';
import activationsRouter from './routes/activations';
import webhooksRouter from './routes/webhooks';
import jadHealthRouter from './routes/jadHealth';
import aiExecuteRouter from './routes/aiExecute';

const app = express();

// ─── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '512kb' }));

// ─── Observability ────────────────────────────────────────────────────────────
app.use(requestId);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/api/jad/marketplace', marketplaceRouter);
app.use('/api/jad/integrations', integrationsRouter);
app.use('/api/jad/connectors', connectorsRouter);
app.use('/api/jad/activations', activationsRouter);
app.use('/api/jad/webhooks', webhooksRouter);
app.use('/api/jad/health', jadHealthRouter);
app.use('/api/jad/ai', aiExecuteRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
if (require.main === module) {
    startWorkflowRunner();
    app.listen(env.PORT, () => {
        console.log(`✅ JAD Runtime running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
}

export default app; // exported for tests
