# IProCore Production Review Checklist

## Focus Areas Reviewed

1. **Env Var Safety**
   - **Current State**: Strong. `zod` validation is enforced at startup (`src/lib/env.ts`), strictly checking for necessary keys. Requires `sslmode=require` in production.
   - **Action Taken**: None required.

2. **Secrets Handling**
   - **Current State**: Strong. Secrets are mounted securely via GCP Secret Manager in Cloud Run (`deploy/iprocore-api-staging.service.yaml`).
   - **Action Taken**: None required.

3. **DB Connection Pooling**
   - **Current State**: Prisma uses default pooling behavior per instance, which risks connection exhaustion during Cloud Run scale-outs.
   - **Action Taken**: Added `connection_limit=5` parameter dynamically in `src/lib/db.ts` to `DATABASE_URL` (if missing) to set a low, predictable cap on per-instance DB connections. Avoids the immediate need for PgBouncer while preventing Postgres exhaustion.

4. **Timeouts & Graceful Shutdown**
   - **Current State**: Cloud Run was configured to terminate the instance abruptly on scale-in, potentially dropping active requests.
   - **Action Taken**: Added graceful shutdown handling to `src/index.ts`. Listens for `SIGTERM`/`SIGINT`, closes the HTTP server, properly invokes `prisma.$disconnect()`, and forces a fallback timeout if connections hang.

5. **Logging**
   - **Current State**: Errors inside `bootstrapAdmin` were silently caught.
   - **Action Taken**: Updated the `.catch()` block on `bootstrapAdmin` in `src/index.ts` to output `console.error` for better visibility during deployment.

6. **Health Checks**
   - **Current State**: Existing `/api/health` endpoint correctly probes DB and handles Cloud Run load balancer 5xx policies. Startup and Liveness probes correctly target this in the Cloud Run configuration.
   - **Action Taken**: None required.

7. **Migrations Safety**
   - **Current State**: `deploy/iprocore-migrate.job.yaml` correctly runs `npm run db:migrate:prod`, enforcing independent migration execution without restarting the application.
   - **Action Taken**: None required.

8. **Cost-Friendly Defaults**
   - **Current State**: The staging configuration was configured for a permanent warm instance (`minScale: "1"`), leading to continuous costs.
   - **Action Taken**: Updated `deploy/iprocore-api-staging.service.yaml` to set `autoscaling.knative.dev/minScale: "0"`.

---

## Risks and Tests

**Risks Added/Updated:**
- **Graceful Shutdown Fallback:** The server shuts down after a hard 10-second limit during scaling events. This risks interrupting long-running connections (e.g., streaming) if they are incomplete.
- **Connection Limit Cap:** Each instance limits DB connections to 5. High concurrent throughput per container might result in application-side throttling due to the connection pool constraint.

**Tests:**
- Ran existing unit and integration tests under `services/iprocore-api/` to ensure structural integrity post-changes.
- Manually verified code syntax to prevent run-time errors on `process.env` updates.